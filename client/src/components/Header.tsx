import React from 'react';
import { Moon, Sun, Activity, Crown } from 'lucide-react';
import { DealChaserLogo } from './Logo.js';
import { FREE_DAILY_LIMIT } from '../utils/subscription.js';

interface HeaderProps {
  darkMode: boolean;
  setDarkMode: (val: boolean) => void;
  activeItemCount: number;
  isPro: boolean;
  remaining: number;
  onOpenPaywall: () => void;
}

export const Header: React.FC<HeaderProps> = ({
  darkMode,
  setDarkMode,
  activeItemCount,
  isPro,
  remaining,
  onOpenPaywall
}) => {
  return (
    <header className="sticky top-0 z-40 backdrop-blur-md bg-white/90 dark:bg-slate-950/90 border-b border-slate-200 dark:border-slate-800 transition-colors shadow-sm dark:shadow-none">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 h-16 flex items-center justify-between">
        {/* Brand / Logo */}
        <div className="flex items-center space-x-3">
          <DealChaserLogo size="md" />
          <div>
            <span className="font-black text-2xl tracking-tight text-slate-900 dark:text-white flex items-center transition-colors">
              Deal<span className="text-emerald-500 dark:text-emerald-400">Chaser</span>
            </span>
            <p className="text-xs text-slate-500 dark:text-slate-400 hidden sm:block transition-colors font-medium">
              Price History &amp; Deal Validator
            </p>
          </div>
        </div>

        {/* Status, Plan Pill & Theme Toggle */}
        <div className="flex items-center space-x-2">
          <button
            type="button"
            onClick={onOpenPaywall}
            className={`press-scale flex items-center space-x-1.5 px-2.5 py-1 rounded-full text-xs font-bold border transition-colors ${
              isPro
                ? 'bg-emerald-500/15 border-emerald-500/40 text-emerald-700 dark:text-emerald-300'
                : 'bg-slate-100 hover:bg-slate-200 dark:bg-slate-800/90 dark:hover:bg-slate-700 border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-200'
            }`}
            title={isPro ? 'DealChaser Pro Active' : 'Upgrade to DealChaser Pro'}
          >
            <Crown className={`h-3.5 w-3.5 ${isPro ? 'text-emerald-500' : 'text-amber-500'}`} />
            <span>{isPro ? 'PRO' : `Free: ${Math.max(0, remaining)}/${FREE_DAILY_LIMIT}`}</span>
          </button>

          {activeItemCount > 0 && (
            <div className="animate-scale-in hidden sm:flex items-center space-x-1.5 px-3 py-1 rounded-full bg-slate-100 dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300 text-xs font-semibold transition-colors">
              <Activity className="h-3.5 w-3.5 text-emerald-500 dark:text-emerald-400 animate-pulse" />
              <span>{activeItemCount} {activeItemCount === 1 ? 'item' : 'items'} checked</span>
            </div>
          )}

          <button
            onClick={() => setDarkMode(!darkMode)}
            className="group press-scale p-2 rounded-lg bg-slate-100 hover:bg-slate-200 dark:bg-slate-800/80 dark:hover:bg-slate-700 text-slate-600 hover:text-slate-900 dark:text-slate-300 dark:hover:text-white transition-all duration-200 border border-slate-200 dark:border-slate-700/60"
            title={darkMode ? 'Switch to Light Mode' : 'Switch to Dark Mode'}
            aria-label="Toggle theme"
          >
            {darkMode ? (
              <Sun className="h-4 w-4 text-amber-400 transition-transform duration-300 group-hover:rotate-45" />
            ) : (
              <Moon className="h-4 w-4 text-slate-600 transition-transform duration-300 group-hover:-rotate-12" />
            )}
          </button>
        </div>
      </div>
    </header>
  );
};
