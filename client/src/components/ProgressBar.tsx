import React from 'react';
import { Loader2, CheckCircle2, Search, DollarSign, LineChart, ShieldCheck } from 'lucide-react';
import { ScrapeProgressEvent } from '../types.js';

interface ProgressBarProps {
  progress: ScrapeProgressEvent | null;
}

export const ProgressBar: React.FC<ProgressBarProps> = ({ progress }) => {
  if (!progress) return null;

  const currentStep = progress.step || 1;
  const totalSteps = 4;
  const itemIndex = (progress.itemIndex !== undefined ? progress.itemIndex + 1 : 1);
  const totalItems = progress.totalItems || 1;

  // Calculate percentage: per-item weight + step fraction
  const overallPercent = Math.min(100, Math.round(
    (((itemIndex - 1) * totalSteps + currentStep) / (totalItems * totalSteps)) * 100
  ));

  const stepsConfig = [
    { num: 1, label: 'Identify', icon: Search },
    { num: 2, label: 'Live Price', icon: DollarSign },
    { num: 3, label: 'Price History', icon: LineChart },
    { num: 4, label: 'Verdict', icon: ShieldCheck }
  ];

  return (
    <div className="bg-white dark:bg-slate-900 border border-emerald-300 dark:border-emerald-500/30 rounded-2xl p-4 sm:p-5 shadow-lg dark:shadow-2xl space-y-4 animate-fade-down transition-colors">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
        <div className="flex items-center space-x-2.5">
          <Loader2 className="h-5 w-5 text-emerald-600 dark:text-emerald-400 animate-spin flex-shrink-0" />
          <div>
            <h4 className="text-sm font-semibold text-slate-900 dark:text-slate-100 flex items-center gap-2">
              <span>Checking Deals...</span>
              {totalItems > 1 && (
                <span className="px-2 py-0.5 rounded-full bg-slate-100 dark:bg-slate-800 text-xs text-slate-700 dark:text-slate-300 font-mono">
                  Item {itemIndex} of {totalItems}
                </span>
              )}
            </h4>
            <p className="text-xs text-emerald-700 dark:text-emerald-400 font-mono mt-0.5">{progress.message}</p>
          </div>
        </div>

        <div className="text-right">
          <span className="text-xl font-bold font-mono text-emerald-700 dark:text-emerald-400">{overallPercent}%</span>
        </div>
      </div>

      {/* Progress Bar Line */}
      <div className="w-full bg-slate-100 dark:bg-slate-950 rounded-full h-2.5 overflow-hidden p-[1px] border border-slate-300 dark:border-slate-800">
        <div
          className="relative overflow-hidden bg-gradient-to-r from-emerald-500 via-teal-400 to-amber-400 h-full rounded-full transition-all duration-500 ease-out shadow-sm shadow-emerald-500/50"
          style={{ width: `${Math.max(5, overallPercent)}%` }}
        >
          <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/40 to-transparent animate-shimmer-sweep" />
        </div>
      </div>

      {/* Step Pills */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 pt-1">
        {stepsConfig.map((s) => {
          const Icon = s.icon;
          const isDone = currentStep > s.num;
          const isCurrent = currentStep === s.num;

          return (
            <div
              key={s.num}
              className={`flex items-center space-x-2 px-3 py-2 rounded-xl text-xs transition-all border ${
                isDone
                  ? 'bg-emerald-50 dark:bg-emerald-950/40 border-emerald-300 dark:border-emerald-500/40 text-emerald-800 dark:text-emerald-300'
                  : isCurrent
                  ? 'bg-emerald-100 dark:bg-slate-800 border-emerald-500 dark:border-emerald-400/80 text-emerald-900 dark:text-white shadow-md'
                  : 'bg-slate-50 dark:bg-slate-950/50 border-slate-200 dark:border-slate-800/80 text-slate-400 dark:text-slate-500'
              }`}
            >
              {isDone ? (
                <CheckCircle2 className="h-4 w-4 text-emerald-600 dark:text-emerald-400 flex-shrink-0" />
              ) : isCurrent ? (
                <Loader2 className="h-4 w-4 text-emerald-600 dark:text-emerald-400 animate-spin flex-shrink-0" />
              ) : (
                <Icon className="h-4 w-4 text-slate-400 dark:text-slate-600 flex-shrink-0" />
              )}
              <span className={`font-medium ${isCurrent ? 'font-semibold text-emerald-900 dark:text-emerald-200' : ''}`}>
                [{s.num}/4] {s.label}
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
};