import { create } from 'zustand';
import {
  buildWeeklyRegimen,
  regenerateWeekDaySession,
} from '@/lib/improveWeekOrchestrator';
import type { PlayerProfile } from '@/types/profile';
import {
  createDefaultWeekDayDrafts,
  type WeekDayDraft,
  type WeekDayId,
  type WeekFocusPreference,
  type WeekSituation,
  type WeekWizardDraft,
  type WeeklyRegimen,
} from '@/types/improveWeek';

interface ImproveWeekDraftState {
  draft: WeekWizardDraft;
  regimen: WeeklyRegimen | null;
  setWeekSituation: (weekSituation: WeekSituation) => void;
  setAge: (age: number) => void;
  setMatchDay: (matchDay: WeekDayId | null) => void;
  setFocusPreference: (focusPreference: WeekFocusPreference) => void;
  togglePrioritySkill: (skillId: string) => void;
  updateDay: (day: WeekDayId, patch: Partial<Omit<WeekDayDraft, 'day'>>) => void;
  resetDraft: () => void;
  generate: (profile: PlayerProfile | null) => WeeklyRegimen | null;
  regenerateDay: (day: WeekDayId, profile: PlayerProfile | null) => WeeklyRegimen | null;
  rebuildWeek: (profile: PlayerProfile | null) => WeeklyRegimen | null;
}

function emptyDraft(): WeekWizardDraft {
  return {
    weekSituation: undefined,
    age: undefined,
    matchDay: null,
    focusPreference: 'balanced',
    prioritySkillIds: [],
    days: createDefaultWeekDayDrafts(),
  };
}

function isCompleteDraft(
  draft: WeekWizardDraft
): draft is WeekWizardDraft & { weekSituation: WeekSituation; age: number } {
  return draft.weekSituation != null && typeof draft.age === 'number';
}

export const useImproveWeekDraftStore = create<ImproveWeekDraftState>((set, get) => ({
  draft: emptyDraft(),
  regimen: null,

  setWeekSituation: (weekSituation) =>
    set((state) => ({ draft: { ...state.draft, weekSituation } })),

  setAge: (age) => set((state) => ({ draft: { ...state.draft, age } })),

  setMatchDay: (matchDay) => set((state) => ({ draft: { ...state.draft, matchDay } })),

  setFocusPreference: (focusPreference) =>
    set((state) => ({ draft: { ...state.draft, focusPreference } })),

  togglePrioritySkill: (skillId) =>
    set((state) => {
      const current = state.draft.prioritySkillIds;
      if (current.includes(skillId)) {
        return {
          draft: {
            ...state.draft,
            prioritySkillIds: current.filter((id) => id !== skillId),
          },
        };
      }
      if (current.length >= 2) {
        return state;
      }
      return {
        draft: {
          ...state.draft,
          prioritySkillIds: [...current, skillId],
        },
      };
    }),

  updateDay: (day, patch) =>
    set((state) => ({
      draft: {
        ...state.draft,
        days: state.draft.days.map((d) => (d.day === day ? { ...d, ...patch } : d)),
      },
    })),

  resetDraft: () => set({ draft: emptyDraft(), regimen: null }),

  generate: (profile) => {
    const { draft } = get();
    if (!isCompleteDraft(draft)) return null;
    const regimen = buildWeeklyRegimen(
      {
        weekSituation: draft.weekSituation,
        age: draft.age,
        matchDay: draft.matchDay,
        focusPreference: draft.focusPreference,
        prioritySkillIds: draft.prioritySkillIds,
        days: draft.days,
      },
      profile
    );
    set({ regimen });
    return regimen;
  },

  regenerateDay: (day, profile) => {
    const { regimen } = get();
    if (!regimen) return null;
    const next = regenerateWeekDaySession(regimen, day, profile);
    set({ regimen: next });
    return next;
  },

  rebuildWeek: (profile) => {
    const { draft } = get();
    if (!isCompleteDraft(draft)) return null;
    const regimen = buildWeeklyRegimen(
      {
        weekSituation: draft.weekSituation,
        age: draft.age,
        matchDay: draft.matchDay,
        focusPreference: draft.focusPreference,
        prioritySkillIds: draft.prioritySkillIds,
        days: draft.days,
      },
      profile
    );
    set({ regimen });
    return regimen;
  },
}));
