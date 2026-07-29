import type { CoachingReport, ScoredCategory } from '@/types/analysis';

const ACTION_CATEGORY_KEYS = new Set([
  'FINISH',
  'DIFFICULTY',
  'TECHNIQUE',
  'CREATIVITY',
  'DECISION',
  'DECISION_MAKING',
  'MOVEMENT',
]);

function topCategory(categories: ScoredCategory[]): ScoredCategory | null {
  if (categories.length === 0) return null;
  return [...categories].sort((a, b) => b.score - a.score)[0] ?? null;
}

/**
 * Prefer the key action frame (highest-rated moment) over the raw tap frame.
 * Blends player-identification timestamp with late-clip action for goal highlights.
 */
export function deriveHallOfFameThumbnailTimestamp(report: CoachingReport): number {
  const tapMs = report.playerSelection.timestampMs;
  const durationMs = Math.max(0, report.clip.durationMs);

  if (durationMs <= 0) return tapMs;

  const categories =
    report.mode === 'GOAL' || report.mode === 'PERFORMANCE' ? report.categories : [];
  const peak = topCategory(categories);

  if (!peak || !ACTION_CATEGORY_KEYS.has(peak.key)) {
    return Math.min(tapMs, durationMs);
  }

  if (report.mode === 'GOAL') {
    const actionMs = Math.min(durationMs * 0.82, durationMs - 400);
    const blended = tapMs * 0.25 + actionMs * 0.75;
    return Math.round(Math.min(durationMs, Math.max(tapMs, blended)));
  }

  if (report.mode === 'PERFORMANCE') {
    const actionMs = Math.min(durationMs * 0.65, durationMs - 300);
    const blended = tapMs * 0.4 + actionMs * 0.6;
    return Math.round(Math.min(durationMs, Math.max(tapMs, blended)));
  }

  return tapMs;
}
