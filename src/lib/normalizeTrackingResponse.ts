import type {
  CoordinateSource,
  PlayerTrackingData,
  TrackingBoundingBox,
  TrackingCorrection,
  TrackingInterval,
  TrackingKeyframe,
  TrackingState,
} from '@/types/analysis';

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function clamp01(value: number): number {
  return Math.min(1, Math.max(0, value));
}

function normalizeBox(raw: unknown): TrackingBoundingBox | null {
  if (!isRecord(raw)) return null;

  const nested =
    isRecord(raw.box) ? raw.box : isRecord(raw.bbox) ? raw.bbox : isRecord(raw.normalizedBox) ? raw.normalizedBox : raw;

  const x = Number(nested.x ?? nested.left);
  const y = Number(nested.y ?? nested.top);
  const width = Number(nested.width ?? nested.w);
  const height = Number(nested.height ?? nested.h);

  if (![x, y, width, height].every((n) => Number.isFinite(n))) return null;
  if (width <= 0 || height <= 0) return null;

  return {
    x: clamp01(x),
    y: clamp01(y),
    width: clamp01(width),
    height: clamp01(height),
  };
}

function normalizeState(raw: unknown): TrackingState {
  const value = String(raw ?? 'CONFIRMED').toUpperCase();
  if (value === 'CONFIRMED' || value === 'PROBABLE' || value === 'SEARCHING' || value === 'LOST') {
    return value;
  }
  return 'CONFIRMED';
}

function normalizeCoordinateSource(raw: unknown, state: TrackingState): CoordinateSource {
  const value = String(raw ?? '').toLowerCase();
  if (value === 'detection' || value === 'prediction' || value === 'interpolated') {
    return value;
  }
  return state === 'LOST' || state === 'SEARCHING' ? 'prediction' : 'detection';
}

export function normalizeTrackingKeyframe(raw: unknown): TrackingKeyframe | null {
  if (!isRecord(raw)) return null;

  const timestampMs = Number(raw.timestampMs ?? raw.timestamp ?? raw.timeMs ?? raw.t);
  if (!Number.isFinite(timestampMs) || timestampMs < 0) return null;

  const detection = isRecord(raw.detection) ? raw.detection : null;
  const box = normalizeBox(raw.box ?? raw.bbox ?? raw.normalizedBox ?? detection?.box ?? detection?.bbox);
  if (!box) return null;

  const state = normalizeState(raw.state ?? raw.identityState);
  const confidence = Number(raw.confidence ?? raw.identityConfidence ?? raw.score ?? 0.5);
  const trackIdRaw = raw.trackId ?? raw.track_id ?? raw.id;
  const trackId = trackIdRaw != null ? String(trackIdRaw) : undefined;

  return {
    timestampMs: Math.round(timestampMs),
    box,
    state,
    confidence: Number.isFinite(confidence) ? confidence : 0.5,
    trackId,
    coordinateSource: normalizeCoordinateSource(raw.coordinateSource ?? raw.source, state),
  };
}

function normalizeInterval(raw: unknown): TrackingInterval | null {
  if (!isRecord(raw)) return null;
  const startMs = Number(raw.startMs ?? raw.start ?? raw.from);
  const endMs = Number(raw.endMs ?? raw.end ?? raw.to);
  if (!Number.isFinite(startMs) || !Number.isFinite(endMs)) return null;
  return { startMs: Math.round(startMs), endMs: Math.round(endMs) };
}

function normalizeCorrection(raw: unknown): TrackingCorrection | null {
  if (!isRecord(raw)) return null;
  const timestampMs = Number(raw.timestampMs ?? raw.timestamp);
  const box = normalizeBox(raw.box ?? raw.bbox ?? raw.normalizedBox);
  if (!Number.isFinite(timestampMs) || !box) return null;
  return { timestampMs: Math.round(timestampMs), box };
}

/** Normalize any server/job payload into PlayerTrackingData. */
export function normalizeTrackingResponse(raw: unknown): PlayerTrackingData | null {
  if (!isRecord(raw)) return null;

  const root = isRecord(raw.tracking) ? raw.tracking : raw;
  const keyframesRaw = root.keyframes ?? root.frames ?? root.samples ?? root.timeline ?? [];

  if (!Array.isArray(keyframesRaw)) return null;

  const keyframes = keyframesRaw
    .map((item) => normalizeTrackingKeyframe(item))
    .filter((item): item is TrackingKeyframe => item != null);

  const confirmedIntervals = Array.isArray(root.confirmedIntervals)
    ? root.confirmedIntervals.map(normalizeInterval).filter((i): i is TrackingInterval => i != null)
    : [];
  const uncertainIntervals = Array.isArray(root.uncertainIntervals)
    ? root.uncertainIntervals.map(normalizeInterval).filter((i): i is TrackingInterval => i != null)
    : [];
  const lostIntervals = Array.isArray(root.lostIntervals)
    ? root.lostIntervals.map(normalizeInterval).filter((i): i is TrackingInterval => i != null)
    : [];

  const userCorrections = Array.isArray(root.userCorrections)
    ? root.userCorrections.map(normalizeCorrection).filter((c): c is TrackingCorrection => c != null)
    : [];

  const selectedTrackIdRaw = root.selectedTrackId ?? root.trackId ?? root.selected_track_id;
  const sourceWidth = Number(root.sourceWidth ?? root.videoWidth);
  const sourceHeight = Number(root.sourceHeight ?? root.videoHeight);

  return {
    keyframes,
    userCorrections,
    confirmedIntervals,
    uncertainIntervals,
    lostIntervals,
    previewAccepted: Boolean(root.previewAccepted),
    identityConfidence:
      root.identityConfidence === 'LOW' || root.identityConfidence === 'HIGH'
        ? root.identityConfidence
        : undefined,
    sourceWidth: Number.isFinite(sourceWidth) ? sourceWidth : undefined,
    sourceHeight: Number.isFinite(sourceHeight) ? sourceHeight : undefined,
    fps: Number.isFinite(Number(root.fps)) ? Number(root.fps) : undefined,
    selectedTrackId: selectedTrackIdRaw != null ? String(selectedTrackIdRaw) : null,
    reliable: typeof root.reliable === 'boolean' ? root.reliable : undefined,
    confirmedCoverageRatio: Number.isFinite(Number(root.confirmedCoverageRatio))
      ? Number(root.confirmedCoverageRatio)
      : Number.isFinite(Number(root.coverageRatio))
        ? Number(root.coverageRatio)
        : undefined,
    coverageRatio: Number.isFinite(Number(root.confirmedCoverageRatio))
      ? Number(root.confirmedCoverageRatio)
      : Number.isFinite(Number(root.coverageRatio))
        ? Number(root.coverageRatio)
        : undefined,
    failureMessage: typeof root.failureMessage === 'string' ? root.failureMessage : undefined,
    rebuildFromMs: Number.isFinite(Number(root.rebuildFromMs)) ? Number(root.rebuildFromMs) : undefined,
  };
}
