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

  /**
   * Streams real-time SSE vetting progress for single-item and wishlist scans.
   */
  const streamVetItems = async (items: string[], options: { prepend: boolean }) => {
    setIsLoading(true);
    setErrorMessage(null);
    setProgress({
      step: 1,
      totalSteps: 4,
      stage: 'resolving',
      message: `[1/4] Identifying product...`,
      totalItems: items.length,
      itemIndex: 0
    });

    try {
      const response = await fetch(apiUrl('/api/vet-stream'), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ items, threshold: strictnessThreshold })
      });

      if (!response.ok) {
        throw new Error(`Failed to initiate stream: HTTP ${response.status}`);
      }

      const reader = response.body?.getReader();
      if (!reader) throw new Error('No readable stream available');

      const decoder = new TextDecoder();
      let buffer = '';
      let streamError: string | null = null;
      let receivedProductCount = 0;

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split('\n\n');
        buffer = lines.pop() || '';

        for (const block of lines) {
          if (!block.trim()) continue;
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

      setTimeout(() => {
        setProgress(null);
        setIsLoading(false);
      }, 400);
    } catch (err: any) {
      console.error(err);
      setErrorMessage(err.message || 'Error vetting product');
      setProgress(null);
      setIsLoading(false);
    }
  };

  // 1. Scan Single Product (with real-time SSE progress)
  const handleScanSingle = async (query: string) => {
    await streamVetItems([query], { prepend: true });
  };

  // 2. Scan Wishlist with SSE Stream
  const handleScanWishlist = async (items: string[]) => {
    if (items.length === 0) return;
    await streamVetItems(items, { prepend: false });
  };

  // 3. Import Public Wishlist URL
  const handleImportWishlistUrl = async (url: string) => {
    setIsLoading(true);
    setErrorMessage(null);
    setProgress({
      step: 1,
      totalSteps: 4,
      stage: 'resolving',
      message: `Fetching public Amazon Wishlist: ${url}...`
    });

    try {
      const res = await fetch(apiUrl('/api/import-wishlist-url'), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ wishlistUrl: url })
      });

      const data = await res.json();
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
      setErrorMessage(err.message || 'Failed to import wishlist URL');
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
