import type {
  PlayerTrackingData,
  TrackingBoundingBox,
  TrackingCorrection,
  TrackingKeyframe,
  TrackingState,
} from '@/types/analysis';

const REIDENTIFY_JUMP_THRESHOLD = 0.2;
const LOST_PREDICTION_MAX_MS = 600;

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
  };

  const keyframes = [...tracking.keyframes, correctionKeyframe].sort(
    (a, b) => a.timestampMs - b.timestampMs
  );

  return { ...tracking, keyframes, userCorrections };
}

export interface InterpolatedTrackingSample {
  timestampMs: number;
  box: TrackingBoundingBox;
  state: TrackingState;
  confidence: number;
  snapPosition: boolean;
}

export function interpolateTrackingAt(
  keyframes: TrackingKeyframe[],
  timestampMs: number
): InterpolatedTrackingSample | null {
  if (keyframes.length === 0) return null;

  const sorted = [...keyframes].sort((a, b) => a.timestampMs - b.timestampMs);

  const first = sorted[0];
  if (timestampMs <= first.timestampMs) {
    if (first.state === 'LOST') return null;
    return {
      timestampMs,
      box: first.box,
      state: first.state,
      confidence: first.confidence,
      snapPosition: true,
    };
  }

  const last = sorted[sorted.length - 1];
  if (timestampMs >= last.timestampMs) {
    if (last.state === 'LOST') return null;
    return {
      timestampMs,
      box: last.box,
      state: last.state,
      confidence: last.confidence,
      snapPosition: true,
    };
  }

  for (let i = 0; i < sorted.length - 1; i++) {
    const a = sorted[i];
    const b = sorted[i + 1];
    if (timestampMs < a.timestampMs || timestampMs > b.timestampMs) continue;

    if (a.state === 'LOST' && b.state === 'LOST') return null;

    if (a.state === 'LOST' || b.state === 'LOST') {
      const lostFrame = a.state === 'LOST' ? a : b;
      const anchor = a.state === 'LOST' ? b : a;
      const lostAt = lostFrame.timestampMs;
      const anchorAt = anchor.timestampMs;
      const gap = Math.abs(lostAt - anchorAt);

      if (gap <= LOST_PREDICTION_MAX_MS && anchor.state !== 'LOST') {
        return {
          timestampMs,
          box: anchor.box,
          state: 'PROBABLE',
          confidence: Math.min(anchor.confidence, 0.45),
          snapPosition: false,
        };
      }
      return null;
    }

    if (boxDistance(a.box, b.box) >= REIDENTIFY_JUMP_THRESHOLD) {
      const nearer = timestampMs - a.timestampMs <= b.timestampMs - timestampMs ? a : b;
      return {
        timestampMs,
        box: nearer.box,
        state: nearer.state,
        confidence: nearer.confidence,
        snapPosition: true,
      };
    }

    const span = b.timestampMs - a.timestampMs;
    const t = span > 0 ? (timestampMs - a.timestampMs) / span : 0;
    const state: TrackingState =
      a.state === 'PROBABLE' || b.state === 'PROBABLE' ? 'PROBABLE' : 'CONFIRMED';

    return {
      timestampMs,
      box: lerpBox(a.box, b.box, t),
      state,
      confidence: a.confidence + (b.confidence - a.confidence) * t,
      snapPosition: false,
    };
  }

  return null;
}

export function isTrackingLostAt(timestampMs: number, tracking: PlayerTrackingData): boolean {
  if (
    tracking.lostIntervals.some(
      (interval) => timestampMs >= interval.startMs && timestampMs <= interval.endMs
    )
  ) {
    return true;
  }
  return interpolateTrackingAt(tracking.keyframes, timestampMs) == null;
}
