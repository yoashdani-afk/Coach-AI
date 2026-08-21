import type { AppearanceFeatures, ExtractedFrame, ObjectTrack, TrackSample } from './types.js';
import {
  appearanceSimilarity,
  extractAppearanceFeatures,
  kitColorSimilarity,
} from './appearanceFeatures.js';

export interface IdentityGallery {
  entries: AppearanceFeatures[];
  sampleTimestamps: number[];
}

function isConfirmedDetection(s: TrackSample): boolean {
  return s.source === 'detection' && s.state !== 'LOST' && s.confidence >= 0.35;
}

function pickSpreadSamples(samples: TrackSample[], max: number): TrackSample[] {
  if (samples.length <= max) return samples;
  const sorted = [...samples].sort((a, b) => a.timestampMs - b.timestampMs);
  const result: TrackSample[] = [];
  const step = sorted.length / max;
  for (let i = 0; i < max; i++) {
    result.push(sorted[Math.min(sorted.length - 1, Math.floor(i * step))]!);
  }
  return result;
}

/** Build multi-view identity gallery from high-confidence anchor detections. */
export async function buildIdentityGallery(
  anchorTrack: ObjectTrack,
  frames: ExtractedFrame[],
  maxEntries = 10
): Promise<IdentityGallery> {
  const confirmed = anchorTrack.samples.filter(isConfirmedDetection);
  const byConfidence = [...confirmed].sort((a, b) => b.confidence - a.confidence);
  const topHalf = byConfidence.slice(0, Math.max(4, Math.ceil(byConfidence.length * 0.6)));
  const picked = pickSpreadSamples(topHalf, maxEntries);

  const entries: AppearanceFeatures[] = [];
  const sampleTimestamps: number[] = [];

  for (const sample of picked) {
    const frame = frames.find((f) => f.timestampMs === sample.timestampMs);
    if (!frame) continue;
    const features = await extractAppearanceFeatures(
      frame.jpeg,
      frame.width,
      frame.height,
      sample.box
    );
    entries.push(features);
    sampleTimestamps.push(sample.timestampMs);
  }

  if (entries.length === 0 && anchorTrack.appearance) {
    entries.push(anchorTrack.appearance);
  }

  return { entries, sampleTimestamps };
}

export interface GalleryScore {
  appearanceSimilarity: number;
  kitColorSimilarity: number;
  aggregated: number;
}

/** Score candidate appearance against gallery (best-of + mean blend). */
export function scoreAgainstGallery(
  gallery: IdentityGallery,
  candidate: AppearanceFeatures
): GalleryScore {
  if (gallery.entries.length === 0) {
    return { appearanceSimilarity: 0, kitColorSimilarity: 0, aggregated: 0 };
  }

  const appSims = gallery.entries.map((e) => appearanceSimilarity(e, candidate));
  const kitSims = gallery.entries.map((e) => kitColorSimilarity(e, candidate));

  const appearance =
    Math.max(...appSims) * 0.65 +
    (appSims.reduce((a, b) => a + b, 0) / appSims.length) * 0.35;
  const kit =
    Math.max(...kitSims) * 0.7 + (kitSims.reduce((a, b) => a + b, 0) / kitSims.length) * 0.3;
  const aggregated = appearance * 0.35 + kit * 0.65;

  return { appearanceSimilarity: appearance, kitColorSimilarity: kit, aggregated };
}
