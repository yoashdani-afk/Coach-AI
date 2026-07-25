import type {
  Challenge,
  GoalSubmission,
  HallOfFameRepository,
  LeaderboardEntry,
  SubmitGoalResult,
} from '@/types/hallOfFame';

/**
 * Remote implementation will fetch from API and replace the local store.
 * UI should depend on this interface (via hallOfFameService), not AsyncStorage.
 */
export type { HallOfFameRepository, GoalSubmission, LeaderboardEntry, Challenge, SubmitGoalResult };

export interface RemoteHallOfFameRepository extends HallOfFameRepository {
  sync(): Promise<void>;
}
