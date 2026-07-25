import AsyncStorage from '@react-native-async-storage/async-storage';
import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';
import type { Challenge, GoalSubmission, LeaderboardEntry, SubmitGoalResult } from '@/types/hallOfFame';
import type { GoalReport } from '@/types/analysis';
import type { PlayerProfile } from '@/types/profile';
import {
  DEMO_HALL_OF_FAME_SUBMISSIONS,
  getDemoChallenges,
  normalizeUserSubmission,
  toLeaderboardEntries,
  toTrendingEntries,
} from '@/lib/hallOfFame/demoData';
import { goalReportToSubmission, validateSubmissionDuplicate } from '@/lib/hallOfFame/submissionMapper';

interface HallOfFameState {
  userSubmissions: GoalSubmission[];
  hasHydrated: boolean;
  setHasHydrated: (value: boolean) => void;
  getAllSubmissions: () => GoalSubmission[];
  getHighestRated: (limit?: number) => LeaderboardEntry[];
  getTrending: (limit?: number) => LeaderboardEntry[];
  getChallenges: () => Challenge[];
  isClipSubmitted: (clipUri: string) => boolean;
  isReportSubmitted: (reportId: string) => boolean;
  submitFromReport: (report: GoalReport, profile: PlayerProfile) => SubmitGoalResult;
}

function isValidSubmission(value: unknown): value is GoalSubmission {
  if (!value || typeof value !== 'object') return false;
  const s = value as GoalSubmission;
  return (
    typeof s.id === 'string' &&
    typeof s.reportId === 'string' &&
    typeof s.clipUri === 'string' &&
    s.source === 'user' &&
    s.score?.isDemo === true
  );
}

export const useHallOfFameStore = create<HallOfFameState>()(
  persist(
    (set, get) => ({
      userSubmissions: [],
      hasHydrated: false,
      setHasHydrated: (value) => set({ hasHydrated: value }),

      getAllSubmissions: () => [
        ...DEMO_HALL_OF_FAME_SUBMISSIONS,
        ...get().userSubmissions.map(normalizeUserSubmission),
      ],

      getHighestRated: (limit = 10) =>
        toLeaderboardEntries(get().getAllSubmissions(), limit),

      getTrending: (limit = 5) => toTrendingEntries(get().getAllSubmissions(), limit),

      getChallenges: () => getDemoChallenges(),

      isClipSubmitted: (clipUri) =>
        get().userSubmissions.some((s) => s.clipUri === clipUri),

      isReportSubmitted: (reportId) =>
        get().userSubmissions.some((s) => s.reportId === reportId),

      submitFromReport: (report, profile) => {
        if (report.mode !== 'GOAL') {
          return { ok: false, reason: 'invalid_report' };
        }

        const duplicate = validateSubmissionDuplicate(get().userSubmissions, report.clip.uri);
        if (duplicate) return duplicate;

        const submission = goalReportToSubmission(report, profile);
        set((state) => ({
          userSubmissions: [submission, ...state.userSubmissions],
        }));
        return { ok: true };
      },
    }),
    {
      name: 'coach-ai-hall-of-fame',
      storage: createJSONStorage(() => AsyncStorage),
      partialize: (state) => ({ userSubmissions: state.userSubmissions }),
      onRehydrateStorage: () => (state) => {
        if (state) {
          state.userSubmissions = state.userSubmissions.filter(isValidSubmission);
        }
        state?.setHasHydrated(true);
      },
    }
  )
);

/** Service facade — UI reads through this so a remote API can swap in later. */
export const hallOfFameService = {
  getHighestRated: (limit?: number) => useHallOfFameStore.getState().getHighestRated(limit),
  getTrending: (limit?: number) => useHallOfFameStore.getState().getTrending(limit),
  getChallenges: () => useHallOfFameStore.getState().getChallenges(),
  isClipSubmitted: (clipUri: string) => useHallOfFameStore.getState().isClipSubmitted(clipUri),
  isReportSubmitted: (reportId: string) => useHallOfFameStore.getState().isReportSubmitted(reportId),
  submitFromReport: (report: GoalReport, profile: PlayerProfile) =>
    useHallOfFameStore.getState().submitFromReport(report, profile),
};

export function useHallOfFame() {
  const userSubmissions = useHallOfFameStore((s) => s.userSubmissions);
  const hasHydrated = useHallOfFameStore((s) => s.hasHydrated);
  const getHighestRated = useHallOfFameStore((s) => s.getHighestRated);
  const getTrending = useHallOfFameStore((s) => s.getTrending);
  const getChallenges = useHallOfFameStore((s) => s.getChallenges);
  const isClipSubmitted = useHallOfFameStore((s) => s.isClipSubmitted);
  const isReportSubmitted = useHallOfFameStore((s) => s.isReportSubmitted);
  const submitFromReport = useHallOfFameStore((s) => s.submitFromReport);

  return {
    hasHydrated,
    userSubmissionCount: userSubmissions.length,
    highestRated: getHighestRated(10),
    trending: getTrending(5),
    challenges: getChallenges(),
    isClipSubmitted,
    isReportSubmitted,
    submitFromReport,
  };
}
