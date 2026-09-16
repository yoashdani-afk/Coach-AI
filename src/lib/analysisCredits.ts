import { FREE_TIER_ANALYSES_PER_MONTH } from '@/lib/constants';
import type { PlayerProfile } from '@/types/profile';

/**
 * Development builds skip free-tier analysis enforcement by default.
 * Set EXPO_PUBLIC_DEV_SIMULATE_FREE_TIER=1 to preview real free-tier limits / paywall
 * while still running a __DEV__ build. Production ignores this (always enforces).
 */
export function isDevUnlimitedAnalyses(): boolean {
  if (!__DEV__) return false;
  return process.env.EXPO_PUBLIC_DEV_SIMULATE_FREE_TIER !== '1';
}

export function createAnalysisAttemptId(): string {
  return `attempt-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
}

/**
 * Monthly analysis limit for the current entitlement.
 * Checkpoint 2 wires Pro (12); until then callers pass free tier or use default.
 */
export function getAnalysisLimit(isPro: boolean = false): number {
  return isPro ? 12 : FREE_TIER_ANALYSES_PER_MONTH;
}

export function getRemainingAnalyses(
  profile: PlayerProfile | null,
  monthlyLimit: number = FREE_TIER_ANALYSES_PER_MONTH
): number {
  if (isDevUnlimitedAnalyses()) {
    return monthlyLimit;
  }
  if (!profile) {
    return 0;
  }
  return Math.max(0, monthlyLimit - profile.analysesUsedThisMonth);
}

export function canStartAnalysis(
  profile: PlayerProfile | null,
  options?: { monthlyLimit?: number; isSignedIn?: boolean }
): boolean {
  if (isDevUnlimitedAnalyses()) {
    return true;
  }
  if (options?.isSignedIn === false) {
    return false;
  }
  return getRemainingAnalyses(profile, options?.monthlyLimit) > 0;
}

export function remainingAnalysesLabel(
  profile: PlayerProfile | null,
  monthlyLimit: number = FREE_TIER_ANALYSES_PER_MONTH
): string {
  if (isDevUnlimitedAnalyses()) {
    return 'Dev: unlimited analyses';
  }
  if (!profile) {
    return 'Sign in to use analyses';
  }
  const remaining = getRemainingAnalyses(profile, monthlyLimit);
  return `${remaining} of ${monthlyLimit} analyses left this month`;
}

/** UTC anniversary period-end label for UI (matches Supabase rollover). */
export function analysesResetLabel(periodEndIsoDate: string | null | undefined): string {
  if (!periodEndIsoDate) {
    return 'Limits reset one month from your period start.';
  }
  try {
    const d = new Date(`${periodEndIsoDate}T00:00:00.000Z`);
    if (Number.isNaN(d.getTime())) {
      return 'Limits reset one month from your period start.';
    }
    const label = d.toLocaleDateString('en-GB', {
      day: 'numeric',
      month: 'short',
      year: 'numeric',
      timeZone: 'UTC',
    });
    return `Resets ${label}`;
  } catch {
    return 'Limits reset one month from your period start.';
  }
}
