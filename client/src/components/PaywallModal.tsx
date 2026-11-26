import React from 'react';
import { X, Crown, Check, Sparkles, RotateCcw, ShieldCheck } from 'lucide-react';
import { FREE_DAILY_LIMIT, FREE_TRIAL_DAYS, ProPlanInterval } from '../utils/subscription.js';

interface PaywallModalProps {
  isOpen: boolean;
  onClose: () => void;
  isPro: boolean;
  remaining: number;
  trialExpired: boolean;
  trialDaysRemaining: number;
  selectedPlan: ProPlanInterval;
  onSelectPlan: (plan: ProPlanInterval) => void;
  monthlyPrice: string;
  annualPrice: string;
  isProcessing: boolean;
  statusMessage: string | null;
  onSubscribe: () => void;
  onRestore: () => void;
}

export const PaywallModal: React.FC<PaywallModalProps> = ({
  isOpen,
  onClose,
  isPro,
  remaining,
  trialExpired,
  trialDaysRemaining,
  selectedPlan,
  onSelectPlan,
  monthlyPrice,
  annualPrice,
  isProcessing,
  statusMessage,
  onSubscribe,
  onRestore
}) => {
  if (!isOpen) return null;

  const selectedPrice = selectedPlan === 'annual' ? annualPrice : monthlyPrice;
  const selectedPeriod = selectedPlan === 'annual' ? 'year' : 'month';

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-sm animate-fade-in">
      <div className="relative w-full max-w-md rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-2xl overflow-hidden">
        {/* Top Accent */}
        <div className="h-1.5 w-full bg-gradient-to-r from-emerald-500 via-teal-400 to-cyan-500" />

        <button
          type="button"
          onClick={onClose}
          aria-label="Close"
          className="absolute top-4 right-4 p-1.5 rounded-lg text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
        >
          <X className="h-4 w-4" />
        </button>

        <div className="p-6 space-y-4">
          {/* Header */}
          <div className="flex items-center gap-3">
            <div className="p-2.5 rounded-xl bg-emerald-500/15 border border-emerald-500/30 text-emerald-500">
              <Crown className="h-6 w-6" />
            </div>
            <div>
              <h2 className="text-lg font-extrabold text-slate-900 dark:text-white">
                {isPro
                  ? 'DealChaser Pro Active'
                  : trialExpired
                    ? 'Your 3-Day Free Trial Ended'
                    : 'Upgrade to DealChaser Pro'}
              </h2>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                {isPro
                  ? 'You have unlimited checks and all custom stores unlocked.'
                  : trialExpired
                    ? 'Choose Pro Monthly or Pro Yearly to keep checking deals.'
                    : `Free trial: ${FREE_DAILY_LIMIT} checks/day (${Math.max(0, remaining)} left today • ${trialDaysRemaining}d left)`}
              </p>
            </div>
          </div>

          {/* Free Trial Summary + Selectable Pro Monthly / Pro Yearly */}
          {!isPro && (
            <div className="space-y-2.5">
              <div className="px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950/50 flex items-center justify-between text-xs">
                <div>
                  <span className="font-bold text-slate-700 dark:text-slate-300">Free Plan ({FREE_TRIAL_DAYS}-Day Trial)</span>
                  <p className="text-[11px] text-slate-500 dark:text-slate-400">
                    {FREE_DAILY_LIMIT} checks/day • Target, Best Buy, Walmart
                  </p>
                </div>
                <span className="font-black text-slate-900 dark:text-white">$0</span>
              </div>

              <div className="grid grid-cols-2 gap-2.5 text-xs">
                {/* Pro Monthly */}
                <button
                  type="button"
                  onClick={() => onSelectPlan('monthly')}
                  className={`text-left p-3 rounded-xl border-2 transition-all space-y-1.5 ${
                    selectedPlan === 'monthly'
                      ? 'border-emerald-500 bg-emerald-500/5 dark:bg-emerald-950/30 ring-1 ring-emerald-500/30'
                      : 'border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-950/40 hover:border-slate-300 dark:hover:border-slate-700'
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <span className="font-bold text-slate-900 dark:text-white">Pro Monthly</span>
                  </div>
                  <div className="text-base font-black text-slate-900 dark:text-white">
                    {monthlyPrice}
                    <span className="text-[11px] font-medium text-slate-500 dark:text-slate-400">/mo</span>
                  </div>
                  <div className="text-[10px] text-slate-500 dark:text-slate-400">Flexible monthly</div>
                </button>

                {/* Pro Yearly */}
                <button
                  type="button"
                  onClick={() => onSelectPlan('annual')}
                  className={`text-left p-3 rounded-xl border-2 transition-all space-y-1.5 ${
                    selectedPlan === 'annual'
                      ? 'border-emerald-500 bg-emerald-500/5 dark:bg-emerald-950/30 ring-1 ring-emerald-500/30'
                      : 'border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-950/40 hover:border-slate-300 dark:hover:border-slate-700'
                  }`}
                >
                  <div className="flex items-center justify-between gap-1">
                    <span className="font-bold text-emerald-600 dark:text-emerald-400">Pro Yearly</span>
                    <span className="px-1.5 py-0.5 rounded bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 text-[9px] font-extrabold uppercase">
                      Save 44%
                    </span>
                  </div>
                  <div className="text-base font-black text-slate-900 dark:text-white">
                    {annualPrice}
                    <span className="text-[11px] font-medium text-slate-500 dark:text-slate-400">/yr</span>
                  </div>
                  <div className="text-[10px] text-slate-500 dark:text-slate-400 flex items-center gap-1">
                    <Sparkles className="h-3 w-3 text-emerald-500" /> Best value (~$1.67/mo)
                  </div>
                </button>
              </div>

              <ul className="grid grid-cols-1 gap-1.5 text-[11px] text-slate-700 dark:text-slate-200 px-1 pt-0.5">
                <li className="flex items-center gap-1.5">
                  <Check className="h-3.5 w-3.5 text-emerald-500 shrink-0" /> Unlimited daily deal &amp; price-history checks
                </li>
                <li className="flex items-center gap-1.5">
                  <Check className="h-3.5 w-3.5 text-emerald-500 shrink-0" /> All custom stores (Newegg, Costco, B&amp;H Photo, Home Depot, any .com)
                </li>
              </ul>
            </div>
          )}

          {statusMessage && (
            <div className="p-2.5 rounded-lg bg-amber-50 dark:bg-amber-950/50 border border-amber-200 dark:border-amber-800/60 text-xs text-amber-800 dark:text-amber-200">
              {statusMessage}
            </div>
          )}

          {/* CTA Buttons */}
          {!isPro && (
            <div className="space-y-2.5">
              <button
                type="button"
                onClick={onSubscribe}
                disabled={isProcessing}
                className="w-full py-3 px-4 rounded-xl bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 text-white font-bold text-sm shadow-lg shadow-emerald-700/25 transition-all"
              >
                {isProcessing ? 'Processing...' : `Continue with Pro — ${selectedPrice}/${selectedPeriod}`}
              </button>

              <button
                type="button"
                onClick={onRestore}
                disabled={isProcessing}
                className="w-full py-2 px-4 rounded-xl bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 text-xs font-semibold flex items-center justify-center gap-1.5 transition-colors"
              >
                <RotateCcw className="h-3.5 w-3.5" />
                <span>Restore Purchases</span>
              </button>
            </div>
          )}

          {/* Apple Subscription Disclosure & Legal Links */}
          <div className="pt-2 border-t border-slate-200 dark:border-slate-800 space-y-2 text-[10px] text-slate-400 dark:text-slate-500 leading-relaxed">
            <p className="flex items-start gap-1.5">
              <ShieldCheck className="h-3.5 w-3.5 text-emerald-500 shrink-0 mt-0.5" />
              <span>
                Payment will be charged to your Apple ID account at confirmation of purchase. Subscription automatically renews at {selectedPrice}/{selectedPeriod} unless canceled at least 24 hours before the end of the current period.
              </span>
            </p>
            <div className="flex items-center justify-center gap-4 pt-1">
              <a
                href="https://worthit-5gvp.onrender.com/terms"
                target="_blank"
                rel="noopener noreferrer"
                className="underline hover:text-slate-600 dark:hover:text-slate-300"
              >
                Terms of Use
              </a>
              <a
                href="https://worthit-5gvp.onrender.com/privacy"
                target="_blank"
                rel="noopener noreferrer"
                className="underline hover:text-slate-600 dark:hover:text-slate-300"
              >
                Privacy Policy
              </a>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
