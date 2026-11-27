import React, { useState, useRef, useEffect } from 'react';
import { Capacitor } from '@capacitor/core';
import { Search, Plus, ArrowRight, Store, ChevronDown, Check, X, Lock } from 'lucide-react';
import { isCoreFreeStore } from '../utils/subscription.js';

const SHOULD_AUTO_FOCUS = typeof window !== 'undefined' && !Capacitor.isNativePlatform() && window.innerWidth >= 640;

const PRESET_STORES = [
  { name: 'Target', dot: 'bg-red-500' },
  { name: 'Best Buy', dot: 'bg-yellow-400' },
  { name: 'Walmart', dot: 'bg-blue-500' },
  { name: 'Costco', dot: 'bg-rose-500' },
  { name: 'B&H Photo', dot: 'bg-sky-500' },
  { name: 'Newegg', dot: 'bg-orange-500' },
  { name: 'GameStop', dot: 'bg-rose-400' },
  { name: 'Micro Center', dot: 'bg-sky-400' },
  { name: 'Apple', dot: 'bg-slate-400' },
  { name: 'eBay', dot: 'bg-violet-500' }
];

export type InputMode = 'single' | 'wishlist' | 'url';

interface InputHubProps {
  onScanSingle: (query: string) => void;
  onScanWishlist?: (items: string[]) => void;
  onImportWishlistUrl?: (url: string) => void;
  isLoading: boolean;
  selectedStores: string[];
  onChangeStores: (stores: string[]) => void;
  section?: 'all' | 'top' | 'bottom';
  isPro?: boolean;
  onOpenPaywall?: () => void;
}

export const InputHub: React.FC<InputHubProps> = ({
  onScanSingle,
  isLoading,
  selectedStores,
  onChangeStores,
  section = 'all',
  isPro = true,
  onOpenPaywall
}) => {
  const [activeTab, setActiveTab] = useState<InputMode>('single');
  const [storeMenuOpen, setStoreMenuOpen] = useState(false);
  const [customStoreInput, setCustomStoreInput] = useState('');
  const dropdownRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setStoreMenuOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const toggleStore = (storeName: string) => {
    const exists = selectedStores.some(s => s.toLowerCase() === storeName.toLowerCase());
    if (exists) {
      if (selectedStores.length <= 1) return; // keep at least 1 store
      onChangeStores(selectedStores.filter(s => s.toLowerCase() !== storeName.toLowerCase()));
    } else {
      if (!isPro && !isCoreFreeStore(storeName)) {
        onOpenPaywall?.();
        return;
      }
      onChangeStores([...selectedStores, storeName]);
    }
  };

  const handleAddCustomStore = () => {
    const cleaned = customStoreInput
      .trim()
      .replace(/^https?:\/\//i, '')
      .replace(/^www\./i, '')
      .replace(/\/.*$/, '');
    if (!cleaned || cleaned.toLowerCase() === 'amazon') return;
    if (!isPro && !isCoreFreeStore(cleaned)) {
      onOpenPaywall?.();
      return;
    }
    if (!selectedStores.some(s => s.toLowerCase() === cleaned.toLowerCase())) {
      onChangeStores([...selectedStores, cleaned]);
    }
    setCustomStoreInput('');
  };

  // Single item state
  const [singleInput, setSingleInput] = useState('');

  const handleSingleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (isLoading) return;
    onScanSingle(singleInput);
  };

  return (
    <div className="space-y-3">
      {/* Tile 1: Single Item */}
      {(section === 'all' || section === 'top') && (
      <div
        className={`animate-fade-up rounded-2xl border transition-all duration-200 overflow-hidden ${
          activeTab === 'single'
            ? 'bg-white dark:bg-[#130d2a]/90 border-violet-500/70 shadow-md ring-1 ring-violet-500/30'
            : 'bg-white/70 dark:bg-slate-900/40 border-slate-200 dark:border-slate-800 hover:border-slate-300 dark:hover:border-slate-700'
        }`}
      >
        <button
          type="button"
          onClick={() => setActiveTab('single')}
          className="w-full p-4 text-left flex items-center justify-between transition-colors"
        >
          <div className="flex items-center space-x-3 min-w-0">
            <div
              className={`p-2 rounded-xl flex-shrink-0 transition-colors ${
                activeTab === 'single'
                  ? 'bg-gradient-to-br from-violet-600 to-emerald-400 text-white shadow-sm'
                  : 'bg-slate-100 dark:bg-slate-800 text-slate-500 dark:text-slate-400'
              }`}
            >
              <Search className="h-4 w-4" />
            </div>
            <div className="min-w-0">
              <span className="text-sm font-bold block text-slate-900 dark:text-white truncate">
                Single Item
              </span>
              <span className="text-xs text-slate-500 dark:text-slate-400 truncate block">
                Instant check by product name, Amazon URL, or ASIN
              </span>
            </div>
          </div>
          <div className="relative flex-shrink-0 ml-2">
            {activeTab === 'single' && (
              <span className="absolute inset-0 rounded-full bg-emerald-400 animate-ping opacity-50" />
            )}
            <div
              className={`relative h-3 w-3 rounded-full transition-all ${
                activeTab === 'single'
                  ? 'bg-emerald-500 ring-4 ring-emerald-500/20'
                  : 'border-2 border-slate-300 dark:border-slate-700'
              }`}
            />
          </div>
        </button>

        {activeTab === 'single' && (
          <div className="animate-fade-down px-4 pb-4 pt-1 border-t border-slate-100 dark:border-slate-800/80">
            <form onSubmit={handleSingleSubmit}>
              <div className="flex flex-col sm:flex-row gap-2.5">
                <div className="relative flex-1">
                  <input
                    type="text"
                    value={singleInput}
                    onChange={(e) => setSingleInput(e.target.value)}
                    placeholder="Enter product name, paste link, or ASIN..."
                    disabled={isLoading}
                    autoFocus={SHOULD_AUTO_FOCUS}
                    className="w-full bg-slate-50 dark:bg-slate-950/80 border border-slate-300 dark:border-slate-700/80 rounded-xl px-4 py-3 pl-10 text-base sm:text-sm text-slate-900 dark:text-slate-100 placeholder-slate-400 dark:placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-emerald-500/50 focus:border-emerald-500 transition-all shadow-inner"
                  />
                  <Search className="absolute left-3.5 top-3.5 h-4 w-4 text-slate-400 dark:text-slate-500" />
                </div>
                <button
                  type="submit"
                  disabled={!singleInput.trim() || isLoading}
                  className="relative overflow-hidden group press-scale py-3 px-5 rounded-xl bg-gradient-to-r from-violet-600 via-indigo-600 to-emerald-500 hover:from-violet-500 hover:via-indigo-500 hover:to-emerald-400 disabled:opacity-50 text-white font-bold text-sm flex items-center justify-center space-x-1.5 transition-all shadow-lg shadow-violet-700/30 whitespace-nowrap flex-shrink-0"
                >
                  {singleInput.trim() && !isLoading && (
                    <span className="pointer-events-none absolute inset-0 bg-gradient-to-r from-transparent via-white/25 to-transparent animate-shimmer-sweep" />
                  )}
                  <span className="relative">{isLoading ? 'Checking...' : 'Check Deal'}</span>
                  <ArrowRight className="relative h-4 w-4 transition-transform duration-200 group-hover:translate-x-1" />
                </button>
              </div>
            </form>
          </div>
        )}
      </div>
      )}

      {/* Store Comparison Bar: Always-visible Search/Add Store Input + Quick-Add Dropdown */}
      {(section === 'all' || section === 'bottom') && (
      <div ref={dropdownRef} style={{ animationDelay: '210ms' }} className="relative animate-fade-up">
        <div className="px-3.5 py-3 rounded-2xl bg-white/80 dark:bg-slate-900/50 border border-slate-200 dark:border-slate-800 space-y-2.5">
          {/* Active Stores Chips */}
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-xs font-semibold text-slate-600 dark:text-slate-400 flex items-center gap-1.5">
              <Store className="h-3.5 w-3.5 text-emerald-500" />
              <span>Compare with:</span>
            </span>
            <div className="flex items-center flex-wrap gap-1.5">
              {selectedStores.map((store) => (
                <span
                  key={store}
                  className="animate-scale-in inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-medium bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-200 border border-slate-200 dark:border-slate-700 transition-colors"
                >
                  <span>{store}</span>
                  {selectedStores.length > 1 && (
                    <button
                      type="button"
                      onClick={() => toggleStore(store)}
                      className="text-slate-400 hover:text-rose-500 transition-colors"
                      aria-label={`Remove ${store}`}
                    >
                      <X className="h-3 w-3" />
                    </button>
                  )}
                </span>
              ))}
            </div>
          </div>

          {/* Search/Add Store Bar FIRST, then Quick-Add Stores Dropdown Button */}
          <div className="flex flex-col sm:flex-row gap-2">
            <div className="flex flex-1 gap-2">
              <div className="relative flex-1">
                <Search className="absolute left-3 top-2.5 h-3.5 w-3.5 text-slate-400 dark:text-slate-500" />
                <input
                  type="text"
                  value={customStoreInput}
                  onChange={(e) => setCustomStoreInput(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') {
                      e.preventDefault();
                      handleAddCustomStore();
                    }
                  }}
                  disabled={isLoading}
                  placeholder="Add store or website (e.g. Costco, adorama.com)..."
                  className="w-full bg-slate-50 dark:bg-slate-950/80 border border-slate-300 dark:border-slate-700 rounded-xl pl-8 pr-3 py-2 text-base sm:text-xs text-slate-900 dark:text-slate-100 placeholder-slate-400 dark:placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-emerald-500/50"
                />
              </div>
              <button
                type="button"
                onClick={handleAddCustomStore}
                disabled={!customStoreInput.trim() || isLoading}
                className="px-3.5 py-2 rounded-xl bg-gradient-to-r from-violet-600 to-indigo-600 hover:from-violet-500 hover:to-indigo-500 disabled:opacity-50 text-white text-xs font-bold flex items-center gap-1 transition-all shadow-sm shadow-violet-700/25 flex-shrink-0"
              >
                <Plus className="h-3.5 w-3.5" />
                <span>Add</span>
              </button>
            </div>

            <button
              type="button"
              onClick={() => setStoreMenuOpen(o => !o)}
              disabled={isLoading}
              className="inline-flex items-center justify-center gap-1.5 px-3.5 py-2 rounded-xl bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-xs font-semibold text-slate-800 dark:text-slate-200 border border-slate-200 dark:border-slate-700 transition-colors flex-shrink-0"
            >
              <span>Quick Add ({selectedStores.length})</span>
              <ChevronDown className={`h-3.5 w-3.5 transition-transform ${storeMenuOpen ? 'rotate-180' : ''}`} />
            </button>
          </div>
        </div>

        {storeMenuOpen && (
          <div className="animate-fade-down mt-2 p-3.5 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 shadow-xl space-y-2.5 z-30">
            <div className="flex items-center justify-between">
              <span className="text-[11px] font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">
                Quick-Add Popular Stores (Amazon Always Included)
              </span>
              <button
                type="button"
                onClick={() => onChangeStores(['Target', 'Best Buy', 'Walmart'])}
                className="text-[11px] font-semibold text-emerald-600 dark:text-emerald-400 hover:underline"
              >
                Reset Default
              </button>
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-5 gap-1.5">
              {PRESET_STORES.filter(s =>
                !customStoreInput.trim() || s.name.toLowerCase().includes(customStoreInput.trim().toLowerCase())
              ).map((store) => {
                const isSelected = selectedStores.some(s => s.toLowerCase() === store.name.toLowerCase());
                const isLocked = !isPro && !isCoreFreeStore(store.name);
                return (
                  <button
                    key={store.name}
                    type="button"
                    onClick={() => toggleStore(store.name)}
                    className={`flex items-center justify-between px-2.5 py-2 rounded-xl text-xs font-medium border transition-all ${
                      isSelected
                        ? 'bg-emerald-50 dark:bg-emerald-950/40 border-emerald-400 dark:border-emerald-500/60 text-emerald-900 dark:text-emerald-200'
                        : 'bg-slate-50 dark:bg-slate-950/60 border-slate-200 dark:border-slate-800 text-slate-600 dark:text-slate-400 hover:border-slate-300 dark:hover:border-slate-700'
                    }`}
                  >
                    <span className="flex items-center gap-1.5 truncate">
                      <span className={`h-2 w-2 rounded-full flex-shrink-0 ${store.dot}`} />
                      <span className="truncate">{store.name}</span>
                    </span>
                    {isLocked ? (
                      <Lock className="h-3 w-3 text-amber-500 flex-shrink-0" />
                    ) : isSelected ? (
                      <Check className="h-3.5 w-3.5 text-emerald-600 dark:text-emerald-400 flex-shrink-0" />
                    ) : null}
                  </button>
                );
              })}
            </div>
          </div>
        )}
      </div>
      )}
    </div>
  );
};
