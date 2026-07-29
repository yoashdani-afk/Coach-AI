import type { TrackingBoundingBox, TrackingKeyframe, TrackingState } from '@/types/analysis';

function clamp01(value: number): number {
  return Math.min(1, Math.max(0, value));
}

/** Estimate a normalised player bounding box from a tap on the player's body. */
export function estimateBoxFromTap(normalizedX: number, normalizedY: number): TrackingBoundingBox {
  const height = clamp01(0.06 + (1 - clamp01(normalizedY)) * 0.16);
  const width = clamp01(height * 0.42);
  const x = clamp01(normalizedX - width / 2);
  const y = clamp01(normalizedY - height * 0.55);

  return {
    x: Math.min(x, 1 - width),
    y: Math.min(y, 1 - height),
    width,
    height,
  };
}

export function headAnchorFromBox(box: TrackingBoundingBox): { x: number; y: number } {
  return {
    x: box.x + box.width / 2,
    y: box.y,
  };
}

export function createKeyframe(
  timestampMs: number,
  box: TrackingBoundingBox,
  state: TrackingState,
  confidence = state === 'CONFIRMED' ? 0.9 : 0.6
): TrackingKeyframe {
  return { timestampMs, state, confidence, box };
}

export function keyframeFromTap(
  timestampMs: number,
  normalizedX: number,
  normalizedY: number,
  state: TrackingState
): TrackingKeyframe {
  return createKeyframe(timestampMs, estimateBoxFromTap(normalizedX, normalizedY), state);
}
