export interface CandidateMatch {
  asin: string;
  title: string;
  price: number | null;
  image: string | null;
}

export interface AmazonProductData {
  asin: string;
  title: string;
  price: number | null;
  listPrice: number | null;
  inStock: boolean;
  image: string | null;
  alternateMatches: CandidateMatch[];
  isLatestTrackedPriceViaCcc?: boolean;
  matchNote?: string;
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
  deltaAvgPercent: number; // e.g. +15.5% means 15.5% cheaper than avg
  deltaLowPercent: number; // e.g. +2.1% means 2.1% above ATL
  rangePositionPercent: number; // 0% = ATL, 100% = ATH
  isFakeDiscountAlert: boolean;
  fakeDiscountMessage?: string;
  savingsDollars: number; // Dollars saved vs historical average
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
  scrapedAt: string;
  status: 'success' | 'warning' | 'error';
  errorMessage?: string;
}

export interface WishlistItemImport {
  asin: string;
  title: string;
  listedPrice: number | null;
  image: string | null;
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
