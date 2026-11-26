import { Request } from 'express';

export const FREE_DAILY_LIMIT = 3;
export const FREE_TRIAL_DAYS = 3;
export const FREE_CORE_STORES = ['Target', 'Best Buy', 'Walmart'];

const CORE_STORE_SET = new Set(FREE_CORE_STORES.map((s) => s.toLowerCase()));
const PRO_CACHE_TTL_MS = 5 * 60 * 1000;
const DAY_MS = 24 * 60 * 60 * 1000;

const proEntitlementCache = new Map<string, { isPro: boolean; expiresAt: number }>();
const dailyUsageMap = new Map<string, { date: string; count: number }>();
const firstSeenMap = new Map<string, number>();

function getTodayKey(): string {
  return new Date().toISOString().slice(0, 10);
}

function getClientKey(req: Request): string {
  const deviceId = String(req.header('x-device-id') || '').trim();
  if (deviceId && deviceId.length >= 6 && deviceId.length <= 128) {
    return `dev:${deviceId}`;
  }
  const forwarded = String(req.header('x-forwarded-for') || '').split(',')[0].trim();
  return `ip:${forwarded || req.ip || 'unknown'}`;
}

function getTrialState(clientKey: string): { trialExpired: boolean; trialDaysRemaining: number } {
  const now = Date.now();
  let firstSeen = firstSeenMap.get(clientKey);
  if (firstSeen === undefined) {
    firstSeen = now;
    firstSeenMap.set(clientKey, firstSeen);
    if (firstSeenMap.size > 5000) {
      const oldestKey = firstSeenMap.keys().next().value;
      if (oldestKey) firstSeenMap.delete(oldestKey);
    }
  }
  const elapsedDays = Math.floor((now - firstSeen) / DAY_MS);
  const trialDaysRemaining = Math.max(0, FREE_TRIAL_DAYS - elapsedDays);
  return {
    trialExpired: elapsedDays >= FREE_TRIAL_DAYS,
    trialDaysRemaining
  };
}

/**
 * Verifies active `pro` entitlement with RevenueCat REST API v1 (cached 5m).
 * Returns false if REVENUECAT_SECRET_KEY is not configured.
 */
export async function verifyProEntitlement(appUserId: string): Promise<boolean> {
  const cleanId = appUserId.replace(/^dev:/, '').trim();
  if (!cleanId || cleanId.startsWith('ip:')) return false;

  const secretKey = process.env.REVENUECAT_SECRET_KEY?.trim();
  if (!secretKey) return false;

  const cached = proEntitlementCache.get(cleanId);
  if (cached && cached.expiresAt > Date.now()) {
    return cached.isPro;
  }

  try {
    const res = await fetch(`https://api.revenuecat.com/v1/subscribers/${encodeURIComponent(cleanId)}`, {
      headers: {
        Authorization: `Bearer ${secretKey}`,
        Accept: 'application/json'
      },
      signal: AbortSignal.timeout(3500)
    });

    if (!res.ok) return false;
    const data: any = await res.json();
    const proEnt = data?.subscriber?.entitlements?.pro;
    const isPro = Boolean(
      proEnt &&
      (proEnt.expires_date === null || new Date(proEnt.expires_date).getTime() > Date.now())
    );

    proEntitlementCache.set(cleanId, { isPro, expiresAt: Date.now() + PRO_CACHE_TTL_MS });
    if (proEntitlementCache.size > 500) {
      const firstKey = proEntitlementCache.keys().next().value;
      if (firstKey) proEntitlementCache.delete(firstKey);
    }
    return isPro;
  } catch {
    return false;
  }
}

export async function getSubscriptionQuotaStatus(req: Request): Promise<{
  isPro: boolean;
  used: number;
  remaining: number;
  limit: number;
  trialExpired: boolean;
  trialDaysRemaining: number;
  freeStores: string[];
}> {
  const clientKey = getClientKey(req);
  const isPro = await verifyProEntitlement(clientKey);
  if (isPro) {
    return {
      isPro: true,
      used: 0,
      remaining: -1,
      limit: -1,
      trialExpired: false,
      trialDaysRemaining: FREE_TRIAL_DAYS,
      freeStores: FREE_CORE_STORES
    };
  }

  const { trialExpired, trialDaysRemaining } = getTrialState(clientKey);
  const today = getTodayKey();
  const entry = dailyUsageMap.get(clientKey);
  const used = entry && entry.date === today ? entry.count : 0;
  const remaining = trialExpired ? 0 : Math.max(0, FREE_DAILY_LIMIT - used);

  return {
    isPro: false,
    used,
    remaining,
    limit: FREE_DAILY_LIMIT,
    trialExpired,
    trialDaysRemaining,
    freeStores: FREE_CORE_STORES
  };
}

export async function checkAndConsumeQuota(
  req: Request,
  requestedStores?: string[]
): Promise<{
  allowed: boolean;
  isPro: boolean;
  effectiveStores: string[] | undefined;
  remaining: number;
  limit: number;
  trialExpired: boolean;
  trialDaysRemaining: number;
  error?: string;
}> {
  const clientKey = getClientKey(req);
  const isPro = await verifyProEntitlement(clientKey);

  if (isPro) {
    return {
      allowed: true,
      isPro: true,
      effectiveStores: requestedStores,
      remaining: -1,
      limit: -1,
      trialExpired: false,
      trialDaysRemaining: FREE_TRIAL_DAYS
    };
  }

  const { trialExpired, trialDaysRemaining } = getTrialState(clientKey);
  if (trialExpired) {
    return {
      allowed: false,
      isPro: false,
      effectiveStores: FREE_CORE_STORES,
      remaining: 0,
      limit: FREE_DAILY_LIMIT,
      trialExpired: true,
      trialDaysRemaining: 0,
      error: 'Your 3-day free trial has ended. Upgrade to DealChaser Pro Monthly ($1.99/mo) or Pro Yearly ($9.99/yr) to continue.'
    };
  }

  const today = getTodayKey();
  const entry = dailyUsageMap.get(clientKey);
  const used = entry && entry.date === today ? entry.count : 0;

  if (used >= FREE_DAILY_LIMIT) {
    return {
      allowed: false,
      isPro: false,
      effectiveStores: FREE_CORE_STORES,
      remaining: 0,
      limit: FREE_DAILY_LIMIT,
      trialExpired: false,
      trialDaysRemaining,
      error: `Daily free limit reached (${FREE_DAILY_LIMIT}/${FREE_DAILY_LIMIT} checks). Upgrade to DealChaser Pro for unlimited searches and custom stores.`
    };
  }

  // Increment usage
  dailyUsageMap.set(clientKey, { date: today, count: used + 1 });
  if (dailyUsageMap.size > 2000) {
    for (const [k, v] of dailyUsageMap.entries()) {
      if (v.date !== today) dailyUsageMap.delete(k);
    }
  }

  // Free tier is limited to the 3 core stores (protects Serper credits)
  const filteredStores = Array.isArray(requestedStores)
    ? requestedStores.filter((s) => CORE_STORE_SET.has(s.toLowerCase()))
    : [];
  const effectiveStores = filteredStores.length > 0 ? filteredStores : FREE_CORE_STORES;

  return {
    allowed: true,
    isPro: false,
    effectiveStores,
    remaining: Math.max(0, FREE_DAILY_LIMIT - (used + 1)),
    limit: FREE_DAILY_LIMIT,
    trialExpired: false,
    trialDaysRemaining
  };
}
