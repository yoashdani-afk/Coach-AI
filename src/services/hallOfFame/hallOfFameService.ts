import { create } from 'zustand';
import { isDevUnlimitedAnalyses } from '@/lib/analysisCredits';
import type {
  Challenge,
  GoalSubmission,
  LeaderboardEntry,
  SubmitGoalResult,
  HallOfFameUnlockPreview,
} from '@/types/hallOfFame';
import {
  getDemoChallenges,
  toLeaderboardEntries,
  toTrendingEntries,
} from '@/lib/hallOfFame/demoData';
import { evaluateHallOfFameEligibility } from '@/lib/hallOfFame/eligibility';
import {
  reportToHallOfFameSubmission,
  validateSubmissionDuplicate,
} from '@/lib/hallOfFame/submissionMapper';
import { deriveHallOfFamePlayTitle } from '@/lib/hallOfFame/playTitle';
import {
  rowToGoalSubmission,
  submissionToInsertRow,
  type HallOfFameEntryRow,
} from '@/lib/hallOfFame/supabaseMapper';
import { uploadHallOfFameVideo } from '@/lib/hallOfFame/uploadVideo';
import { getSupabase, isSupabaseConfigured } from '@/lib/supabase';
import { useAuthStore } from '@/stores/authStore';
import type { CoachingReport } from '@/types/analysis';
import type { PlayerProfile } from '@/types/profile';

/**
 * Non-premium: exactly one Hall of Fame entry per user.
 * FUTURE PREMIUM: raise limit / allow replace when entitlement grants more slots.
 */
export const MAX_USER_HALL_OF_FAME_ENTRIES_NON_PREMIUM = 1;

/** Display cap for Global Leaderboard — only top N by score are shown. */
export const GLOBAL_LEADERBOARD_DISPLAY_LIMIT = 100;

const SUPABASE_URL = process.env.EXPO_PUBLIC_SUPABASE_URL ?? '';

function createEntryId(): string {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID();
  }
  return `hof-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
}

function requireSessionUserId(): string | null {
  return useAuthStore.getState().session?.user?.id ?? null;
}

interface HallOfFameState {
  userSubmissions: GoalSubmission[];
  globalSubmissions: GoalSubmission[];
  isLoading: boolean;
  isSubmitting: boolean;
  error: string | null;
  hasHydrated: boolean;
  refresh: () => Promise<void>;
  clearError: () => void;
  getUserSubmissionsChronological: () => GoalSubmission[];
  getPinnedUserSubmissions: (limit?: number) => GoalSubmission[];
  getHighestRated: (limit?: number) => LeaderboardEntry[];
  getTrending: (limit?: number) => LeaderboardEntry[];
  getChallenges: () => Challenge[];
  isClipSubmitted: (clipUri: string) => boolean;
  isReportSubmitted: (reportId: string) => boolean;
  hasReachedUserEntryLimit: () => boolean;
  evaluateForHallOfFame: (report: CoachingReport) => HallOfFameUnlockPreview | null;
  tryAutoInductFromReport: (
    report: CoachingReport,
    profile: PlayerProfile
  ) => Promise<SubmitGoalResult & { playTitle?: string }>;
  submitFromReport: (
    report: CoachingReport,
    profile: PlayerProfile,
    options?: { autoInducted?: boolean }
  ) => Promise<SubmitGoalResult>;
}

export const useHallOfFameStore = create<HallOfFameState>((set, get) => ({
  userSubmissions: [],
  globalSubmissions: [],
  isLoading: false,
  isSubmitting: false,
  error: null,
  hasHydrated: false,

  clearError: () => set({ error: null }),

  refresh: async () => {
    if (!isSupabaseConfigured) {
      set({ hasHydrated: true, isLoading: false, error: null });
      return;
    }

    set({ isLoading: true, error: null });
    try {
      const supabase = getSupabase();
      const userId = requireSessionUserId();

      const globalQuery = supabase
        .from('hall_of_fame_entries')
        .select('*')
        .order('score_overall', { ascending: false })
        .limit(GLOBAL_LEADERBOARD_DISPLAY_LIMIT);

      const userQuery = userId
        ? supabase
            .from('hall_of_fame_entries')
            .select('*')
            .eq('user_id', userId)
            .order('submitted_at', { ascending: false })
        : null;

      const [globalRes, userRes] = await Promise.all([
        globalQuery,
        userQuery ?? Promise.resolve({ data: [] as HallOfFameEntryRow[], error: null }),
      ]);

      if (globalRes.error) throw new Error(globalRes.error.message);
      if (userRes.error) throw new Error(userRes.error.message);

      const globalSubmissions = ((globalRes.data ?? []) as HallOfFameEntryRow[]).map((row) =>
        rowToGoalSubmission(row, SUPABASE_URL)
      );
      const userSubmissions = ((userRes.data ?? []) as HallOfFameEntryRow[]).map((row) =>
        rowToGoalSubmission(row, SUPABASE_URL)
      );

      set({
        globalSubmissions,
        userSubmissions,
        isLoading: false,
        hasHydrated: true,
        error: null,
      });
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to load Hall of Fame';
      console.warn('[HallOfFame] refresh failed', err);
      set({ isLoading: false, hasHydrated: true, error: message });
    }
  },

  getUserSubmissionsChronological: () =>
    [...get().userSubmissions].sort(
      (a, b) => new Date(b.submittedAt).getTime() - new Date(a.submittedAt).getTime()
    ),

  getPinnedUserSubmissions: (limit = 3) =>
    [...get().userSubmissions]
      .sort((a, b) => b.score.overall - a.score.overall)
      .slice(0, limit),

  getHighestRated: (limit = GLOBAL_LEADERBOARD_DISPLAY_LIMIT) =>
    toLeaderboardEntries(get().globalSubmissions, limit),

  getTrending: (limit = 5) => toTrendingEntries(get().globalSubmissions, limit),

  getChallenges: () => getDemoChallenges(),

  isClipSubmitted: (clipUri) => get().userSubmissions.some((s) => s.clipUri === clipUri),

  isReportSubmitted: (reportId) =>
    get().userSubmissions.some((s) => s.reportId === reportId),

  hasReachedUserEntryLimit: () => {
    if (isDevUnlimitedAnalyses()) return false;
    return get().userSubmissions.length >= MAX_USER_HALL_OF_FAME_ENTRIES_NON_PREMIUM;
  },

  evaluateForHallOfFame: (report) => {
    if (!requireSessionUserId()) {
      console.log('[HallOfFame] Skip unlock preview — not signed in');
      return null;
    }

    const eligibility = evaluateHallOfFameEligibility(report);
    if (!eligibility.qualifies) return null;

    if (get().hasReachedUserEntryLimit()) {
      console.log('[HallOfFame] Eligible Goal report ignored — user entry limit reached', {
        reportId: report.id,
        limit: MAX_USER_HALL_OF_FAME_ENTRIES_NON_PREMIUM,
      });
      return null;
    }

    return {
      reportId: report.id,
      playTitle: deriveHallOfFamePlayTitle(report),
      reasons: eligibility.reasons,
    };
  },

  tryAutoInductFromReport: async (report, profile) => {
    const eligibility = evaluateHallOfFameEligibility(report);
    if (!eligibility.qualifies) {
      return { ok: false, reason: 'invalid_report' };
    }

    const result = await get().submitFromReport(report, profile, { autoInducted: true });
    if (result.ok) {
      console.log('[HallOfFame] Auto-inducted play', {
        reportId: report.id,
        playTitle: deriveHallOfFamePlayTitle(report),
        reasons: eligibility.reasons,
      });
      return { ...result, playTitle: deriveHallOfFamePlayTitle(report) };
    }
    return result;
  },

  submitFromReport: async (report, profile, options) => {
    if (!isSupabaseConfigured) {
      return {
        ok: false,
        reason: 'network_error',
        message: 'Supabase is not configured.',
      };
    }

    const userId = requireSessionUserId();
    if (!userId) {
      return {
        ok: false,
        reason: 'not_signed_in',
        message: 'Sign in to induct plays into the Hall of Fame.',
      };
    }

    if (get().hasReachedUserEntryLimit()) {
      return { ok: false, reason: 'entry_limit' };
    }

    const duplicate = validateSubmissionDuplicate(
      get().userSubmissions,
      report.id,
      report.clip.uri
    );
    if (duplicate) return duplicate;

    set({ isSubmitting: true, error: null });

    try {
      const entryId = createEntryId();
      const draft = reportToHallOfFameSubmission(report, profile, {
        autoInducted: options?.autoInducted ?? false,
      });

      const { path } = await uploadHallOfFameVideo({
        userId,
        entryId,
        localUri: report.clip.uri,
      });

      const row = submissionToInsertRow({
        id: entryId,
        userId,
        submission: draft,
        videoPath: path,
      });

      const { data, error } = await getSupabase()
        .from('hall_of_fame_entries')
        .insert(row)
        .select('*')
        .single();

      if (error) {
        // Best-effort cleanup of orphaned upload
        await getSupabase().storage.from('hall-of-fame').remove([path]).catch(() => undefined);
        throw new Error(error.message);
      }

      const saved = rowToGoalSubmission(data as HallOfFameEntryRow, SUPABASE_URL);

      set((state) => ({
        userSubmissions: [saved, ...state.userSubmissions.filter((s) => s.id !== saved.id)],
        globalSubmissions: [saved, ...state.globalSubmissions.filter((s) => s.id !== saved.id)],
        isSubmitting: false,
      }));

      return { ok: true, playTitle: saved.playTitle };
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to save Hall of Fame entry';
      console.warn('[HallOfFame] submit failed', err);
      set({ isSubmitting: false, error: message });
      return { ok: false, reason: 'network_error', message };
    }
  },
}));

export const hallOfFameService = {
  refresh: () => useHallOfFameStore.getState().refresh(),
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
  const globalSubmissions = useHallOfFameStore((s) => s.globalSubmissions);
  const hasHydrated = useHallOfFameStore((s) => s.hasHydrated);
  const isLoading = useHallOfFameStore((s) => s.isLoading);
  const isSubmitting = useHallOfFameStore((s) => s.isSubmitting);
  const error = useHallOfFameStore((s) => s.error);
  const refresh = useHallOfFameStore((s) => s.refresh);
  const clearError = useHallOfFameStore((s) => s.clearError);
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
  const currentUserId = useAuthStore((s) => s.session?.user?.id ?? null);

  return {
    hasHydrated,
    isLoading,
    isSubmitting,
    error,
    refresh,
    clearError,
    currentUserId,
    userSubmissionCount: userSubmissions.length,
    globalSubmissionCount: globalSubmissions.length,
    highestRated: getHighestRated(GLOBAL_LEADERBOARD_DISPLAY_LIMIT),
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
