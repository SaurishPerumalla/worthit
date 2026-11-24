import React, { useState } from 'react';
import { ChevronDown, ChevronUp, LineChart, ExternalLink, RefreshCw, AlertCircle } from 'lucide-react';
import { apiUrl } from '../utils/api.js';

interface ChartDrawerProps {
  asin: string;
  title: string;
}

type TimeRange = 'all' | '1y' | '6m' | '3m';

export const ChartDrawer: React.FC<ChartDrawerProps> = ({ asin, title }) => {
  const [isOpen, setIsOpen] = useState(false);
  const [timeRange, setTimeRange] = useState<TimeRange>('all');
  const [imgError, setImgError] = useState(false);
  const [retryKey, setRetryKey] = useState(0);

  const chartUrl = apiUrl(`/api/chart-proxy?asin=${asin}&tp=${timeRange}&_r=${retryKey}`);

  const timeRanges: { label: string; value: TimeRange }[] = [
    { label: 'All Time', value: 'all' },
    { label: '1 Year', value: '1y' },
    { label: '6 Months', value: '6m' },
    { label: '3 Months', value: '3m' },
  ];

  const handleRetry = () => {
    setImgError(false);
    setRetryKey(prev => prev + 1);
  };

  return (
    <div className="border-t border-slate-200 dark:border-slate-800/80 pt-3 transition-colors">
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="w-full flex items-center justify-between text-xs font-semibold text-slate-700 hover:text-emerald-700 dark:text-slate-300 dark:hover:text-emerald-400 py-2 px-3 rounded-xl bg-slate-50 hover:bg-slate-100 dark:bg-slate-950/60 dark:hover:bg-slate-800/60 transition-all border border-slate-200 dark:border-slate-800"
      >
        <span className="flex items-center gap-2 truncate">
          <LineChart className="h-4 w-4 text-emerald-600 dark:text-emerald-400 flex-shrink-0" />
          <span className="truncate">Price History Chart</span>
        </span>
        <span className="flex items-center gap-1 text-slate-500 dark:text-slate-400 flex-shrink-0 text-[11px]">
          <span>{isOpen ? 'Collapse' : 'Expand'}</span>
          {isOpen ? <ChevronUp className="h-3.5 w-3.5" /> : <ChevronDown className="h-3.5 w-3.5" />}
        </span>
      </button>

      {isOpen && (
        <div className="mt-3 p-4 rounded-xl bg-slate-50 dark:bg-slate-950/90 border border-slate-200 dark:border-slate-800 space-y-3 animate-in fade-in duration-200 transition-colors">
          {/* Header & Time Toggles */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
            <div className="flex items-center gap-2">
              <span className="text-xs font-semibold text-slate-700 dark:text-slate-300">Time Range:</span>
              <div className="flex bg-slate-200/80 dark:bg-slate-900 rounded-lg p-0.5 border border-slate-300 dark:border-slate-800">
                {timeRanges.map((r) => (
                  <button
                    key={r.value}
                    onClick={() => {
                      setTimeRange(r.value);
                      setImgError(false);
                    }}
                    className={`px-2.5 py-1 text-xs rounded-md font-medium transition-all ${
                      timeRange === r.value
                        ? 'bg-emerald-600 text-white shadow-sm'
                        : 'text-slate-600 hover:text-slate-900 hover:bg-slate-300/60 dark:text-slate-400 dark:hover:text-slate-200 dark:hover:bg-slate-800'
                    }`}
                  >
                    {r.label}
                  </button>
                ))}
              </div>
            </div>

            <div className="flex items-center space-x-2">
              <button
                onClick={handleRetry}
                className="p-1.5 rounded-lg bg-white hover:bg-slate-100 dark:bg-slate-900 dark:hover:bg-slate-800 text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200 text-xs border border-slate-200 dark:border-slate-800 transition-colors"
                title="Reload Chart"
              >
                <RefreshCw className="h-3.5 w-3.5" />
              </button>
              <a
                href={`https://camelcamelcamel.com/product/${asin}`}
                target="_blank"
                rel="noopener noreferrer"
                className="text-xs text-emerald-700 dark:text-emerald-400 hover:text-emerald-600 dark:hover:text-emerald-300 flex items-center gap-1 px-2.5 py-1 rounded-lg bg-white hover:bg-slate-100 dark:bg-slate-900 dark:hover:bg-slate-800 border border-slate-200 dark:border-slate-800 transition-colors"
              >
                <span>Verify on CCC</span>
                <ExternalLink className="h-3 w-3" />
              </a>
            </div>
          </div>

          {/* Chart Display Area */}
          <div className="relative rounded-lg overflow-hidden border border-slate-200 dark:border-slate-800/80 bg-white dark:bg-slate-900 min-h-[220px] flex items-center justify-center p-1 transition-colors">
            {imgError ? (
              <div className="p-6 text-center space-y-2">
                <AlertCircle className="h-8 w-8 text-amber-500 dark:text-amber-400 mx-auto" />
                <p className="text-xs text-slate-700 dark:text-slate-300 font-medium">
                  Direct image preview took longer than expected to render.
                </p>
                <a
                  href={`https://camelcamelcamel.com/product/${asin}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white font-medium shadow-sm transition-colors"
                >
                  <span>Open Full Chart on CamelCamelCamel</span>
                  <ExternalLink className="h-3.5 w-3.5" />
                </a>
              </div>
            ) : (
              <img
                src={chartUrl}
                alt={`Price history chart for ${title}`}
                className="w-full max-h-[380px] object-contain rounded"
                onError={() => setImgError(true)}
                loading="lazy"
              />
            )}
          </div>
        </div>
      )}
    </div>
  );
};