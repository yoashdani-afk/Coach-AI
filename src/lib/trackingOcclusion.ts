import type {
  IdentityReference,
  PlayerTrackingData,
  TrackingBoundingBox,
  TrackingKeyframe,
  TrackingState,
} from '@/types/analysis';
import { estimateBoxFromTap } from '@/lib/trackingBox';

const CLEAR_FRAME_SEARCH_MS = 2000;
const OCCLUSION_CONFIDENCE_THRESHOLD = 0.55;

export interface ClearFrameCandidate {
  timestampMs: number;
  box: TrackingBoundingBox;
  state: TrackingState;
  confidence: number;
  source: 'keyframe' | 'reference';
}

/** Find the nearest high-confidence visible frame within ±searchMs. */
export function findNearestClearFrame(
  tracking: PlayerTrackingData,
  references: IdentityReference[],
  lostAtMs: number,
  searchMs = CLEAR_FRAME_SEARCH_MS
): ClearFrameCandidate | null {
  const candidates: ClearFrameCandidate[] = [];

  for (const kf of tracking.keyframes) {
    if (Math.abs(kf.timestampMs - lostAtMs) > searchMs) continue;
    if (kf.state === 'LOST') continue;
    if (kf.confidence < OCCLUSION_CONFIDENCE_THRESHOLD) continue;
    candidates.push({
      timestampMs: kf.timestampMs,
      box: kf.box,
      state: kf.state,
      confidence: kf.confidence,
      source: 'keyframe',
    });
  }

  for (const ref of references) {
    if (Math.abs(ref.timestampMs - lostAtMs) > searchMs) continue;
    candidates.push({
      timestampMs: ref.timestampMs,
      box: estimateBoxFromTap(ref.normalizedX, ref.normalizedY),
      state: 'CONFIRMED',
      confidence: 0.95,
      source: 'reference',
    });
  }

  if (candidates.length === 0) return null;

  candidates.sort(
    (a, b) =>
      Math.abs(a.timestampMs - lostAtMs) - Math.abs(b.timestampMs - lostAtMs) ||
      b.confidence - a.confidence
  );

  return candidates[0];
}

/** Heuristic: current frame is a poor retap target (occluded / ambiguous). */
export function isPoorRetapFrame(params: {
  state: TrackingState | null;
  confidence: number;
  box?: TrackingBoundingBox | null;
}): boolean {
  const { state, confidence, box } = params;

  if (state === 'LOST' || state === 'SEARCHING') return true;
  if (confidence < OCCLUSION_CONFIDENCE_THRESHOLD) return true;
  if (box && (box.width < 0.025 || box.height < 0.04)) return true;

  return false;
}

export function predictBoxThroughOcclusion(
  lastBox: TrackingBoundingBox,
  velocity: { dx: number; dy: number },
  frames = 1
): TrackingBoundingBox {
  return {
    x: Math.min(1 - lastBox.width, Math.max(0, lastBox.x + velocity.dx * frames)),
    y: Math.min(1 - lastBox.height, Math.max(0, lastBox.y + velocity.dy * frames)),
    width: lastBox.width,
    height: lastBox.height,
  };
}

export function estimateVelocity(
  a: TrackingKeyframe,
  b: TrackingKeyframe
): { dx: number; dy: number } {
  const span = Math.max(1, b.timestampMs - a.timestampMs);
  const frames = span / 33;
  return {
    dx: (b.box.x - a.box.x) / frames,
    dy: (b.box.y - a.box.y) / frames,
  };
}

export type TrackingConfidenceLabel = 'High' | 'Medium' | 'Low';

export function confidenceToLabel(
  state: TrackingState,
  confidence: number,
  identityLevel?: 'HIGH' | 'LOW'
): TrackingConfidenceLabel {
  if (identityLevel === 'LOW') return 'Low';
  if (state === 'LOST') return 'Low';
  if (state === 'SEARCHING' || state === 'PROBABLE') return 'Medium';
  if (confidence >= 0.75) return 'High';
  if (confidence >= 0.5) return 'Medium';
  return 'Low';
}

export function describePlayerAppearance(selection: {
  identityProfile?: { references: IdentityReference[] };
}): string {
  const refCount = selection.identityProfile?.references.length ?? 1;
  if (refCount >= 2) return 'your confirmed player';
  return 'selected player';
}
