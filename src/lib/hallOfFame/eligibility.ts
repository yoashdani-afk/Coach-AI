import type { CoachingReport } from '@/types/analysis';

export type HallOfFameQualificationReason = 'successful_goal_analysis';

export interface HallOfFameEligibilityResult {
  qualifies: boolean;
  reasons: HallOfFameQualificationReason[];
  rejectionReasons: string[];
}

/**
 * Evaluate whether a completed analysis qualifies for automatic Hall of Fame induction.
 *
 * Rule: every successfully produced GOAL-mode report qualifies.
 * Performance / Coach Me never qualify. Score thresholds and
 * "exceptional performance" gates are intentionally not applied —
 * insufficient-evidence / grounding failures never produce a report here.
 */
export function evaluateHallOfFameEligibility(
  report: CoachingReport
): HallOfFameEligibilityResult {
  const reasons: HallOfFameQualificationReason[] = [];
  const rejectionReasons: string[] = [];

  if (report.mode !== 'GOAL') {
    rejectionReasons.push(
      report.mode === 'PERFORMANCE'
        ? 'PERFORMANCE mode reports are not eligible for Hall of Fame induction'
        : 'Only GOAL mode reports are eligible for automatic Hall of Fame induction'
    );
    console.log('[HallOfFame] Eligibility evaluation', {
      qualifies: false,
      reasons,
      rejectionReasons,
      mode: report.mode,
    });
    return { qualifies: false, reasons, rejectionReasons };
  }

  reasons.push('successful_goal_analysis');

  console.log('[HallOfFame] Eligibility evaluation', {
    qualifies: true,
    reasons,
    rejectionReasons,
    mode: report.mode,
    overallScore: report.overallScore,
  });

  return {
    qualifies: true,
    reasons,
    rejectionReasons,
  };
}
