import { FREE_TIER_ANALYSES_PER_MONTH } from '@/lib/constants';

/** Pro monthly analysis cap (generous but cost-bounded). */
export const PRO_ANALYSES_PER_MONTH = 12;

export const FREE_HOF_ENTRY_LIMIT = 1;
export const PRO_HOF_ENTRY_LIMIT = 3;

/** Fallback marketing prices when store offerings have not loaded yet. */
export const PRO_MONTHLY_PRICE_LABEL = '€5.99';
export const PRO_YEARLY_PRICE_LABEL = '€49.99';
/** @deprecated Prefer PRO_MONTHLY_PRICE_LABEL */
export const PRO_PRICE_LABEL = PRO_MONTHLY_PRICE_LABEL;

/**
 * Entitlement helpers — `isPro` comes from RevenueCat CustomerInfo
 * (`football_dani_app_pro`) or a dev mock. Do not invent a local writable isPro flag.
 */

export function getAnalysisLimit(isPro: boolean): number {
  return isPro ? PRO_ANALYSES_PER_MONTH : FREE_TIER_ANALYSES_PER_MONTH;
}

export function getHofLimit(isPro: boolean): number {
  return isPro ? PRO_HOF_ENTRY_LIMIT : FREE_HOF_ENTRY_LIMIT;
}

export function canAccessWeeklyRegimen(isPro: boolean): boolean {
  return isPro;
}

/**
 * Dev override: set EXPO_PUBLIC_DEV_FORCE_PRO=1 to exercise Pro gates without RevenueCat.
 * Production builds ignore this.
 */
export function isDevForcePro(): boolean {
  return __DEV__ && process.env.EXPO_PUBLIC_DEV_FORCE_PRO === '1';
}

export type ProPaywallReason = 'analyses' | 'hof' | 'weekly';

/** Path for the in-app Pro paywall with optional trigger context. */
export function proPaywallHref(reason?: ProPaywallReason): '/pro' | `/pro?reason=${ProPaywallReason}` {
  if (!reason) return '/pro';
  return `/pro?reason=${reason}`;
}
