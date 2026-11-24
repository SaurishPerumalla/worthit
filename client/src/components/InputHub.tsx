import React, { useState } from 'react';
import { Search, ListPlus, ExternalLink, Plus, Trash2, ArrowRight } from 'lucide-react';

export type InputMode = 'single' | 'wishlist' | 'url';

interface InputHubProps {
  onScanSingle: (query: string) => void;
  onScanWishlist: (items: string[]) => void;
  onImportWishlistUrl: (url: string) => void;
  isLoading: boolean;
}

export const InputHub: React.FC<InputHubProps> = ({
  onScanSingle,
  onScanWishlist,
  onImportWishlistUrl,
  isLoading
}) => {
  const [activeTab, setActiveTab] = useState<InputMode>('single');

  // Tab 1 state
  const [singleInput, setSingleInput] = useState('');

  // Tab 2 state
  const [wishlistText, setWishlistText] = useState('');
  const [stagingList, setStagingList] = useState<string[]>([]);
  const [newItemInput, setNewItemInput] = useState('');

  // Tab 3 state
  const [wishlistUrl, setWishlistUrl] = useState('');

  const handleSingleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!singleInput.trim() || isLoading) return;
    onScanSingle(singleInput.trim());
  };

  const handleWishlistSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (isLoading) return;

    let itemsToScan: string[] = [];
    if (wishlistText.trim()) {
      itemsToScan = wishlistText
        .split('\n')
        .map(s => s.trim())
        .filter(Boolean);
    } else if (stagingList.length > 0) {
      itemsToScan = stagingList;
    }

    if (itemsToScan.length > 0) {
      onScanWishlist(itemsToScan);
    }
  };

  const handleUrlSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!wishlistUrl.trim() || isLoading) return;
    onImportWishlistUrl(wishlistUrl.trim());
  };

  const handleAddToStaging = () => {
    if (!newItemInput.trim()) return;
    setStagingList([...stagingList, newItemInput.trim()]);
    setNewItemInput('');
  };

  const handleRemoveFromStaging = (index: number) => {
    setStagingList(stagingList.filter((_, i) => i !== index));
  };

  return (
    <div className="bg-white dark:bg-slate-900 rounded-3xl border border-slate-200/90 dark:border-slate-800 p-5 sm:p-6 shadow-sm dark:shadow-xl relative overflow-hidden transition-all">
      {/* 1. Mode Segmented Tiles */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5 mb-5">
        {/* Tile Tab 1: Single Item */}
        <button
          type="button"
          onClick={() => setActiveTab('single')}
          className={`py-3 px-4 rounded-2xl border text-left transition-all flex items-center space-x-3 ${
            activeTab === 'single'
              ? 'bg-emerald-50 dark:bg-emerald-950/40 border-emerald-500 text-emerald-950 dark:text-emerald-300 shadow-sm ring-1 ring-emerald-500/30'
              : 'bg-slate-50/70 hover:bg-slate-100 dark:bg-slate-950/60 dark:hover:bg-slate-800/60 border-slate-200 dark:border-slate-800 text-slate-600 dark:text-slate-400'
          }`}
        >
          <div className={`p-2 rounded-xl flex-shrink-0 ${activeTab === 'single' ? 'bg-emerald-500 text-slate-950' : 'bg-slate-200 dark:bg-slate-800 text-slate-600 dark:text-slate-400'}`}>
            <Search className="h-4 w-4" />
          </div>
          <span className="text-xs sm:text-sm font-bold truncate">Single Item</span>
        </button>

        {/* Tile Tab 2: Wishlist Builder */}
        <button
          type="button"
          onClick={() => setActiveTab('wishlist')}
          className={`py-3 px-4 rounded-2xl border text-left transition-all flex items-center space-x-3 ${
            activeTab === 'wishlist'
              ? 'bg-emerald-50 dark:bg-emerald-950/40 border-emerald-500 text-emerald-950 dark:text-emerald-300 shadow-sm ring-1 ring-emerald-500/30'
              : 'bg-slate-50/70 hover:bg-slate-100 dark:bg-slate-950/60 dark:hover:bg-slate-800/60 border-slate-200 dark:border-slate-800 text-slate-600 dark:text-slate-400'
          }`}
        >
          <div className={`p-2 rounded-xl flex-shrink-0 ${activeTab === 'wishlist' ? 'bg-emerald-500 text-slate-950' : 'bg-slate-200 dark:bg-slate-800 text-slate-600 dark:text-slate-400'}`}>
            <ListPlus className="h-4 w-4" />
          </div>
          <span className="text-xs sm:text-sm font-bold truncate">Wishlist Builder</span>
        </button>

        {/* Tile Tab 3: Public Wishlist URL */}
        <button
          type="button"
          onClick={() => setActiveTab('url')}
          className={`py-3 px-4 rounded-2xl border text-left transition-all flex items-center space-x-3 ${
            activeTab === 'url'
              ? 'bg-emerald-50 dark:bg-emerald-950/40 border-emerald-500 text-emerald-950 dark:text-emerald-300 shadow-sm ring-1 ring-emerald-500/30'
              : 'bg-slate-50/70 hover:bg-slate-100 dark:bg-slate-950/60 dark:hover:bg-slate-800/60 border-slate-200 dark:border-slate-800 text-slate-600 dark:text-slate-400'
          }`}
        >
          <div className={`p-2 rounded-xl flex-shrink-0 ${activeTab === 'url' ? 'bg-emerald-500 text-slate-950' : 'bg-slate-200 dark:bg-slate-800 text-slate-600 dark:text-slate-400'}`}>
            <ExternalLink className="h-4 w-4" />
          </div>
          <span className="text-xs sm:text-sm font-bold truncate">Amazon Wishlist URL</span>
        </button>
      </div>

      {/* 2. Active Mode Content */}
      {/* Mode 1: Single Item Input */}
      {activeTab === 'single' && (
        <form onSubmit={handleSingleSubmit}>
          <div className="relative">
            <input
              type="text"
              value={singleInput}
              onChange={(e) => setSingleInput(e.target.value)}
              placeholder="Search product name, paste Amazon link, or enter ASIN..."
              disabled={isLoading}
              className="w-full bg-slate-50 dark:bg-slate-950/80 border border-slate-300 dark:border-slate-700/80 rounded-2xl px-4 py-3.5 pl-11 pr-32 text-sm sm:text-base text-slate-900 dark:text-slate-100 placeholder-slate-400 dark:placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-emerald-500/50 focus:border-emerald-500 transition-all shadow-inner"
            />
            <Search className="absolute left-3.5 top-3.5 h-5 w-5 text-slate-400 dark:text-slate-500" />
            <button
              type="submit"
              disabled={!singleInput.trim() || isLoading}
              className="absolute right-2 top-2 bottom-2 px-4 rounded-xl bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 text-white font-bold text-xs sm:text-sm flex items-center space-x-1.5 transition-all shadow-md shadow-emerald-700/20"
            >
              <span>{isLoading ? 'Checking...' : 'Check Deal'}</span>
              <ArrowRight className="h-4 w-4" />
            </button>
          </div>
        </form>
      )}

      {/* Mode 2: Multi-Item Wishlist Builder */}
      {activeTab === 'wishlist' && (
        <form onSubmit={handleWishlistSubmit} className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* Direct Multi-line Paste Tile */}
            <div className="bg-slate-50/70 dark:bg-slate-950/40 p-4 rounded-2xl border border-slate-200 dark:border-slate-800">
              <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wider mb-2">
                Paste Multiple Items (One per line)
              </label>
              <textarea
                rows={4}
                value={wishlistText}
                onChange={(e) => setWishlistText(e.target.value)}
                placeholder="Apple AirPods Pro 2&#10;Sony WH-1000XM5&#10;https://www.amazon.com/dp/B09TMN58KL"
                disabled={isLoading}
                className="w-full bg-white dark:bg-slate-950/80 border border-slate-300 dark:border-slate-700/80 rounded-xl p-3 text-xs sm:text-sm font-mono text-slate-800 dark:text-slate-200 placeholder-slate-400 dark:placeholder-slate-600 focus:outline-none focus:ring-2 focus:ring-emerald-500/50 focus:border-emerald-500 transition-all"
              />
            </div>

            {/* Interactive Staging Builder Tile */}
            <div className="bg-slate-50/70 dark:bg-slate-950/40 p-4 rounded-2xl border border-slate-200 dark:border-slate-800 flex flex-col justify-between">
              <div>
                <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wider mb-2">
                  Add Items One by One
                </label>
                <div className="flex gap-2 mb-2">
                  <input
                    type="text"
                    value={newItemInput}
                    onChange={(e) => setNewItemInput(e.target.value)}
                    onKeyDown={(e) => e.key === 'Enter' && (e.preventDefault(), handleAddToStaging())}
                    placeholder="Enter name, URL or ASIN..."
                    className="flex-1 bg-white dark:bg-slate-950/80 border border-slate-300 dark:border-slate-700/80 rounded-xl px-3 py-2 text-xs sm:text-sm text-slate-900 dark:text-slate-100 placeholder-slate-400 dark:placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-emerald-500/50"
                  />
                  <button
                    type="button"
                    onClick={handleAddToStaging}
                    className="px-3.5 py-2 bg-slate-200 hover:bg-slate-300 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-800 dark:text-slate-200 rounded-xl text-xs font-bold flex items-center space-x-1 transition-colors"
                  >
                    <Plus className="h-3.5 w-3.5" />
                    <span>Add</span>
                  </button>
                </div>

                {stagingList.length > 0 ? (
                  <div className="max-h-24 overflow-y-auto space-y-1 pr-1">
                    {stagingList.map((item, idx) => (
                      <div key={idx} className="flex items-center justify-between text-xs bg-white dark:bg-slate-900 px-2.5 py-1.5 rounded-lg border border-slate-200 dark:border-slate-800 text-slate-800 dark:text-slate-300">
                        <span className="truncate max-w-[200px]">{item}</span>
                        <button
                          type="button"
                          onClick={() => handleRemoveFromStaging(idx)}
                          className="text-slate-400 hover:text-rose-600 dark:text-slate-500 dark:hover:text-rose-400 p-0.5"
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </button>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="text-xs text-slate-400 italic py-2">No items added yet.</p>
                )}
              </div>
            </div>
          </div>

          <div className="flex justify-end pt-2 border-t border-slate-200 dark:border-slate-800">
            <button
              type="submit"
              disabled={isLoading || (!wishlistText.trim() && stagingList.length === 0)}
              className="px-5 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 text-white font-bold text-xs sm:text-sm flex items-center space-x-2 transition-all shadow-md shadow-emerald-700/20"
            >
              <span>{isLoading ? 'Checking Deals...' : 'Check All Items'}</span>
              <ArrowRight className="h-4 w-4" />
            </button>
          </div>
        </form>
      )}

      {/* Mode 3: Public Wishlist URL Input */}
      {activeTab === 'url' && (
        <form onSubmit={handleUrlSubmit}>
          <div className="relative">
            <input
              type="text"
              value={wishlistUrl}
              onChange={(e) => setWishlistUrl(e.target.value)}
              placeholder="Paste public Amazon Wishlist URL (https://www.amazon.com/hz/wishlist/ls/...)"
              disabled={isLoading}
              className="w-full bg-slate-50 dark:bg-slate-950/80 border border-slate-300 dark:border-slate-700/80 rounded-2xl px-4 py-3.5 pl-11 pr-36 text-sm sm:text-base text-slate-900 dark:text-slate-100 placeholder-slate-400 dark:placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-emerald-500/50 focus:border-emerald-500 transition-all shadow-inner"
            />
            <ExternalLink className="absolute left-3.5 top-3.5 h-5 w-5 text-slate-400 dark:text-slate-500" />
            <button
              type="submit"
              disabled={!wishlistUrl.trim() || isLoading}
              className="absolute right-2 top-2 bottom-2 px-4 rounded-xl bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 text-white font-bold text-xs sm:text-sm flex items-center space-x-1.5 transition-all shadow-md shadow-emerald-700/20"
            >
              <span>{isLoading ? 'Importing...' : 'Import &amp; Check'}</span>
              <ArrowRight className="h-4 w-4" />
            </button>
          </div>
        </form>
      )}
    </div>
  );
};