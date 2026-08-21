import type { TrackingBoundingBox, TrackingState } from '../types.js';
import type { ExtractedFrame, PersonDetection } from './types.js';
import { extractVideoSegmentFrames } from './frameExtractor.js';
import { detectPeopleInAllFrames } from './personDetector.js';
import {
  appearanceDistance,
  boxCenter,
  extractAppearanceFeatures,
} from './appearanceFeatures.js';

export interface RefinementWindow {
  startMs: number;
  endMs: number;
}

export interface RefinementKeyframe {
  timestampMs: number;
  box: TrackingBoundingBox;
  state: TrackingState;
  confidence: number;
  coordinateSource: 'detection' | 'prediction' | 'interpolated';
}

const MAX_JUMP = 0.16;
const MATCH_MAX_COST = 0.72;
const WINDOW_PAD_MS = 350;
const MERGE_GAP_MS = 200;

function isGenuineKeyframe(k: RefinementKeyframe): boolean {
  return k.coordinateSource === 'detection' && k.state !== 'LOST' && k.box.width > 0 && k.box.height > 0;
}

function boxDistance(a: TrackingBoundingBox, b: TrackingBoundingBox): number {
  const ca = boxCenter(a);
  const cb = boxCenter(b);
  return Math.hypot(cb.x - ca.x, cb.y - ca.y);
}

export function findRefinementWindows(
  keyframes: RefinementKeyframe[],
  totalDurationMs: number
): RefinementWindow[] {
  if (keyframes.length === 0) return [];

  const sorted = [...keyframes].sort((a, b) => a.timestampMs - b.timestampMs);
  const raw: RefinementWindow[] = [];

  for (let i = 0; i < sorted.length; i++) {
    const k = sorted[i]!;
    const prev = sorted[i - 1];
    const needsRefine =
      k.state === 'LOST' ||
      k.state === 'SEARCHING' ||
      k.confidence < 0.48 ||
      k.coordinateSource === 'prediction' ||
      (prev && isGenuineKeyframe(prev) && isGenuineKeyframe(k) && boxDistance(prev.box, k.box) > MAX_JUMP);

    if (needsRefine) {
      raw.push({
        startMs: Math.max(0, k.timestampMs - WINDOW_PAD_MS),
        endMs: Math.min(totalDurationMs, k.timestampMs + WINDOW_PAD_MS),
      });
    }
  }

  if (raw.length === 0) return [];

  raw.sort((a, b) => a.startMs - b.startMs);
  const merged: RefinementWindow[] = [raw[0]!];
  for (let i = 1; i < raw.length; i++) {
    const prev = merged[merged.length - 1]!;
    const cur = raw[i]!;
    if (cur.startMs <= prev.endMs + MERGE_GAP_MS) {
      prev.endMs = Math.max(prev.endMs, cur.endMs);
    } else {
      merged.push(cur);
    }
  }

  return merged;
}

function matchCost(
  det: PersonDetection,
  anchor: RefinementKeyframe,
  appearanceDist: number
): number {
  const centerDist = Math.hypot(
    boxCenter(det.box).x - boxCenter(anchor.box).x,
    boxCenter(det.box).y - boxCenter(anchor.box).y
  );
  return centerDist * 0.55 + (appearanceDist / 90) * 0.45;
}

function inWindow(k: RefinementKeyframe, window: RefinementWindow): boolean {
  return k.timestampMs >= window.startMs && k.timestampMs <= window.endMs;
}

/** Pass2 refinement — additive only; never replaces confirmed observations with LOST. */
export async function refineKeyframesInWindows(params: {
  videoPath: string;
  clipDurationMs: number;
  windows: RefinementWindow[];
  keyframes: RefinementKeyframe[];
  anchorAppearance: Awaited<ReturnType<typeof extractAppearanceFeatures>> | null;
}): Promise<RefinementKeyframe[]> {
  const { videoPath, clipDurationMs, windows, anchorAppearance } = params;
  let keyframes = [...params.keyframes].sort((a, b) => a.timestampMs - b.timestampMs);
  if (windows.length === 0) return keyframes;

  for (const window of windows) {
    const originalsInWindow = keyframes.filter((k) => inWindow(k, window));
    let segmentFrames: ExtractedFrame[] = [];
    try {
      segmentFrames = await extractVideoSegmentFrames(
        videoPath,
        window.startMs,
        window.endMs,
        clipDurationMs
      );
    } catch (error) {
      console.warn('[Refinement] Segment extract failed — preserving originals', {
        startMs: window.startMs,
        endMs: window.endMs,
        message: error instanceof Error ? error.message : String(error),
      });
      continue;
    }
    if (segmentFrames.length === 0) continue;

    const segmentDetections = await detectPeopleInAllFrames(segmentFrames);
    const byTime = new Map<number, PersonDetection[]>();
    for (const det of segmentDetections) {
      const list = byTime.get(det.timestampMs) ?? [];
      list.push(det);
      byTime.set(det.timestampMs, list);
    }

    const improvements = new Map<number, RefinementKeyframe>();

    for (const frame of segmentFrames) {
      const dets = byTime.get(frame.timestampMs) ?? [];
      const before = [...keyframes]
        .filter((k) => k.timestampMs <= frame.timestampMs && isGenuineKeyframe(k))
        .sort((a, b) => b.timestampMs - a.timestampMs)[0];
      const after = [...keyframes]
        .filter((k) => k.timestampMs >= frame.timestampMs && isGenuineKeyframe(k))
        .sort((a, b) => a.timestampMs - b.timestampMs)[0];
      const anchor = before ?? after;
      if (!anchor) continue;

      let best: { det: PersonDetection; cost: number } | null = null;
      for (const det of dets) {
        let appearanceDist = 50;
        if (anchorAppearance) {
          const app = await extractAppearanceFeatures(
            frame.jpeg,
            frame.width,
            frame.height,
            det.box
          );
          if (app) appearanceDist = appearanceDistance(app, anchorAppearance);
        }
        const cost = matchCost(det, anchor, appearanceDist);
        if (cost < MATCH_MAX_COST && (!best || cost < best.cost)) {
          best = { det, cost };
        }
      }

      if (!best) continue;

      const existing =
        originalsInWindow.find((k) => k.timestampMs === frame.timestampMs) ??
        keyframes.find((k) => k.timestampMs === frame.timestampMs);

      const refined: RefinementKeyframe = {
        timestampMs: frame.timestampMs,
        box: best.det.box,
        state: best.det.confidence >= 0.55 ? 'CONFIRMED' : 'PROBABLE',
        confidence: best.det.confidence,
        coordinateSource: 'detection',
      };

      if (!existing || !isGenuineKeyframe(existing) || refined.confidence >= existing.confidence) {
        improvements.set(frame.timestampMs, refined);
      }
    }

    keyframes = keyframes.filter((k) => !inWindow(k, window));

    for (const original of originalsInWindow) {
      const improved = improvements.get(original.timestampMs);
      if (improved) {
        keyframes.push(improved);
        improvements.delete(original.timestampMs);
      } else if (isGenuineKeyframe(original)) {
        keyframes.push(original);
      }
    }

    for (const improved of improvements.values()) {
      keyframes.push(improved);
    }

    keyframes.sort((a, b) => a.timestampMs - b.timestampMs);
  }

  return keyframes;
}
