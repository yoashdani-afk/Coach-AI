import type { ScoredCategory } from '@/types/analysis';
import type { GoalAward, GoalAwardType, GoalScore } from '@/types/hallOfFame';

const AWARD_DEFINITIONS: Record<
  GoalAwardType,
  { emoji: string; label: string }
> = {
  ICE_COLD_FINISH: { emoji: '🥶', label: 'Ice Cold Finish' },
  ROCKET_STRIKE: { emoji: '⚡', label: 'Rocket Strike' },
  TOP_CORNER_PRECISION: { emoji: '🎯', label: 'Top Corner Precision' },
  ELITE_DECISION: { emoji: '🧠', label: 'Elite Decision' },
  CREATIVE_GENIUS: { emoji: '🎨', label: 'Creative Genius' },
  PERFECT_TEAM_GOAL: { emoji: '💎', label: 'Perfect Team Goal' },
};

export function createGoalAward(type: GoalAwardType): GoalAward {
  const def = AWARD_DEFINITIONS[type];
  return { type, emoji: def.emoji, label: def.label };
}

/** Pick a memorable award from category scores — deterministic for the same categories. */
export function determineGoalAward(categories: ScoredCategory[]): GoalAward {
  const sorted = [...categories].sort((a, b) => b.score - a.score);
  const top = sorted[0]?.key ?? 'FINISH';
  const second = sorted[1]?.key ?? 'TECHNIQUE';
  const third = sorted[2]?.key ?? 'DECISION';

  const scoreOf = (key: string) => categories.find((c) => c.key === key)?.score ?? 0;

  let type: GoalAwardType;

  if (top === 'COMPOSURE' && scoreOf('FINISH') >= scoreOf('TECHNIQUE')) {
    type = 'ICE_COLD_FINISH';
  } else if (top === 'DIFFICULTY' || (top === 'TECHNIQUE' && second === 'DIFFICULTY')) {
    type = 'ROCKET_STRIKE';
  } else if (top === 'FINISH' && ['TECHNIQUE', 'DIFFICULTY'].includes(second)) {
    type = top === 'FINISH' && second === 'DIFFICULTY' ? 'ROCKET_STRIKE' : 'TOP_CORNER_PRECISION';
  } else if (
    (top === 'DECISION' && second === 'CREATIVITY') ||
    (top === 'CREATIVITY' && second === 'DECISION') ||
    (['DECISION', 'CREATIVITY'].includes(top) && ['DECISION', 'CREATIVITY'].includes(second))
  ) {
    type = 'PERFECT_TEAM_GOAL';
  } else if (top === 'DECISION' || (top === 'COMPOSURE' && third === 'DECISION')) {
    type = 'ELITE_DECISION';
  } else if (top === 'CREATIVITY') {
    type = 'CREATIVE_GENIUS';
  } else if (top === 'FINISH') {
    type = scoreOf('COMPOSURE') >= 7.5 ? 'ICE_COLD_FINISH' : 'TOP_CORNER_PRECISION';
  } else if (top === 'COMPOSURE') {
    type = 'ICE_COLD_FINISH';
  } else {
    type = 'TOP_CORNER_PRECISION';
  }

  return createGoalAward(type);
}

export function buildGoalScore(overall: number, categories: ScoredCategory[]): GoalScore {
  return {
    overall,
    isDemo: true,
    categories,
  };
}
