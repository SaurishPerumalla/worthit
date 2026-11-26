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
import { checkAndConsumeQuota, getSubscriptionQuotaStatus } from './services/subscriptionGuard.js';
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
    serperEnabled: Boolean(process.env.SERPER_API_KEY?.trim()),
    timestamp: new Date().toISOString()
  });
});

function isValidProductInput(raw: unknown): raw is string {
  if (typeof raw !== 'string') return false;
  const trimmed = raw.trim();
  return trimmed.length >= 2 && /[a-zA-Z0-9]/.test(trimmed);
}

function clampThreshold(raw: unknown): number {
  const n = Number(raw);
  if (!Number.isFinite(n)) return 12;
  return Math.min(90, Math.max(1, n));
}

// Subscription & Daily Quota Status
app.get('/api/subscription-status', async (req: Request, res: Response) => {
  const status = await getSubscriptionQuotaStatus(req);
  res.json({ success: true, ...status });
});

// Single Product Vetting
app.post('/api/vet-single', async (req: Request, res: Response) => {
  try {
    const { input, threshold = 12, stores } = req.body || {};
    if (!isValidProductInput(input)) {
      res.status(400).json({
        success: false,
        error: 'Please enter a valid product name (at least 2 characters), Amazon link, or ASIN.'
      });
      return;
    }

    const requestedStores = Array.isArray(stores) ? stores.map((s: any) => String(s).trim()).filter(Boolean) : undefined;
    const quota = await checkAndConsumeQuota(req, requestedStores);
    if (!quota.allowed) {
      res.status(402).json({
        success: false,
        code: 'FREE_LIMIT_REACHED',
        error: quota.error,
        remaining: quota.remaining,
        limit: quota.limit
      });
      return;
    }

    const product = await vetSingleProduct(input.trim(), clampThreshold(threshold), undefined, 0, 1, quota.effectiveStores);
    res.json({
      success: true,
      product,
      quota: {
        isPro: quota.isPro,
        remaining: quota.remaining,
        limit: quota.limit
      }
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
    const { items, threshold = 12, stores } = req.body || {};
    if (!Array.isArray(items) || items.length === 0) {
      res.status(400).json({ success: false, error: 'Please provide at least one product to check.' });
      return;
    }

    const cleanItems = items.map((i: any) => String(i ?? '').trim()).filter(isValidProductInput);
    if (cleanItems.length === 0) {
      res.status(400).json({ success: false, error: 'No valid non-empty product names, links, or ASINs were provided.' });
      return;
    }

    const requestedStores = Array.isArray(stores) ? stores.map((s: any) => String(s).trim()).filter(Boolean) : undefined;
    const quota = await checkAndConsumeQuota(req, requestedStores);
    if (!quota.allowed) {
      res.status(402).json({
        success: false,
        code: 'FREE_LIMIT_REACHED',
        error: quota.error,
        remaining: quota.remaining,
        limit: quota.limit
      });
      return;
    }

    const products = await processQueueWithConcurrency(cleanItems, clampThreshold(threshold), undefined, 2, quota.effectiveStores);
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
  const { items, threshold = 12, stores } = req.body || {};
  const requestedStores = Array.isArray(stores) ? stores.map((s: any) => String(s).trim()).filter(Boolean) : undefined;

  if (!Array.isArray(items) || items.length === 0) {
    res.status(400).json({ error: 'Please provide at least one product to check.' });
    return;
  }

  const cleanItems = items.map((i: any) => String(i ?? '').trim()).filter(isValidProductInput);
  if (cleanItems.length === 0) {
    res.status(400).json({ error: 'Please enter a valid product name (at least 2 characters), Amazon link, or ASIN.' });
    return;
  }

  const quota = await checkAndConsumeQuota(req, requestedStores);
  if (!quota.allowed) {
    res.status(402).json({
      success: false,
      code: 'FREE_LIMIT_REACHED',
      error: quota.error,
      remaining: quota.remaining,
      limit: quota.limit
    });
    return;
  }
  const selectedStores = quota.effectiveStores;

  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache, no-transform');
  res.setHeader('Connection', 'keep-alive');
  res.setHeader('X-Accel-Buffering', 'no');
  res.flushHeaders?.();

  const sendEvent = (event: ScrapeProgressEvent) => {
    if (!res.writableEnded) {
      res.write(`data: ${JSON.stringify(event)}\n\n`);
    }
  };

  // Keep SSE connection alive across mobile Safari / cloud proxies
  const heartbeat = setInterval(() => {
    if (!res.writableEnded) {
      res.write(': keepalive\n\n');
    }
  }, 12000);

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
      clampThreshold(threshold),
      (event) => sendEvent(event),
      2,
      selectedStores
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

    clearInterval(heartbeat);
    if (!res.writableEnded) {
      res.write('event: complete\ndata: {"status":"complete"}\n\n');
      res.end();
    }
  } catch (err: any) {
    clearInterval(heartbeat);
    console.error('Error in /api/vet-stream:', err);
    sendEvent({
      step: 4,
      totalSteps: 4,
      stage: 'error',
      message: err.message || 'Stream processing encountered an error'
    });
    if (!res.writableEnded) {
      res.end();
    }
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

// App Store Legal Pages (Privacy Policy & Terms of Use / EULA)
app.get('/privacy', (_req: Request, res: Response) => {
  res.setHeader('Content-Type', 'text/html; charset=utf-8');
  res.send(`<!DOCTYPE html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>DealChaser Privacy Policy</title><style>body{font-family:-apple-system,BlinkMacSystemFont,sans-serif;max-width:720px;margin:40px auto;padding:0 20px;line-height:1.6;color:#e2e8f0;background:#020617}h1,h2{color:#10b981}</style></head><body><h1>DealChaser Privacy Policy</h1><p>Last updated: November 2026</p><p>DealChaser respects your privacy. We do not require account registration, and we do not sell your personal information.</p><h2>Data We Process</h2><ul><li><strong>Product Queries:</strong> Search terms and URLs you enter are sent to our server solely to look up live prices and historical price charts.</li><li><strong>Anonymous Device Identifier:</strong> A random anonymous device ID is stored locally on your device to enforce daily Free tier limits and verify your DealChaser Pro subscription status via RevenueCat and Apple StoreKit.</li></ul><h2>Subscriptions</h2><p>Subscriptions are processed securely by Apple via the App Store. Payment and billing details are never accessible to DealChaser.</p><h2>Contact</h2><p>For support or privacy questions, contact the developer through the DealChaser App Store support link.</p></body></html>`);
});

app.get('/terms', (_req: Request, res: Response) => {
  res.setHeader('Content-Type', 'text/html; charset=utf-8');
  res.send(`<!DOCTYPE html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>DealChaser Terms of Use</title><style>body{font-family:-apple-system,BlinkMacSystemFont,sans-serif;max-width:720px;margin:40px auto;padding:0 20px;line-height:1.6;color:#e2e8f0;background:#020617}h1,h2{color:#10b981}</style></head><body><h1>DealChaser Terms of Use</h1><p>Last updated: November 2026</p><h2>DealChaser Pro Subscription</h2><ul><li><strong>Subscription Title:</strong> DealChaser Pro Monthly</li><li><strong>Price:</strong> $3.99/month (or local App Store equivalent shown at purchase)</li><li><strong>Auto-Renewal:</strong> Payment is charged to your Apple ID account at confirmation of purchase. Subscription automatically renews unless canceled at least 24 hours before the end of the current period.</li><li><strong>Managing &amp; Canceling:</strong> You can manage or cancel your subscription anytime in your Apple ID Account Settings after purchase.</li></ul><h2>Disclaimer</h2><p>Prices and availability are fetched from third-party retailers and may change at checkout. Always confirm the final price on the retailer's site before purchasing.</p></body></html>`);
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
