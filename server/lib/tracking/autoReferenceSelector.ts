import sharp from 'sharp';
import type { ExtractedFrame, ObjectTrack, PersonDetection } from './types.js';
import type { TrackingBoundingBox } from '../types.js';
import { boxCenter, boxIoU } from './appearanceFeatures.js';
import type { TrackSample } from './types.js';

export interface FrameQualityScore {
  timestampMs: number;
  box: TrackingBoundingBox;
  total: number;
  visibility: number;
  playerSize: number;
  occlusion: number;
  blur: number;
  lighting: number;
  shirtVisibility: number;
  fullBody: number;
  identityConfidence: number;
  userIdentifiable: boolean;
  rejectReasons: string[];
}

const SEARCH_WINDOW_MS = 3000;
/** Minimum score to show "Is this still you?" — frame must be clearly visible. */
const HIGH_QUALITY_THRESHOLD = 0.62;
/** Minimum score to silently auto-add a reference without asking. */
const AUTO_REF_THRESHOLD = 0.42;
/** Hard minimum for any user-facing confirmation — below this, never ask. */
const USER_CONFIRMATION_MIN_THRESHOLD = 0.52;

export {
  HIGH_QUALITY_THRESHOLD,
  AUTO_REF_THRESHOLD,
  USER_CONFIRMATION_MIN_THRESHOLD,
  SEARCH_WINDOW_MS,
};

function clamp01(v: number): number {
  return Math.min(1, Math.max(0, v));
}

function boxOffScreenPenalty(box: TrackingBoundingBox): number {
  const right = box.x + box.width;
  const bottom = box.y + box.height;
  if (box.x < 0 || box.y < 0 || right > 1.01 || bottom > 1.01) return 0;
  const margin = 0.02;
  const nearEdge =
    box.x < margin || box.y < margin || right > 1 - margin || bottom > 1 - margin;
  return nearEdge ? 0.75 : 1;
}

function occlusionFromOtherPlayers(
  box: TrackingBoundingBox,
  others: PersonDetection[]
): number {
  if (others.length === 0) return 1;
  let maxIou = 0;
  for (const other of others) {
    maxIou = Math.max(maxIou, boxIoU(box, other.box));
  }
  if (maxIou >= 0.45) return 0.15;
  if (maxIou >= 0.28) return 0.45;
  if (maxIou >= 0.15) return 0.7;
  return 1;
}

async function laplacianVariance(jpeg: Buffer, box: TrackingBoundingBox, frame: ExtractedFrame): Promise<number> {
  try {
    const left = Math.max(0, Math.round(box.x * frame.width));
    const top = Math.max(0, Math.round(box.y * frame.height));
    const width = Math.max(1, Math.round(box.width * frame.width));
    const height = Math.max(1, Math.round(box.height * frame.height));

    const { data, info } = await sharp(frame.jpeg)
      .extract({
        left: Math.min(left, frame.width - 1),
        top: Math.min(top, frame.height - 1),
        width: Math.min(width, frame.width - left),
        height: Math.min(height, frame.height - top),
      })
      .greyscale()
      .resize(64, 64)
      .convolve({
        width: 3,
        height: 3,
        kernel: [0, 1, 0, 1, -4, 1, 0, 1, 0],
      })
      .raw()
      .toBuffer({ resolveWithObject: true });

    let mean = 0;
    for (let i = 0; i < data.length; i++) mean += data[i];
    mean /= data.length;

    let variance = 0;
    for (let i = 0; i < data.length; i++) {
      const d = data[i] - mean;
      variance += d * d;
    }
    variance /= data.length;
    return Math.min(1, variance / 900);
  } catch {
    return 0.25;
  }
}

function evaluateUserIdentifiable(
  parts: Omit<FrameQualityScore, 'timestampMs' | 'box' | 'total' | 'userIdentifiable' | 'rejectReasons'>,
  sample: TrackSample
): { userIdentifiable: boolean; rejectReasons: string[] } {
  const reasons: string[] = [];

  if (sample.state === 'LOST') reasons.push('lost');
  if (sample.source === 'prediction') reasons.push('predicted_not_detected');
  if (parts.playerSize < 0.22) reasons.push('too_small');
  if (parts.blur < 0.18) reasons.push('motion_blur');
  if (parts.occlusion < 0.45) reasons.push('occluded');
  if (parts.visibility < 0.4) reasons.push('low_visibility');
  if (parts.shirtVisibility < 0.2) reasons.push('shirt_not_visible');
  if (parts.fullBody < 0.45) reasons.push('body_not_visible');
  if (parts.identityConfidence < 0.38) reasons.push('low_identity_confidence');
  if (parts.lighting < 0.15) reasons.push('too_dark');

  return { userIdentifiable: reasons.length === 0, rejectReasons: reasons };
}

async function scoreFrameSample(
  frame: ExtractedFrame,
  box: TrackingBoundingBox,
  sample: TrackSample,
  otherPlayers: PersonDetection[]
): Promise<Omit<FrameQualityScore, 'timestampMs' | 'box' | 'total'>> {
  const area = box.width * box.height;
  const playerSize = Math.min(1, area / 0.012) * boxOffScreenPenalty(box);

  const left = Math.max(0, Math.round(box.x * frame.width));
  const top = Math.max(0, Math.round(box.y * frame.height));
  const width = Math.max(1, Math.round(box.width * frame.width));
  const height = Math.max(1, Math.round(box.height * frame.height));

  let lighting = 0.5;
  let shirtVisibility = 0.5;
  try {
    const crop = await sharp(frame.jpeg)
      .extract({
        left: Math.min(left, frame.width - 1),
        top: Math.min(top, frame.height - 1),
        width: Math.min(width, frame.width - left),
        height: Math.min(height, frame.height - top),
      })
      .raw()
      .toBuffer({ resolveWithObject: true });

    const channels = crop.info.channels;
    let brightness = 0;
    let upperSat = 0;
    const upperRows = Math.max(1, Math.floor(crop.info.height * 0.35));
    for (let y = 0; y < crop.info.height; y++) {
      for (let x = 0; x < crop.info.width; x++) {
        const i = (y * crop.info.width + x) * channels;
        const r = crop.data[i];
        const g = crop.data[i + 1];
        const b = crop.data[i + 2];
        brightness += (r + g + b) / 3;
        if (y < upperRows) {
          upperSat += Math.max(r, g, b) - Math.min(r, g, b);
        }
      }
    }
    const pixels = crop.info.width * crop.info.height;
    const meanBright = brightness / pixels;
    lighting = clamp01((meanBright - 35) / 160);
    shirtVisibility = clamp01(upperSat / (upperRows * crop.info.width * 80));
  } catch {
    // keep defaults
  }

  const blur = await laplacianVariance(frame.jpeg, box, frame);
  const visibility = clamp01(sample.confidence);
  const detectionOcclusion = sample.source === 'detection' ? 1 : 0.25;
  const playerOcclusion = occlusionFromOtherPlayers(box, otherPlayers);
  const occlusion = Math.min(detectionOcclusion, playerOcclusion);

  const aspect = box.height / Math.max(0.01, box.width);
  const fullBody = aspect >= 1.8 && aspect <= 4.5 ? 1 : 0.45;

  let identityConfidence = sample.confidence;
  if (sample.state === 'CONFIRMED') identityConfidence = Math.max(identityConfidence, 0.85);
  else if (sample.state === 'PROBABLE') identityConfidence *= 0.85;
  else if (sample.state === 'SEARCHING') identityConfidence *= 0.55;
  else identityConfidence *= 0.2;

  const parts = {
    visibility,
    playerSize,
    occlusion,
    blur,
    lighting,
    shirtVisibility,
    fullBody,
    identityConfidence: clamp01(identityConfidence),
  };

  const { userIdentifiable, rejectReasons } = evaluateUserIdentifiable(parts, sample);

  return { ...parts, userIdentifiable, rejectReasons };
}

function totalScore(parts: Omit<FrameQualityScore, 'timestampMs' | 'box' | 'total'>): number {
  return (
    parts.visibility * 0.18 +
    parts.playerSize * 0.16 +
    parts.occlusion * 0.18 +
    parts.blur * 0.12 +
    parts.lighting * 0.06 +
    parts.shirtVisibility * 0.12 +
    parts.fullBody * 0.08 +
    parts.identityConfidence * 0.1
  );
}

export async function scoreCandidateFrames(
  frames: ExtractedFrame[],
  track: ObjectTrack,
  anchorTimestampMs: number,
  detections: PersonDetection[],
  windowMs = SEARCH_WINDOW_MS
): Promise<FrameQualityScore[]> {
  const candidates = frames.filter(
    (f) => Math.abs(f.timestampMs - anchorTimestampMs) <= windowMs
  );

  const scores: FrameQualityScore[] = [];
  for (const frame of candidates) {
    const sample = track.samples.find((s) => s.timestampMs === frame.timestampMs);
    if (!sample || sample.state === 'LOST') continue;

    const othersAtTime = detections.filter(
      (d) =>
        d.timestampMs === frame.timestampMs &&
        boxIoU(d.box, sample.box) < 0.65
    );

    const parts = await scoreFrameSample(frame, sample.box, sample, othersAtTime);
    scores.push({
      timestampMs: frame.timestampMs,
      box: sample.box,
      ...parts,
      total: totalScore(parts),
    });
  }

  scores.sort((a, b) => b.total - a.total);
  return scores;
}

export function findWeakIdentityAnchors(
  keyframes: Array<{ timestampMs: number; state: string; confidence: number }>,
  minRun = 2
): number[] {
  const anchors: number[] = [];
  let runStart: number | null = null;
  let runLength = 0;

  for (const kf of keyframes) {
    const weak =
      kf.state === 'SEARCHING' ||
      kf.state === 'PROBABLE' ||
      (kf.state !== 'LOST' && kf.confidence < 0.55);

    if (weak) {
      if (runStart == null) runStart = kf.timestampMs;
      runLength += 1;
    } else if (runStart != null && runLength >= minRun) {
      anchors.push(runStart);
      runStart = null;
      runLength = 0;
    } else {
      runStart = null;
      runLength = 0;
    }
  }

  if (runStart != null && runLength >= minRun) {
    anchors.push(runStart);
  }

  return anchors;
}

/** Best frame suitable for user confirmation within ±windowMs. Never returns occluded/hidden frames. */
export async function pickConfirmationCandidate(
  frames: ExtractedFrame[],
  track: ObjectTrack,
  anchorTimestampMs: number,
  detections: PersonDetection[]
): Promise<FrameQualityScore | null> {
  const scores = await scoreCandidateFrames(frames, track, anchorTimestampMs, detections);
  const identifiable = scores.filter(
    (s) =>
      s.userIdentifiable &&
      s.total >= USER_CONFIRMATION_MIN_THRESHOLD &&
      s.occlusion >= 0.45 &&
      s.playerSize >= 0.22
  );
  return identifiable[0] ?? null;
}

/** Best frame for silent auto-reference (may be lower quality, still must not be lost). */
export async function pickAutoReferenceCandidate(
  frames: ExtractedFrame[],
  track: ObjectTrack,
  anchorTimestampMs: number,
  detections: PersonDetection[]
): Promise<FrameQualityScore | null> {
  const scores = await scoreCandidateFrames(frames, track, anchorTimestampMs, detections);
  const usable = scores.filter((s) => s.total >= AUTO_REF_THRESHOLD && s.playerSize >= 0.15);
  return usable[0] ?? null;
}

export function centerOfBox(box: TrackingBoundingBox): { x: number; y: number } {
  return boxCenter(box);
}
