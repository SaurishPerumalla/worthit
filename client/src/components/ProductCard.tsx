import React, { useState } from 'react';
import {
  ExternalLink,
  CheckCircle2,
  AlertTriangle,
  XCircle,
  Clock,
  Layers,
  ChevronDown,
  Sparkles
} from 'lucide-react';
import { VettedProduct, CandidateMatch } from '../types.js';
import { ChartDrawer } from './ChartDrawer.js';
import { RetailerPriceComparison } from './RetailerPriceComparison.js';

interface ProductCardProps {
  product: VettedProduct;
  onSwitchVariation?: (targetAsin: string) => void;
}

export const ProductCard: React.FC<ProductCardProps> = ({ product, onSwitchVariation }) => {
  const [showVariations, setShowVariations] = useState(false);
  const { verdict, historical } = product;

  // Format date helper to ensure no redundant prefix causes truncation
  const formatCompactDate = (dateStr?: string | null) => {
    if (!dateStr) return 'All-time';
    return dateStr.replace(/recorded:?\s*/i, '').trim();
  };

  // Recommendation validation mapping
  const getRecommendation = () => {
    switch (verdict.tier) {
      case 'APPROVED_ALL_TIME_LOW':
        return {
          recommended: true,
          badgeBg: 'bg-emerald-500 text-slate-950 font-black',
          cardRing: 'ring-1 ring-emerald-500/30 dark:ring-emerald-500/40',
          tileBg: 'bg-emerald-50/90 dark:bg-emerald-950/60 border-emerald-200 dark:border-emerald-500/40 text-emerald-950 dark:text-emerald-100',
          icon: CheckCircle2,
          iconColor: 'text-emerald-600 dark:text-emerald-400',
          verdictTitle: 'ALL-TIME LOW DEAL',
          summary: `Currently at its lowest price recorded on Amazon ($${historical.allTimeLow.price.toFixed(2)}).`
        };
      case 'APPROVED_STRONG_DEAL':
        return {
          recommended: true,
          badgeBg: 'bg-emerald-600 text-white font-bold',
          cardRing: 'ring-1 ring-emerald-500/20 dark:ring-emerald-500/30',
          tileBg: 'bg-emerald-50/80 dark:bg-emerald-950/50 border-emerald-200 dark:border-emerald-500/30 text-emerald-950 dark:text-emerald-100',
          icon: CheckCircle2,
          iconColor: 'text-emerald-600 dark:text-emerald-400',
          verdictTitle: 'RECOMMENDED DEAL',
          summary: `Selling for $${verdict.savingsDollars.toFixed(2)} (${verdict.deltaAvgPercent}%) below its historical average.`
        };
      case 'HOLD_TYPICAL_PRICE':
        return {
          recommended: false,
          badgeBg: 'bg-amber-500 text-slate-950 font-bold',
          cardRing: 'ring-1 ring-amber-500/20 dark:ring-amber-500/30',
          tileBg: 'bg-amber-50/90 dark:bg-amber-950/50 border-amber-200 dark:border-amber-500/30 text-amber-950 dark:text-amber-100',
          icon: Clock,
          iconColor: 'text-amber-600 dark:text-amber-400',
          verdictTitle: 'HOLD — TYPICAL PRICE',
          summary: `Selling at its typical average price ($${historical.historicalAverage.toFixed(2)}). Wait for a price drop.`
        };
      case 'REJECT_OVERPRICED':
      default:
        return {
          recommended: false,
          badgeBg: 'bg-rose-600 text-white font-bold',
          cardRing: 'ring-1 ring-rose-500/20 dark:ring-rose-500/30',
          tileBg: 'bg-rose-50/90 dark:bg-rose-950/50 border-rose-200 dark:border-rose-500/30 text-rose-950 dark:text-rose-100',
          icon: verdict.isFakeDiscountAlert ? AlertTriangle : XCircle,
          iconColor: 'text-rose-600 dark:text-rose-400',
          verdictTitle: verdict.isFakeDiscountAlert ? 'FAKE SALE ALERT' : 'OVERPRICED — DO NOT BUY',
          summary: verdict.isFakeDiscountAlert && verdict.fakeDiscountMessage
            ? verdict.fakeDiscountMessage
            : `Selling above its historical average price ($${historical.historicalAverage.toFixed(2)}).`
        };
    }
  };

  const rec = getRecommendation();
  const RecIcon = rec.icon;

  return (
    <div className={`rounded-3xl border border-slate-200/90 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-md hover:shadow-xl transition-all duration-200 overflow-hidden flex flex-col justify-between ${rec.cardRing}`}>
      <div className="p-5 space-y-4">
        {/* Product Identity Header Tile */}
        <div className="flex gap-3.5 items-start">
          {/* Product Image Tile */}
          <div className="h-20 w-20 rounded-2xl bg-slate-50 dark:bg-slate-950 p-2 flex items-center justify-center flex-shrink-0 border border-slate-200/80 dark:border-slate-800 transition-colors shadow-inner">
            <img
              src={product.image}
              alt={product.title}
              className="max-h-full max-w-full object-contain"
              loading="lazy"
              onError={(e) => {
                (e.target as HTMLElement).style.display = 'none';
              }}
            />
          </div>

          {/* Details & ASIN */}
          <div className="flex-1 min-w-0">
            <div className="flex flex-wrap items-center gap-1.5 mb-1">
              <a
                href={product.amazonUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="px-2 py-0.5 rounded-md bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-[11px] font-mono font-semibold text-emerald-700 dark:text-emerald-400 border border-slate-200 dark:border-slate-700 flex items-center gap-1 transition-colors whitespace-nowrap"
                title="View product on Amazon"
              >
                <span>ASIN: {product.asin}</span>
                <ExternalLink className="h-3 w-3 text-slate-400" />
              </a>

              {product.isLatestTrackedPriceViaCcc && (
                <span className="px-2 py-0.5 rounded-md bg-amber-50 dark:bg-amber-950/80 text-amber-800 dark:text-amber-300 text-[10px] font-semibold border border-amber-200 dark:border-amber-500/30 whitespace-nowrap">
                  Via CCC
                </span>
              )}

              {product.matchNote && (
                <span className="px-2 py-0.5 rounded-md bg-sky-50 dark:bg-sky-950/80 text-sky-700 dark:text-sky-300 text-[10px] font-semibold border border-sky-200 dark:border-sky-500/30 flex items-center gap-1 whitespace-nowrap">
                  <Sparkles className="h-3 w-3 text-sky-500" />
                  {product.matchNote}
                </span>
              )}
            </div>

            <h3 className="text-sm sm:text-base font-bold text-slate-900 dark:text-white line-clamp-3 leading-snug transition-colors">
              {product.title}
            </h3>

            {/* Alternates dropdown */}
            {product.alternateMatches && product.alternateMatches.length > 0 && onSwitchVariation && (
              <div className="mt-1 relative">
                <button
                  type="button"
                  onClick={() => setShowVariations(!showVariations)}
                  className="text-xs text-slate-500 dark:text-slate-400 hover:text-emerald-600 dark:hover:text-emerald-400 flex items-center gap-1 py-0.5 transition-colors font-medium"
                >
                  <Layers className="h-3.5 w-3.5 text-emerald-600 dark:text-emerald-400 flex-shrink-0" />
                  <span className="truncate">Switch variation ({product.alternateMatches.length} available)</span>
                  <ChevronDown className="h-3 w-3 ml-0.5 flex-shrink-0" />
                </button>

                {showVariations && (
                  <div className="absolute left-0 mt-1 z-30 w-full sm:w-80 bg-white dark:bg-slate-950 border border-slate-200 dark:border-slate-700 rounded-2xl shadow-2xl p-2 space-y-1">
                    <div className="text-[11px] font-semibold text-slate-500 dark:text-slate-400 px-2 py-1 uppercase tracking-wider">
                      Switch to Variation:
                    </div>
                    {product.alternateMatches.map((alt: CandidateMatch) => (
                      <button
                        key={alt.asin}
                        onClick={() => {
                          setShowVariations(false);
                          onSwitchVariation(alt.asin);
                        }}
                        className="w-full text-left p-2 rounded-xl hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors flex items-center space-x-2.5 border border-transparent hover:border-slate-300 dark:hover:border-slate-700"
                      >
                        {alt.image && (
                          <img src={alt.image} alt="" className="h-8 w-8 object-contain rounded bg-slate-50 dark:bg-slate-900 p-0.5 border border-slate-200 dark:border-slate-800 flex-shrink-0" />
                        )}
                        <div className="flex-1 min-w-0">
                          <p className="text-xs text-slate-800 dark:text-slate-200 line-clamp-1 font-medium">{alt.title}</p>
                          <div className="flex items-center gap-2 mt-0.5 text-[10px] font-mono text-slate-500 dark:text-slate-400">
                            <span>ASIN: {alt.asin}</span>
                            {alt.price && <span className="text-emerald-600 dark:text-emerald-400 font-bold">${alt.price.toFixed(2)}</span>}
                          </div>
                        </div>
                      </button>
                    ))}
                  </div>
                )}
              </div>
            )}
          </div>
        </div>

        {/* 1. RECOMMENDATION / VALIDATION TILE */}
        <div className={`rounded-2xl p-3.5 border space-y-1.5 shadow-sm transition-colors ${rec.tileBg}`}>
          <div className="flex items-center justify-between">
            <span className={`px-2.5 py-1 rounded-lg text-xs font-black tracking-wide inline-flex items-center gap-1.5 shadow-sm whitespace-nowrap ${rec.badgeBg}`}>
              <RecIcon className="h-3.5 w-3.5 flex-shrink-0" />
              <span>{rec.verdictTitle}</span>
            </span>
          </div>
          <p className="text-xs sm:text-sm font-semibold leading-relaxed">
            {rec.summary}
          </p>
        </div>

        {/* 2. THE THREE ESSENTIAL PRICING TILES */}
        <div className="grid grid-cols-3 gap-2">
          {/* Tile A: Current Price */}
          <div className="bg-slate-50/90 dark:bg-slate-950/80 border border-slate-200/90 dark:border-slate-800 rounded-2xl p-3 flex flex-col justify-between transition-colors shadow-sm min-w-0">
            <div className="flex items-center justify-between">
              <span className="text-[10px] sm:text-[11px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider truncate">
                Current
              </span>
              <span className="h-2 w-2 rounded-full bg-emerald-500 flex-shrink-0 ml-1"></span>
            </div>
            <div className="my-1.5">
              <div className="text-lg sm:text-2xl font-black font-mono text-slate-900 dark:text-white truncate">
                ${product.currentPrice.toFixed(2)}
              </div>
              {product.listPrice && product.listPrice > product.currentPrice && (
                <div className="text-[10px] text-slate-400 dark:text-slate-500 line-through font-mono truncate">
                  ${product.listPrice.toFixed(2)}
                </div>
              )}
            </div>
            <span className="text-[10px] text-emerald-700 dark:text-emerald-400 font-medium truncate block">
              {product.isLatestTrackedPriceViaCcc ? 'Via CCC' : 'Amazon Live'}
            </span>
          </div>

          {/* Tile B: All-Time Low */}
          <div className="bg-emerald-50/40 dark:bg-slate-950/80 border border-emerald-200/70 dark:border-slate-800 rounded-2xl p-3 flex flex-col justify-between transition-colors shadow-sm min-w-0">
            <div className="flex items-center justify-between">
              <span className="text-[10px] sm:text-[11px] font-bold text-emerald-700 dark:text-emerald-400 uppercase tracking-wider truncate">
                All-Time Low
              </span>
            </div>
            <div className="my-1.5">
              <div className="text-lg sm:text-2xl font-black font-mono text-emerald-600 dark:text-emerald-400 truncate">
                ${historical.allTimeLow.price.toFixed(2)}
              </div>
              {product.listPrice && product.listPrice > product.currentPrice && (
                <div className="text-[10px] text-transparent select-none">
                  &nbsp;
                </div>
              )}
            </div>
            <span className="text-[10px] text-slate-500 dark:text-slate-400 truncate block">
              {formatCompactDate(historical.allTimeLow.date)}
            </span>
          </div>

          {/* Tile C: All-Time High */}
          <div className="bg-slate-50/90 dark:bg-slate-950/80 border border-slate-200/90 dark:border-slate-800 rounded-2xl p-3 flex flex-col justify-between transition-colors shadow-sm min-w-0">
            <div className="flex items-center justify-between">
              <span className="text-[10px] sm:text-[11px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider truncate">
                All-Time High
              </span>
            </div>
            <div className="my-1.5">
              <div className="text-lg sm:text-2xl font-black font-mono text-slate-800 dark:text-slate-300 truncate">
                ${historical.allTimeHigh.price.toFixed(2)}
              </div>
              {product.listPrice && product.listPrice > product.currentPrice && (
                <div className="text-[10px] text-transparent select-none">
                  &nbsp;
                </div>
              )}
            </div>
            <span className="text-[10px] text-slate-500 dark:text-slate-400 truncate block">
              {formatCompactDate(historical.allTimeHigh.date)}
            </span>
          </div>
        </div>

        {/* Multi-Store Price Comparison (Target, Best Buy, Walmart) */}
        <RetailerPriceComparison comparisons={product.retailerComparisons} />

        {/* Collapsible Chart Drawer Tile */}
        <div className="pt-1">
          <ChartDrawer asin={product.asin} title={product.title} />
        </div>
      </div>
    </div>
  );
};