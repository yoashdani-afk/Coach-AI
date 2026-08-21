import AsyncStorage from '@react-native-async-storage/async-storage';
import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';
import type { PlayerProfile } from '@/types/profile';
import { FREE_TIER_ANALYSES_PER_MONTH } from '@/lib/constants';
import { isDevUnlimitedAnalyses } from '@/lib/analysisCredits';
import { useAnalysisCreditsStore } from '@/stores/analysisCreditsStore';
import { migrateStoredProfile } from '@/lib/profileUtils';

interface ProfileState {
  hasSeenOnboarding: boolean;
  isSignedIn: boolean;
  profile: PlayerProfile | null;
  hasHydrated: boolean;
  setHasSeenOnboarding: (value: boolean) => void;
  setSignedIn: (value: boolean) => void;
  setProfile: (profile: PlayerProfile) => void;
  /** Consume one free credit for a successful Gemini analysis (production only). */
  consumeAnalysisCreditForAttempt: (attemptId: string) => boolean;
  resetFreeAnalyses: () => void;
  clearProfile: () => void;
  resetAll: () => void;
  setHasHydrated: (value: boolean) => void;
}

export const useProfileStore = create<ProfileState>()(
  persist(
    (set, get) => ({
      hasSeenOnboarding: false,
      isSignedIn: false,
      profile: null,
      hasHydrated: false,
      setHasSeenOnboarding: (value) => set({ hasSeenOnboarding: value }),
      setSignedIn: (value) => set({ isSignedIn: value }),
      setProfile: (profile) => set({ profile, isSignedIn: true }),

      consumeAnalysisCreditForAttempt: (attemptId) => {
        if (isDevUnlimitedAnalyses()) {
          console.log('[Credits] Dev mode — skipping credit consumption', { attemptId });
          return false;
        }

        const credits = useAnalysisCreditsStore.getState();
        if (credits.hasAttemptConsumed(attemptId)) {
          console.log('[Credits] Attempt already charged — skipping duplicate', { attemptId });
          return false;
        }

        const profile = get().profile;
        if (!profile) return false;

        if (profile.analysesUsedThisMonth >= FREE_TIER_ANALYSES_PER_MONTH) {
          console.warn('[Credits] No free analyses remaining', { attemptId });
          return false;
        }

        credits.markAttemptConsumed(attemptId);
        set({
          profile: {
            ...profile,
            analysesUsedThisMonth: Math.min(
              FREE_TIER_ANALYSES_PER_MONTH,
              profile.analysesUsedThisMonth + 1
            ),
            updatedAt: new Date().toISOString(),
          },
        });

        console.log('[Credits] Consumed one free analysis', {
          attemptId,
          used: get().profile?.analysesUsedThisMonth,
        });
        return true;
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
        console.log('[Credits] Free analyses reset to', FREE_TIER_ANALYSES_PER_MONTH);
      },

      clearProfile: () => set({ profile: null }),
      resetAll: () =>
        set({
          hasSeenOnboarding: false,
          isSignedIn: false,
          profile: null,
        }),
      setHasHydrated: (value) => set({ hasHydrated: value }),
    }),
    {
      name: 'coach-ai-profile',
      storage: createJSONStorage(() => AsyncStorage),
      partialize: (state) => ({
        hasSeenOnboarding: state.hasSeenOnboarding,
        isSignedIn: state.isSignedIn,
        profile: state.profile,
      }),
      onRehydrateStorage: () => (state) => {
        if (state?.profile) {
          const migrated = migrateStoredProfile(state.profile);
          if (migrated) {
            state.setProfile(migrated);
          } else {
            state.clearProfile();
          }
        }
        state?.setHasHydrated(true);
      },
    }
  )
);

export { getRemainingAnalyses, canStartAnalysis, remainingAnalysesLabel, isDevUnlimitedAnalyses } from '@/lib/analysisCredits';

export function hasCompleteProfile(profile: PlayerProfile | null): boolean {
  return profile?.isComplete === true;
}

export function profileNeedsCompletion(profile: PlayerProfile | null): boolean {
  return profile != null && profile.isComplete !== true;
}
