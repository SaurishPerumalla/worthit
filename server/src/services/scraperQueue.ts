import { resolveInputToAsin } from './asinResolver.js';
import { scrapeAmazonProduct } from './amazonScraper.js';
import { fetchCccPriceHistory, buildCccChartUrl, createBaselineHistoricalData } from './cccScraper.js';
import { evaluateDeal } from './vettingEngine.js';
import { compareRetailers, finalizeRetailerComparisons } from './retailerComparisonService.js';
import { VettedProduct, ScrapeProgressEvent, RetailerPriceComparison } from '../types.js';

export type ProgressCallback = (event: ScrapeProgressEvent) => void;

/**
 * Preserves or infers brand prefix when Amazon search result card truncates the brand name.
 */
function buildEarlyRetailerQuery(input: string, resolvedTitle?: string): string | null {
  if (!resolvedTitle) return null;
  const trimmedInput = input.trim();
  const lowerTitle = resolvedTitle.toLowerCase();
  const brandMatch = trimmedInput.match(/^(Apple|Nintendo|Sony|Samsung|Bose|LG|Microsoft|Google|Logitech|Dyson)\b/i);
  const inferredBrand = brandMatch?.[1] || (
    /\b(airpods|iphone|ipad|macbook|apple\s*watch|watch\s*(?:se|series|ultra))\b/i.test(lowerTitle) ? 'Apple'
      : /\bswitch\b/i.test(lowerTitle) ? 'Nintendo'
      : /\b(wh-?1000|wf-?1000|playstation)\b/i.test(lowerTitle) ? 'Sony'
      : null
  );
  if (inferredBrand && !new RegExp(`\\b${inferredBrand}\\b`, 'i').test(resolvedTitle)) {
    return `${inferredBrand} ${resolvedTitle}`;
  }
  return resolvedTitle;
}

/**
 * Executes a controlled delay with random jitter (base 600ms + 0-200ms random).
 */
export function jitterDelay(baseMs: number = 600): Promise<void> {
  const jitter = Math.floor(Math.random() * 200);
  return new Promise(resolve => setTimeout(resolve, baseMs + jitter));
}

/**
 * Vets a single item through the 4-phase zero-mismatch pipeline, executing independent
 * Amazon PDP, price history OCR, and cross-retailer lookups concurrently.
 */
export async function vetSingleProduct(
  input: string,
  thresholdPercent: number = 12,
  onProgress?: ProgressCallback,
  itemIndex: number = 0,
  totalItems: number = 1,
  selectedStores?: string[]
): Promise<VettedProduct> {
  const notify = (step: number, stage: ScrapeProgressEvent['stage'], message: string, asin?: string, product?: VettedProduct) => {
    if (onProgress) {
      onProgress({
        step,
        totalSteps: 4,
        stage,
        message,
        asin,
        itemIndex,
        totalItems,
        product
      });
    }
  };

  try {
    // ----------------------------------------------------
    // Phase 1: Canonical ASIN Resolution
    // ----------------------------------------------------
    notify(1, 'resolving', `[1/4] Identifying product...`);
    const resolved = await resolveInputToAsin(input);
    const asin = resolved.asin;
    const amazonUrl = `https://www.amazon.com/dp/${asin}`;
    const earlyTitle = buildEarlyRetailerQuery(input, resolved.resolvedTitle);

    // ----------------------------------------------------
    // Phases 2, 3 & Retailer Pre-fetch run in parallel as soon as ASIN is known
    // ----------------------------------------------------
    notify(2, 'amazon_fetch', `[2/4] Fetching live price & history...`, asin);
    const amazonPromise = scrapeAmazonProduct(asin);
    const cccPromise = fetchCccPriceHistory(asin, resolved.resolvedPrice, null);
    const earlyComparePromise: Promise<RetailerPriceComparison[] | null> = earlyTitle
      ? compareRetailers(earlyTitle, resolved.resolvedPrice || 0, amazonUrl, null, null, null, selectedStores).catch(() => null)
      : Promise.resolve(null);

    const amazonData = await amazonPromise;

    // Prefer resolved search title/image if scraper missed them
    if (!amazonData.title && resolved.resolvedTitle) {
      amazonData.title = resolved.resolvedTitle;
    }
    if (!amazonData.image && resolved.resolvedImage) {
      amazonData.image = resolved.resolvedImage;
    }
    if (amazonData.price === null && resolved.resolvedPrice) {
      amazonData.price = resolved.resolvedPrice;
    }

    // Attach alternate variations from search
    amazonData.alternateMatches = resolved.alternateMatches;

    // ----------------------------------------------------
    // Phase 3: Price History Analysis (already pre-fetched concurrently)
    // ----------------------------------------------------
    notify(3, 'ccc_fetch', `[3/4] Analyzing price history...`, asin);
    let historical = await cccPromise;
    if (historical.historySource === 'amazon_baseline' && (amazonData.price || amazonData.listPrice)) {
      historical = createBaselineHistoricalData(asin, historical.chartUrl, amazonData.price, amazonData.listPrice);
    }

    // ----------------------------------------------------
    // Phase 4: Data Integrity Guard, Deal Verdict & Multi-Store Alignment
    // ----------------------------------------------------
    notify(4, 'vetting', `[4/4] Comparing stores & verdict...`, asin);

    let currentPrice = amazonData.price;
    let isLatestTrackedPriceViaCcc = false;

    // Fallback: If Amazon live price was unavailable, use CCC current price
    if (currentPrice === null || currentPrice <= 0) {
      if (historical.cccCurrent && historical.cccCurrent.price > 0) {
        currentPrice = historical.cccCurrent.price;
        isLatestTrackedPriceViaCcc = true;
      } else if (historical.allTimeLow && historical.allTimeLow.price > 0) {
        currentPrice = historical.allTimeLow.price;
        isLatestTrackedPriceViaCcc = true;
      } else {
        currentPrice = 29.99; // ultimate fallback
      }
    }

    // Anomaly Guard:
    // If currentPrice is an extreme outlier (e.g. an accessory, phone case, or single monthly installment was scraped),
    // detect and correct it against historical baseline
    if (
      currentPrice !== null &&
      historical.allTimeLow &&
      historical.allTimeLow.price > 50 &&
      currentPrice < historical.allTimeLow.price * 0.35
    ) {
      console.warn(`Extreme price outlier detected for ${asin}: parsed $${currentPrice} vs ATL $${historical.allTimeLow.price}. Falling back to CCC verified price.`);
      if (historical.cccCurrent && historical.cccCurrent.price > 0) {
        currentPrice = historical.cccCurrent.price;
        isLatestTrackedPriceViaCcc = true;
      } else if (amazonData.listPrice && amazonData.listPrice > 50) {
        currentPrice = amazonData.listPrice;
      } else {
        currentPrice = historical.allTimeLow.price;
        isLatestTrackedPriceViaCcc = true;
      }
    }

    // Sanity enforcement: P_low <= P_avg <= P_high
    if (historical.allTimeLow.price > historical.allTimeHigh.price) {
      const temp = historical.allTimeLow;
      historical.allTimeLow = historical.allTimeHigh;
      historical.allTimeHigh = temp;
    }
    if (historical.historicalAverage < historical.allTimeLow.price) {
      historical.historicalAverage = historical.allTimeLow.price;
    }
    if (historical.historicalAverage > historical.allTimeHigh.price) {
      historical.historicalAverage = historical.allTimeHigh.price;
    }

    currentPrice = Number(currentPrice.toFixed(2));
    historical.historicalAverage = Number(historical.historicalAverage.toFixed(2));
    historical.allTimeLow.price = Number(historical.allTimeLow.price.toFixed(2));
    historical.allTimeHigh.price = Number(historical.allTimeHigh.price.toFixed(2));

    const verdict = evaluateDeal(currentPrice, amazonData.listPrice, historical, thresholdPercent);

    // Cross-Retailer Price Comparison (use pre-fetched result when available, else run now)
    let retailerComparisons: RetailerPriceComparison[] | undefined;
    try {
      const earlyMatches = await earlyComparePromise;
      if (earlyMatches) {
        retailerComparisons = finalizeRetailerComparisons(
          earlyMatches,
          amazonData.title || input,
          currentPrice,
          amazonUrl,
          amazonData.listPrice,
          undefined,
          historical?.allTimeHigh?.price,
          historical?.historicalAverage,
          selectedStores
        );
      } else {
        retailerComparisons = await compareRetailers(
          amazonData.title || input,
          currentPrice,
          amazonUrl,
          amazonData.listPrice,
          historical?.allTimeHigh?.price,
          historical?.historicalAverage,
          selectedStores
        );
      }
    } catch (retailerErr) {
      console.warn('Cross-retailer comparison skipped:', retailerErr);
    }

    const vettedProduct: VettedProduct = {
      asin,
      inputQuery: input,
      title: amazonData.title || `Amazon Product (${asin})`,
      image: amazonData.image || `https://ws-na.amazon-adsystem.com/widgets/q?_encoding=UTF8&Format=_SL300_&ASIN=${asin}&MarketPlace=US`,
      currentPrice,
      listPrice: amazonData.listPrice,
      inStock: amazonData.inStock,
      isLatestTrackedPriceViaCcc,
      amazonUrl,
      cccUrl: `https://camelcamelcamel.com/product/${asin}`,
      chartUrl: buildCccChartUrl(asin, 'all'),
      historical,
      verdict,
      alternateMatches: resolved.alternateMatches,
      matchNote: resolved.matchNote,
      retailerComparisons,
      scrapedAt: new Date().toISOString(),
      status: 'success'
    };

    notify(4, 'done', `[4/4] Deal verdict calculated`, asin, vettedProduct);
    return vettedProduct;
  } catch (error: any) {
    console.error(`Error vetting product for input "${input}":`, error);
    const msg = error?.message?.includes('No matching')
      ? `Could not find an Amazon product matching "${input}". Please paste the direct Amazon link or 10-character ASIN (e.g. B0HJB73N19).`
      : (error?.message || `Failed to vet product "${input}"`);
    notify(4, 'error', msg, undefined);
    throw new Error(msg);
  }
}

/**
 * Processes a list of items with concurrency limit of 2 and 600ms jitter delay.
 */
export async function processQueueWithConcurrency(
  inputs: string[],
  thresholdPercent: number = 12,
  onProgress?: ProgressCallback,
  concurrencyLimit: number = 2,
  selectedStores?: string[]
): Promise<VettedProduct[]> {
  const results: VettedProduct[] = new Array(inputs.length);
  let currentIndex = 0;

  async function worker() {
    while (currentIndex < inputs.length) {
      const idx = currentIndex++;
      const input = inputs[idx];
      
      try {
        const product = await vetSingleProduct(
          input,
          thresholdPercent,
          onProgress,
          idx,
          inputs.length,
          selectedStores
        );
        results[idx] = product;
      } catch (err: any) {
        console.warn(`Failed item in wishlist "${input}":`, err?.message);
      }

      // Rate limit jitter delay between item scrapes
      if (currentIndex < inputs.length) {
        await jitterDelay(600);
      }
    }
  }

  const workers = Array.from({ length: Math.min(concurrencyLimit, inputs.length) }, () => worker());
  await Promise.all(workers);

  return results.filter(Boolean);
}
