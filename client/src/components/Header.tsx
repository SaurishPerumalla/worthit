import React from 'react';
import { Moon, Sun, Activity } from 'lucide-react';
import { DealChaserLogo } from './Logo.js';

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

        {/* Status & Theme Toggle */}
        <div className="flex items-center space-x-3">
          {activeItemCount > 0 && (
            <div className="animate-scale-in flex items-center space-x-1.5 px-3 py-1 rounded-full bg-slate-100 dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300 text-xs font-semibold transition-colors">
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
