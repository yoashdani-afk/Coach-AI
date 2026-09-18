import type { GoalReport } from '@/types/analysis';
import {
  parsePublicGoalReportSnapshot,
  snapshotToGoalReport,
} from '@/lib/hallOfFame/reportSnapshot';
import { getSupabase, isSupabaseConfigured } from '@/lib/supabase';

export type FetchHallOfFamePublicReportResult =
  | {
      status: 'ok';
      report: GoalReport;
      playTitle: string;
      playerName: string;
      ownerUserId?: string;
    }
  | {
      status: 'unavailable';
      playTitle: string;
      playerName: string;
      ownerUserId?: string;
    }
  | { status: 'not_found' }
  | { status: 'error'; message: string };

/**
 * Load a Hall of Fame entry for the public report detail screen.
 * Legacy rows without report_snapshot return status "unavailable".
 */
export async function fetchHallOfFamePublicReport(
  entryId: string
): Promise<FetchHallOfFamePublicReportResult> {
  if (!isSupabaseConfigured) {
    return { status: 'error', message: 'Supabase is not configured.' };
  }

  try {
    const { data, error } = await getSupabase()
      .from('hall_of_fame_entries')
      .select('id, play_title, player_name, report_snapshot, user_id')
      .eq('id', entryId)
      .maybeSingle();

    if (error) {
      return { status: 'error', message: error.message };
    }
    if (!data) {
      return { status: 'not_found' };
    }

    const playTitle = typeof data.play_title === 'string' ? data.play_title : 'Hall of Fame play';
    const playerName = typeof data.player_name === 'string' ? data.player_name : 'Player';
    const ownerUserId = typeof data.user_id === 'string' ? data.user_id : undefined;
    const snapshot = parsePublicGoalReportSnapshot(data.report_snapshot);

    if (!snapshot) {
      return { status: 'unavailable', playTitle, playerName, ownerUserId };
    }

    return {
      status: 'ok',
      report: snapshotToGoalReport(snapshot),
      playTitle,
      playerName,
      ownerUserId,
    };
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Failed to load Hall of Fame report';
    return { status: 'error', message };
  }
}
