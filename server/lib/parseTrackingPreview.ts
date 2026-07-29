import type {
  PlayerTrackingData,
  TrackingBoundingBox,
  TrackingInterval,
  TrackingKeyframe,
  TrackingState,
} from './types.js';

function clamp01(value: number): number {
  return Math.min(1, Math.max(0, value));
}

function estimateBoxFromTap(normalizedX: number, normalizedY: number): TrackingBoundingBox {
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

function asConfidence(value: unknown): number {
  const raw = Number(value);
  if (Number.isNaN(raw)) return 0;
  return Math.min(1, Math.max(0, raw));
}

function asState(value: unknown): TrackingState {
  const raw = String(value ?? '').toUpperCase();
  if (raw === 'CONFIRMED' || raw === 'PROBABLE' || raw === 'LOST') return raw;
  return 'PROBABLE';
}

function readBox(row: Record<string, unknown>): TrackingBoundingBox | null {
  const boxRaw = row.box;
  if (boxRaw && typeof boxRaw === 'object') {
    const box = boxRaw as Record<string, unknown>;
    const x = Number(box.x);
    const y = Number(box.y);
    const width = Number(box.width);
    const height = Number(box.height);
    if (![x, y, width, height].some(Number.isNaN) && width > 0 && height > 0) {
      return {
        x: clamp01(x),
        y: clamp01(y),
        width: clamp01(width),
        height: clamp01(height),
      };
    }
  }

  const normalizedX = Number(row.normalizedX);
  const normalizedY = Number(row.normalizedY);
  if (!Number.isNaN(normalizedX) && !Number.isNaN(normalizedY)) {
    return estimateBoxFromTap(normalizedX, normalizedY);
  }

  return null;
}

function readIntervals(raw: unknown): TrackingInterval[] {
  if (!Array.isArray(raw)) return [];
  const intervals: TrackingInterval[] = [];
  for (const item of raw) {
    if (!item || typeof item !== 'object') continue;
    const row = item as Record<string, unknown>;
    const startMs = Number(row.startMs);
    const endMs = Number(row.endMs);
    if (Number.isNaN(startMs) || Number.isNaN(endMs)) continue;
    intervals.push({ startMs, endMs });
  }
  return intervals;
}

function extractJsonText(raw: string): string {
  const trimmed = raw.trim();
  const fence = trimmed.match(/```(?:json)?\s*\n?([\s\S]*?)\n?```/i);
  if (fence) return fence[1].trim();
  const start = trimmed.indexOf('{');
  const end = trimmed.lastIndexOf('}');
  if (start >= 0 && end > start) return trimmed.slice(start, end + 1);
  return trimmed;
}

function buildIntervalsFromKeyframes(keyframes: TrackingKeyframe[]): {
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

  let currentState: TrackingState = sorted[0].state;
  let intervalStart = sorted[0].timestampMs;

  for (let i = 1; i < sorted.length; i++) {
    const frame = sorted[i];
    if (frame.state !== currentState) {
      const interval = { startMs: intervalStart, endMs: frame.timestampMs };
      if (currentState === 'CONFIRMED') confirmedIntervals.push(interval);
      else if (currentState === 'PROBABLE') uncertainIntervals.push(interval);
      else lostIntervals.push(interval);
      currentState = frame.state;
      intervalStart = frame.timestampMs;
    }
  }

  const lastMs = sorted[sorted.length - 1].timestampMs;
  const tail = { startMs: intervalStart, endMs: lastMs };
  if (currentState === 'CONFIRMED') confirmedIntervals.push(tail);
  else if (currentState === 'PROBABLE') uncertainIntervals.push(tail);
  else lostIntervals.push(tail);

  return { confirmedIntervals, uncertainIntervals, lostIntervals };
}

export function parseTrackingPreviewJson(
  raw: string,
  fallback: Pick<PlayerTrackingData, 'keyframes'>
): PlayerTrackingData {
  let parsed: unknown;
  try {
    parsed = JSON.parse(extractJsonText(raw).replace(/,\s*([}\]])/g, '$1'));
  } catch {
    console.warn('[TrackingPreview] Failed to parse tracking JSON — using fallback');
    const intervals = buildIntervalsFromKeyframes(fallback.keyframes);
    return { keyframes: fallback.keyframes, userCorrections: [], previewAccepted: false, ...intervals };
  }

  if (!parsed || typeof parsed !== 'object') {
    const intervals = buildIntervalsFromKeyframes(fallback.keyframes);
    return { keyframes: fallback.keyframes, userCorrections: [], previewAccepted: false, ...intervals };
  }

  const obj = parsed as Record<string, unknown>;
  const keyframes: TrackingKeyframe[] = [];

  if (Array.isArray(obj.keyframes)) {
    for (const item of obj.keyframes) {
      if (!item || typeof item !== 'object') continue;
      const row = item as Record<string, unknown>;
      const timestampMs = Number(row.timestampMs);
      if (Number.isNaN(timestampMs)) continue;

      const state = asState(row.state);
      if (state === 'LOST') {
        keyframes.push({
          timestampMs: Math.round(timestampMs),
          state: 'LOST',
          confidence: asConfidence(row.confidence),
          box: { x: 0, y: 0, width: 0, height: 0 },
        });
        continue;
      }

      const box = readBox(row);
      if (!box) continue;

      keyframes.push({
        timestampMs: Math.round(timestampMs),
        state,
        confidence: asConfidence(row.confidence),
        box,
      });
    }
  }

  const effectiveKeyframes =
    keyframes.length > 0
      ? keyframes.sort((a, b) => a.timestampMs - b.timestampMs)
      : fallback.keyframes;

  const derived = buildIntervalsFromKeyframes(effectiveKeyframes);

  const result: PlayerTrackingData = {
    keyframes: effectiveKeyframes,
    userCorrections: [],
    previewAccepted: false,
    confirmedIntervals: readIntervals(obj.confirmedIntervals).length
      ? readIntervals(obj.confirmedIntervals)
      : derived.confirmedIntervals,
    uncertainIntervals: readIntervals(obj.uncertainIntervals).length
      ? readIntervals(obj.uncertainIntervals)
      : derived.uncertainIntervals,
    lostIntervals: readIntervals(obj.lostIntervals).length
      ? readIntervals(obj.lostIntervals)
      : derived.lostIntervals,
  };

  console.log('[TrackingPreview] Parsed bounding-box tracking', {
    keyframeCount: result.keyframes.length,
    trackingConfidence: asConfidence(obj.trackingConfidence),
    confirmedIntervals: result.confirmedIntervals,
    uncertainIntervals: result.uncertainIntervals,
    lostIntervals: result.lostIntervals,
  });

  return result;
}

export function fallbackTrackingFromSelection(
  playerSelection: import('./types.js').PlayerSelection,
  clipDurationMs: number
): PlayerTrackingData {
  const refs =
    playerSelection.identityProfile?.references ??
    [
      {
        normalizedX: playerSelection.normalizedX,
        normalizedY: playerSelection.normalizedY,
        timestampMs: playerSelection.timestampMs,
        label: 'primary' as const,
      },
    ];

  const keyframes: TrackingKeyframe[] = refs.map((ref) => ({
    timestampMs: ref.timestampMs,
    state: 'CONFIRMED' as const,
    confidence: 0.95,
    box: estimateBoxFromTap(ref.normalizedX, ref.normalizedY),
  }));

  const lastRef = refs[refs.length - 1];
  if (clipDurationMs > lastRef.timestampMs + 400) {
    keyframes.push({
      timestampMs: lastRef.timestampMs + 400,
      state: 'PROBABLE',
      confidence: 0.55,
      box: estimateBoxFromTap(lastRef.normalizedX, lastRef.normalizedY),
    });
  }

  const intervals = buildIntervalsFromKeyframes(keyframes);
  const identityConfidence =
    playerSelection.identityProfile?.identityConfidence ??
    (playerSelection.reducedTrackingConfidence ? 'LOW' : 'HIGH');

  return {
    keyframes,
    userCorrections: [],
    previewAccepted: false,
    identityConfidence,
    ...intervals,
  };
}

export function logTrackingPreviewStates(tracking: PlayerTrackingData): void {
  console.log(
    '[TrackingPreview] Keyframe boxes',
    tracking.keyframes.map((k) => ({
      timestampMs: k.timestampMs,
      state: k.state,
      confidence: k.confidence,
      box: k.box,
    }))
  );
}
