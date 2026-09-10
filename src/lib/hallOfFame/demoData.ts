import type { Challenge, GoalSubmission, LeaderboardEntry } from '@/types/hallOfFame';
import { determineGoalAward } from '@/lib/hallOfFame/goalAward';

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

/** No seed entries — Hall of Fame starts empty until Goal-mode inductions. */
export const DEMO_HALL_OF_FAME_SUBMISSIONS: GoalSubmission[] = [];

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

export function normalizeUserSubmission(submission: GoalSubmission): GoalSubmission {
  return {
    ...submission,
    playTitle: submission.playTitle ?? submission.award?.label ?? 'Standout Moment',
    summary: submission.summary ?? '',
    analysisMode: submission.analysisMode ?? 'GOAL',
    thumbnailFocalY: submission.thumbnailFocalY ?? 0.38,
    award: determineGoalAward(submission.score.categories),
  };
}
