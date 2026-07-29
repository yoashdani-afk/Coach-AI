import AsyncStorage from '@react-native-async-storage/async-storage';
import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';

interface AnalysisCreditsState {
  consumedAttemptIds: string[];
  devCreditsMigrationDone: boolean;
  hasHydrated: boolean;
  setHasHydrated: (value: boolean) => void;
  hasAttemptConsumed: (attemptId: string) => boolean;
  markAttemptConsumed: (attemptId: string) => boolean;
  resetConsumedAttempts: () => void;
}

export const useAnalysisCreditsStore = create<AnalysisCreditsState>()(
  persist(
    (set, get) => ({
      consumedAttemptIds: [],
      devCreditsMigrationDone: false,
      hasHydrated: false,
      setHasHydrated: (value) => set({ hasHydrated: value }),

      hasAttemptConsumed: (attemptId) => get().consumedAttemptIds.includes(attemptId),

      markAttemptConsumed: (attemptId) => {
        if (get().consumedAttemptIds.includes(attemptId)) {
          return false;
        }
        set((state) => ({
          consumedAttemptIds: [...state.consumedAttemptIds, attemptId],
        }));
        return true;
      },

      resetConsumedAttempts: () => set({ consumedAttemptIds: [] }),
    }),
    {
      name: 'coach-ai-analysis-credits',
      storage: createJSONStorage(() => AsyncStorage),
      partialize: (state) => ({
        consumedAttemptIds: state.consumedAttemptIds,
        devCreditsMigrationDone: state.devCreditsMigrationDone,
      }),
      onRehydrateStorage: () => (state) => {
        state?.setHasHydrated(true);
      },
    }
  )
);
