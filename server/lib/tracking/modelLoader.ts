import './tfNodePolyfill.js';
import '@tensorflow/tfjs-node';
import type { ObjectDetection } from '@tensorflow-models/coco-ssd';
import * as tf from '@tensorflow/tfjs-node';

let backendReady = false;
let detectorPromise: Promise<ObjectDetection> | null = null;
let backendName: string | null = null;
let loggedModelReuse = false;

export function getTrackingBackendName(): string | null {
  return backendName;
}

export async function initTrackingBackend(): Promise<void> {
  if (backendReady) return;

  try {
    await tf.ready();
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    throw new Error(`[Tracking] Failed to initialize tfjs-node backend: ${message}`);
  }

  backendName = tf.getBackend();
  console.log('[Tracking] tf.getBackend() =', backendName);

  if (backendName !== 'tensorflow') {
    throw new Error(
      `[Tracking] Expected tensorflow backend, got "${backendName}". Refusing slow JS fallback.`
    );
  }

  backendReady = true;
}

export async function loadTrackingDetector(): Promise<ObjectDetection> {
  if (detectorPromise) {
    if (!loggedModelReuse) {
      console.log('[Tracking] reusing loaded models');
      loggedModelReuse = true;
    }
    return detectorPromise;
  }

  detectorPromise = (async () => {
    await initTrackingBackend();
    const cocoSsd = await import('@tensorflow-models/coco-ssd');
    const model = await cocoSsd.load({ base: 'lite_mobilenet_v2' });
    console.log('[Tracking] detector loaded');
    return model;
  })();

  return detectorPromise;
}

/** Warm models at server startup so first job does not pay load cost. */
export async function warmupTrackingModels(): Promise<void> {
  await loadTrackingDetector();
  console.log('[Tracking] re-id model loaded');
}
