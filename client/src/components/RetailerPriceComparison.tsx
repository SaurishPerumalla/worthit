import React from 'react';
import { ExternalLink, Tag, Trophy, ArrowDownRight, ArrowUpRight } from 'lucide-react';
import { RetailerPriceComparison as RetailerPriceType } from '../types.js';

interface Props {
  comparisons?: RetailerPriceType[];
}

export const RetailerPriceComparison: React.FC<Props> = ({ comparisons }) => {
  if (!comparisons || comparisons.length <= 1) return null;

  // Retailer brand colors and badges
  const getRetailerMeta = (retailer: string) => {
    switch (retailer) {
      case 'Target':
        return {
          color: 'text-red-600 dark:text-red-400',
          bg: 'bg-red-50 dark:bg-red-950/40',
          border: 'border-red-200 dark:border-red-900/50',
          dot: 'bg-red-500'
        };
      case 'Best Buy':
        return {
          color: 'text-yellow-600 dark:text-yellow-400',
          bg: 'bg-yellow-50 dark:bg-yellow-950/40',
          border: 'border-yellow-200 dark:border-yellow-900/50',
          dot: 'bg-yellow-400'
        };
      case 'Walmart':
        return {
          color: 'text-blue-600 dark:text-blue-400',
          bg: 'bg-blue-50 dark:bg-blue-950/40',
          border: 'border-blue-200 dark:border-blue-900/50',
          dot: 'bg-blue-500'
        };
      default: // Amazon
        return {
          color: 'text-amber-600 dark:text-amber-400',
          bg: 'bg-amber-50 dark:bg-amber-950/40',
          border: 'border-amber-200 dark:border-amber-900/50',
          dot: 'bg-amber-500'
        };
    }
  };

  const lowest = comparisons.find(c => c.isLowestPrice);
  const cheaperThanAmazon = comparisons.find(
    c => c.retailer !== 'Amazon' && typeof c.savingsVsAmazon === 'number' && c.savingsVsAmazon > 0
  );

  const maxSavingsVsOthers = Math.max(
    0,
    ...comparisons
      .filter(c => c.retailer !== 'Amazon' && typeof c.price === 'number')
      .map(c => Number(((c.price || 0) - (lowest?.price || 0)).toFixed(2)))
  );

  return (
    <div className="mt-3 pt-3 border-t border-slate-200/80 dark:border-slate-800/80 space-y-2.5">
      {/* Header with Callout */}
      <div className="flex flex-wrap items-center justify-between gap-1.5">
        <div className="flex items-center space-x-1.5">
          <Tag className="h-3.5 w-3.5 text-emerald-600 dark:text-emerald-400" />
          <span className="text-xs font-bold text-slate-800 dark:text-slate-200 uppercase tracking-wider">
            Multi-Store Price Check
          </span>
        </div>

        {cheaperThanAmazon ? (
          <span className="px-2 py-0.5 rounded-full bg-emerald-100 dark:bg-emerald-950/80 text-emerald-800 dark:text-emerald-300 text-[10px] font-bold border border-emerald-300 dark:border-emerald-600/40 flex items-center gap-1">
            <Trophy className="h-3 w-3 text-emerald-600 dark:text-emerald-400" />
            {cheaperThanAmazon.retailer} is ${cheaperThanAmazon.savingsVsAmazon?.toFixed(2)} cheaper than Amazon!
          </span>
        ) : lowest?.retailer === 'Amazon' && maxSavingsVsOthers > 0 ? (
          <span className="px-2 py-0.5 rounded-full bg-emerald-50 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-300 text-[10px] font-semibold border border-emerald-200 dark:border-emerald-800/60 flex items-center gap-1">
            <Trophy className="h-3 w-3 text-emerald-600 dark:text-emerald-400" />
            Amazon is lowest (Save up to ${maxSavingsVsOthers.toFixed(2)} vs other stores)
          </span>
        ) : lowest?.retailer === 'Amazon' ? (
          <span className="px-2 py-0.5 rounded-full bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 text-[10px] font-medium border border-slate-200 dark:border-slate-700">
            Amazon has the lowest price
          </span>
        ) : null}
      </div>

      {/* Grid of Retailer Prices */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
        {comparisons.map((c) => {
          const meta = getRetailerMeta(c.retailer);
          const hasPrice = typeof c.price === 'number' && c.price > 0;

          return (
            <a
              key={c.retailer}
              href={c.url}
              target="_blank"
              rel="noopener noreferrer"
              className={`p-2.5 rounded-xl border transition-all flex flex-col justify-between group hover:shadow-md ${
                c.isLowestPrice && hasPrice
                  ? 'bg-emerald-50/80 dark:bg-emerald-950/40 border-emerald-400 dark:border-emerald-500/50 shadow-sm ring-1 ring-emerald-400/30'
                  : 'bg-white dark:bg-slate-900/60 border-slate-200 dark:border-slate-800 hover:border-slate-300 dark:hover:border-slate-700'
              }`}
            >
              <div className="flex items-center justify-between mb-1">
                <div className="flex items-center space-x-1.5">
                  <span className={`h-2 w-2 rounded-full ${meta.dot}`}></span>
                  <span className="text-xs font-bold text-slate-900 dark:text-white">
                    {c.retailer}
                  </span>
                </div>
                <div className="flex items-center gap-1">
                  {c.label && (
                    <span className="text-[9px] uppercase px-1 py-0.2 rounded font-semibold bg-slate-100 dark:bg-slate-800 text-slate-500 dark:text-slate-400">
                      {c.label}
                    </span>
                  )}
                  <ExternalLink className="h-3 w-3 text-slate-400 group-hover:text-slate-600 dark:group-hover:text-slate-200 transition-colors" />
                </div>
              </div>

              <div className="my-1">
                {hasPrice ? (
                  <div className="flex items-baseline gap-1">
                    <span className="text-sm sm:text-base font-black font-mono text-slate-900 dark:text-white">
                      ${(c.price as number).toFixed(2)}
                    </span>
                    {c.regularPrice && c.regularPrice > (c.price as number) && (
                      <span className="text-[10px] line-through text-slate-400 font-mono">
                        ${c.regularPrice.toFixed(2)}
                      </span>
                    )}
                  </div>
                ) : (
                  <div className="text-[11px] font-semibold text-slate-500 dark:text-slate-400">
                    Check Store
                  </div>
                )}
              </div>

              <div className="flex items-center justify-between text-[10px] mt-0.5">
                {c.isLowestPrice && hasPrice ? (
                  <span className="text-emerald-700 dark:text-emerald-400 font-bold flex items-center gap-0.5">
                    <Trophy className="h-2.5 w-2.5" /> Best Deal
                  </span>
                ) : typeof c.savingsVsAmazon === 'number' && c.savingsVsAmazon > 0 ? (
                  <span className="text-emerald-700 dark:text-emerald-400 font-semibold flex items-center gap-0.5">
                    <ArrowDownRight className="h-2.5 w-2.5" /> -${c.savingsVsAmazon.toFixed(2)} vs Amazon
                  </span>
                ) : typeof c.savingsVsAmazon === 'number' && c.savingsVsAmazon < 0 ? (
                  <span className="text-slate-500 dark:text-slate-400 font-medium flex items-center gap-0.5">
                    <ArrowUpRight className="h-2.5 w-2.5 text-amber-500" /> +${Math.abs(c.savingsVsAmazon).toFixed(2)} vs Amazon
                  </span>
                ) : c.price ? (
                  <span className="text-slate-400">Matches Amazon</span>
                ) : (
                  <span className="text-slate-400">Live search</span>
                )}
              </div>
            </a>
          );
        })}
      </div>
    </div>
  );
};
