import type { CoachingReport, PerformanceReport, GoalReport } from '@/types/analysis';
import type { PlayerProfile } from '@/types/profile';
import type { GoalSubmission, SubmitGoalResult } from '@/types/hallOfFame';
import { buildGoalScore, determineGoalAward } from '@/lib/hallOfFame/goalAward';
import { deriveHallOfFamePlayTitle } from '@/lib/hallOfFame/playTitle';
import { deriveHallOfFameThumbnailTimestamp } from '@/lib/hallOfFame/thumbnailTimestamp';
import { createSubmissionId } from '@/lib/hallOfFame/goalScoring';
import { labelForPosition } from '@/lib/constants';

function reportSummary(report: CoachingReport): string {
  return report.summary.trim() || report.title.trim();
}

function reportCategories(report: CoachingReport) {
  if (report.mode === 'GOAL' || report.mode === 'PERFORMANCE') {
    return report.categories;
  }
  return [];
}

function reportOverallScore(report: CoachingReport): number {
  if (report.mode === 'GOAL' || report.mode === 'PERFORMANCE') {
    return report.overallScore;
  }
  return 0;
}

export function reportToHallOfFameSubmission(
  report: CoachingReport,
  profile: PlayerProfile,
  options?: { autoInducted?: boolean }
): GoalSubmission {
  const categories = reportCategories(report);
  const award =
    report.mode === 'GOAL'
      ? determineGoalAward((report as GoalReport).categories)
      : determineGoalAward(categories.length > 0 ? categories : [{ key: 'FINISH', label: 'Finish', score: reportOverallScore(report) }]);

  return {
    id: createSubmissionId(report.id),
    reportId: report.id,
    clipUri: report.clip.uri,
    thumbnailTimestampMs: deriveHallOfFameThumbnailTimestamp(report),
    thumbnailFocalY: report.playerSelection.normalizedY,
    playerName: profile.firstName,
    position: profile.mainPosition,
    positionLabel: labelForPosition(profile.mainPosition),
    playTitle: deriveHallOfFamePlayTitle(report),
    summary: reportSummary(report),
    analysisMode: report.mode,
    score: buildGoalScore(
      reportOverallScore(report),
      categories,
      report.isDemo || report.analysisSource !== 'gemini'
    ),
    award,
    submittedAt: new Date().toISOString(),
    source: 'user',
    autoInducted: options?.autoInducted ?? false,
  };
}

/** @deprecated Use reportToHallOfFameSubmission */
export function goalReportToSubmission(
  report: GoalReport,
  profile: PlayerProfile
): GoalSubmission {
  return reportToHallOfFameSubmission(report, profile);
}

export function validateSubmissionDuplicate(
  submissions: GoalSubmission[],
  reportId: string,
  clipUri: string
): SubmitGoalResult | null {
  if (submissions.some((s) => s.source === 'user' && s.reportId === reportId)) {
    return { ok: false, reason: 'duplicate' };
  }
  if (submissions.some((s) => s.source === 'user' && s.clipUri === clipUri)) {
    return { ok: false, reason: 'duplicate' };
  }
  return null;
}
