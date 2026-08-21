import { computeSampleTimestamps } from './frameExtractor.js';
import type { TrackingInterval } from '../types.js';
import type { TrackingTimelineResult } from './types.js';

export type CoverageKeyframe = TrackingTimelineResult['keyframes'][number];

const ZERO_BOX = { x: 0, y: 0, width: 0, height: 0 };

/** Minimum confirmed coverage of clip duration to mark tracking reliable. */
export const MIN_RELIABLE_COVERAGE_RATIO = 0.55;

export function isValidBox(box: CoverageKeyframe['box']): boolean {
  return box.width > 0 && box.height > 0;
}

export function isConfirmedVisible(k: CoverageKeyframe): boolean {
  return (
    (k.state === 'CONFIRMED' || k.state === 'PROBABLE') &&
    k.coordinateSource === 'detection' &&
    isValidBox(k.box)
  );
}

function normalizeSparseKeyframe(k: CoverageKeyframe): CoverageKeyframe {
  if (isValidBox(k.box) && k.coordinateSource === 'detection') {
    return {
      ...k,
      state: k.confidence >= 0.55 ? 'CONFIRMED' : 'PROBABLE',
    };
  }

  if (k.state === 'LOST' || !isValidBox(k.box)) {
    return {
      ...k,
      state: 'LOST',
      confidence: 0,
      box: ZERO_BOX,
      coordinateSource: 'prediction',
    };
  }

  return k;
}

function nearestKeyframe(
  sorted: CoverageKeyframe[],
  timestampMs: number
): CoverageKeyframe | null {
  if (sorted.length === 0) return null;
  let best = sorted[0]!;
  let bestDist = Math.abs(best.timestampMs - timestampMs);
  for (const k of sorted) {
    const dist = Math.abs(k.timestampMs - timestampMs);
    if (dist < bestDist) {
      bestDist = dist;
      best = k;
    }
  }
  return best;
}

function confirmedRuns(keyframes: CoverageKeyframe[]): Array<{ startMs: number; endMs: number }> {
  const sorted = [...keyframes].sort((a, b) => a.timestampMs - b.timestampMs);
  const runs: Array<{ startMs: number; endMs: number }> = [];
  let runStart: number | null = null;

  for (const k of sorted) {
    if (isConfirmedVisible(k)) {
      if (runStart == null) runStart = k.timestampMs;
    } else if (runStart != null) {
      runs.push({ startMs: runStart, endMs: k.timestampMs });
      runStart = null;
    }
  }

  if (runStart != null) {
    const lastVisible = [...sorted].reverse().find(isConfirmedVisible);
    runs.push({ startMs: runStart, endMs: lastVisible?.timestampMs ?? runStart });
  }

  return runs;
}

function isInGapBetweenRuns(timestampMs: number, runs: Array<{ startMs: number; endMs: number }>): boolean {
  if (runs.length === 0) return true;
  if (timestampMs < runs[0]!.startMs || timestampMs > runs[runs.length - 1]!.endMs) return true;

  for (let i = 0; i < runs.length - 1; i++) {
    const cur = runs[i]!;
    const next = runs[i + 1]!;
    if (timestampMs > cur.endMs && timestampMs < next.startMs) return true;
  }
  return false;
}

/**
 * Expand sparse track samples to a full-clip timeline at `fps`.
 * Before first / after last confirmed detection, and inter-run gaps → LOST.
 */
export function expandToFullClipTimeline(params: {
  sparseKeyframes: CoverageKeyframe[];
  videoDurationMs: number;
  fps: number;
  trackId: string | null;
}): CoverageKeyframe[] {
  const { sparseKeyframes, videoDurationMs, fps, trackId } = params;
  const timestamps = computeSampleTimestamps(videoDurationMs, fps);
  const sortedSparse = [...sparseKeyframes]
    .map(normalizeSparseKeyframe)
    .sort((a, b) => a.timestampMs - b.timestampMs);
  const halfStep = Math.round(1000 / fps / 2) + 25;

  const aligned: CoverageKeyframe[] = timestamps.map((timestampMs) => {
    const exact = sortedSparse.find((k) => k.timestampMs === timestampMs);
    if (exact) {
      return normalizeSparseKeyframe({ ...exact, trackId: trackId ?? exact.trackId, timestampMs });
    }

    const nearest = nearestKeyframe(sortedSparse, timestampMs);
    if (nearest && Math.abs(nearest.timestampMs - timestampMs) <= halfStep && isConfirmedVisible(nearest)) {
      return normalizeSparseKeyframe({
        ...nearest,
        timestampMs,
        trackId: trackId ?? nearest.trackId,
      });
    }

    return {
      timestampMs,
      state: 'LOST',
      confidence: 0,
      box: ZERO_BOX,
      trackId: trackId ?? undefined,
      coordinateSource: 'prediction',
    };
  });

  const runs = confirmedRuns(aligned);
  const firstConfirmedMs = runs[0]?.startMs ?? null;
  const lastConfirmedMs = runs[runs.length - 1]?.endMs ?? null;

  return aligned.map((k) => {
    if (!isConfirmedVisible(k)) {
      if (!firstConfirmedMs || !lastConfirmedMs) {
        return {
          ...k,
          state: 'LOST',
          confidence: 0,
          box: ZERO_BOX,
          coordinateSource: 'prediction',
        };
      }

      if (k.timestampMs < firstConfirmedMs || k.timestampMs > lastConfirmedMs) {
        return {
          ...k,
          state: 'LOST',
          confidence: 0,
          box: ZERO_BOX,
          coordinateSource: 'prediction',
        };
      }

      if (isInGapBetweenRuns(k.timestampMs, runs)) {
        return {
          ...k,
          state: 'LOST',
          confidence: 0,
          box: ZERO_BOX,
          coordinateSource: 'prediction',
        };
      }
    }

    if (k.state === 'LOST' || !isValidBox(k.box)) {
      return {
        ...k,
        state: 'LOST',
        confidence: 0,
        box: ZERO_BOX,
        coordinateSource: 'prediction',
      };
    }

    return normalizeSparseKeyframe(k);
  });
}

export function buildIntervalsFromFullClipKeyframes(
  keyframes: CoverageKeyframe[]
): {
  confirmedIntervals: TrackingInterval[];
  uncertainIntervals: TrackingInterval[];
  lostIntervals: TrackingInterval[];
} {
  if (keyframes.length === 0) {
    return { confirmedIntervals: [], uncertainIntervals: [], lostIntervals: [] };
  }

  const sorted = [...keyframes].sort((a, b) => a.timestampMs - b.timestampMs);
  const confirmedIntervals: TrackingInterval[] = [];
  const uncertainIntervals: TrackingInterval[] = [];
  const lostIntervals: TrackingInterval[] = [];

  let currentState = sorted[0]!.state;
  let intervalStart = sorted[0]!.timestampMs;

  for (let i = 1; i < sorted.length; i++) {
    const frame = sorted[i]!;
    if (frame.state !== currentState) {
      const interval = { startMs: intervalStart, endMs: frame.timestampMs };
      if (currentState === 'CONFIRMED') confirmedIntervals.push(interval);
      else if (currentState === 'PROBABLE' || currentState === 'SEARCHING') uncertainIntervals.push(interval);
      else lostIntervals.push(interval);
      currentState = frame.state;
      intervalStart = frame.timestampMs;
    }
  }

  const lastMs = sorted[sorted.length - 1]!.timestampMs;
  const tail = { startMs: intervalStart, endMs: lastMs };
  if (currentState === 'CONFIRMED') confirmedIntervals.push(tail);
  else if (currentState === 'PROBABLE' || currentState === 'SEARCHING') uncertainIntervals.push(tail);
  else lostIntervals.push(tail);

  return { confirmedIntervals, uncertainIntervals, lostIntervals };
}

export interface CoverageMetrics {
  videoDurationMs: number;
  firstKeyframeMs: number;
  lastKeyframeMs: number;
  confirmedDurationMs: number;
  confirmedCoverageRatio: number;
  lostDurationMs: number;
  lostFrames: number;
  lostIntervalsCount: number;
  /** @deprecated Use confirmedCoverageRatio — span metric, not confirmed coverage. */
  coverageRatio: number;
  /** @deprecated First-to-last visible span — not used for approval. */
  coveredDurationMs: number;
}

export function computeCoverageMetrics(
  keyframes: CoverageKeyframe[],
  videoDurationMs: number,
  fps: number
): CoverageMetrics {
  const sorted = [...keyframes].sort((a, b) => a.timestampMs - b.timestampMs);
  const visible = sorted.filter(isConfirmedVisible);
  const firstKeyframeMs = sorted[0]?.timestampMs ?? 0;
  const lastKeyframeMs = sorted[sorted.length - 1]?.timestampMs ?? 0;
  const videoDuration = Math.max(1, videoDurationMs);

  const stepMs = 1000 / fps;
  const confirmedDurationMs = visible.length * stepMs;
  const confirmedCoverageRatio = confirmedDurationMs / videoDuration;

  const coverageStartMs = visible[0]?.timestampMs ?? firstKeyframeMs;
  const coverageEndMs = visible[visible.length - 1]?.timestampMs ?? lastKeyframeMs;
  const coveredDurationMs = Math.max(0, coverageEndMs - coverageStartMs);

  const lostFrames = sorted.filter((k) => k.state === 'LOST').length;
  const lostDurationMs = Math.max(0, videoDurationMs - confirmedDurationMs);
  const intervals = buildIntervalsFromFullClipKeyframes(sorted);

  return {
    videoDurationMs,
    firstKeyframeMs,
    lastKeyframeMs,
    confirmedDurationMs,
    confirmedCoverageRatio,
    lostDurationMs,
    lostFrames,
    lostIntervalsCount: intervals.lostIntervals.length,
    coverageRatio: confirmedCoverageRatio,
    coveredDurationMs,
  };
}

export function assertTimelineSerialization(params: {
  keyframes: CoverageKeyframe[];
  selectedTrackDetectionCount: number;
  metrics: CoverageMetrics;
}): void {
  const { keyframes, selectedTrackDetectionCount, metrics } = params;
  const confirmedFrames = keyframes.filter((k) => k.state === 'CONFIRMED').length;

  if (selectedTrackDetectionCount > 0 && confirmedFrames === 0) {
    throw new Error('serialization_discarded_all_confirmed_samples');
  }

  if (metrics.confirmedDurationMs === 0 && metrics.confirmedCoverageRatio !== 0) {
    throw new Error('coverage_nonzero_when_no_confirmed_duration');
  }

  for (const k of keyframes) {
    if (k.state === 'LOST' && isValidBox(k.box)) {
      throw new Error('lost_keyframe_has_valid_box');
    }
    if (k.state === 'CONFIRMED' && !isValidBox(k.box)) {
      throw new Error('confirmed_keyframe_missing_box');
    }
  }
}

export function assessTimelineReliability(params: {
  keyframes: CoverageKeyframe[];
  videoDurationMs: number;
  fps: number;
  identityScore: number;
  identityFromTapContainment: boolean;
}): { reliable: boolean; reasons: string[]; metrics: CoverageMetrics } {
  const { keyframes, videoDurationMs, fps, identityScore, identityFromTapContainment } = params;
  const metrics = computeCoverageMetrics(keyframes, videoDurationMs, fps);
  const reasons: string[] = [];

  if (metrics.confirmedCoverageRatio < MIN_RELIABLE_COVERAGE_RATIO) {
    reasons.push(
      `confirmed_coverage_too_low (${metrics.confirmedCoverageRatio.toFixed(3)} < ${MIN_RELIABLE_COVERAGE_RATIO})`
    );
  }

  if (!identityFromTapContainment && identityScore < 0.72) {
    reasons.push(`identity_not_confirmed (${identityScore.toFixed(3)})`);
  }

  const visible = keyframes.filter(isConfirmedVisible);
  if (visible.length < 3) {
    reasons.push('too_few_confirmed_samples');
  }

  const reliable = reasons.length === 0;
  return { reliable, reasons, metrics };
}
