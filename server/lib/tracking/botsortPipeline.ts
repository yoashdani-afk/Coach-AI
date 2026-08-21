import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import type { AnalysisRequestMetadata, PlayerTrackingData } from '../types.js';
import type { ConfirmationRequest } from './confirmationRegistry.js';
import type { TrackingPipelineProgress, TrackingTimelineResult } from './types.js';
import { callBotsortTracker } from './botsortClient.js';
import {
  assessTimelineReliability,
  buildIntervalsFromFullClipKeyframes,
  expandToFullClipTimeline,
} from './timelineCoverage.js';
import { PASS1_FPS } from './frameExtractor.js';

const FAILURE_MESSAGE =
  "We couldn't reliably follow you throughout this clip. Try retapping yourself on a clearer moment.";

function throwIfCancelled(signal?: AbortSignal): void {
  if (signal?.aborted) {
    throw new Error('Tracking job cancelled');
  }
}

function emitProgress(
  onProgress: ((p: TrackingPipelineProgress) => void) | undefined,
  update: TrackingPipelineProgress,
  totalDurationMs: number
): void {
  onProgress?.({ totalDurationMs, ...update });
}

function toPlayerKeyframes(
  keyframes: TrackingTimelineResult['keyframes']
): PlayerTrackingData['keyframes'] {
  return keyframes.map(({ timestampMs, state, confidence, box, trackId, coordinateSource }) => ({
    timestampMs,
    state,
    confidence,
    box,
    trackId,
    coordinateSource,
  }));
}

function emitPartialKeyframes(
  keyframes: TrackingTimelineResult['keyframes'],
  onPartialKeyframes: ((keyframes: PlayerTrackingData['keyframes'], processedUpToMs: number) => void) | undefined
): void {
  if (!onPartialKeyframes || keyframes.length === 0) return;
  onPartialKeyframes(toPlayerKeyframes(keyframes), keyframes[keyframes.length - 1]!.timestampMs);
}

/**
 * BoT-SORT tracking pipeline — YOLO detection + Ultralytics BoT-SORT via Python service.
 * Skips custom fragment reconnection, appearance scoring, and pass2 refinement.
 */
export async function runBotsortPipeline(params: {
  videoBuffer: Buffer;
  originalName: string;
  metadata: AnalysisRequestMetadata;
  jobId?: string;
  signal?: AbortSignal;
  onProgress?: (progress: TrackingPipelineProgress) => void;
  onPartialKeyframes?: (keyframes: PlayerTrackingData['keyframes'], processedUpToMs: number) => void;
  onConfirmationRequired?: (request: ConfirmationRequest) => void;
}): Promise<{ timeline: TrackingTimelineResult; playerTracking: PlayerTrackingData }> {
  const { metadata, videoBuffer, originalName, onProgress, onPartialKeyframes, signal, jobId } =
    params;
  const { playerSelection, clip } = metadata;
  const totalDurationMs = clip.durationMs;

  console.log('[BotsortPipeline] Player tap received', {
    jobId,
    timestampMs: playerSelection.timestampMs,
    tapNormalizedX: playerSelection.normalizedX,
    tapNormalizedY: playerSelection.normalizedY,
  });

  throwIfCancelled(signal);

  const tempDir = await fs.mkdtemp(path.join(os.tmpdir(), 'coach-ai-botsort-'));
  const safeName = originalName.replace(/[^\w.-]+/g, '_') || 'clip.mp4';
  const tempPath = path.join(tempDir, safeName);

  try {
    await fs.writeFile(tempPath, videoBuffer);

    emitProgress(
      onProgress,
      { stage: 'decoding_frames', message: 'Running YOLO + BoT-SORT tracker', jobId, processedDurationMs: 0 },
      totalDurationMs
    );

    throwIfCancelled(signal);

    emitProgress(
      onProgress,
      { stage: 'detecting_players', message: 'Tracking players across clip', jobId },
      totalDurationMs
    );

    const result = await callBotsortTracker({
      videoPath: tempPath,
      referenceTimestampMs: playerSelection.timestampMs,
      normalizedTapX: playerSelection.normalizedX,
      normalizedTapY: playerSelection.normalizedY,
      clipDurationMs: totalDurationMs,
      jobId,
    });

    console.log('[BotsortPipeline] Tracker stats', result.stats);
    if (result.debugVideoPath) {
      console.log('[BotsortPipeline] Debug video', { path: result.debugVideoPath });
    }

    const trackingFps = PASS1_FPS;
    const trackId = result.selectedTrackId;

    const sparseKeyframes: TrackingTimelineResult['keyframes'] = result.observations.map((obs) => ({
      timestampMs: obs.timestampMs,
      state: obs.state,
      confidence: obs.confidence,
      box: obs.box,
      trackId: obs.trackId,
      coordinateSource: obs.coordinateSource,
    }));

    console.log('[BotsortPipeline] Pre-serialization audit', {
      selectedTrackId: trackId,
      observationCount: sparseKeyframes.length,
      firstFiveSamples: sparseKeyframes.slice(0, 5),
    });

    emitProgress(
      onProgress,
      { stage: 'building_tracks', message: 'Building player timeline', jobId },
      totalDurationMs
    );

    const keyframes = expandToFullClipTimeline({
      sparseKeyframes,
      videoDurationMs: totalDurationMs,
      fps: trackingFps,
      trackId,
    });

    emitPartialKeyframes(keyframes, onPartialKeyframes);

    const reliability = assessTimelineReliability({
      keyframes,
      videoDurationMs: totalDurationMs,
      fps: trackingFps,
      identityScore: 1,
      identityFromTapContainment: true,
    });

    const coverageMetrics = reliability.metrics;
    const reliable = reliability.reliable;

    console.log('[BotsortPipeline] Coverage validation', {
      jobId,
      confirmedCoverageRatio: coverageMetrics.confirmedCoverageRatio,
      confirmedDurationMs: coverageMetrics.confirmedDurationMs,
      lostFrames: coverageMetrics.lostFrames,
      reliable,
      reliabilityReasons: reliability.reasons,
    });

    console.log('[BotsortPipeline] Identity result', {
      jobId,
      selectedTrackId: trackId,
      keyframesCount: keyframes.length,
      confirmedFrames: keyframes.filter((k) => k.state === 'CONFIRMED').length,
      lostFrames: coverageMetrics.lostFrames,
    });

    const intervals = buildIntervalsFromFullClipKeyframes(keyframes);
    const identityConfidence =
      playerSelection.identityProfile?.identityConfidence ??
      (playerSelection.reducedTrackingConfidence ? 'LOW' : 'HIGH');

    const timeline: TrackingTimelineResult = {
      sourceWidth: result.sourceWidth,
      sourceHeight: result.sourceHeight,
      fps: trackingFps,
      selectedTrackId: trackId,
      reliable,
      failureMessage: reliable ? undefined : FAILURE_MESSAGE,
      detectionsPerFrame: sparseKeyframes.length / Math.max(1, result.stats.totalFrames),
      trackedFrameCount: keyframes.length,
      keyframes,
    };

    const playerTracking: PlayerTrackingData = {
      keyframes: toPlayerKeyframes(keyframes),
      userCorrections: [],
      previewAccepted: false,
      identityConfidence: reliable ? identityConfidence : 'LOW',
      sourceWidth: result.sourceWidth,
      sourceHeight: result.sourceHeight,
      fps: trackingFps,
      selectedTrackId: trackId,
      reliable,
      coverageRatio: coverageMetrics.confirmedCoverageRatio,
      confirmedCoverageRatio: coverageMetrics.confirmedCoverageRatio,
      failureMessage: reliable ? undefined : FAILURE_MESSAGE,
      ...intervals,
    };

    emitProgress(
      onProgress,
      {
        stage: 'complete',
        message: 'Tracking ready',
        jobId,
        processedDurationMs: totalDurationMs,
      },
      totalDurationMs
    );

    console.log('[BotsortPipeline] Complete', {
      jobId,
      selectedTrackId: trackId,
      stats: result.stats,
      confirmedCoverageRatio: coverageMetrics.confirmedCoverageRatio,
    });

    return { timeline, playerTracking };
  } finally {
    await fs.rm(tempDir, { recursive: true, force: true }).catch(() => undefined);
  }
}
