import type { ClipMetadata, GoalReport, PlayerSelection, ScoredCategory } from '@/types/analysis';
import type { PlayerProfile } from '@/types/profile';
import { clipCategoryOffset } from '@/lib/hallOfFame/goalScoring';
import {
  ageAdjustment,
  averageScores,
  baseReportFields,
  buildProfileContext,
  clampScore,
  createReportId,
  focusPenalty,
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
  const categories = buildCategories(profile, clip);
  const sorted = [...categories].sort((a, b) => b.score - a.score);
  const top = sorted[0];
  const bottom = sorted[sorted.length - 1];
  const overallScore = averageScores(categories);

  const whyScoredThisWay = `This attacking action receives a Demo Score of ${overallScore}/10 for a ${ctx.levelLabel.toLowerCase()} ${ctx.positionLabel.toLowerCase()}. ${top.label} (${top.score}/10) led the assessment — scores are generated locally from your profile and clip, not from real AI video analysis.`;

  const excellentPoint = (() => {
    const map: Record<string, string> = {
      FINISH: 'The contact was clean and you chose the corner the keeper struggled to reach — a confident striker’s finish.',
      TECHNIQUE: 'Body shape over the ball was excellent — hips low, ankle locked, and you did not snatch at it.',
      DIFFICULTY: 'You created something from a tight angle under pressure — that raises the value of the action.',
      CREATIVITY: 'You saw a route others might not — the disguise or angle of the attempt showed real attacking imagination.',
      DECISION: 'You took the shot when the window opened instead of overcomplicating — good instinct in the box.',
      COMPOSURE: 'No panic in the final moment — you slowed the action down when others might have rushed.',
    };
    return map[top.key] ?? `${top.label} was the highlight of this attacking moment.`;
  })();

  const couldBeBetter = (() => {
    const map: Record<string, string> = {
      FINISH: 'A slightly earlier shot release could beat the recovering defender — you had one more step of space.',
      TECHNIQUE: 'Plant foot a fraction wider would add power without sacrificing placement.',
      DIFFICULTY: 'A one-touch finish from that angle would push the difficulty rating even higher.',
      CREATIVITY: 'A disguised pass to the far post runner was also on — mixing shot and pass keeps keepers honest.',
      DECISION: 'One more scan before committing might have revealed a square pass for a tap-in.',
      COMPOSURE: 'Set the ball one touch earlier so the finish is even more controlled under pressure.',
    };
    return map[bottom.key] ?? `${bottom.label} (${bottom.score}/10) is the area that could elevate this goal from good to great.`;
  })();

  return {
    id: createReportId(clip, 'goal'),
    mode: 'GOAL',
    title: 'Rate This Goal',
    summary: whyScoredThisWay,
    playerSelection,
    categories,
    overallScore,
    whyScoredThisWay,
    excellentPoint,
    couldBeBetter,
    ...baseReportFields(clip),
  };
}
