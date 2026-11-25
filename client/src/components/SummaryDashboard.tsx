import React from 'react';
import { CheckCircle2, ShoppingBag, Filter } from 'lucide-react';
import { VettedProduct } from '../types.js';

interface SummaryDashboardProps {
  products: VettedProduct[];
  showApprovedOnly: boolean;
  setShowApprovedOnly: (val: boolean) => void;
  strictnessThreshold: number;
  setStrictnessThreshold: (val: number) => void;
}

export const SummaryDashboard: React.FC<SummaryDashboardProps> = ({
  products,
  showApprovedOnly,
  setShowApprovedOnly
}) => {
  if (products.length === 0) return null;

  // Filter approved products (tiers: ALL_TIME_LOW or STRONG_DEAL)
  const approvedProducts = products.filter(
    p => p.verdict.tier === 'APPROVED_ALL_TIME_LOW' || p.verdict.tier === 'APPROVED_STRONG_DEAL'
  );

  const approvedCount = approvedProducts.length;
  const totalCount = products.length;
  const totalApprovedCost = approvedProducts.reduce((sum, p) => sum + p.currentPrice, 0);
  const approvalRate = Math.round((approvedCount / (totalCount || 1)) * 100);

  return (
    <div className="grid grid-cols-1 sm:grid-cols-3 gap-3.5">
      {/* Tile 1: Deal Recommendation Tally */}
      <div className="animate-fade-up bg-white dark:bg-slate-900 rounded-3xl border border-slate-200/90 dark:border-slate-800 p-4 sm:p-5 shadow-sm hover:shadow-md hover:-translate-y-0.5 transition-all duration-200 flex items-start space-x-3.5">
        <div className="h-11 w-11 rounded-2xl bg-emerald-50 dark:bg-emerald-950/60 border border-emerald-200 dark:border-emerald-500/30 text-emerald-600 dark:text-emerald-400 flex items-center justify-center flex-shrink-0 shadow-sm">
          <CheckCircle2 className="h-5 w-5" />
        </div>
        <div className="flex-1 min-w-0">
          <span className="text-[11px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider block">
            Recommended Deals
          </span>
          <div className="flex items-baseline space-x-1.5 mt-0.5">
            <span className="text-2xl font-black font-mono text-slate-900 dark:text-white">
              {approvedCount}
            </span>
            <span className="text-xs font-semibold text-slate-500 dark:text-slate-400">
              of {totalCount} items
            </span>
          </div>
          <span className="inline-block mt-1 text-[10px] font-bold px-2 py-0.5 rounded-full bg-emerald-100 dark:bg-emerald-950 text-emerald-800 dark:text-emerald-300">
            {approvalRate}% Approved
          </span>
        </div>
      </div>

      {/* Tile 2: Approved Cart Total */}
      <div
        className="animate-fade-up bg-white dark:bg-slate-900 rounded-3xl border border-slate-200/90 dark:border-slate-800 p-4 sm:p-5 shadow-sm hover:shadow-md hover:-translate-y-0.5 transition-all duration-200 flex items-start space-x-3.5"
        style={{ animationDelay: '60ms' }}
      >
        <div className="h-11 w-11 rounded-2xl bg-teal-50 dark:bg-teal-950/60 border border-teal-200 dark:border-teal-500/30 text-teal-600 dark:text-teal-400 flex items-center justify-center flex-shrink-0 shadow-sm">
          <ShoppingBag className="h-5 w-5" />
        </div>
        <div className="flex-1 min-w-0">
          <span className="text-[11px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider block">
            Approved Total
          </span>
          <div className="flex items-baseline space-x-1 mt-0.5">
            <span className="text-2xl font-black font-mono text-slate-900 dark:text-white">
              ${totalApprovedCost.toFixed(2)}
            </span>
          </div>
          <span className="text-[11px] text-slate-500 dark:text-slate-400 block mt-1 truncate">
            {approvedCount > 0 ? `For ${approvedCount} approved deal${approvedCount === 1 ? '' : 's'}` : 'No approved items'}
          </span>
        </div>
      </div>

      {/* Tile 3: Filter & View Toggle */}
      <div
        className="animate-fade-up bg-white dark:bg-slate-900 rounded-3xl border border-slate-200/90 dark:border-slate-800 p-4 sm:p-5 shadow-sm hover:shadow-md hover:-translate-y-0.5 transition-all duration-200 flex flex-col justify-between"
        style={{ animationDelay: '120ms' }}
      >
        <div>
          <span className="text-[11px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider block">
            Filter Results
          </span>
          <span className="text-xs text-slate-500 dark:text-slate-400 block mt-0.5">
            {showApprovedOnly ? 'Showing approved only' : 'Showing all items'}
          </span>
        </div>

        <button
          onClick={() => setShowApprovedOnly(!showApprovedOnly)}
          className={`press-scale w-full mt-2.5 px-4 py-2 rounded-xl text-xs font-bold flex items-center justify-center space-x-2 transition-all shadow-sm ${
            showApprovedOnly
              ? 'bg-emerald-600 hover:bg-emerald-500 text-white shadow-emerald-600/20'
              : 'bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 border border-slate-300 dark:border-slate-700'
          }`}
        >
          <Filter className="h-3.5 w-3.5" />
          <span>{showApprovedOnly ? 'Show All' : 'Show Approved Only'}</span>
        </button>
      </div>
    </div>
  );
};