import type { DenseFrame } from './factualEventTypes.js';
import type { AnalysisMode, AnalysisRequestMetadata } from './types.js';
import { logVideoUnderstandingJson } from './videoUnderstandingLog.js';

export interface VideoEvidenceAuditPayload {
  requestId: string;
  model: string;
  mode: AnalysisMode;
  videoDurationMs: number;
  originalVideoIncluded: boolean;
  originalVideoMimeType: string | null;
  originalVideoReason?: string;
  frameCount: number;
  frameTimestampsMs: number[];
  frameDimensions: { width: number; height: number; orientation: string }[];
  selectedPlayerReferenceIncluded: boolean;
  selectedPlayerTimestampMs: number;
  selectedPlayerCoordinates: { normalizedX: number; normalizedY: number };
  legacyTrackingIncluded: boolean;
  previousAnalysisIncluded: boolean;
  fps: number;
  inputMethod: 'dense_jpeg_frames' | 'dense_jpeg_frames_batched';
  batched: boolean;
  batchCount: number;
  expectedFrameCount: number;
  frameCountWarning?: string;
  geminiObservationInput: 'jpeg_frames_only';
  geminiVerificationInput: 'jpeg_frames_only';
}

export function logVideoEvidenceAudit(payload: VideoEvidenceAuditPayload): VideoEvidenceAuditPayload {
  console.log('[VideoEvidenceAudit]\n' + JSON.stringify(payload, null, 2));
  return payload;
}

export function buildVideoEvidenceAuditPayload(params: {
  requestId: string;
  model: string;
  metadata: AnalysisRequestMetadata;
  mimeType: string;
  frames: DenseFrame[];
  fps: number;
  width: number;
  height: number;
  referenceIncluded: boolean;
  batched: boolean;
  batchCount: number;
}): VideoEvidenceAuditPayload {
  const { metadata, frames, fps, width, height } = params;
  const durationMs = metadata.clip.durationMs;
  const expectedFrameCount = Math.max(1, Math.ceil((durationMs / 1000) * fps));
  const orientation = width >= height ? 'landscape' : 'portrait';

  let frameCountWarning: string | undefined;
  if (frames.length === 0) {
    frameCountWarning = 'ZERO frames extracted — observation will fail.';
  } else if (frames.length < expectedFrameCount * 0.5) {
    frameCountWarning = `Only ${frames.length} frames vs ~${expectedFrameCount} expected at ${fps} FPS — temporal coverage may be incomplete.`;
  }

  const legacyTrackingIncluded = Boolean(
    metadata.playerTracking?.previewAccepted || metadata.playerTracking?.keyframes?.length
  );

  const payload: VideoEvidenceAuditPayload = {
    requestId: params.requestId,
    model: params.model,
    mode: metadata.mode,
    videoDurationMs: durationMs,
    originalVideoIncluded: false,
    originalVideoMimeType: params.mimeType,
    originalVideoReason:
      'Dense timeline pipeline sends extracted JPEG frames only. Original MP4 is normalized locally but NOT uploaded to Gemini observe/verify calls.',
    frameCount: frames.length,
    frameTimestampsMs: frames.map((frame) => frame.timestampMs),
    frameDimensions: frames.map((frame) => ({
      width: frame.width ?? width,
      height: frame.height ?? height,
      orientation: frame.orientation ?? orientation,
    })),
    selectedPlayerReferenceIncluded: params.referenceIncluded,
    selectedPlayerTimestampMs: metadata.playerSelection.timestampMs,
    selectedPlayerCoordinates: {
      normalizedX: metadata.playerSelection.normalizedX,
      normalizedY: metadata.playerSelection.normalizedY,
    },
    legacyTrackingIncluded,
    previousAnalysisIncluded: false,
    fps,
    inputMethod: params.batched ? 'dense_jpeg_frames_batched' : 'dense_jpeg_frames',
    batched: params.batched,
    batchCount: params.batchCount,
    expectedFrameCount,
    frameCountWarning,
    geminiObservationInput: 'jpeg_frames_only',
    geminiVerificationInput: 'jpeg_frames_only',
  };

  if (legacyTrackingIncluded) {
    logVideoUnderstandingJson(
      'TRACKING NOT SENT TO GEMINI',
      {
        requestId: params.requestId,
        note: 'playerTracking present in request metadata but excluded from observation/verification prompts.',
      },
      params.requestId
    );
  }

  return logVideoEvidenceAudit(payload);
}
