import { runBotsortPipeline } from './tracking/botsortPipeline.js';
import { runTrackingPipeline } from './tracking/pipeline.js';
import { getTrackingEngine, isBotsortEngine } from './tracking/trackingEngine.js';
import type { AnalysisRequestMetadata, PlayerTrackingData } from './types.js';
import type { TrackingPipelineProgress } from './tracking/types.js';
import type { ConfirmationRequest } from './tracking/confirmationRegistry.js';

/** Dispatch to BoT-SORT or legacy custom CV tracking based on TRACKING_ENGINE. */
export async function trackPlayerPreviewWithGemini(params: {
  videoBuffer: Buffer;
  mimeType: string;
  originalName: string;
  metadata: AnalysisRequestMetadata;
  jobId?: string;
  signal?: AbortSignal;
  onProgress?: (progress: TrackingPipelineProgress) => void;
  onPartialKeyframes?: (keyframes: PlayerTrackingData['keyframes'], processedUpToMs: number) => void;
  onConfirmationRequired?: (request: ConfirmationRequest) => void;
  rebuildFromMs?: number;
  prefixKeyframes?: PlayerTrackingData['keyframes'];
}): Promise<PlayerTrackingData> {
  const engine = getTrackingEngine();
  console.log('[TrackPlayerPreview] Engine', { engine, jobId: params.jobId });

  if (isBotsortEngine()) {
    const { playerTracking } = await runBotsortPipeline({
      videoBuffer: params.videoBuffer,
      originalName: params.originalName,
      metadata: params.metadata,
      jobId: params.jobId,
      signal: params.signal,
      onProgress: params.onProgress,
      onPartialKeyframes: params.onPartialKeyframes,
    });
    return playerTracking;
  }

  const { playerTracking } = await runTrackingPipeline({
    videoBuffer: params.videoBuffer,
    originalName: params.originalName,
    metadata: params.metadata,
    jobId: params.jobId,
    signal: params.signal,
    onProgress: params.onProgress,
    onPartialKeyframes: params.onPartialKeyframes,
    onConfirmationRequired: params.onConfirmationRequired,
    rebuildFromMs: params.rebuildFromMs,
    prefixKeyframes: params.prefixKeyframes?.map((k) => ({
      ...k,
      coordinateSource: k.coordinateSource ?? 'detection',
    })),
  });
  return playerTracking;
}

export { getTrackingEngine, isBotsortEngine };
