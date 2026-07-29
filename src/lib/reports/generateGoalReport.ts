import type { ClipMetadata, GoalReport, PlayerSelection, ScoredCategory } from '@/types/analysis';
import type { PlayerProfile } from '@/types/profile';
import {
  buildGoalWhyAnalysis,
  goalExcellentPoint,
  goalImprovementPoint,
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

const GOAL_CATEGORIES: { key: string; label: string }[] = [
  { key: 'FINISH', label: 'Finish' },
  { key: 'TECHNIQUE', label: 'Technique' },
  { key: 'DIFFICULTY', label: 'Difficulty' },
  { key: 'CREATIVITY', label: 'Creativity' },
  { key: 'DECISION', label: 'Decision' },
  { key: 'COMPOSURE', label: 'Composure' },
];

function scoreGoalCategory(
  profile: PlayerProfile,
  clip: ClipMetadata,
  categoryKey: string
): number {
  const base = levelBaseScore(profile.playingLevel);
  const boost = positionBoost(profile.mainPosition, categoryKey);
  const penalty = focusPenalty(profile.improvementGoals, profile.feedbackAreas, categoryKey);
  const ageAdj =
    categoryKey === 'COMPOSURE' ? ageAdjustment(profile.age, 'COMPOSURE') : 0;
  const clipAdj = clipCategoryOffset(clip, categoryKey);

  let roleAdj = 0;
  if (['STRIKER', 'WINGER'].includes(profile.mainPosition) && ['FINISH', 'TECHNIQUE'].includes(categoryKey)) {
    roleAdj = 0.4;
  }
  if (['CENTRE_BACK', 'DEFENSIVE_MIDFIELDER', 'GOALKEEPER'].includes(profile.mainPosition) && categoryKey === 'CREATIVITY') {
    roleAdj = -0.3;
  }

  return clampScore(base + boost + penalty + ageAdj + roleAdj + clipAdj);
}

function buildCategories(profile: PlayerProfile, clip: ClipMetadata): ScoredCategory[] {
  return GOAL_CATEGORIES.map(({ key, label }) => ({
    key,
    label,
    score: scoreGoalCategory(profile, clip, key),
  }));
}

export function generateGoalReport(params: {
  profile: PlayerProfile;
  clip: ClipMetadata;
  playerSelection: PlayerSelection;
}): GoalReport {
  const { profile, clip, playerSelection } = params;
  const ctx = buildProfileContext(profile);
  const seed = hashString(clip.uri + 'goal' + profile.mainPosition);
  const categories = buildCategories(profile, clip);
  const overallScore = averageScores(categories);

  const whyScoredThisWay = buildGoalWhyAnalysis(
    overallScore,
    ctx.positionLabel,
    ctx.levelLabel,
    seed
  );

  return {
    id: createReportId(clip, 'goal'),
    mode: 'GOAL',
    title: 'Rate This Goal',
    summary: whyScoredThisWay,
    playerSelection,
    categories,
    overallScore,
    whyScoredThisWay,
    excellentPoint: goalExcellentPoint(seed),
    couldBeBetter: goalImprovementPoint(seed),
    ...baseReportFields(clip),
  };
}
