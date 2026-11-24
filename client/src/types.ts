export interface RetailerPriceComparison {
  retailer: 'Amazon' | 'Best Buy' | 'Target' | 'Walmart';
  price: number | null;
  regularPrice?: number | null;
  url: string;
  inStock: boolean;
  isLowestPrice: boolean;
  savingsVsAmazon?: number;
  label?: string;
}

export interface CandidateMatch {
  asin: string;
  title: string;
  price: number | null;
  image: string | null;
}

export interface HistoricalPriceEntry {
  price: number;
  date: string | null;
}

export interface PriceMatrix {
  lowest: HistoricalPriceEntry;
  highest: HistoricalPriceEntry;
  current: HistoricalPriceEntry;
}

export interface HistoricalPriceData {
  asin: string;
  chartUrl: string;
  amazon: PriceMatrix | null;
  thirdPartyNew: PriceMatrix | null;
  allTimeLow: HistoricalPriceEntry;
  allTimeHigh: HistoricalPriceEntry;
  historicalAverage: number;
  cccCurrent: HistoricalPriceEntry | null;
  historySource: 'camelcamelcamel_chart' | 'amazon_baseline';
}

export type VerdictTier =
  | 'APPROVED_ALL_TIME_LOW'
  | 'APPROVED_STRONG_DEAL'
  | 'HOLD_TYPICAL_PRICE'
  | 'REJECT_OVERPRICED';

export interface DealVerdict {
  tier: VerdictTier;
  score: number; // 0 - 100
  badgeLabel: string;
  headline: string;
  explanation: string;
  deltaAvgPercent: number; // positive = cheaper than avg
  deltaLowPercent: number; // positive = above ATL
  rangePositionPercent: number; // 0% = ATL, 100% = ATH
  isFakeDiscountAlert: boolean;
  fakeDiscountMessage?: string;
  savingsDollars: number;
}

export interface VettedProduct {
  asin: string;
  inputQuery: string;
  title: string;
  image: string;
  currentPrice: number;
  listPrice: number | null;
  inStock: boolean;
  isLatestTrackedPriceViaCcc: boolean;
  amazonUrl: string;
  cccUrl: string;
  chartUrl: string;
  historical: HistoricalPriceData;
  verdict: DealVerdict;
  alternateMatches: CandidateMatch[];
  matchNote?: string;
  retailerComparisons?: RetailerPriceComparison[];
  scrapedAt: string;
  status: 'success' | 'warning' | 'error';
  errorMessage?: string;
}

export interface ScrapeProgressEvent {
  step: number;
  totalSteps: number;
  stage: 'resolving' | 'amazon_fetch' | 'ccc_fetch' | 'vetting' | 'done' | 'error';
  message: string;
  asin?: string;
  itemIndex?: number;
  totalItems?: number;
  product?: VettedProduct;
}

export interface WishlistItemImport {
  asin: string;
  title: string;
  listedPrice: number | null;
  image: string | null;
}
