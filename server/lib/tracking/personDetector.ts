import './tfNodePolyfill.js';
import * as tf from '@tensorflow/tfjs-node';
import type { ExtractedFrame, PersonDetection } from './types.js';
import type { TrackingBoundingBox } from '../types.js';
import { loadTrackingDetector } from './modelLoader.js';

function pixelBoxToNormalized(
  bbox: [number, number, number, number],
  frameWidth: number,
  frameHeight: number
): TrackingBoundingBox {
  const [px, py, pw, ph] = bbox;
  return {
    x: Math.min(1, Math.max(0, px / frameWidth)),
    y: Math.min(1, Math.max(0, py / frameHeight)),
    width: Math.min(1, Math.max(0.01, pw / frameWidth)),
    height: Math.min(1, Math.max(0.01, ph / frameHeight)),
  };
}

async function frameToTensor(frame: ExtractedFrame) {
  return tf.node.decodeJpeg(frame.jpeg, 3);
}

export async function detectPeopleInFrame(frame: ExtractedFrame): Promise<PersonDetection[]> {
  const model = await loadTrackingDetector();
  const imageTensor = await frameToTensor(frame);
  let predictions;
  try {
    predictions = await model.detect(imageTensor as unknown as HTMLImageElement);
  } finally {
    imageTensor.dispose();
  }

  return predictions
    .filter((p) => p.class === 'person' && p.score >= 0.35)
    .map((p) => ({
      timestampMs: frame.timestampMs,
      box: pixelBoxToNormalized(p.bbox, frame.width, frame.height),
      confidence: p.score,
    }));
}

export async function detectPeopleInAllFrames(
  frames: ExtractedFrame[],
  onProgress?: (done: number, total: number, processedDurationMs?: number) => void
): Promise<PersonDetection[]> {
  const CONCURRENCY = 8;
  const all: PersonDetection[] = [];

  for (let i = 0; i < frames.length; i += CONCURRENCY) {
    const batch = frames.slice(i, i + CONCURRENCY);
    const batchResults = await Promise.all(batch.map((frame) => detectPeopleInFrame(frame)));
    for (const detections of batchResults) {
      all.push(...detections);
    }
    const lastFrame = batch[batch.length - 1];
    onProgress?.(
      Math.min(i + CONCURRENCY, frames.length),
      frames.length,
      lastFrame?.timestampMs
    );
  }

  return all;
}
