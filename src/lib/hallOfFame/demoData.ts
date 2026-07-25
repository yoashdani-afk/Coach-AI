import type { Challenge, GoalSubmission, LeaderboardEntry } from '@/types/hallOfFame';
import { buildGoalScore, createGoalAward, determineGoalAward } from '@/lib/hallOfFame/goalAward';

const DEMO_CHALLENGES: Challenge[] = [
  {
    id: 'challenge-volley',
    title: 'Best Volley',
    description: 'Submit your best volley finish. Judges reward technique and difficulty.',
    emoji: '🦅',
    status: 'upcoming',
  },
  {
    id: 'challenge-weak-foot',
    title: 'Best Weak Foot Finish',
    description: 'Score with your weaker foot and prove your versatility in front of goal.',
    emoji: '🦶',
    status: 'upcoming',
  },
  {
    id: 'challenge-long-range',
    title: 'Long Range Goals',
    description: 'Strike from distance — power, placement, and bravery all count.',
    emoji: '🚀',
    status: 'upcoming',
  },
  {
    id: 'challenge-team-goal',
    title: 'Team Goal Challenge',
    description: 'The best team move ending in a goal. Creativity and decision-making matter.',
    emoji: '🤝',
    status: 'upcoming',
  },
];

function demoSubmission(params: {
  id: string;
  playerName: string;
  position: GoalSubmission['position'];
  positionLabel: string;
  overall: number;
  categories: GoalSubmission['score']['categories'];
  awardType: Parameters<typeof createGoalAward>[0];
  daysAgo: number;
}): GoalSubmission {
  const categories = params.categories;
  const award = createGoalAward(params.awardType);

  return {
    id: params.id,
    reportId: `demo-report-${params.id}`,
    clipUri: `demo://clip/${params.id}`,
    thumbnailTimestampMs: 1200,
    playerName: params.playerName,
    position: params.position,
    positionLabel: params.positionLabel,
    score: buildGoalScore(params.overall, categories),
    award,
    submittedAt: new Date(Date.now() - params.daysAgo * 86_400_000).toISOString(),
    source: 'demo',
  };
}

/** Seed entries shown before the user submits anything. */
export const DEMO_HALL_OF_FAME_SUBMISSIONS: GoalSubmission[] = [
  demoSubmission({
    id: 'demo-1',
    playerName: 'Marcus Reid',
    position: 'STRIKER',
    positionLabel: 'Striker',
    overall: 9.1,
    awardType: 'ICE_COLD_FINISH',
    daysAgo: 2,
    categories: [
      { key: 'FINISH', label: 'Finish', score: 9.2 },
      { key: 'TECHNIQUE', label: 'Technique', score: 8.8 },
      { key: 'DIFFICULTY', label: 'Difficulty', score: 8.5 },
      { key: 'CREATIVITY', label: 'Creativity', score: 8.0 },
      { key: 'DECISION', label: 'Decision', score: 9.0 },
      { key: 'COMPOSURE', label: 'Composure', score: 9.4 },
    ],
  }),
  demoSubmission({
    id: 'demo-2',
    playerName: 'Elena Vasquez',
    position: 'WINGER',
    positionLabel: 'Winger',
    overall: 8.8,
    awardType: 'ROCKET_STRIKE',
    daysAgo: 1,
    categories: [
      { key: 'FINISH', label: 'Finish', score: 8.9 },
      { key: 'TECHNIQUE', label: 'Technique', score: 8.7 },
      { key: 'DIFFICULTY', label: 'Difficulty', score: 9.3 },
      { key: 'CREATIVITY', label: 'Creativity', score: 8.2 },
      { key: 'DECISION', label: 'Decision', score: 8.5 },
      { key: 'COMPOSURE', label: 'Composure', score: 8.4 },
    ],
  }),
  demoSubmission({
    id: 'demo-3',
    playerName: 'Tom Okonkwo',
    position: 'ATTACKING_MIDFIELDER',
    positionLabel: 'Attacking midfielder',
    overall: 8.6,
    awardType: 'CREATIVE_GENIUS',
    daysAgo: 3,
    categories: [
      { key: 'FINISH', label: 'Finish', score: 8.2 },
      { key: 'TECHNIQUE', label: 'Technique', score: 8.5 },
      { key: 'DIFFICULTY', label: 'Difficulty', score: 8.0 },
      { key: 'CREATIVITY', label: 'Creativity', score: 9.4 },
      { key: 'DECISION', label: 'Decision', score: 8.8 },
      { key: 'COMPOSURE', label: 'Composure', score: 8.3 },
    ],
  }),
  demoSubmission({
    id: 'demo-4',
    playerName: 'Sofia Lindström',
    position: 'STRIKER',
    positionLabel: 'Striker',
    overall: 8.4,
    awardType: 'TOP_CORNER_PRECISION',
    daysAgo: 4,
    categories: [
      { key: 'FINISH', label: 'Finish', score: 9.1 },
      { key: 'TECHNIQUE', label: 'Technique', score: 8.9 },
      { key: 'DIFFICULTY', label: 'Difficulty', score: 7.8 },
      { key: 'CREATIVITY', label: 'Creativity', score: 7.5 },
      { key: 'DECISION', label: 'Decision', score: 8.2 },
      { key: 'COMPOSURE', label: 'Composure', score: 8.0 },
    ],
  }),
  demoSubmission({
    id: 'demo-5',
    playerName: 'Jayden Cole',
    position: 'CENTRAL_MIDFIELDER',
    positionLabel: 'Central midfielder',
    overall: 8.2,
    awardType: 'PERFECT_TEAM_GOAL',
    daysAgo: 1,
    categories: [
      { key: 'FINISH', label: 'Finish', score: 8.0 },
      { key: 'TECHNIQUE', label: 'Technique', score: 8.1 },
      { key: 'DIFFICULTY', label: 'Difficulty', score: 7.6 },
      { key: 'CREATIVITY', label: 'Creativity', score: 8.9 },
      { key: 'DECISION', label: 'Decision', score: 9.0 },
      { key: 'COMPOSURE', label: 'Composure', score: 8.0 },
    ],
  }),
  demoSubmission({
    id: 'demo-6',
    playerName: 'Amir Hassan',
    position: 'WINGER',
    positionLabel: 'Winger',
    overall: 8.0,
    awardType: 'ELITE_DECISION',
    daysAgo: 5,
    categories: [
      { key: 'FINISH', label: 'Finish', score: 7.8 },
      { key: 'TECHNIQUE', label: 'Technique', score: 7.9 },
      { key: 'DIFFICULTY', label: 'Difficulty', score: 7.5 },
      { key: 'CREATIVITY', label: 'Creativity', score: 7.8 },
      { key: 'DECISION', label: 'Decision', score: 9.2 },
      { key: 'COMPOSURE', label: 'Composure', score: 8.1 },
    ],
  }),
];

export function getDemoChallenges(): Challenge[] {
  return DEMO_CHALLENGES;
}

export function toLeaderboardEntries(
  submissions: GoalSubmission[],
  limit?: number
): LeaderboardEntry[] {
  const sorted = [...submissions].sort((a, b) => b.score.overall - a.score.overall);
  const slice = limit ? sorted.slice(0, limit) : sorted;
  return slice.map((submission, index) => ({
    submission,
    rank: index + 1,
  }));
}

export function toTrendingEntries(
  submissions: GoalSubmission[],
  limit = 5
): LeaderboardEntry[] {
  const sorted = [...submissions].sort(
    (a, b) => new Date(b.submittedAt).getTime() - new Date(a.submittedAt).getTime()
  );
  return sorted.slice(0, limit).map((submission, index) => ({
    submission,
    rank: index + 1,
    isTrending: true,
  }));
}

/** Recompute award from categories when loading user submissions. */
export function normalizeUserSubmission(submission: GoalSubmission): GoalSubmission {
  return {
    ...submission,
    award: determineGoalAward(submission.score.categories),
  };
}
