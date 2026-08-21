import type { AnalysisRequestPayload } from '@/analysis/models/AnalysisRequest';
import {
  buildTrackingTimelineWithUpload,
  createReducedTrackingFallback,
  submitTrackingConfirmation,
} from '@/lib/trackingBuildUpload';
import type {
  PlayerSelection,
  PlayerTrackingData,
  TrackingBuildProgress,
  TrackingConfirmationResponse,
  TrackingIdentityConfirmation,
} from '@/types/analysis';

export {
  buildTrackingTimelineWithUpload,
  createReducedTrackingFallback,
  submitTrackingConfirmation,
  TrackingBuildError,
  UPLOAD_STALL_TIMEOUT_MS,
  TRACKING_JOB_TIMEOUT_MS,
} from '@/lib/trackingBuildUpload';

export async function buildPlayerTrackingTimeline(
  request: Pick<AnalysisRequestPayload, 'clip' | 'mode' | 'profile' | 'playerSelection'>,
  onProgress?: (progress: TrackingBuildProgress) => void,
  options?: {
    signal?: AbortSignal;
    onDebug?: (debug: import('@/types/analysis').TrackingBuildDebugState) => void;
    onConfirmationRequired?: (
      confirmation: TrackingIdentityConfirmation
    ) => Promise<TrackingConfirmationResponse>;
    rebuildFromTracking?: PlayerTrackingData;
    jobTimeoutMs?: number;
  }
): Promise<PlayerTrackingData> {
  return buildTrackingTimelineWithUpload({
    request,
    onProgress,
    signal: options?.signal,
    onDebug: options?.onDebug,
    onConfirmationRequired: options?.onConfirmationRequired,
    rebuildFromTracking: options?.rebuildFromTracking,
    jobTimeoutMs: options?.jobTimeoutMs,
  });
}

export async function rebuildTrackingFromCorrection(
  request: Pick<AnalysisRequestPayload, 'clip' | 'mode' | 'profile' | 'playerSelection'>,
  tracking: PlayerTrackingData,
  fromTimestampMs: number,
  onProgress?: (progress: TrackingBuildProgress) => void
): Promise<PlayerTrackingData> {
  const prefixKeyframes = tracking.keyframes.filter((k) => k.timestampMs < fromTimestampMs);
  return buildPlayerTrackingTimeline(request, onProgress, {
    rebuildFromTracking: {
      ...tracking,
      keyframes: prefixKeyframes,
      rebuildFromMs: fromTimestampMs,
      previewAccepted: false,
    },
  });
}

/** @deprecated Client-side fake tracking removed. */
export function createInitialTrackingFromSelection(
  _playerSelection: PlayerSelection,
  _clipDurationMs: number
): PlayerTrackingData {
  return createReducedTrackingFallback();
}

export async function fetchPlayerTrackingPreview(
  request: Pick<AnalysisRequestPayload, 'clip' | 'mode' | 'profile' | 'playerSelection'>
): Promise<PlayerTrackingData> {
  return buildPlayerTrackingTimeline(request);
}
