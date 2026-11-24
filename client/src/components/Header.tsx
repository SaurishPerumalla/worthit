import React from 'react';
import { Moon, Sun, Activity } from 'lucide-react';
import { PriceSentryLogo } from './Logo.js';

interface HeaderProps {
  darkMode: boolean;
  setDarkMode: (val: boolean) => void;
  activeItemCount: number;
}

export const Header: React.FC<HeaderProps> = ({ darkMode, setDarkMode, activeItemCount }) => {
  return (
    <header className="sticky top-0 z-40 backdrop-blur-md bg-white/90 dark:bg-slate-950/90 border-b border-slate-200 dark:border-slate-800 transition-colors shadow-sm dark:shadow-none">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 h-16 flex items-center justify-between">
        {/* Brand / Logo */}
        <div className="flex items-center space-x-3">
          <PriceSentryLogo size="md" />
          <div>
            <span className="font-black text-2xl tracking-tight text-slate-900 dark:text-white flex items-center transition-colors">
              Price<span className="text-emerald-500 dark:text-emerald-400">Sentry</span>
            </span>
            <p className="text-xs text-slate-500 dark:text-slate-400 hidden sm:block transition-colors font-medium">
              Price History &amp; Deal Validator
            </p>
          </div>
        </div>

        {/* Status & Theme Toggle */}
        <div className="flex items-center space-x-3">
          {activeItemCount > 0 && (
            <div className="flex items-center space-x-1.5 px-3 py-1 rounded-full bg-slate-100 dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300 text-xs font-semibold transition-colors">
              <Activity className="h-3.5 w-3.5 text-emerald-500 dark:text-emerald-400" />
              <span>{activeItemCount} {activeItemCount === 1 ? 'item' : 'items'} checked</span>
            </div>
          )}

          <button
            onClick={() => setDarkMode(!darkMode)}
            className="p-2 rounded-lg bg-slate-100 hover:bg-slate-200 dark:bg-slate-800/80 dark:hover:bg-slate-700 text-slate-600 hover:text-slate-900 dark:text-slate-300 dark:hover:text-white transition-colors border border-slate-200 dark:border-slate-700/60"
            title={darkMode ? 'Switch to Light Mode' : 'Switch to Dark Mode'}
            aria-label="Toggle theme"
          >
            {darkMode ? <Sun className="h-4 w-4 text-amber-400" /> : <Moon className="h-4 w-4 text-slate-600" />}
          </button>
        </div>
      </div>
    </header>
  );
};
