import express, { Request, Response } from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';
import { vetSingleProduct, processQueueWithConcurrency } from './services/scraperQueue.js';
import { importAmazonWishlist } from './services/wishlistImporter.js';
import { evaluateDeal } from './services/vettingEngine.js';
import { warmUpCccWorker } from './services/cccScraper.js';
import { VettedProduct, ScrapeProgressEvent } from './types.js';

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = process.env.PORT || 5001;

app.use(cors({ origin: '*' }));
app.use(express.json({ limit: '10mb' }));

// Health Check
app.get('/api/health', (_req: Request, res: Response) => {
  res.json({
    status: 'ok',
    service: 'CamelScout Pro API',
    version: '1.1.0',
    timestamp: new Date().toISOString()
  });
});

// Single Product Vetting
app.post('/api/vet-single', async (req: Request, res: Response) => {
  try {
    const { input, threshold = 12 } = req.body;
    if (!input || typeof input !== 'string') {
      res.status(400).json({ success: false, error: 'Valid input string (URL, ASIN, or name) is required' });
      return;
    }

    const product = await vetSingleProduct(input, Number(threshold));
    res.json({
      success: true,
      product
    });
  } catch (error: any) {
    console.error('Error in /api/vet-single:', error);
    res.status(500).json({
      success: false,
      error: error.message || 'Internal error vetting product'
    });
  }
});

// Multi-Item Wishlist Vetting (Synchronous JSON)
app.post('/api/vet-wishlist', async (req: Request, res: Response) => {
  try {
    const { items, threshold = 12 } = req.body;
    if (!Array.isArray(items) || items.length === 0) {
      res.status(400).json({ success: false, error: 'Array of items is required' });
      return;
    }

    const cleanItems = items.map((i: any) => String(i).trim()).filter(Boolean);
    if (cleanItems.length === 0) {
      res.status(400).json({ success: false, error: 'No valid non-empty items provided' });
      return;
    }

    const products = await processQueueWithConcurrency(cleanItems, Number(threshold), undefined, 2);
    res.json({
      success: true,
      count: products.length,
      products
    });
  } catch (error: any) {
    console.error('Error in /api/vet-wishlist:', error);
    res.status(500).json({
      success: false,
      error: error.message || 'Internal error processing wishlist'
    });
  }
});

// Real-Time SSE Stream for Wishlist / Bulk Vetting
app.post('/api/vet-stream', async (req: Request, res: Response) => {
  const { items, threshold = 12 } = req.body;

  if (!Array.isArray(items) || items.length === 0) {
    res.status(400).json({ error: 'Array of items is required' });
    return;
  }

  const cleanItems = items.map((i: any) => String(i).trim()).filter(Boolean);

  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Connection', 'keep-alive');
  res.flushHeaders?.();

  const sendEvent = (event: ScrapeProgressEvent) => {
    res.write(`data: ${JSON.stringify(event)}\n\n`);
  };

  try {
    sendEvent({
      step: 0,
      totalSteps: 4,
      stage: 'resolving',
      message: `Starting zero-mismatch scan for ${cleanItems.length} items...`,
      totalItems: cleanItems.length
    });

    const products = await processQueueWithConcurrency(
      cleanItems,
      Number(threshold),
      (event) => sendEvent(event),
      2
    );

    if (cleanItems.length > 1 && products.length > 0) {
      sendEvent({
        step: 4,
        totalSteps: 4,
        stage: 'done',
        message: `Completed scan for all ${products.length} items.`,
        totalItems: cleanItems.length
      });
    }

    res.write('event: complete\ndata: {"status":"complete"}\n\n');
    res.end();
  } catch (err: any) {
    console.error('Error in /api/vet-stream:', err);
    sendEvent({
      step: 4,
      totalSteps: 4,
      stage: 'error',
      message: err.message || 'Stream processing encountered an error'
    });
    res.end();
  }
});

// Import Amazon Wishlist from Public URL
app.post('/api/import-wishlist-url', async (req: Request, res: Response) => {
  try {
    const { wishlistUrl } = req.body;
    if (!wishlistUrl || typeof wishlistUrl !== 'string') {
      res.status(400).json({ success: false, error: 'A valid Amazon Wishlist URL is required' });
      return;
    }

    const items = await importAmazonWishlist(wishlistUrl);
    res.json({
      success: true,
      count: items.length,
      items
    });
  } catch (error: any) {
    console.error('Error in /api/import-wishlist-url:', error);
    res.status(400).json({
      success: false,
      error: error.message || 'Failed to import Amazon wishlist URL'
    });
  }
});

// Dynamic Re-evaluate without re-scraping
app.post('/api/re-evaluate', (req: Request, res: Response) => {
  try {
    const { products, threshold = 12 } = req.body;
    if (!Array.isArray(products)) {
      res.status(400).json({ success: false, error: 'products array is required' });
      return;
    }

    const reEvaluated: VettedProduct[] = products.map((p: VettedProduct) => {
      const newVerdict = evaluateDeal(p.currentPrice, p.listPrice, p.historical, Number(threshold));
      return {
        ...p,
        verdict: newVerdict
      };
    });

    res.json({
      success: true,
      products: reEvaluated
    });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// Same-Origin Chart Image Proxy (Bypasses any cross-origin or tracking-protection image blocks)
app.get('/api/chart-proxy', async (req: Request, res: Response) => {
  try {
    const asin = String(req.query.asin || '').toUpperCase();
    const tp = String(req.query.tp || 'all');
    if (!/^[A-Z0-9]{10}$/.test(asin)) {
      res.status(400).send('Invalid ASIN');
      return;
    }

    const remoteUrl = `https://charts.camelcamelcamel.com/us/${asin}/amazon-new-used.png?force=1&zero=0&w=855&h=513&desired=false&legend=1&ilt=1&tp=${tp}&fo=0&lang=en`;
    let upstreamRes = await fetch(remoteUrl);
    if (!upstreamRes.ok) {
      upstreamRes = await fetch(remoteUrl, { headers: { 'User-Agent': 'curl/8.7.1', 'Accept': '*/*' } });
    }

    if (!upstreamRes.ok) {
      res.status(upstreamRes.status).send('Chart not found');
      return;
    }

    const buf = Buffer.from(await upstreamRes.arrayBuffer());
    res.setHeader('Content-Type', 'image/png');
    res.setHeader('Cache-Control', 'public, max-age=3600');
    res.send(buf);
  } catch (err: any) {
    res.status(500).send(err.message || 'Error proxying chart');
  }
});

// Serve frontend static build if present
const clientDistPath = path.resolve(__dirname, '../../client/dist');
if (fs.existsSync(clientDistPath)) {
  app.use(express.static(clientDistPath));
  app.get('*', (req: Request, res: Response) => {
    if (!req.path.startsWith('/api')) {
      res.sendFile(path.join(clientDistPath, 'index.html'));
    }
  });
}

app.listen(PORT, () => {
  console.log(`🚀 CamelScout Pro Server running on http://localhost:${PORT}`);
  warmUpCccWorker();
});
