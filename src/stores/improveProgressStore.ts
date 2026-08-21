import AsyncStorage from '@react-native-async-storage/async-storage';
import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';
import { XP_PER_DRILL, improveSkillKey } from '@/lib/improveProgress';

interface ImproveProgressState {
  skillXp: Record<string, number>;
  hasHydrated: boolean;
  markDrillDone: (categoryId: string, skillId: string) => void;
  getSkillXp: (categoryId: string, skillId: string) => number;
  resetAllProgress: () => void;
  setHasHydrated: (value: boolean) => void;
}

export const useImproveProgressStore = create<ImproveProgressState>()(
  persist(
    (set, get) => ({
      skillXp: {},
      hasHydrated: false,

      markDrillDone: (categoryId, skillId) => {
        const key = improveSkillKey(categoryId, skillId);
        set((state) => ({
          skillXp: {
            ...state.skillXp,
            [key]: (state.skillXp[key] ?? 0) + XP_PER_DRILL,
          },
        }));
      },

      getSkillXp: (categoryId, skillId) => {
        const key = improveSkillKey(categoryId, skillId);
        return get().skillXp[key] ?? 0;
      },

      resetAllProgress: () => set({ skillXp: {} }),

      setHasHydrated: (value) => set({ hasHydrated: value }),
    }),
    {
      name: 'coach-ai-improve-progress',
      storage: createJSONStorage(() => AsyncStorage),
      partialize: (state) => ({ skillXp: state.skillXp }),
      onRehydrateStorage: () => (state) => {
        state?.setHasHydrated(true);
      },
    }
  )
);
