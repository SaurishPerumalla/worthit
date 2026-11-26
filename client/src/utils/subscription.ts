import { Capacitor } from '@capacitor/core';
import { Purchases, LOG_LEVEL, PurchasesPackage } from '@revenuecat/purchases-capacitor';

export const FREE_DAILY_LIMIT = 5;
export const FREE_CORE_STORES = ['Target', 'Best Buy', 'Walmart'];
const CORE_STORE_SET = new Set(FREE_CORE_STORES.map((s) => s.toLowerCase()));

const DEVICE_ID_STORAGE_KEY = 'dealchaser_device_id';
const RC_IOS_API_KEY = (import.meta as any).env?.VITE_REVENUECAT_IOS_KEY?.trim() || '';

let rcConfigured = false;

export function isCoreFreeStore(storeName: string): boolean {
  return CORE_STORE_SET.has(storeName.trim().toLowerCase());
}

export function getDeviceId(): string {
  try {
    const existing = localStorage.getItem(DEVICE_ID_STORAGE_KEY);
    if (existing && existing.length >= 8) return existing;
    const generated =
      typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function'
        ? crypto.randomUUID()
        : `dc_${Date.now()}_${Math.random().toString(36).slice(2, 10)}`;
    localStorage.setItem(DEVICE_ID_STORAGE_KEY, generated);
    return generated;
  } catch {
    return 'dc_fallback_device';
  }
}

export function isRevenueCatReady(): boolean {
  return Capacitor.isNativePlatform() && Boolean(RC_IOS_API_KEY);
}

export async function initRevenueCat(): Promise<boolean> {
  if (!Capacitor.isNativePlatform() || !RC_IOS_API_KEY) {
    return false;
  }

  try {
    if (!rcConfigured) {
      await Purchases.setLogLevel({ level: LOG_LEVEL.WARN });
      await Purchases.configure({
        apiKey: RC_IOS_API_KEY,
        appUserID: getDeviceId()
      });
      rcConfigured = true;
    }
    const { customerInfo } = await Purchases.getCustomerInfo();
    return Boolean(customerInfo?.entitlements?.active?.['pro']);
  } catch (err) {
    console.warn('RevenueCat init warning:', err);
    return false;
  }
}

export async function fetchProMonthlyPackage(): Promise<{ pkg: PurchasesPackage | null; priceString: string }> {
  if (!isRevenueCatReady()) {
    return { pkg: null, priceString: '$3.99' };
  }

  try {
    await initRevenueCat();
    const offerings = await Purchases.getOfferings();
    const current = offerings?.current;
    const pkg = current?.monthly || current?.availablePackages?.[0] || null;
    const priceString = pkg?.product?.priceString || '$3.99';
    return { pkg, priceString };
  } catch {
    return { pkg: null, priceString: '$3.99' };
  }
}

export async function purchaseProMonthly(pkg?: PurchasesPackage | null): Promise<{ isPro: boolean; cancelled?: boolean; error?: string }> {
  if (!Capacitor.isNativePlatform()) {
    return {
      isPro: false,
      error: 'Subscriptions are processed via Apple In-App Purchase inside the DealChaser iOS app.'
    };
  }
  if (!RC_IOS_API_KEY) {
    return {
      isPro: false,
      error: 'In-App Purchases are almost ready — add your VITE_REVENUECAT_IOS_KEY before releasing to App Store Connect.'
    };
  }

  try {
    await initRevenueCat();
    let targetPkg = pkg;
    if (!targetPkg) {
      const loaded = await fetchProMonthlyPackage();
      targetPkg = loaded.pkg;
    }
    if (!targetPkg) {
      return { isPro: false, error: 'Monthly subscription product is not configured in App Store Connect yet.' };
    }

    const result = await Purchases.purchasePackage({ aPackage: targetPkg });
    const isPro = Boolean(result?.customerInfo?.entitlements?.active?.['pro']);
    return { isPro };
  } catch (err: any) {
    if (err?.userCancelled || err?.code === '1' || /cancel/i.test(String(err?.message || ''))) {
      return { isPro: false, cancelled: true };
    }
    return { isPro: false, error: err?.message || 'Purchase could not be completed.' };
  }
}

export async function restoreProPurchases(): Promise<{ isPro: boolean; error?: string }> {
  if (!Capacitor.isNativePlatform() || !RC_IOS_API_KEY) {
    return {
      isPro: false,
      error: Capacitor.isNativePlatform()
        ? 'RevenueCat is not configured yet (missing VITE_REVENUECAT_IOS_KEY).'
        : 'Restore Purchases is available in the DealChaser iOS app.'
    };
  }

  try {
    await initRevenueCat();
    const { customerInfo } = await Purchases.restorePurchases();
    const isPro = Boolean(customerInfo?.entitlements?.active?.['pro']);
    return {
      isPro,
      error: isPro ? undefined : 'No active DealChaser Pro subscription was found for this Apple ID.'
    };
  } catch (err: any) {
    return { isPro: false, error: err?.message || 'Could not restore purchases.' };
  }
}
