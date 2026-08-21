import type {
  CoordinateSource,
  PlayerTrackingData,
  SelectedPlayerTrackSample,
  TrackingBoundingBox,
  TrackingCorrection,
  TrackingKeyframe,
  TrackingState,
} from '@/types/analysis';
import { SHOW_TRACKING_DEBUG } from '@/lib/trackingConfig';

export type { SelectedPlayerTrackSample };

export interface SelectedPlayerLookupResult {
  currentVideoTimeMs: number;
  previousSampleTimeMs: number | null;
  nextSampleTimeMs: number | null;
  sampleTimeMs: number;
  trackId: string | null;
  normalizedBox: TrackingBoundingBox;
  identityState: 'CONFIRMED' | 'PROBABLE';
  identityConfidence: number;
  coordinateSource: CoordinateSource;
}

export const MAX_INTERPOLATION_GAP_MS = 350;
export const MAX_JUMP_THRESHOLD = 0.14;
export const CONFIRMED_SMOOTH_ALPHA = 0.22;

function clamp01(value: number): number {
  return Math.min(1, Math.max(0, value));
}

function boxCenter(box: TrackingBoundingBox): { x: number; y: number } {
  return { x: box.x + box.width / 2, y: box.y + box.height / 2 };
}

function boxDistance(a: TrackingBoundingBox, b: TrackingBoundingBox): number {
  const ca = boxCenter(a);
  const cb = boxCenter(b);
  return Math.hypot(cb.x - ca.x, cb.y - ca.y);
}

function lerpBox(a: TrackingBoundingBox, b: TrackingBoundingBox, t: number): TrackingBoundingBox {
  return {
    x: a.x + (b.x - a.x) * t,
    y: a.y + (b.y - a.y) * t,
    width: a.width + (b.width - a.width) * t,
    height: a.height + (b.height - a.height) * t,
  };
}

function isInLostInterval(tracking: PlayerTrackingData, timestampMs: number): boolean {
  return tracking.lostIntervals.some(
    (interval) => timestampMs >= interval.startMs && timestampMs <= interval.endMs
  );
}

function isTrustedSample(sample: SelectedPlayerTrackSample): boolean {
  if (sample.coordinateSource === 'prediction') return false;
  if (sample.identityState === 'LOST' || sample.identityState === 'SEARCHING') return false;
  return sample.identityState === 'CONFIRMED' || sample.identityState === 'PROBABLE';
}

function isVisibleIdentityState(state: TrackingState): state is 'CONFIRMED' | 'PROBABLE' {
  return state === 'CONFIRMED' || state === 'PROBABLE';
}

function logLookupDebug(
  currentVideoTimeMs: number,
  result: SelectedPlayerLookupResult | null,
  reason?: string
): void {
  if (!SHOW_TRACKING_DEBUG && !__DEV__) return;
  console.log('[SelectedPlayerTrack]', {
    currentVideoTimeMs,
    previousSampleTimeMs: result?.previousSampleTimeMs ?? null,
    nextSampleTimeMs: result?.nextSampleTimeMs ?? null,
    trackId: result?.trackId ?? null,
    box: result?.normalizedBox ?? null,
    identityState: result?.identityState ?? reason ?? 'hidden',
    coordinateSource: result?.coordinateSource ?? null,
  });
}

/** Build the authoritative timeline from the same object passed into analysis. */
export function buildSelectedPlayerTimeline(
  tracking: PlayerTrackingData
): SelectedPlayerTrackSample[] {
  const selectedTrackId = tracking.selectedTrackId ?? null;

  return [...tracking.keyframes]
    .filter((frame) => !selectedTrackId || frame.trackId === selectedTrackId || !frame.trackId)
    .sort((a, b) => a.timestampMs - b.timestampMs)
    .map((frame) => keyframeToSample(frame, selectedTrackId));
}

export interface SelectedPlayerTimelineAudit {
  totalRawKeyframes: number;
  rejectedWrongTrackId: number;
  rejectedSource: number;
  rejectedIdentityState: number;
  rejectedInvalidBox: number;
  rejectedInvalidTimestamp: number;
  acceptedKeyframes: number;
}

function isValidBox(box: TrackingBoundingBox): boolean {
  return (
    Number.isFinite(box.x) &&
    Number.isFinite(box.y) &&
    Number.isFinite(box.width) &&
    Number.isFinite(box.height) &&
    box.width > 0 &&
    box.height > 0
  );
}

/** Log why samples are rejected from the selected-player timeline. */
export function auditSelectedPlayerTimeline(tracking: PlayerTrackingData): SelectedPlayerTimelineAudit {
  const selectedTrackId = tracking.selectedTrackId ?? null;
  const audit: SelectedPlayerTimelineAudit = {
    totalRawKeyframes: tracking.keyframes.length,
    rejectedWrongTrackId: 0,
    rejectedSource: 0,
    rejectedIdentityState: 0,
    rejectedInvalidBox: 0,
    rejectedInvalidTimestamp: 0,
    acceptedKeyframes: 0,
  };

  for (const frame of tracking.keyframes) {
    if (!Number.isFinite(frame.timestampMs) || frame.timestampMs < 0) {
      audit.rejectedInvalidTimestamp += 1;
      continue;
    }
    if (!isValidBox(frame.box)) {
      audit.rejectedInvalidBox += 1;
      continue;
    }
    if (selectedTrackId && frame.trackId && frame.trackId !== selectedTrackId) {
      audit.rejectedWrongTrackId += 1;
      continue;
    }

    const sample = keyframeToSample(frame, selectedTrackId);
    if (sample.coordinateSource === 'prediction') {
      audit.rejectedSource += 1;
      continue;
    }
    if (sample.identityState === 'LOST' || sample.identityState === 'SEARCHING') {
      audit.rejectedIdentityState += 1;
      continue;
    }
    if (sample.identityState !== 'CONFIRMED' && sample.identityState !== 'PROBABLE') {
      audit.rejectedIdentityState += 1;
      continue;
    }

    audit.acceptedKeyframes += 1;
  }

  if (__DEV__) {
    console.log('[SelectedPlayerTimelineAudit]', audit);
  }

  return audit;
}

function keyframeToSample(
  frame: TrackingKeyframe,
  selectedTrackId: string | null
): SelectedPlayerTrackSample {
  return {
    timestampMs: frame.timestampMs,
    trackId: frame.trackId ?? selectedTrackId,
    normalizedBox: frame.box,
    identityState: frame.state,
    identityConfidence: frame.confidence,
    coordinateSource: frame.coordinateSource ?? 'detection',
  };
}

/** Resolve dimensions used for viewport mapping — must match server tracking space. */
export function getTrackingSourceDimensions(
  tracking: PlayerTrackingData,
  playerSelection?: { videoWidth?: number; videoHeight?: number }
): { sourceWidth: number; sourceHeight: number } {
  if (tracking.sourceWidth && tracking.sourceHeight) {
    return { sourceWidth: tracking.sourceWidth, sourceHeight: tracking.sourceHeight };
  }
  return {
    sourceWidth: playerSelection?.videoWidth ?? 1080,
    sourceHeight: playerSelection?.videoHeight ?? 1920,
  };
}

/**
 * Look up the selected-player box at the current playback timestamp.
 * Uses the same timeline as analysis — never tap position or separate predictions.
 */
export function lookupSelectedPlayerAt(
  tracking: PlayerTrackingData,
  currentVideoTimeMs: number
): SelectedPlayerLookupResult | null {
  if (tracking.keyframes.length === 0) {
    logLookupDebug(currentVideoTimeMs, null, 'no_keyframes');
    return null;
  }

  if (isInLostInterval(tracking, currentVideoTimeMs)) {
    logLookupDebug(currentVideoTimeMs, null, 'lost_interval');
    return null;
  }

  const selectedTrackId = tracking.selectedTrackId ?? null;
  const trusted = buildSelectedPlayerTimeline(tracking).filter(isTrustedSample);

  if (trusted.length === 0) {
    logLookupDebug(currentVideoTimeMs, null, 'no_trusted_samples');
    return null;
  }

  let previous: SelectedPlayerTrackSample | null = null;
  let next: SelectedPlayerTrackSample | null = null;

  for (const sample of trusted) {
    if (sample.timestampMs <= currentVideoTimeMs) {
      previous = sample;
    } else if (!next) {
      next = sample;
      break;
    }
  }

  if (!previous && !next) {
    logLookupDebug(currentVideoTimeMs, null, 'no_neighbors');
    return null;
  }

  if (!next) {
    previous = trusted[trusted.length - 1]!;
    if (currentVideoTimeMs - previous.timestampMs > MAX_INTERPOLATION_GAP_MS) {
      logLookupDebug(currentVideoTimeMs, null, 'stale_tail');
      return null;
    }
    if (!isVisibleIdentityState(previous.identityState)) {
      logLookupDebug(currentVideoTimeMs, null, 'tail_not_visible');
      return null;
    }
    const result: SelectedPlayerLookupResult = {
      currentVideoTimeMs,
      previousSampleTimeMs: previous.timestampMs,
      nextSampleTimeMs: null,
      sampleTimeMs: previous.timestampMs,
      trackId: previous.trackId,
      normalizedBox: previous.normalizedBox,
      identityState: previous.identityState,
      identityConfidence: previous.identityConfidence,
      coordinateSource: previous.coordinateSource,
    };
    logLookupDebug(currentVideoTimeMs, result);
    return result;
  }

  if (!previous) {
    if (next.timestampMs - currentVideoTimeMs > MAX_INTERPOLATION_GAP_MS) {
      logLookupDebug(currentVideoTimeMs, null, 'stale_head');
      return null;
    }
    if (!isVisibleIdentityState(next.identityState)) {
      logLookupDebug(currentVideoTimeMs, null, 'head_not_visible');
      return null;
    }
    const result: SelectedPlayerLookupResult = {
      currentVideoTimeMs,
      previousSampleTimeMs: null,
      nextSampleTimeMs: next.timestampMs,
      sampleTimeMs: next.timestampMs,
      trackId: next.trackId,
      normalizedBox: next.normalizedBox,
      identityState: next.identityState,
      identityConfidence: next.identityConfidence,
      coordinateSource: next.coordinateSource,
    };
    logLookupDebug(currentVideoTimeMs, result);
    return result;
  }

  if (previous.trackId && next.trackId && previous.trackId !== next.trackId) {
    logLookupDebug(currentVideoTimeMs, null, 'track_id_mismatch');
    return null;
  }

  const span = next.timestampMs - previous.timestampMs;
  if (span > MAX_INTERPOLATION_GAP_MS) {
    logLookupDebug(currentVideoTimeMs, null, 'gap_too_large');
    return null;
  }

  if (boxDistance(previous.normalizedBox, next.normalizedBox) >= MAX_JUMP_THRESHOLD) {
    logLookupDebug(currentVideoTimeMs, null, 'jump_too_large');
    return null;
  }

  const t = span > 0 ? (currentVideoTimeMs - previous.timestampMs) / span : 0;
  const identityState: 'CONFIRMED' | 'PROBABLE' =
    previous.identityState === 'PROBABLE' || next.identityState === 'PROBABLE'
      ? 'PROBABLE'
      : 'CONFIRMED';

  if (!isVisibleIdentityState(identityState)) {
    logLookupDebug(currentVideoTimeMs, null, 'interpolated_not_visible');
    return null;
  }

  const result: SelectedPlayerLookupResult = {
    currentVideoTimeMs,
    previousSampleTimeMs: previous.timestampMs,
    nextSampleTimeMs: next.timestampMs,
    sampleTimeMs: Math.round(previous.timestampMs + span * t),
    trackId: previous.trackId ?? next.trackId ?? selectedTrackId,
    normalizedBox: lerpBox(previous.normalizedBox, next.normalizedBox, clamp01(t)),
    identityState,
    identityConfidence:
      previous.identityConfidence +
      (next.identityConfidence - previous.identityConfidence) * t,
    coordinateSource: 'interpolated',
  };
  logLookupDebug(currentVideoTimeMs, result);
  return result;
}

/** Light smoothing in normalized source space — CONFIRMED samples only, no cross-gap smoothing. */
export function smoothConfirmedBox(
  current: TrackingBoundingBox,
  identityState: TrackingState,
  previousBox: TrackingBoundingBox | null,
  previousState: TrackingState | null
): TrackingBoundingBox {
  if (
    identityState !== 'CONFIRMED' ||
    previousState !== 'CONFIRMED' ||
    !previousBox
  ) {
    return current;
  }
  if (boxDistance(previousBox, current) >= MAX_JUMP_THRESHOLD) {
    return current;
  }
  return lerpBox(previousBox, current, CONFIRMED_SMOOTH_ALPHA);
}

/** Previous trusted box centres for debug trail. */
export function getSelectedPlayerTrailCenters(
  tracking: PlayerTrackingData,
  currentVideoTimeMs: number,
  count = 8
): Array<{ x: number; y: number }> {
  return buildSelectedPlayerTimeline(tracking)
    .filter(isTrustedSample)
    .filter((s) => s.timestampMs <= currentVideoTimeMs)
    .slice(-count)
    .map((s) => boxCenter(s.normalizedBox));
}

export function mergeTrackingCorrections(
  tracking: PlayerTrackingData,
  correction: TrackingCorrection
): PlayerTrackingData {
  const userCorrections = [...tracking.userCorrections, correction];
  const correctionKeyframe: TrackingKeyframe = {
    timestampMs: correction.timestampMs,
    box: correction.box,
    state: 'CONFIRMED',
    confidence: 1,
    coordinateSource: 'detection',
    trackId: tracking.selectedTrackId ?? undefined,
  };

  const keyframes = [...tracking.keyframes, correctionKeyframe].sort(
    (a, b) => a.timestampMs - b.timestampMs
  );

  return { ...tracking, keyframes, userCorrections };
}

export function isTrackingLostAt(timestampMs: number, tracking: PlayerTrackingData): boolean {
  if (isInLostInterval(tracking, timestampMs)) return true;
  return lookupSelectedPlayerAt(tracking, timestampMs) == null;
}

export function isMarkerVisibleState(state: TrackingState | null | undefined): boolean {
  return state === 'CONFIRMED' || state === 'PROBABLE';
}

/** @deprecated Use lookupSelectedPlayerAt — kept for callers migrating gradually. */
export function interpolateTrackingAt(
  keyframes: TrackingKeyframe[],
  timestampMs: number,
  tracking?: PlayerTrackingData
) {
  const data: PlayerTrackingData =
    tracking ??
    ({
      keyframes,
      userCorrections: [],
      confirmedIntervals: [],
      uncertainIntervals: [],
      lostIntervals: [],
      previewAccepted: false,
    } as PlayerTrackingData);

  const lookup = lookupSelectedPlayerAt(data, timestampMs);
  if (!lookup) return null;

  return {
    timestampMs: lookup.currentVideoTimeMs,
    trackingTimestampMs: lookup.sampleTimeMs,
    box: lookup.normalizedBox,
    state: lookup.identityState,
    confidence: lookup.identityConfidence,
    snapPosition: lookup.coordinateSource !== 'interpolated',
    trackId: lookup.trackId ?? undefined,
    coordinateSource: lookup.coordinateSource,
  };
}
