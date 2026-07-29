import type { ClipMetadata, PerformanceReport, PlayerSelection, ScoredCategory } from '@/types/analysis';
import type { PlayerProfile } from '@/types/profile';
import {
  performanceImprovement,
  performanceStrength,
  performanceSummary,
  performanceTraining,
} from '@/lib/coaching/feedbackBank';
import { clipCategoryOffset } from '@/lib/hallOfFame/goalScoring';
import {
  ageAdjustment,
  averageScores,
  baseReportFields,
  buildProfileContext,
  clampScore,
  createReportId,
  focusPenalty,
  hashString,
  levelBaseScore,
  positionBoost,
} from './shared';

const PERFORMANCE_CATEGORIES: { key: string; label: string; ageKey?: 'COMPOSURE' | 'COMMUNICATION' }[] = [
  { key: 'DECISION_MAKING', label: 'Decision Making' },
  { key: 'POSITIONING', label: 'Positioning' },
  { key: 'SCANNING', label: 'Scanning' },
  { key: 'MOVEMENT', label: 'Movement' },
  { key: 'FIRST_TOUCH', label: 'First Touch' },
  { key: 'COMPOSURE', label: 'Composure', ageKey: 'COMPOSURE' },
  { key: 'COMMUNICATION', label: 'Communication', ageKey: 'COMMUNICATION' },
];

function scoreCategory(
  profile: PlayerProfile,
  clip: ClipMetadata,
  categoryKey: string,
  ageKey?: 'COMPOSURE' | 'COMMUNICATION'
): number {
  const base = levelBaseScore(profile.playingLevel);
  const boost = positionBoost(profile.mainPosition, categoryKey);
  const penalty = focusPenalty(profile.improvementGoals, profile.feedbackAreas, categoryKey);
  const ageAdj = ageAdjustment(profile.age, ageKey ?? 'DEFAULT');
  const clipAdj = clipCategoryOffset(clip, categoryKey);
  return clampScore(base + boost + penalty + ageAdj + clipAdj);
}

function buildCategories(profile: PlayerProfile, clip: ClipMetadata): ScoredCategory[] {
  return PERFORMANCE_CATEGORIES.map(({ key, label, ageKey }) => ({
    key,
    label,
    score: scoreCategory(profile, clip, key, ageKey),
  }));
}

export function generatePerformanceReport(params: {
  profile: PlayerProfile;
  clip: ClipMetadata;
  playerSelection: PlayerSelection;
}): PerformanceReport {
  const { profile, clip, playerSelection } = params;
  const ctx = buildProfileContext(profile);
  const seed = hashString(clip.uri + 'performance' + profile.mainPosition);
  const categories = buildCategories(profile, clip);
  const sorted = [...categories].sort((a, b) => b.score - a.score);
  const top = sorted[0];
  const bottom = sorted[sorted.length - 1];
  const overallScore = averageScores(categories);

  const coachSummary = performanceSummary(
    ctx.firstName,
    ctx.positionLabel,
    ctx.levelLabel,
    top.label,
    top.score,
    bottom.label,
    bottom.score,
    overallScore,
    seed
  );

  return {
    id: createReportId(clip, 'performance'),
    mode: 'PERFORMANCE',
    title: 'Rate My Performance',
    summary: coachSummary,
    playerSelection,
    categories,
    overallScore,
    topStrength: performanceStrength(top.key, top.score, seed),
    biggestImprovement: performanceImprovement(bottom.key, bottom.score, seed),
    coachSummary,
    trainingRecommendation: performanceTraining(bottom.key, ctx.footLabel, seed),
    ...baseReportFields(clip),
  };
}
