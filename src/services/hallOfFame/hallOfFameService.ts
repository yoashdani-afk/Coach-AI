import AsyncStorage from '@react-native-async-storage/async-storage';
import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';
import type {
  Challenge,
  GoalSubmission,
  LeaderboardEntry,
  SubmitGoalResult,
  HallOfFameUnlockPreview,
} from '@/types/hallOfFame';
import {
  DEMO_HALL_OF_FAME_SUBMISSIONS,
  getDemoChallenges,
  normalizeUserSubmission,
  toLeaderboardEntries,
  toTrendingEntries,
} from '@/lib/hallOfFame/demoData';
import { evaluateHallOfFameEligibility } from '@/lib/hallOfFame/eligibility';
import {
  reportToHallOfFameSubmission,
  validateSubmissionDuplicate,
} from '@/lib/hallOfFame/submissionMapper';
import { deriveHallOfFamePlayTitle } from '@/lib/hallOfFame/playTitle';
import type { CoachingReport } from '@/types/analysis';
import type { PlayerProfile } from '@/types/profile';

interface HallOfFameState {
  userSubmissions: GoalSubmission[];
  hasHydrated: boolean;
  setHasHydrated: (value: boolean) => void;
  getAllSubmissions: () => GoalSubmission[];
  getUserSubmissionsChronological: () => GoalSubmission[];
  getPinnedUserSubmissions: (limit?: number) => GoalSubmission[];
  getHighestRated: (limit?: number) => LeaderboardEntry[];
  getTrending: (limit?: number) => LeaderboardEntry[];
  getChallenges: () => Challenge[];
  isClipSubmitted: (clipUri: string) => boolean;
  isReportSubmitted: (reportId: string) => boolean;
  evaluateForHallOfFame: (report: CoachingReport) => HallOfFameUnlockPreview | null;
  tryAutoInductFromReport: (
    report: CoachingReport,
    profile: PlayerProfile
  ) => SubmitGoalResult & { playTitle?: string };
  submitFromReport: (report: CoachingReport, profile: PlayerProfile) => SubmitGoalResult;
}

function isValidSubmission(value: unknown): value is GoalSubmission {
  if (!value || typeof value !== 'object') return false;
  const s = value as GoalSubmission;
  return (
    typeof s.id === 'string' &&
    typeof s.reportId === 'string' &&
    typeof s.clipUri === 'string' &&
    s.source === 'user' &&
    typeof s.score?.overall === 'number' &&
    Array.isArray(s.score?.categories)
  );
}

function migrateSubmission(raw: GoalSubmission): GoalSubmission {
  return normalizeUserSubmission({
    ...raw,
    playTitle: raw.playTitle ?? raw.award?.label ?? 'Standout Moment',
    summary: raw.summary ?? '',
    analysisMode: raw.analysisMode ?? 'GOAL',
    score: {
      ...raw.score,
      isDemo: raw.score?.isDemo ?? true,
    },
  });
}

export const useHallOfFameStore = create<HallOfFameState>()(
  persist(
    (set, get) => ({
      userSubmissions: [],
      hasHydrated: false,
      setHasHydrated: (value) => set({ hasHydrated: value }),

      getAllSubmissions: () => [
        ...DEMO_HALL_OF_FAME_SUBMISSIONS,
        ...get().userSubmissions.map(migrateSubmission),
      ],

      getUserSubmissionsChronological: () =>
        [...get().userSubmissions.map(migrateSubmission)].sort(
          (a, b) => new Date(b.submittedAt).getTime() - new Date(a.submittedAt).getTime()
        ),

      getPinnedUserSubmissions: (limit = 3) =>
        [...get().userSubmissions.map(migrateSubmission)]
          .sort((a, b) => b.score.overall - a.score.overall)
          .slice(0, limit),

      getHighestRated: (limit = 10) =>
        toLeaderboardEntries(get().getAllSubmissions(), limit),

      getTrending: (limit = 5) => toTrendingEntries(get().getAllSubmissions(), limit),

      getChallenges: () => getDemoChallenges(),

      isClipSubmitted: (clipUri) =>
        get().userSubmissions.some((s) => s.clipUri === clipUri),

      isReportSubmitted: (reportId) =>
        get().userSubmissions.some((s) => s.reportId === reportId),

      evaluateForHallOfFame: (report) => {
        const eligibility = evaluateHallOfFameEligibility(report);
        if (!eligibility.qualifies) return null;
        return {
          reportId: report.id,
          playTitle: deriveHallOfFamePlayTitle(report),
          reasons: eligibility.reasons,
        };
      },

      tryAutoInductFromReport: (report, profile) => {
        const eligibility = evaluateHallOfFameEligibility(report);
        if (!eligibility.qualifies) {
          return { ok: false, reason: 'invalid_report' };
        }

        const duplicate = validateSubmissionDuplicate(
          get().userSubmissions,
          report.id,
          report.clip.uri
        );
        if (duplicate) return duplicate;

        const submission = reportToHallOfFameSubmission(report, profile, {
          autoInducted: true,
        });

        set((state) => ({
          userSubmissions: [submission, ...state.userSubmissions],
        }));

        console.log('[HallOfFame] Auto-inducted play', {
          reportId: report.id,
          playTitle: submission.playTitle,
          analysisMode: report.mode,
          overallScore: submission.score.overall,
          reasons: eligibility.reasons,
        });

        return { ok: true, playTitle: submission.playTitle };
      },

      submitFromReport: (report, profile) => {
        const duplicate = validateSubmissionDuplicate(
          get().userSubmissions,
          report.id,
          report.clip.uri
        );
        if (duplicate) return duplicate;

        const submission = reportToHallOfFameSubmission(report, profile);
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

export const hallOfFameService = {
  getHighestRated: (limit?: number) => useHallOfFameStore.getState().getHighestRated(limit),
  getTrending: (limit?: number) => useHallOfFameStore.getState().getTrending(limit),
  getChallenges: () => useHallOfFameStore.getState().getChallenges(),
  isClipSubmitted: (clipUri: string) => useHallOfFameStore.getState().isClipSubmitted(clipUri),
  isReportSubmitted: (reportId: string) =>
    useHallOfFameStore.getState().isReportSubmitted(reportId),
  evaluateForHallOfFame: (report: CoachingReport) =>
    useHallOfFameStore.getState().evaluateForHallOfFame(report),
  tryAutoInductFromReport: (report: CoachingReport, profile: PlayerProfile) =>
    useHallOfFameStore.getState().tryAutoInductFromReport(report, profile),
  submitFromReport: (report: CoachingReport, profile: PlayerProfile) =>
    useHallOfFameStore.getState().submitFromReport(report, profile),
};

export function useHallOfFame() {
  const userSubmissions = useHallOfFameStore((s) => s.userSubmissions);
  const hasHydrated = useHallOfFameStore((s) => s.hasHydrated);
  const getHighestRated = useHallOfFameStore((s) => s.getHighestRated);
  const getTrending = useHallOfFameStore((s) => s.getTrending);
  const getChallenges = useHallOfFameStore((s) => s.getChallenges);
  const getUserSubmissionsChronological = useHallOfFameStore(
    (s) => s.getUserSubmissionsChronological
  );
  const getPinnedUserSubmissions = useHallOfFameStore((s) => s.getPinnedUserSubmissions);
  const isClipSubmitted = useHallOfFameStore((s) => s.isClipSubmitted);
  const isReportSubmitted = useHallOfFameStore((s) => s.isReportSubmitted);
  const evaluateForHallOfFame = useHallOfFameStore((s) => s.evaluateForHallOfFame);
  const tryAutoInductFromReport = useHallOfFameStore((s) => s.tryAutoInductFromReport);
  const submitFromReport = useHallOfFameStore((s) => s.submitFromReport);

  return {
    hasHydrated,
    userSubmissionCount: userSubmissions.length,
    highestRated: getHighestRated(10),
    trending: getTrending(5),
    userEntriesChronological: getUserSubmissionsChronological(),
    pinnedUserEntries: getPinnedUserSubmissions(3),
    challenges: getChallenges(),
    isClipSubmitted,
    isReportSubmitted,
    evaluateForHallOfFame,
    tryAutoInductFromReport,
    submitFromReport,
  };
}
