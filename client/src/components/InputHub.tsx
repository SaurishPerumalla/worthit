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
    <div className="space-y-3">
      {/* Tile 1: Single Item */}
      <div
        className={`rounded-2xl border transition-all duration-200 overflow-hidden ${
          activeTab === 'single'
            ? 'bg-white dark:bg-slate-900 border-emerald-500 shadow-md ring-1 ring-emerald-500/30'
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
                  ? 'bg-emerald-500 text-slate-950 shadow-sm'
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
          <div
            className={`h-3 w-3 rounded-full flex-shrink-0 ml-2 transition-all ${
              activeTab === 'single'
                ? 'bg-emerald-500 ring-4 ring-emerald-500/20'
                : 'border-2 border-slate-300 dark:border-slate-700'
            }`}
          />
        </button>

        {activeTab === 'single' && (
          <div className="px-4 pb-4 pt-1 border-t border-slate-100 dark:border-slate-800/80">
            <form onSubmit={handleSingleSubmit}>
              <div className="flex flex-col sm:flex-row gap-2.5">
                <div className="relative flex-1">
                  <input
                    type="text"
                    value={singleInput}
                    onChange={(e) => setSingleInput(e.target.value)}
                    placeholder="Enter product name, paste link, or ASIN..."
                    disabled={isLoading}
                    autoFocus
                    className="w-full bg-slate-50 dark:bg-slate-950/80 border border-slate-300 dark:border-slate-700/80 rounded-xl px-4 py-3 pl-10 text-sm text-slate-900 dark:text-slate-100 placeholder-slate-400 dark:placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-emerald-500/50 focus:border-emerald-500 transition-all shadow-inner"
                  />
                  <Search className="absolute left-3.5 top-3.5 h-4 w-4 text-slate-400 dark:text-slate-500" />
                </div>
                <button
                  type="submit"
                  disabled={!singleInput.trim() || isLoading}
                  className="py-3 px-5 rounded-xl bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 text-white font-bold text-sm flex items-center justify-center space-x-1.5 transition-all shadow-md shadow-emerald-700/20 whitespace-nowrap flex-shrink-0"
                >
                  <span>{isLoading ? 'Checking...' : 'Check Deal'}</span>
                  <ArrowRight className="h-4 w-4" />
                </button>
              </div>
            </form>
          </div>
        )}
      </div>

      {/* Tile 2: Wishlist Builder */}
      <div
        className={`rounded-2xl border transition-all duration-200 overflow-hidden ${
          activeTab === 'wishlist'
            ? 'bg-white dark:bg-slate-900 border-emerald-500 shadow-md ring-1 ring-emerald-500/30'
            : 'bg-white/70 dark:bg-slate-900/40 border-slate-200 dark:border-slate-800 hover:border-slate-300 dark:hover:border-slate-700'
        }`}
      >
        <button
          type="button"
          onClick={() => setActiveTab('wishlist')}
          className="w-full p-4 text-left flex items-center justify-between transition-colors"
        >
          <div className="flex items-center space-x-3 min-w-0">
            <div
              className={`p-2 rounded-xl flex-shrink-0 transition-colors ${
                activeTab === 'wishlist'
                  ? 'bg-emerald-500 text-slate-950 shadow-sm'
                  : 'bg-slate-100 dark:bg-slate-800 text-slate-500 dark:text-slate-400'
              }`}
            >
              <ListPlus className="h-4 w-4" />
            </div>
            <div className="min-w-0">
              <span className="text-sm font-bold block text-slate-900 dark:text-white truncate">
                Wishlist Builder
              </span>
              <span className="text-xs text-slate-500 dark:text-slate-400 truncate block">
                Batch compare multiple products at once
              </span>
            </div>
          </div>
          <div
            className={`h-3 w-3 rounded-full flex-shrink-0 ml-2 transition-all ${
              activeTab === 'wishlist'
                ? 'bg-emerald-500 ring-4 ring-emerald-500/20'
                : 'border-2 border-slate-300 dark:border-slate-700'
            }`}
          />
        </button>

        {activeTab === 'wishlist' && (
          <div className="px-4 pb-4 pt-1 border-t border-slate-100 dark:border-slate-800/80">
            <form onSubmit={handleWishlistSubmit} className="space-y-3">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                {/* Direct Multi-line Paste */}
                <div className="bg-slate-50/70 dark:bg-slate-950/40 p-3.5 rounded-xl border border-slate-200 dark:border-slate-800">
                  <label className="block text-[11px] font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wider mb-1.5">
                    Paste Multiple Items (One per line)
                  </label>
                  <textarea
                    rows={4}
                    value={wishlistText}
                    onChange={(e) => setWishlistText(e.target.value)}
                    placeholder="Apple AirPods Pro 2&#10;Sony WH-1000XM5&#10;B0HJB73N19"
                    disabled={isLoading}
                    className="w-full bg-white dark:bg-slate-950/80 border border-slate-300 dark:border-slate-700/80 rounded-lg p-2.5 text-xs sm:text-sm font-mono text-slate-800 dark:text-slate-200 placeholder-slate-400 dark:placeholder-slate-600 focus:outline-none focus:ring-2 focus:ring-emerald-500/50"
                  />
                </div>

                {/* Item-by-item Staging */}
                <div className="bg-slate-50/70 dark:bg-slate-950/40 p-3.5 rounded-xl border border-slate-200 dark:border-slate-800 flex flex-col justify-between">
                  <div>
                    <label className="block text-[11px] font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wider mb-1.5">
                      Add Items One by One
                    </label>
                    <div className="flex gap-2 mb-2">
                      <input
                        type="text"
                        value={newItemInput}
                        onChange={(e) => setNewItemInput(e.target.value)}
                        onKeyDown={(e) => e.key === 'Enter' && (e.preventDefault(), handleAddToStaging())}
                        placeholder="Enter name, URL or ASIN..."
                        className="flex-1 bg-white dark:bg-slate-950/80 border border-slate-300 dark:border-slate-700/80 rounded-lg px-3 py-2 text-xs sm:text-sm text-slate-900 dark:text-slate-100 placeholder-slate-400 dark:placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-emerald-500/50"
                      />
                      <button
                        type="button"
                        onClick={handleAddToStaging}
                        className="px-3 py-2 bg-slate-200 hover:bg-slate-300 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-800 dark:text-slate-200 rounded-lg text-xs font-bold flex items-center space-x-1 transition-colors"
                      >
                        <Plus className="h-3.5 w-3.5" />
                        <span>Add</span>
                      </button>
                    </div>

                    {stagingList.length > 0 ? (
                      <div className="max-h-24 overflow-y-auto space-y-1 pr-1">
                        {stagingList.map((item, idx) => (
                          <div key={idx} className="flex items-center justify-between text-xs bg-white dark:bg-slate-900 px-2.5 py-1.5 rounded-md border border-slate-200 dark:border-slate-800 text-slate-800 dark:text-slate-300">
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
                      <p className="text-xs text-slate-400 italic py-1">No items added yet.</p>
                    )}
                  </div>
                </div>
              </div>

              <div className="flex justify-end pt-1">
                <button
                  type="submit"
                  disabled={isLoading || (!wishlistText.trim() && stagingList.length === 0)}
                  className="py-2.5 px-5 rounded-xl bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 text-white font-bold text-sm flex items-center space-x-2 transition-all shadow-md shadow-emerald-700/20"
                >
                  <span>{isLoading ? 'Checking Deals...' : 'Check All Items'}</span>
                  <ArrowRight className="h-4 w-4" />
                </button>
              </div>
            </form>
          </div>
        )}
      </div>

      {/* Tile 3: Public Wishlist URL */}
      <div
        className={`rounded-2xl border transition-all duration-200 overflow-hidden ${
          activeTab === 'url'
            ? 'bg-white dark:bg-slate-900 border-emerald-500 shadow-md ring-1 ring-emerald-500/30'
            : 'bg-white/70 dark:bg-slate-900/40 border-slate-200 dark:border-slate-800 hover:border-slate-300 dark:hover:border-slate-700'
        }`}
      >
        <button
          type="button"
          onClick={() => setActiveTab('url')}
          className="w-full p-4 text-left flex items-center justify-between transition-colors"
        >
          <div className="flex items-center space-x-3 min-w-0">
            <div
              className={`p-2 rounded-xl flex-shrink-0 transition-colors ${
                activeTab === 'url'
                  ? 'bg-emerald-500 text-slate-950 shadow-sm'
                  : 'bg-slate-100 dark:bg-slate-800 text-slate-500 dark:text-slate-400'
              }`}
            >
              <ExternalLink className="h-4 w-4" />
            </div>
            <div className="min-w-0">
              <span className="text-sm font-bold block text-slate-900 dark:text-white truncate">
                Amazon Wishlist URL
              </span>
              <span className="text-xs text-slate-500 dark:text-slate-400 truncate block">
                Paste any public Amazon Wishlist link to scan every item
              </span>
            </div>
          </div>
          <div
            className={`h-3 w-3 rounded-full flex-shrink-0 ml-2 transition-all ${
              activeTab === 'url'
                ? 'bg-emerald-500 ring-4 ring-emerald-500/20'
                : 'border-2 border-slate-300 dark:border-slate-700'
            }`}
          />
        </button>

        {activeTab === 'url' && (
          <div className="px-4 pb-4 pt-1 border-t border-slate-100 dark:border-slate-800/80">
            <form onSubmit={handleUrlSubmit}>
              <div className="flex flex-col sm:flex-row gap-2.5">
                <div className="relative flex-1">
                  <input
                    type="text"
                    value={wishlistUrl}
                    onChange={(e) => setWishlistUrl(e.target.value)}
                    placeholder="Paste public Wishlist URL (https://www.amazon.com/hz/wishlist/ls/...)"
                    disabled={isLoading}
                    autoFocus
                    className="w-full bg-slate-50 dark:bg-slate-950/80 border border-slate-300 dark:border-slate-700/80 rounded-xl px-4 py-3 pl-10 text-sm text-slate-900 dark:text-slate-100 placeholder-slate-400 dark:placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-emerald-500/50 focus:border-emerald-500 transition-all shadow-inner"
                  />
                  <ExternalLink className="absolute left-3.5 top-3.5 h-4 w-4 text-slate-400 dark:text-slate-500" />
                </div>
                <button
                  type="submit"
                  disabled={!wishlistUrl.trim() || isLoading}
                  className="py-3 px-5 rounded-xl bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 text-white font-bold text-sm flex items-center justify-center space-x-1.5 transition-all shadow-md shadow-emerald-700/20 whitespace-nowrap flex-shrink-0"
                >
                  <span>{isLoading ? 'Importing...' : 'Import & Check'}</span>
                  <ArrowRight className="h-4 w-4" />
                </button>
              </div>
            </form>
          </div>
        )}
      </div>
    </div>
  );
};
