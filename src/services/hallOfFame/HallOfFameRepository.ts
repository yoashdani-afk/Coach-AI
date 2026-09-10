import type {
  Challenge,
  GoalSubmission,
  HallOfFameRepository,
  LeaderboardEntry,
  SubmitGoalResult,
} from '@/types/hallOfFame';

/**
 * Remote Hall of Fame is implemented via Supabase in hallOfFameService.
 * UI should depend on hallOfFameService / useHallOfFame, not AsyncStorage.
 */
export type { HallOfFameRepository, GoalSubmission, LeaderboardEntry, Challenge, SubmitGoalResult };

export interface RemoteHallOfFameRepository extends HallOfFameRepository {
  sync(): Promise<void>;
}
