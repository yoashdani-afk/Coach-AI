import type { GoalReport } from '@/types/analysis';
import type { PlayerProfile } from '@/types/profile';
import type { GoalSubmission, SubmitGoalResult } from '@/types/hallOfFame';
import { buildGoalScore, determineGoalAward } from '@/lib/hallOfFame/goalAward';
import { createSubmissionId } from '@/lib/hallOfFame/goalScoring';
import { labelForPosition } from '@/lib/constants';

export function goalReportToSubmission(
  report: GoalReport,
  profile: PlayerProfile
): GoalSubmission {
  const award = determineGoalAward(report.categories);

  return {
    id: createSubmissionId(report.id),
    reportId: report.id,
    clipUri: report.clip.uri,
    thumbnailTimestampMs: report.playerSelection.timestampMs,
    playerName: profile.firstName,
    position: profile.mainPosition,
    positionLabel: labelForPosition(profile.mainPosition),
    score: buildGoalScore(report.overallScore, report.categories),
    award,
    submittedAt: new Date().toISOString(),
    source: 'user',
  };
}

export function validateSubmissionDuplicate(
  submissions: GoalSubmission[],
  clipUri: string
): SubmitGoalResult | null {
  const existing = submissions.find((s) => s.source === 'user' && s.clipUri === clipUri);
  if (existing) {
    return { ok: false, reason: 'duplicate' };
  }
  return null;
}
