import React from 'react';
import { TrendingDown, Tag, ShieldCheck, ArrowRight } from 'lucide-react';
import { DealChaserLogo } from './Logo.js';

interface InfoTileProps {
  onQuickSearch?: (query: string) => void;
}

const EXAMPLE_QUERIES = [
  'Nintendo Switch 2',
  'Apple Watch SE 3 40mm',
  'Sony WH-1000XM5'
];

export const InfoTile: React.FC<InfoTileProps> = ({ onQuickSearch }) => {
  return (
    <section
      aria-label="About DealChaser"
      className="text-center rounded-3xl border border-dashed border-slate-300 dark:border-slate-800 bg-white dark:bg-slate-900/40 px-5 py-8 sm:py-9 shadow-sm dark:shadow-none space-y-5 transition-colors"
    >
      <DealChaserLogo size="lg" className="mx-auto" />

      <div className="space-y-1.5">
        <h2 className="text-lg font-bold text-slate-900 dark:text-white tracking-tight">
          How DealChaser Works
        </h2>
        <p className="text-xs sm:text-sm text-slate-600 dark:text-slate-400 max-w-xl mx-auto">
          Spot fake discounts using real price history and compare prices across{' '}
          <span className="text-slate-800 dark:text-slate-200 font-medium">various stores</span>.
        </p>
      </div>

      {/* 3 Compact Feature Highlights */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5 max-w-2xl mx-auto text-left">
        <div className="flex items-center gap-2.5 px-3.5 py-2.5 rounded-2xl bg-slate-50 dark:bg-slate-950/60 border border-slate-200/80 dark:border-slate-800/80">
          <TrendingDown className="h-4 w-4 text-emerald-500 flex-shrink-0" />
          <div className="min-w-0">
            <div className="text-xs font-bold text-slate-800 dark:text-slate-200">Price History</div>
            <div className="text-[11px] text-slate-500 dark:text-slate-400 truncate">Low, avg &amp; all-time high</div>
          </div>
        </div>

        <div className="flex items-center gap-2.5 px-3.5 py-2.5 rounded-2xl bg-slate-50 dark:bg-slate-950/60 border border-slate-200/80 dark:border-slate-800/80">
          <Tag className="h-4 w-4 text-teal-500 flex-shrink-0" />
          <div className="min-w-0">
            <div className="text-xs font-bold text-slate-800 dark:text-slate-200">Multi-Store Check</div>
            <div className="text-[11px] text-slate-500 dark:text-slate-400 truncate">Any major or custom store</div>
          </div>
        </div>

        <div className="flex items-center gap-2.5 px-3.5 py-2.5 rounded-2xl bg-slate-50 dark:bg-slate-950/60 border border-slate-200/80 dark:border-slate-800/80">
          <ShieldCheck className="h-4 w-4 text-cyan-500 flex-shrink-0" />
          <div className="min-w-0">
            <div className="text-xs font-bold text-slate-800 dark:text-slate-200">Deal Verdict</div>
            <div className="text-[11px] text-slate-500 dark:text-slate-400 truncate">Buy Now vs. Wait rating</div>
          </div>
        </div>
      </div>

      {/* Quick Try Chips */}
      {onQuickSearch && (
        <div className="flex flex-wrap items-center justify-center gap-1.5 pt-1">
          <span className="text-[11px] text-slate-500 dark:text-slate-400 mr-1">Try:</span>
          {EXAMPLE_QUERIES.map((example) => (
            <button
              key={example}
              type="button"
              onClick={() => onQuickSearch(example)}
              className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[11px] font-medium bg-slate-100 hover:bg-emerald-50 dark:bg-slate-800/80 dark:hover:bg-emerald-950/70 text-slate-700 hover:text-emerald-700 dark:text-slate-300 dark:hover:text-emerald-300 border border-slate-200 dark:border-slate-700/80 hover:border-emerald-300 dark:hover:border-emerald-600/50 transition-colors"
            >
              <span>{example}</span>
              <ArrowRight className="h-2.5 w-2.5 opacity-60" />
            </button>
          ))}
        </div>
      )}
    </section>
  );
};
