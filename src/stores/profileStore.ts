import AsyncStorage from '@react-native-async-storage/async-storage';
import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';
import type { PlayerProfile } from '@/types/profile';
import { FREE_TIER_ANALYSES_PER_MONTH } from '@/lib/constants';

interface ProfileState {
  hasSeenOnboarding: boolean;
  isSignedIn: boolean;
  profile: PlayerProfile | null;
  hasHydrated: boolean;
  setHasSeenOnboarding: (value: boolean) => void;
  setSignedIn: (value: boolean) => void;
  setProfile: (profile: PlayerProfile) => void;
  incrementAnalysesUsed: () => void;
  clearProfile: () => void;
  resetAll: () => void;
  setHasHydrated: (value: boolean) => void;
}

export const useProfileStore = create<ProfileState>()(
  persist(
    (set) => ({
      hasSeenOnboarding: false,
      isSignedIn: false,
      profile: null,
      hasHydrated: false,
      setHasSeenOnboarding: (value) => set({ hasSeenOnboarding: value }),
      setSignedIn: (value) => set({ isSignedIn: value }),
      setProfile: (profile) => set({ profile, isSignedIn: true }),
      incrementAnalysesUsed: () =>
        set((state) => {
          if (!state.profile) return state;
          return {
            profile: {
              ...state.profile,
              analysesUsedThisMonth: Math.min(
                FREE_TIER_ANALYSES_PER_MONTH,
                state.profile.analysesUsedThisMonth + 1
              ),
              updatedAt: new Date().toISOString(),
            },
          };
        }),
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
        state?.setHasHydrated(true);
      },
    }
  )
);

export function getRemainingAnalyses(profile: PlayerProfile | null): number {
  if (!profile) return 3;
  return Math.max(0, 3 - profile.analysesUsedThisMonth);
}

export function hasCompleteProfile(profile: PlayerProfile | null): boolean {
  return profile?.isComplete === true;
}
