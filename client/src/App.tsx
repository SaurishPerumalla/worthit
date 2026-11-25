import React, { useState, useEffect } from 'react';
import { Header } from './components/Header.js';
import { InputHub } from './components/InputHub.js';
import { ProgressBar } from './components/ProgressBar.js';
import { SummaryDashboard } from './components/SummaryDashboard.js';
import { ProductCard } from './components/ProductCard.js';
import { InfoTile } from './components/InfoTile.js';
import { VettedProduct, ScrapeProgressEvent } from './types.js';
import { reEvaluateProducts } from './utils/evaluator.js';
import { apiUrl } from './utils/api.js';
import { AlertCircle, ShoppingCart, RefreshCw } from 'lucide-react';

export const App: React.FC = () => {
  const [darkMode, setDarkMode] = useState<boolean>(() => {
    const saved = localStorage.getItem('pricesentry_theme') || localStorage.getItem('worthit_theme') || localStorage.getItem('deal_digger_theme');
    if (saved !== null) {
      return saved === 'dark';
    }
    return true; // default to dark
  });
  const [products, setProducts] = useState<VettedProduct[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [progress, setProgress] = useState<ScrapeProgressEvent | null>(null);
  const [strictnessThreshold, setStrictnessThreshold] = useState<number>(12);
  const [showApprovedOnly, setShowApprovedOnly] = useState<boolean>(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  // Sync dark class on root document and persist in localStorage
  useEffect(() => {
    localStorage.setItem('pricesentry_theme', darkMode ? 'dark' : 'light');
    if (darkMode) {
      document.documentElement.classList.add('dark');
    } else {
      document.documentElement.classList.remove('dark');
    }
  }, [darkMode]);

  // When strictness threshold slider changes, immediately re-evaluate all products
  useEffect(() => {
    if (products.length > 0) {
      setProducts(prev => reEvaluateProducts(prev, strictnessThreshold));
    }
  }, [strictnessThreshold]);

  // Pre-warm backend on mount so free-tier cloud servers wake up before the user submits
  useEffect(() => {
    fetch(apiUrl('/api/health')).catch(() => {});
  }, []);

  /**
   * Validates a single product query / Amazon URL / ASIN before sending to the backend.
   */
  const validateSingleQuery = (raw: string): { valid: boolean; cleaned: string; error?: string } => {
    const cleaned = raw.trim();
    if (!cleaned) {
      return { valid: false, cleaned: '', error: 'Please enter a product name, Amazon link, or ASIN.' };
    }
    if (cleaned.length < 2 || !/[a-zA-Z0-9]/.test(cleaned)) {
      return { valid: false, cleaned, error: 'Please enter a recognizable product name (at least 2 characters), Amazon link, or ASIN.' };
    }
    if (/^https?:\/\//i.test(cleaned) && !/(amazon\.|a\.co|amzn\.)/i.test(cleaned)) {
      return { valid: false, cleaned, error: 'Please paste an Amazon link, 10-character ASIN, or type a product name.' };
    }
    return { valid: true, cleaned };
  };

  /**
   * Converts raw browser network/stream errors (such as Safari's "Load failed") into helpful messages.
   */
  const formatUserError = (err: any, fallback: string): string => {
    const msg = String(err?.message || '').trim();
    if (!msg || /load failed|failed to fetch|networkerror|network request failed|aborted/i.test(msg)) {
      return 'Connection was interrupted while checking the deal (the server may be waking up). Please try again.';
    }
    return msg || fallback;
  };

  /**
   * Standard JSON fallback when iOS Safari / proxies drop an SSE ReadableStream.
   */
  const fallbackJsonVet = async (items: string[], options: { prepend: boolean }): Promise<void> => {
    setProgress({
      step: 2,
      totalSteps: 4,
      stage: 'amazon_fetch',
      message: `[2/4] Fetching live price & history...`,
      totalItems: items.length,
      itemIndex: 0
    });

    if (items.length === 1) {
      const res = await fetch(apiUrl('/api/vet-single'), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ input: items[0], threshold: strictnessThreshold })
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok || !data.success || !data.product) {
        throw new Error(data.error || `Request failed (HTTP ${res.status})`);
      }
      const prod: VettedProduct = data.product;
      setProgress({
        step: 4,
        totalSteps: 4,
        stage: 'done',
        message: `[4/4] Deal verdict calculated`,
        product: prod
      });
      setProducts(prev => {
        const filtered = prev.filter(p => p.asin !== prod.asin);
        return options.prepend ? [prod, ...filtered] : [...filtered, prod];
      });
      return;
    }

    const res = await fetch(apiUrl('/api/vet-wishlist'), {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ items, threshold: strictnessThreshold })
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok || !data.success || !Array.isArray(data.products)) {
      throw new Error(data.error || `Request failed (HTTP ${res.status})`);
    }
    if (data.products.length === 0) {
      throw new Error('Could not find matching Amazon products for the provided items.');
    }
    setProducts(prev => {
      const incoming = data.products as VettedProduct[];
      const incomingAsins = new Set(incoming.map(p => p.asin));
      const remaining = prev.filter(p => !incomingAsins.has(p.asin));
      return [...remaining, ...incoming];
    });
  };

  /**
   * Streams real-time SSE vetting progress for single-item and wishlist scans,
   * with automatic fallback to standard JSON endpoints if iOS Safari drops the stream.
   */
  const streamVetItems = async (items: string[], options: { prepend: boolean }) => {
    const validItems = items
      .map(i => i.trim())
      .filter(i => i.length >= 2 && /[a-zA-Z0-9]/.test(i));

    if (validItems.length === 0) {
      setErrorMessage('Please enter a valid product name, Amazon link, or ASIN.');
      return;
    }

    setIsLoading(true);
    setErrorMessage(null);
    setProgress({
      step: 1,
      totalSteps: 4,
      stage: 'resolving',
      message: `[1/4] Identifying product...`,
      totalItems: validItems.length,
      itemIndex: 0
    });

    let receivedProductCount = 0;
    let streamError: string | null = null;

    try {
      const response = await fetch(apiUrl('/api/vet-stream'), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ items: validItems, threshold: strictnessThreshold })
      });

      if (!response.ok) {
        const errBody = await response.json().catch(() => ({}));
        throw new Error(errBody.error || `Failed to initiate stream: HTTP ${response.status}`);
      }

      const reader = response.body?.getReader();
      if (!reader) {
        await fallbackJsonVet(validItems, options);
      } else {
        const decoder = new TextDecoder();
        let buffer = '';

        while (true) {
          const { done, value } = await reader.read();
          if (done) break;

          buffer += decoder.decode(value, { stream: true });
          const lines = buffer.split('\n\n');
          buffer = lines.pop() || '';

          for (const block of lines) {
            if (!block.trim() || block.trim().startsWith(':')) continue;
            const dataMatch = block.match(/data:\s*(.*)/);
            if (dataMatch && dataMatch[1]) {
              try {
                const event: ScrapeProgressEvent = JSON.parse(dataMatch[1]);
                if (event.stage === 'error') {
                  streamError = event.message || 'Failed to vet product';
                  continue;
                }
                setProgress(event);

                // If event attached a completed product, add it to state immediately!
                if (event.product) {
                  receivedProductCount++;
                  const prod = event.product;
                  setProducts(prev => {
                    const filtered = prev.filter(p => p.asin !== prod.asin);
                    return options.prepend ? [prod, ...filtered] : [...filtered, prod];
                  });
                }
              } catch {
                // skip parse error
              }
            }
          }
        }

        if (streamError && receivedProductCount === 0) {
          throw new Error(streamError);
        }
      }

      setTimeout(() => {
        setProgress(null);
        setIsLoading(false);
      }, 400);
    } catch (err: any) {
      const isStreamOrNetworkDrop =
        !streamError &&
        receivedProductCount === 0 &&
        /load failed|failed to fetch|network|stream|abort/i.test(String(err?.message || ''));

      if (isStreamOrNetworkDrop) {
        try {
          await fallbackJsonVet(validItems, options);
          setTimeout(() => {
            setProgress(null);
            setIsLoading(false);
          }, 400);
          return;
        } catch (fallbackErr: any) {
          console.error('Fallback vet failed:', fallbackErr);
          setErrorMessage(formatUserError(fallbackErr, 'Error vetting product'));
          setProgress(null);
          setIsLoading(false);
          return;
        }
      }

      console.error(err);
      setErrorMessage(formatUserError(err, 'Error vetting product'));
      setProgress(null);
      setIsLoading(false);
    }
  };

  // 1. Scan Single Product (with real-time SSE progress)
  const handleScanSingle = async (query: string) => {
    const check = validateSingleQuery(query);
    if (!check.valid) {
      setErrorMessage(check.error || 'Please enter a valid product name, Amazon link, or ASIN.');
      return;
    }
    await streamVetItems([check.cleaned], { prepend: true });
  };

  // 2. Scan Wishlist with SSE Stream
  const handleScanWishlist = async (items: string[]) => {
    const valid = items.map(i => i.trim()).filter(i => i.length >= 2 && /[a-zA-Z0-9]/.test(i));
    if (valid.length === 0) {
      setErrorMessage('Please enter at least one valid product name, Amazon link, or ASIN.');
      return;
    }
    await streamVetItems(valid, { prepend: false });
  };

  // 3. Import Public Wishlist URL
  const handleImportWishlistUrl = async (url: string) => {
    const cleaned = url.trim();
    if (!cleaned || !/amazon\./i.test(cleaned)) {
      setErrorMessage('Please paste a valid public Amazon Wishlist URL (e.g. https://www.amazon.com/hz/wishlist/ls/...).');
      return;
    }

    setIsLoading(true);
    setErrorMessage(null);
    setProgress({
      step: 1,
      totalSteps: 4,
      stage: 'resolving',
      message: `Fetching public Amazon Wishlist: ${cleaned}...`
    });

    try {
      const res = await fetch(apiUrl('/api/import-wishlist-url'), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ wishlistUrl: cleaned })
      });

      const data = await res.json().catch(() => ({}));
      if (!res.ok || !data.success) {
        throw new Error(data.error || 'Failed to import wishlist');
      }

      const asinsToScan = data.items.map((i: any) => i.asin);
      if (asinsToScan.length === 0) {
        throw new Error('No valid items found in wishlist');
      }

      // Automatically scan the imported items
      await handleScanWishlist(asinsToScan);
    } catch (err: any) {
      console.error(err);
      setErrorMessage(formatUserError(err, 'Failed to import wishlist URL'));
      setProgress(null);
      setIsLoading(false);
    }
  };

  // Switch variation handler for a card
  const handleSwitchVariation = (targetAsin: string) => {
    handleScanSingle(targetAsin);
  };

  const displayedProducts = showApprovedOnly
    ? products.filter(p => p.verdict.tier === 'APPROVED_ALL_TIME_LOW' || p.verdict.tier === 'APPROVED_STRONG_DEAL')
    : products;

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-950 text-slate-900 dark:text-slate-100 flex flex-col transition-colors duration-200">
      <Header
        darkMode={darkMode}
        setDarkMode={setDarkMode}
        activeItemCount={products.length}
      />

      <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 py-6 sm:py-8 space-y-6">
        {/* Error Callout */}
        {errorMessage && (
          <div className="p-4 rounded-xl bg-rose-50 dark:bg-rose-950/80 border border-rose-200 dark:border-rose-500/50 flex items-start space-x-3 text-sm text-rose-900 dark:text-rose-200 animate-in fade-in">
            <AlertCircle className="h-5 w-5 text-rose-600 dark:text-rose-400 flex-shrink-0 mt-0.5" />
            <div className="flex-1">
              <span className="font-bold block">Notice</span>
              <span>{errorMessage}</span>
            </div>
            <button
              onClick={() => setErrorMessage(null)}
              className="text-rose-600 dark:text-rose-400 hover:text-rose-800 dark:hover:text-white text-xs font-semibold"
            >
              Dismiss
            </button>
          </div>
        )}

        {/* Input Hub */}
        <InputHub
          onScanSingle={handleScanSingle}
          onScanWishlist={handleScanWishlist}
          onImportWishlistUrl={handleImportWishlistUrl}
          isLoading={isLoading}
        />

        {/* Real-time Progress Bar */}
        {isLoading && progress && <ProgressBar progress={progress} />}

        {/* Summary Dashboard KPIs */}
        {products.length > 0 && (
          <SummaryDashboard
            products={products}
            showApprovedOnly={showApprovedOnly}
            setShowApprovedOnly={setShowApprovedOnly}
            strictnessThreshold={strictnessThreshold}
            setStrictnessThreshold={setStrictnessThreshold}
          />
        )}

        {/* Products Results Feed */}
        {displayedProducts.length > 0 ? (
          <div className="space-y-4">
            <div className="flex items-center justify-between px-1">
              <h3 className="text-sm font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider flex items-center gap-2">
                <span>Products ({displayedProducts.length})</span>
                {showApprovedOnly && (
                  <span className="text-xs text-emerald-600 dark:text-emerald-400 font-normal">
                    (Approved Deals Only)
                  </span>
                )}
              </h3>

              {products.length > 0 && (
                <button
                  onClick={() => setProducts([])}
                  className="text-xs text-slate-500 hover:text-rose-600 dark:hover:text-rose-400 transition-colors"
                >
                  Clear Results
                </button>
              )}
            </div>

            <div className={displayedProducts.length === 1 ? "grid grid-cols-1 gap-6 max-w-3xl mx-auto" : "grid grid-cols-1 lg:grid-cols-2 gap-5"}>
              {displayedProducts.map(product => (
                <ProductCard
                  key={product.asin}
                  product={product}
                  onSwitchVariation={handleSwitchVariation}
                />
              ))}
            </div>
          </div>
        ) : products.length > 0 && showApprovedOnly ? (
          <div className="text-center py-12 bg-white dark:bg-slate-900/60 rounded-2xl border border-slate-200 dark:border-slate-800 p-8 space-y-3 shadow-sm">
            <ShoppingCart className="h-10 w-10 text-slate-400 dark:text-slate-600 mx-auto" />
            <h4 className="text-base font-semibold text-slate-700 dark:text-slate-300">No deals meet the current strictness threshold</h4>
            <p className="text-xs text-slate-500 max-w-md mx-auto">
              Currently all {products.length} scanned items are priced near their historical average or above.
              Try sliding the Approval Threshold to be more lenient (e.g. 5%), or click below to view all items.
            </p>
            <button
              onClick={() => setShowApprovedOnly(false)}
              className="px-4 py-2 rounded-xl bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-xs font-semibold text-slate-700 dark:text-slate-200 border border-slate-300 dark:border-slate-700"
            >
              Show All Scanned Items
            </button>
          </div>
        ) : !isLoading ? (
          /* Empty / Welcome Info Tile */
          <InfoTile onQuickSearch={handleScanSingle} />
        ) : null}
      </main>

      {/* Footer */}
      <footer className="border-t border-slate-200 dark:border-slate-800/80 py-4 text-center text-xs text-slate-500 bg-white dark:bg-transparent mt-auto transition-colors">
        <div className="max-w-7xl mx-auto px-4 flex flex-col sm:flex-row items-center justify-between gap-2">
          <span className="font-semibold text-slate-700 dark:text-slate-300">DealChaser</span>
          <span className="text-[11px] text-slate-500 dark:text-slate-400">
            Made By: Saurish Perumalla, 2026
          </span>
          <span className="font-mono text-[11px] text-slate-400 dark:text-slate-600">
            Live Price &amp; Deal Validator
          </span>
        </div>
      </footer>
    </div>
  );
};
