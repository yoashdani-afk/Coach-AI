import type { ScoredCategory } from '@/types/analysis';
import type { Position } from '@/types/profile';

export type GoalCategoryKey =
  | 'FINISH'
  | 'TECHNIQUE'
  | 'DIFFICULTY'
  | 'CREATIVITY'
  | 'DECISION'
  | 'COMPOSURE';

export type GoalAwardType =
  | 'ICE_COLD_FINISH'
  | 'ROCKET_STRIKE'
  | 'TOP_CORNER_PRECISION'
  | 'ELITE_DECISION'
  | 'CREATIVE_GENIUS'
  | 'PERFECT_TEAM_GOAL';

export interface GoalScore {
  overall: number;
  isDemo: true;
  categories: ScoredCategory[];
}

export interface GoalAward {
  type: GoalAwardType;
  emoji: string;
  label: string;
}

export interface GoalSubmission {
  id: string;
  reportId: string;
  clipUri: string;
  thumbnailTimestampMs: number;
  playerName: string;
  position: Position;
  positionLabel: string;
  score: GoalScore;
  award: GoalAward;
  submittedAt: string;
  source: 'user' | 'demo';
}

export interface LeaderboardEntry {
  submission: GoalSubmission;
  rank: number;
  isTrending?: boolean;
}

export type ChallengeStatus = 'upcoming' | 'active' | 'ended';

export interface Challenge {
  id: string;
  title: string;
  description: string;
  emoji: string;
  status: ChallengeStatus;
}

export type SubmitGoalResult = { ok: true } | { ok: false; reason: 'duplicate' | 'invalid_report' };

export interface HallOfFameRepository {
  getHighestRated(limit?: number): LeaderboardEntry[];
  getTrending(limit?: number): LeaderboardEntry[];
  getChallenges(): Challenge[];
  getUserSubmissions(): GoalSubmission[];
  isClipSubmitted(clipUri: string): boolean;
  isReportSubmitted(reportId: string): boolean;
  submitGoal(submission: GoalSubmission): SubmitGoalResult;
}
