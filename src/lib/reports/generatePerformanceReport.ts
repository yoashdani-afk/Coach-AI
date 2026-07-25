import type { ClipMetadata, PerformanceReport, PlayerSelection, ScoredCategory } from '@/types/analysis';
import type { PlayerProfile } from '@/types/profile';
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
  categoryKey: string,
  ageKey?: 'COMPOSURE' | 'COMMUNICATION'
): number {
  const base = levelBaseScore(profile.playingLevel);
  const boost = positionBoost(profile.mainPosition, categoryKey);
  const penalty = focusPenalty(profile.improvementGoals, profile.feedbackAreas, categoryKey);
  const ageAdj = ageAdjustment(profile.age, ageKey ?? 'DEFAULT');
  return clampScore(base + boost + penalty + ageAdj);
}

function buildCategories(profile: PlayerProfile): ScoredCategory[] {
  return PERFORMANCE_CATEGORIES.map(({ key, label, ageKey }) => ({
    key,
    label,
    score: scoreCategory(profile, key, ageKey),
  }));
}

function strengthCopy(category: ScoredCategory, ctx: ReturnType<typeof buildProfileContext>): string {
  const copies: Record<string, string> = {
    DECISION_MAKING: `You read the moment well for a ${ctx.levelLabel.toLowerCase()} ${ctx.positionLabel.toLowerCase()} — your decision-making (${category.score}/10) shows you trust what you see.`,
    POSITIONING: `Your starting position and spacing (${category.score}/10) gave you a platform to affect the play without chasing the ball.`,
    SCANNING: `You checked your surroundings before acting (${category.score}/10) — that habit separates good players from great ones at your age.`,
    MOVEMENT: `Your movement off the ball (${category.score}/10) created options for teammates and kept defenders guessing.`,
    FIRST_TOUCH: `Your first touch (${category.score}/10) set up the next action cleanly — especially important for a ${ctx.footLabel.toLowerCase()}-footed player in tight areas.`,
    COMPOSURE: `You stayed calm under pressure (${category.score}/10) — ${ctx.firstName}, that maturity is a real asset at ${ctx.age}.`,
    COMMUNICATION: `You communicated clearly in this clip (${category.score}/10) — calling early helps everyone around you play faster.`,
  };
  return copies[category.key] ?? `Strong ${category.label.toLowerCase()} (${category.score}/10) stood out in this moment.`;
}

function improvementCopy(category: ScoredCategory, ctx: ReturnType<typeof buildProfileContext>): string {
  const copies: Record<string, string> = {
    DECISION_MAKING: `Decision making (${category.score}/10) is your biggest growth area — pause for one scan before committing when the picture is unclear.`,
    POSITIONING: `Positioning (${category.score}/10) can improve — arrive side-on and half a step deeper so you see both ball and runner.`,
    SCANNING: `Scanning (${category.score}/10) needs work — build the habit of checking shoulder before every receive, not after.`,
    MOVEMENT: `Movement (${category.score}/10) was flat at times — show for the ball earlier and create angles before the pass is played.`,
    FIRST_TOUCH: `First touch (${category.score}/10) forced rushed second actions — set the ball into space with your ${ctx.footLabel.toLowerCase()} foot before pressure arrives.`,
    COMPOSURE: `Composure (${category.score}/10) dipped when pressed — one extra touch to secure possession beats a hurried clearance.`,
    COMMUNICATION: `Communication (${category.score}/10) was quiet — call "time", "turn", or "man on" before receiving to help teammates.`,
  };
  return copies[category.key] ?? `${category.label} (${category.score}/10) has the most room to grow in this clip.`;
}

function trainingForCategory(key: string, ctx: ReturnType<typeof buildProfileContext>): string {
  const plans: Record<string, string> = {
    DECISION_MAKING: 'Small-sided 4v4: before every pass, point to your target. Build the habit of choosing the simple option first.',
    POSITIONING: 'Shadow defending: hold a side-on body shape and check both posts every three seconds without losing the ball.',
    SCANNING: 'Receive-and-turn drill: partner calls a colour cone — you must scan both shoulders before your first touch.',
    MOVEMENT: 'Third-man runs in rondos: after passing, move to a new angle within two seconds every rep.',
    FIRST_TOUCH: `Wall work: 30 touches per session with your ${ctx.footLabel.toLowerCase()} foot, aiming to set the ball into a cone zone.`,
    COMPOSURE: 'Pressured possession boxes: three defenders, six passes to escape — no panicked clearances allowed.',
    COMMUNICATION: 'Every training drill this week: verbal call before every receive. Loud, early, and specific.',
  };
  return plans[key] ?? 'Pick one habit from this clip and repeat it deliberately in your next three sessions.';
}

export function generatePerformanceReport(params: {
  profile: PlayerProfile;
  clip: ClipMetadata;
  playerSelection: PlayerSelection;
}): PerformanceReport {
  const { profile, clip, playerSelection } = params;
  const ctx = buildProfileContext(profile);
  const categories = buildCategories(profile);
  const sorted = [...categories].sort((a, b) => b.score - a.score);
  const top = sorted[0];
  const bottom = sorted[sorted.length - 1];
  const overallScore = averageScores(categories);

  const coachSummary = `${ctx.firstName}, as a ${ctx.levelLabel.toLowerCase()} ${ctx.positionLabel.toLowerCase()} (${ctx.age}), this clip shows solid habits with clear next steps. Your strongest area was ${top.label.toLowerCase()} (${top.score}/10), while ${bottom.label.toLowerCase()} (${bottom.score}/10) offers the most room to grow — especially given your training focus.`;

  return {
    id: createReportId(clip, 'performance'),
    mode: 'PERFORMANCE',
    title: 'Rate My Performance',
    summary: coachSummary,
    playerSelection,
    categories,
    overallScore,
    topStrength: strengthCopy(top, ctx),
    biggestImprovement: improvementCopy(bottom, ctx),
    coachSummary,
    trainingRecommendation: trainingForCategory(bottom.key, ctx),
    ...baseReportFields(clip),
  };
}
