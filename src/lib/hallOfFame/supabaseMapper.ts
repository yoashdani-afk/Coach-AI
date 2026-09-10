import type { AnalysisMode } from '@/types/analysis';
import type { GoalAward, GoalAwardType, GoalSubmission } from '@/types/hallOfFame';
import type { Position } from '@/types/profile';
import type { ScoredCategory } from '@/types/analysis';
import { normalizeUserSubmission } from '@/lib/hallOfFame/demoData';

export const HALL_OF_FAME_BUCKET = 'hall-of-fame';

/** Row shape for public.hall_of_fame_entries */
export interface HallOfFameEntryRow {
  id: string;
  user_id: string;
  report_id: string;
  video_path: string;
  thumbnail_timestamp_ms: number;
  thumbnail_focal_y: number | null;
  player_name: string;
  position: string;
  position_label: string;
  play_title: string;
  summary: string;
  analysis_mode: string;
  score_overall: number;
  score_is_demo: boolean;
  score_categories: ScoredCategory[];
  award_type: string;
  award_emoji: string;
  award_label: string;
  submitted_at: string;
  source: 'user' | 'demo';
  auto_inducted: boolean;
}

export function publicVideoUrl(supabaseUrl: string, videoPath: string): string {
  const base = supabaseUrl.replace(/\/$/, '');
  return `${base}/storage/v1/object/public/${HALL_OF_FAME_BUCKET}/${videoPath}`;
}

export function rowToGoalSubmission(
  row: HallOfFameEntryRow,
  supabaseUrl: string
): GoalSubmission {
  const submission: GoalSubmission = {
    id: row.id,
    reportId: row.report_id,
    clipUri: publicVideoUrl(supabaseUrl, row.video_path),
    thumbnailTimestampMs: row.thumbnail_timestamp_ms ?? 0,
    thumbnailFocalY: row.thumbnail_focal_y ?? undefined,
    playerName: row.player_name,
    position: row.position as Position,
    positionLabel: row.position_label,
    playTitle: row.play_title,
    summary: row.summary ?? '',
    analysisMode: (row.analysis_mode as AnalysisMode) || 'GOAL',
    score: {
      overall: Number(row.score_overall),
      isDemo: Boolean(row.score_is_demo),
      categories: Array.isArray(row.score_categories) ? row.score_categories : [],
    },
    award: {
      type: row.award_type as GoalAwardType,
      emoji: row.award_emoji ?? '',
      label: row.award_label,
    },
    submittedAt: row.submitted_at,
    source: row.source === 'demo' ? 'demo' : 'user',
    autoInducted: Boolean(row.auto_inducted),
    ownerUserId: row.user_id,
  };

  return normalizeUserSubmission(submission);
}

export function submissionToInsertRow(params: {
  id: string;
  userId: string;
  submission: GoalSubmission;
  videoPath: string;
}): Omit<HallOfFameEntryRow, 'submitted_at'> & { submitted_at?: string } {
  const { id, userId, submission, videoPath } = params;
  const award: GoalAward = submission.award;

  return {
    id,
    user_id: userId,
    report_id: submission.reportId,
    video_path: videoPath,
    thumbnail_timestamp_ms: submission.thumbnailTimestampMs,
    thumbnail_focal_y: submission.thumbnailFocalY ?? null,
    player_name: submission.playerName,
    position: submission.position,
    position_label: submission.positionLabel,
    play_title: submission.playTitle,
    summary: submission.summary,
    analysis_mode: submission.analysisMode,
    score_overall: submission.score.overall,
    score_is_demo: submission.score.isDemo,
    score_categories: submission.score.categories,
    award_type: award.type,
    award_emoji: award.emoji,
    award_label: award.label,
    source: submission.source,
    auto_inducted: Boolean(submission.autoInducted),
    submitted_at: submission.submittedAt,
  };
}
