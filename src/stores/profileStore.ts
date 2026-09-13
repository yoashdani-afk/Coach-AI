import { FREE_TIER_ANALYSES_PER_MONTH } from '@/lib/constants';
import { isDevUnlimitedAnalyses } from '@/lib/analysisCredits';
import { getAnalysisLimit } from '@/lib/entitlements';
import {
  consumeAnalysisCreditRemote,
  fetchAnalysisUsage,
  type AnalysisUsageSnapshot,
} from '@/lib/analysisUsageRemote';
import { createAppJSONStorage } from '@/lib/appStorage';
import { useAnalysisCreditsStore } from '@/stores/analysisCreditsStore';
import { useAuthStore } from '@/stores/authStore';
import { migrateStoredProfile } from '@/lib/profileUtils';
import type { PlayerProfile } from '@/types/profile';
import { create } from 'zustand';
import { persist } from 'zustand/middleware';

interface ProfileState {
  hasSeenOnboarding: boolean;
  isSignedIn: boolean;
  profile: PlayerProfile | null;
  /** Last known remote monthly limit used for sync (free or Pro). */
  analysesMonthlyLimit: number;
  hasHydrated: boolean;
  setHasSeenOnboarding: (value: boolean) => void;
  setSignedIn: (value: boolean) => void;
  setProfile: (profile: PlayerProfile) => void;
  applyAnalysisUsage: (usage: AnalysisUsageSnapshot) => void;
  /** Pull usage from Supabase for the signed-in account. */
  refreshAnalysisUsage: (monthlyLimit?: number) => Promise<AnalysisUsageSnapshot | null>;
  /**
   * Consume one analysis credit for a successful Gemini analysis.
   * Production: Supabase RPC (account-scoped). Dev: no-op / unlimited.
   */
  consumeAnalysisCreditForAttempt: (
    attemptId: string,
    monthlyLimit?: number
  ) => Promise<boolean>;
  resetFreeAnalyses: () => void;
  clearProfile: () => void;
  resetAll: () => void;
  setHasHydrated: (value: boolean) => void;
}

function withUsageFields(
  profile: PlayerProfile,
  usage: AnalysisUsageSnapshot
): PlayerProfile {
  return {
    ...profile,
    analysesUsedThisMonth: usage.used,
    analysesPeriodEnd: usage.periodEnd || null,
    updatedAt: new Date().toISOString(),
  };
}

export const useProfileStore = create<ProfileState>()(
  persist(
    (set, get) => ({
      hasSeenOnboarding: false,
      isSignedIn: false,
      profile: null,
      analysesMonthlyLimit: FREE_TIER_ANALYSES_PER_MONTH,
      hasHydrated: false,
      setHasSeenOnboarding: (value) => set({ hasSeenOnboarding: value }),
      setSignedIn: (value) => set({ isSignedIn: value }),
      setProfile: (profile) => set({ profile, isSignedIn: true }),

      applyAnalysisUsage: (usage) => {
        const profile = get().profile;
        if (!profile) {
          set({ analysesMonthlyLimit: usage.limit });
          return;
        }
        set({
          profile: withUsageFields(profile, usage),
          analysesMonthlyLimit: usage.limit,
        });
      },

      refreshAnalysisUsage: async (monthlyLimit) => {
        if (isDevUnlimitedAnalyses()) {
          return null;
        }
        if (!useAuthStore.getState().session) {
          return null;
        }
        const limit = monthlyLimit ?? get().analysesMonthlyLimit ?? getAnalysisLimit(false);
        const usage = await fetchAnalysisUsage(limit);
        if (usage) {
          get().applyAnalysisUsage(usage);
        }
        return usage;
      },

      consumeAnalysisCreditForAttempt: async (attemptId, monthlyLimit) => {
        if (isDevUnlimitedAnalyses()) {
          console.log('[Credits] Dev mode — skipping credit consumption', { attemptId });
          return false;
        }

        const credits = useAnalysisCreditsStore.getState();
        if (credits.hasAttemptConsumed(attemptId)) {
          console.log('[Credits] Attempt already charged — skipping duplicate', { attemptId });
          return false;
        }

        if (!useAuthStore.getState().session) {
          console.warn('[Credits] No session — cannot charge analysis credit', { attemptId });
          return false;
        }

        const limit = monthlyLimit ?? get().analysesMonthlyLimit ?? getAnalysisLimit(false);
        const result = await consumeAnalysisCreditRemote(attemptId, limit);

        if (!result.ok) {
          console.warn('[Credits] Remote consume failed', result);
          if (result.usage) {
            get().applyAnalysisUsage(result.usage);
          }
          return false;
        }

        credits.markAttemptConsumed(attemptId);
        get().applyAnalysisUsage(result.usage);

        console.log('[Credits] Consumed analysis credit (remote)', {
          attemptId,
          duplicate: result.duplicate,
          used: result.usage.used,
          remaining: result.usage.remaining,
        });
        return !result.duplicate;
      },

      resetFreeAnalyses: () => {
        const profile = get().profile;
        if (!profile) return;

        set({
          profile: {
            ...profile,
            analysesUsedThisMonth: 0,
            updatedAt: new Date().toISOString(),
          },
        });
        useAnalysisCreditsStore.getState().resetConsumedAttempts();
        console.log(
          '[Credits] Local analyses counter reset (dev). Remote usage is unchanged — wait for month rollover or SQL reset.'
        );
      },

      clearProfile: () => set({ profile: null }),
      resetAll: () =>
        set({
          hasSeenOnboarding: false,
          isSignedIn: false,
          profile: null,
          analysesMonthlyLimit: FREE_TIER_ANALYSES_PER_MONTH,
        }),
      setHasHydrated: (value) => set({ hasHydrated: value }),
    }),
    {
      name: 'coach-ai-profile',
      storage: createAppJSONStorage(),
      partialize: (state) => ({
        hasSeenOnboarding: state.hasSeenOnboarding,
        isSignedIn: state.isSignedIn,
        profile: state.profile,
        analysesMonthlyLimit: state.analysesMonthlyLimit,
      }),
      onRehydrateStorage: () => (state, error) => {
        if (typeof window === 'undefined') return;
        if (error) {
          console.warn('[profileStore] rehydration failed', error);
        }
        if (state?.profile) {
          const migrated = migrateStoredProfile(state.profile);
          if (migrated) {
            state.setProfile(migrated);
          } else {
            state.clearProfile();
          }
        }
        useProfileStore.setState({ hasHydrated: true });
      },
    }
  )
);

export {
  getRemainingAnalyses,
  canStartAnalysis,
  remainingAnalysesLabel,
  isDevUnlimitedAnalyses,
  analysesResetLabel,
} from '@/lib/analysisCredits';

export { getAnalysisLimit } from '@/lib/entitlements';

export function hasCompleteProfile(profile: PlayerProfile | null): boolean {
  return profile?.isComplete === true;
}

export function profileNeedsCompletion(profile: PlayerProfile | null): boolean {
  return profile != null && profile.isComplete !== true;
}
