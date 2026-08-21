import sharp from 'sharp';
import type { AppearanceFeatures } from './types.js';
import type { TrackingBoundingBox } from '../types.js';

function clamp01(v: number): number {
  return Math.min(1, Math.max(0, v));
}

async function regionMeanRgb(
  jpeg: Buffer,
  frameWidth: number,
  frameHeight: number,
  box: TrackingBoundingBox,
  yStartRatio: number,
  yEndRatio: number
): Promise<[number, number, number]> {
  const left = Math.round(clamp01(box.x) * frameWidth);
  const top = Math.round(clamp01(box.y + box.height * yStartRatio) * frameHeight);
  const width = Math.max(1, Math.round(clamp01(box.width) * frameWidth));
  const height = Math.max(
    1,
    Math.round(clamp01(box.height * (yEndRatio - yStartRatio)) * frameHeight)
  );

  const maxLeft = Math.min(left, frameWidth - 1);
  const maxTop = Math.min(top, frameHeight - 1);
  const extractWidth = Math.min(width, frameWidth - maxLeft);
  const extractHeight = Math.min(height, frameHeight - maxTop);

  if (extractWidth <= 0 || extractHeight <= 0) {
    return [128, 128, 128];
  }

  const { data, info } = await sharp(jpeg)
    .extract({ left: maxLeft, top: maxTop, width: extractWidth, height: extractHeight })
    .resize(8, 8)
    .raw()
    .toBuffer({ resolveWithObject: true });

  let r = 0;
  let g = 0;
  let b = 0;
  const channels = info.channels;
  const pixels = data.length / channels;
  for (let i = 0; i < data.length; i += channels) {
    r += data[i];
    g += data[i + 1];
    b += data[i + 2];
  }

  return [Math.round(r / pixels), Math.round(g / pixels), Math.round(b / pixels)];
}

export async function extractAppearanceFeatures(
  jpeg: Buffer,
  frameWidth: number,
  frameHeight: number,
  box: TrackingBoundingBox
): Promise<AppearanceFeatures> {
  const [shirtRgb, shortsRgb, socksRgb] = await Promise.all([
    regionMeanRgb(jpeg, frameWidth, frameHeight, box, 0.05, 0.38),
    regionMeanRgb(jpeg, frameWidth, frameHeight, box, 0.38, 0.68),
    regionMeanRgb(jpeg, frameWidth, frameHeight, box, 0.68, 0.95),
  ]);

  return {
    shirtRgb,
    shortsRgb,
    socksRgb,
    aspectRatio: box.width / Math.max(0.01, box.height),
  };
}

export function appearanceDistance(a: AppearanceFeatures, b: AppearanceFeatures): number {
  const shirt = Math.hypot(a.shirtRgb[0] - b.shirtRgb[0], a.shirtRgb[1] - b.shirtRgb[1], a.shirtRgb[2] - b.shirtRgb[2]);
  const shorts = Math.hypot(a.shortsRgb[0] - b.shortsRgb[0], a.shortsRgb[1] - b.shortsRgb[1], a.shortsRgb[2] - b.shortsRgb[2]);
  const socks = Math.hypot(a.socksRgb[0] - b.socksRgb[0], a.socksRgb[1] - b.socksRgb[1], a.socksRgb[2] - b.socksRgb[2]);
  const aspect = Math.abs(a.aspectRatio - b.aspectRatio) * 100;
  return shirt * 0.45 + shorts * 0.3 + socks * 0.15 + aspect * 0.1;
}

function rgbDistance(a: [number, number, number], b: [number, number, number]): number {
  return Math.hypot(a[0] - b[0], a[1] - b[1], a[2] - b[2]);
}

/** Kit-weighted color similarity — shirt/shorts dominate over socks. */
export function kitColorSimilarity(a: AppearanceFeatures, b: AppearanceFeatures): number {
  const shirt = rgbDistance(a.shirtRgb, b.shirtRgb);
  const shorts = rgbDistance(a.shortsRgb, b.shortsRgb);
  const socks = rgbDistance(a.socksRgb, b.socksRgb);
  const weighted = shirt * 0.55 + shorts * 0.35 + socks * 0.1;
  return Math.max(0, 1 - weighted / 75);
}

/** Convert appearance distance to 0–1 similarity. */
export function appearanceSimilarity(a: AppearanceFeatures, b: AppearanceFeatures): number {
  return Math.max(0, 1 - appearanceDistance(a, b) / 90);
}

export function boxCenter(box: TrackingBoundingBox): { x: number; y: number } {
  return { x: box.x + box.width / 2, y: box.y + box.height / 2 };
}

export function boxIoU(a: TrackingBoundingBox, b: TrackingBoundingBox): number {
  const x1 = Math.max(a.x, b.x);
  const y1 = Math.max(a.y, b.y);
  const x2 = Math.min(a.x + a.width, b.x + b.width);
  const y2 = Math.min(a.y + a.height, b.y + b.height);
  const inter = Math.max(0, x2 - x1) * Math.max(0, y2 - y1);
  const union = a.width * a.height + b.width * b.height - inter;
  return union > 0 ? inter / union : 0;
}
