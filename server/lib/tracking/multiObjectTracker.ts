import type { ExtractedFrame, ObjectTrack, PersonDetection, TrackSample, AppearanceFeatures } from './types.js';
import type { TrackingBoundingBox, TrackingState } from '../types.js';
import {
  appearanceDistance,
  boxCenter,
  boxIoU,
  extractAppearanceFeatures,
} from './appearanceFeatures.js';

const MAX_MISSES_BEFORE_LOST = 6;
const IOU_MATCH_THRESHOLD = 0.1;
const APPEARANCE_MATCH_MAX = 85;
const APPEARANCE_REACQUIRE_MAX = 55;
const MAX_CENTER_JUMP = 0.28;
const MATCH_COST_THRESHOLD = 0.68;
const APPEARANCE_REJECT_DIST = 62;

function predictBox(prev: TrackingBoundingBox, velocity: { dx: number; dy: number }): TrackingBoundingBox {
  return {
    x: Math.min(1 - prev.width, Math.max(0, prev.x + velocity.dx)),
    y: Math.min(1 - prev.height, Math.max(0, prev.y + velocity.dy)),
    width: prev.width,
    height: prev.height,
  };
}

function updateVelocity(
  prev: TrackingBoundingBox,
  next: TrackingBoundingBox,
  dtMs: number
): { dx: number; dy: number } {
  const span = Math.max(1, dtMs / 33);
  return {
    dx: (next.x - prev.x) / span,
    dy: (next.y - prev.y) / span,
  };
}

function medianGlobalShift(
  matches: Array<{ det: PersonDetection; track: ObjectTrack }>
): { dx: number; dy: number } {
  if (matches.length === 0) return { dx: 0, dy: 0 };
  const shifts = matches.map(({ det, track }) => {
    const last = track.samples[track.samples.length - 1].box;
    return {
      dx: boxCenter(det.box).x - boxCenter(last).x,
      dy: boxCenter(det.box).y - boxCenter(last).y,
    };
  });
  shifts.sort((a, b) => a.dx - b.dx);
  const mid = Math.floor(shifts.length / 2);
  return shifts.length % 2 ? shifts[mid] : { dx: (shifts[mid - 1].dx + shifts[mid].dx) / 2, dy: (shifts[mid - 1].dy + shifts[mid].dy) / 2 };
}

function matchCost(
  det: PersonDetection,
  track: ObjectTrack,
  predicted: TrackingBoundingBox,
  appearance: AppearanceFeatures | null,
  cameraShift: { dx: number; dy: number }
): number {
  const compensated: TrackingBoundingBox = {
    ...det.box,
    x: det.box.x - cameraShift.dx,
    y: det.box.y - cameraShift.dy,
  };

  const iou = boxIoU(compensated, predicted);
  const centerDist = Math.hypot(
    boxCenter(compensated).x - boxCenter(predicted).x,
    boxCenter(compensated).y - boxCenter(predicted).y
  );

  let cost = (1 - iou) * 0.45 + centerDist * 0.3;
  if (appearance && track.appearance) {
    const appDist = appearanceDistance(appearance, track.appearance);
    if (appDist > APPEARANCE_REJECT_DIST) return 2;
    cost += (appDist / APPEARANCE_MATCH_MAX) * 0.4;
  }
  return cost;
}

export async function buildObjectTracks(
  frames: ExtractedFrame[],
  detections: PersonDetection[]
): Promise<ObjectTrack[]> {
  const byTime = new Map<number, PersonDetection[]>();
  for (const det of detections) {
    const list = byTime.get(det.timestampMs) ?? [];
    list.push(det);
    byTime.set(det.timestampMs, list);
  }

  const tracks: ObjectTrack[] = [];
  let nextId = 1;

  for (const frame of frames) {
    const frameDets = byTime.get(frame.timestampMs) ?? [];
    const activeTracks = tracks.filter((t) => t.consecutiveMisses < MAX_MISSES_BEFORE_LOST);

    const preliminaryMatches: Array<{ det: PersonDetection; track: ObjectTrack }> = [];
    const usedTracks = new Set<string>();
    const usedDets = new Set<number>();

    for (const det of frameDets) {
      let bestTrack: ObjectTrack | null = null;
      let bestIou = IOU_MATCH_THRESHOLD;
      for (const track of activeTracks) {
        if (usedTracks.has(track.trackId)) continue;
        const last = track.samples[track.samples.length - 1];
        const iou = boxIoU(det.box, last.box);
        if (iou > bestIou) {
          bestIou = iou;
          bestTrack = track;
        }
      }
      if (bestTrack) {
        preliminaryMatches.push({ det, track: bestTrack });
        usedTracks.add(bestTrack.trackId);
        usedDets.add(det.timestampMs + det.box.x * 1000);
      }
    }

    const cameraShift = medianGlobalShift(preliminaryMatches);

    const finalMatches: Array<{ det: PersonDetection; track: ObjectTrack; appearance: AppearanceFeatures | null }> = [];
    const pendingDets: Array<{ det: PersonDetection; appearance: AppearanceFeatures | null }> = [];
    usedTracks.clear();
    usedDets.clear();

    for (const det of frameDets) {
      let best: { track: ObjectTrack; cost: number; appearance: AppearanceFeatures | null } | null = null;
      const appearance = await extractAppearanceFeatures(frame.jpeg, frame.width, frame.height, det.box);

      for (const track of activeTracks) {
        if (usedTracks.has(track.trackId)) continue;
        const last = track.samples[track.samples.length - 1];
        const velocity =
          track.samples.length >= 2
            ? updateVelocity(
                track.samples[track.samples.length - 2].box,
                last.box,
                last.timestampMs - track.samples[track.samples.length - 2].timestampMs
              )
            : { dx: 0, dy: 0 };
        const predicted = predictBox(last.box, velocity);
        const cost = matchCost(det, track, predicted, appearance, cameraShift);
        const centerDist = Math.hypot(
          boxCenter(det.box).x - boxCenter(predicted).x,
          boxCenter(det.box).y - boxCenter(predicted).y
        );
        if (centerDist > MAX_CENTER_JUMP && cost > 0.4) continue;
        if (!best || cost < best.cost) {
          best = { track, cost, appearance };
        }
      }

      if (best && best.cost < MATCH_COST_THRESHOLD) {
        finalMatches.push({ det, track: best.track, appearance: best.appearance });
        usedTracks.add(best.track.trackId);
      } else {
        pendingDets.push({ det, appearance });
      }
    }

    for (const track of activeTracks) {
      if (usedTracks.has(track.trackId) || !track.appearance || track.consecutiveMisses < 3) continue;

      let bestIdx = -1;
      let bestDist = APPEARANCE_REACQUIRE_MAX;
      for (let i = 0; i < pendingDets.length; i++) {
        const { appearance } = pendingDets[i];
        if (!appearance) continue;
        const dist = appearanceDistance(appearance, track.appearance);
        if (dist < bestDist) {
          bestDist = dist;
          bestIdx = i;
        }
      }

      if (bestIdx >= 0) {
        const { det, appearance } = pendingDets[bestIdx];
        finalMatches.push({ det, track, appearance });
        usedTracks.add(track.trackId);
        pendingDets.splice(bestIdx, 1);
      }
    }

    for (const { det, appearance } of pendingDets) {
      const trackId = `track-${nextId++}`;
      tracks.push({
        trackId,
        samples: [
          {
            timestampMs: frame.timestampMs,
            box: det.box,
            confidence: det.confidence,
            source: 'detection',
            state: 'CONFIRMED',
          },
        ],
        appearance,
        consecutiveMisses: 0,
      });
    }

    for (const { det, track, appearance } of finalMatches) {
      const sample: TrackSample = {
        timestampMs: frame.timestampMs,
        box: det.box,
        confidence: det.confidence,
        source: 'detection',
        state: det.confidence >= 0.55 ? 'CONFIRMED' : 'PROBABLE',
      };
      track.samples.push(sample);
      track.consecutiveMisses = 0;
      if (appearance) {
        track.appearance = track.appearance
          ? {
              shirtRgb: [
                Math.round((track.appearance.shirtRgb[0] + appearance.shirtRgb[0]) / 2),
                Math.round((track.appearance.shirtRgb[1] + appearance.shirtRgb[1]) / 2),
                Math.round((track.appearance.shirtRgb[2] + appearance.shirtRgb[2]) / 2),
              ] as [number, number, number],
              shortsRgb: [
                Math.round((track.appearance.shortsRgb[0] + appearance.shortsRgb[0]) / 2),
                Math.round((track.appearance.shortsRgb[1] + appearance.shortsRgb[1]) / 2),
                Math.round((track.appearance.shortsRgb[2] + appearance.shortsRgb[2]) / 2),
              ] as [number, number, number],
              socksRgb: [
                Math.round((track.appearance.socksRgb[0] + appearance.socksRgb[0]) / 2),
                Math.round((track.appearance.socksRgb[1] + appearance.socksRgb[1]) / 2),
                Math.round((track.appearance.socksRgb[2] + appearance.socksRgb[2]) / 2),
              ] as [number, number, number],
              aspectRatio: (track.appearance.aspectRatio + appearance.aspectRatio) / 2,
            }
          : appearance;
      }
    }

    for (const track of activeTracks) {
      if (usedTracks.has(track.trackId)) continue;

      track.consecutiveMisses += 1;
      const last = track.samples[track.samples.length - 1];
      const velocity =
        track.samples.length >= 2
          ? updateVelocity(
              track.samples[track.samples.length - 2].box,
              last.box,
              last.timestampMs - track.samples[track.samples.length - 2].timestampMs
            )
          : { dx: 0, dy: 0 };
      const predicted = predictBox(last.box, velocity);
      const state: TrackingState =
        track.consecutiveMisses >= MAX_MISSES_BEFORE_LOST
          ? 'LOST'
          : track.consecutiveMisses >= 2
            ? 'SEARCHING'
            : 'PROBABLE';
      track.samples.push({
        timestampMs: frame.timestampMs,
        box: predicted,
        confidence: Math.max(0.2, last.confidence - track.consecutiveMisses * 0.08),
        source: 'prediction',
        state,
      });
    }
  }

  return tracks;
}
