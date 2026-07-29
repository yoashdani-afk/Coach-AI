import { FREE_TIER_ANALYSES_PER_MONTH } from '@/lib/constants';
import type { PlayerProfile } from '@/types/profile';

/** Development builds never consume or enforce free-tier limits. */
export function isDevUnlimitedAnalyses(): boolean {
  return __DEV__;
}

export function createAnalysisAttemptId(): string {
  return `attempt-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
}

export function getRemainingAnalyses(profile: PlayerProfile | null): number {
  if (isDevUnlimitedAnalyses()) {
    return FREE_TIER_ANALYSES_PER_MONTH;
  }
  if (!profile) {
    return FREE_TIER_ANALYSES_PER_MONTH;
  }
  return Math.max(0, FREE_TIER_ANALYSES_PER_MONTH - profile.analysesUsedThisMonth);
}

export function canStartAnalysis(profile: PlayerProfile | null): boolean {
  if (isDevUnlimitedAnalyses()) {
    return true;
  }
  return getRemainingAnalyses(profile) > 0;
}

export function remainingAnalysesLabel(profile: PlayerProfile | null): string {
  if (isDevUnlimitedAnalyses()) {
    return 'Dev: unlimited analyses';
  }
  const remaining = getRemainingAnalyses(profile);
  return `${remaining} of ${FREE_TIER_ANALYSES_PER_MONTH} analyses left this month`;
}
