import type { CoachingReport, ScoredCategory } from '@/types/analysis';

/** Strict automatic induction threshold on the 0–10 scale. */
export const HALL_OF_FAME_SCORE_THRESHOLD = 9.0;
export const HALL_OF_FAME_CATEGORY_THRESHOLD = 9.2;

const EXCEPTIONAL_OUTCOME_PHRASES = [
  'scored',
  'goal',
  'assist',
  'saved',
  'elite save',
  'last-man',
  'last man',
  'outstanding skill',
  'world-class',
  'world class',
  'bicycle kick',
  'overhead kick',
  'scissor kick',
  'chance created',
  'one-on-one',
  '1v1',
];

const UNCERTAINTY_PHRASES = [
  'could not be confirmed',
  'could not confirm',
  'not visually confirmed',
  'identity could not',
  'tracking uncertain',
  'temporarily out of view',
  'temporarily left the frame',
];

export type HallOfFameQualificationReason =
  | 'overall_score'
  | 'category_score'
  | 'exceptional_outcome'
  | 'high_execution';

export interface HallOfFameEligibilityResult {
  qualifies: boolean;
  reasons: HallOfFameQualificationReason[];
  rejectionReasons: string[];
}

function meetsOverallThreshold(score: number): boolean {
  if (score >= 95) return true;
  return score >= HALL_OF_FAME_SCORE_THRESHOLD;
}

function categoryScore(categories: ScoredCategory[], label: string): number | null {
  const normalized = label.toLowerCase();
  const match = categories.find(
    (c) =>
      c.label.toLowerCase() === normalized ||
      c.key.toLowerCase() === normalized.replace(/\s+/g, '_')
  );
  return match?.score ?? null;
}

function collectReportText(report: CoachingReport): string {
  const parts = [report.title, report.summary];

  if (report.mode === 'GOAL') {
    parts.push(report.whyScoredThisWay, report.excellentPoint, report.couldBeBetter);
  } else if (report.mode === 'PERFORMANCE') {
    parts.push(report.coachSummary, report.topStrength, report.biggestImprovement);
  } else {
    parts.push(report.verdict, report.betterOption, report.trainingTakeaway, ...report.didWell);
  }

  return parts.join(' ').toLowerCase();
}

function hasExceptionalOutcome(text: string): boolean {
  return EXCEPTIONAL_OUTCOME_PHRASES.some((phrase) => text.includes(phrase));
}

function hasTrackingUncertainty(text: string): boolean {
  return UNCERTAINTY_PHRASES.some((phrase) => text.includes(phrase));
}

function hasMeaningfulImprovements(report: CoachingReport): boolean {
  if (report.mode === 'GOAL') {
    return report.couldBeBetter.trim().length > 20;
  }
  if (report.mode === 'PERFORMANCE') {
    return report.biggestImprovement.trim().length > 20;
  }
  return report.couldImprove.some((item) => item.trim().length > 20);
}

function hasLowIdentityConfidence(report: CoachingReport): boolean {
  const profile = report.playerSelection.identityProfile;
  if (profile?.identityConfidence === 'LOW') return true;
  if (report.playerSelection.reducedTrackingConfidence) return true;
  return false;
}

/** Evaluate whether a completed analysis qualifies for automatic Hall of Fame induction. */
export function evaluateHallOfFameEligibility(
  report: CoachingReport
): HallOfFameEligibilityResult {
  const reasons: HallOfFameQualificationReason[] = [];
  const rejectionReasons: string[] = [];
  const text = collectReportText(report);

  if (report.mode !== 'GOAL' && report.mode !== 'PERFORMANCE') {
    rejectionReasons.push('COACH_ME reports are not eligible for automatic Hall of Fame induction');
    return { qualifies: false, reasons, rejectionReasons };
  }

  if (hasLowIdentityConfidence(report)) {
    rejectionReasons.push('Player identity confidence was LOW during analysis');
  }

  if (hasTrackingUncertainty(text)) {
    rejectionReasons.push('Report contains tracking or identity uncertainty');
  }

  if (hasMeaningfulImprovements(report)) {
    rejectionReasons.push('Report contains meaningful improvement areas');
  }

  const overallOk = meetsOverallThreshold(report.overallScore);
  const topCategory = [...report.categories].sort((a, b) => b.score - a.score)[0];
  const categoryOk = topCategory ? topCategory.score >= HALL_OF_FAME_CATEGORY_THRESHOLD : false;
  const exceptionalOutcome = hasExceptionalOutcome(text);

  if (overallOk) reasons.push('overall_score');
  if (categoryOk) reasons.push('category_score');
  if (exceptionalOutcome) reasons.push('exceptional_outcome');
  if (overallOk && categoryOk && !hasMeaningfulImprovements(report)) {
    reasons.push('high_execution');
  }

  const qualifies =
    overallOk &&
    categoryOk &&
    exceptionalOutcome &&
    rejectionReasons.length === 0;

  if (!overallOk) rejectionReasons.push(`Overall score below ${HALL_OF_FAME_SCORE_THRESHOLD}`);
  if (!categoryOk) {
    rejectionReasons.push(`No category >= ${HALL_OF_FAME_CATEGORY_THRESHOLD}`);
  }
  if (!exceptionalOutcome) {
    rejectionReasons.push('No exceptional football outcome detected (goal, assist, elite save, etc.)');
  }

  console.log('[HallOfFame] Eligibility evaluation', {
    qualifies,
    reasons,
    rejectionReasons,
    overallScore: report.overallScore,
    topCategory: topCategory?.label,
    topCategoryScore: topCategory?.score,
  });

  return {
    qualifies,
    reasons,
    rejectionReasons,
  };
}
