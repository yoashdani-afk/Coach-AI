import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import type { AnalysisRequestMetadata, PlayerTrackingData } from '../types.js';
import { extractVideoFrames, PASS1_FPS } from './frameExtractor.js';
import { detectPeopleInAllFrames } from './personDetector.js';
import { buildObjectTracks } from './multiObjectTracker.js';
import { matchReferencesToTrack, exportTrackTimeline } from './identityMatcher.js';
import { recoverIdentityWithAutoReferences, mergeTrackingPrefix } from './identityRecovery.js';
import { findRefinementWindows, refineKeyframesInWindows } from './trackRefinement.js';
import { maybeRequestSecondReference } from './secondReference.js';
import type { ConfirmationRequest } from './confirmationRegistry.js';
import {
  resetStageTimings,
  summarizeStageTimings,
  timeStage,
} from './stageTimer.js';
import type { TrackingPipelineProgress, TrackingTimelineResult } from './types.js';
import { extractAppearanceFeatures } from './appearanceFeatures.js';
import {
  expandToFullClipTimeline,
  buildIntervalsFromFullClipKeyframes,
  assessTimelineReliability,
  assertTimelineSerialization,
  isConfirmedVisible,
} from './timelineCoverage.js';
import type { ReconnectionReport } from './trackFragmentReconnect.js';
import { reconnectTrackFragments } from './trackFragmentReconnect.js';
import { generateFragmentReconnectDebug } from './fragmentReconnectDebug.js';
import {
  logTapCoordinateAudit,
  mapClientTapToFrameNormalized,
  saveTapDebugFrame,
} from './tapCoordinateAudit.js';

import { estimateBoxFromTap } from '../parseTrackingPreview.js';
import { probeVideoGeometry, formatVideoProbeLog } from '../videoProbe.js';

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
  onProgress?.({
    totalDurationMs,
    ...update,
  });
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
  onPartialKeyframes(toPlayerKeyframes(keyframes), keyframes[keyframes.length - 1].timestampMs);
}

export async function runTrackingPipeline(params: {
  videoBuffer: Buffer;
  originalName: string;
  metadata: AnalysisRequestMetadata;
  jobId?: string;
  signal?: AbortSignal;
  onProgress?: (progress: TrackingPipelineProgress) => void;
  onPartialKeyframes?: (keyframes: PlayerTrackingData['keyframes'], processedUpToMs: number) => void;
  onConfirmationRequired?: (request: ConfirmationRequest) => void;
  rebuildFromMs?: number;
  prefixKeyframes?: TrackingTimelineResult['keyframes'];
}): Promise<{ timeline: TrackingTimelineResult; playerTracking: PlayerTrackingData }> {
  const {
    metadata,
    videoBuffer,
    originalName,
    onProgress,
    onPartialKeyframes,
    onConfirmationRequired,
    signal,
    jobId,
    rebuildFromMs,
    prefixKeyframes,
  } = params;
  const { playerSelection, clip } = metadata;
  const pipelineStarted = Date.now();
  const totalDurationMs = clip.durationMs;
  resetStageTimings();

  console.log('[TrackingPipeline] Player tap received', {
    jobId,
    timestampMs: playerSelection.timestampMs,
    tapNormalizedX: playerSelection.normalizedX,
    tapNormalizedY: playerSelection.normalizedY,
    videoWidth: playerSelection.videoWidth ?? null,
    videoHeight: playerSelection.videoHeight ?? null,
    displayWidth: playerSelection.displayWidth ?? null,
    displayHeight: playerSelection.displayHeight ?? null,
  });

  throwIfCancelled(signal);

  const tempDir = await fs.mkdtemp(path.join(os.tmpdir(), 'coach-ai-cv-track-'));
  const safeName = originalName.replace(/[^\w.-]+/g, '_') || 'clip.mp4';
  const tempPath = path.join(tempDir, safeName);

  try {
    await timeStage('video_upload', async () => {
      await fs.writeFile(tempPath, videoBuffer);
    });

    let videoGeometry: Awaited<ReturnType<typeof probeVideoGeometry>> | null = null;
    try {
      videoGeometry = await probeVideoGeometry(tempPath);
      console.log('[VideoProbe]', {
        jobId,
        ...formatVideoProbeLog(videoGeometry),
      });
    } catch (probeError) {
      console.warn('[VideoProbe] Failed', {
        jobId,
        message: probeError instanceof Error ? probeError.message : String(probeError),
      });
    }

    throwIfCancelled(signal);

    emitProgress(
      onProgress,
      { stage: 'decoding_frames', message: 'Decoding video frames', jobId, processedDurationMs: 0 },
      totalDurationMs
    );

    const trackingFps = PASS1_FPS;

    const frames = await timeStage(
      'ffmpeg_decode_and_frame_extraction',
      async () => {
        const extracted = await extractVideoFrames(tempPath, clip.durationMs, trackingFps, (done, total) => {
          throwIfCancelled(signal);
          emitProgress(
            onProgress,
            {
              stage: 'decoding_frames',
              message: 'Decoding video frames',
              jobId,
              framesDone: done,
              framesTotal: total,
              processedDurationMs: Math.round((done / Math.max(1, total)) * totalDurationMs),
            },
            totalDurationMs
          );
        });
        return extracted;
      },
      { framesProcessed: 0 }
    );

    const stageReports = await import('./stageTimer.js');
    const timings = stageReports.getStageTimings();
    const decodeIdx = timings.findIndex((t) => t.stage === 'ffmpeg_decode_and_frame_extraction');
    if (decodeIdx >= 0) {
      timings[decodeIdx].framesProcessed = frames.length;
      if (timings[decodeIdx].durationMs > 0) {
        timings[decodeIdx].effectiveFps =
          (frames.length / timings[decodeIdx].durationMs) * 1000;
      }
    }

    if (frames.length === 0) {
      throw new Error('Could not decode video frames for tracking');
    }

    console.log('[VideoProbe] Extracted frames', {
      jobId,
      extractedJpegWidth: frames[0]!.width,
      extractedJpegHeight: frames[0]!.height,
      frameCount: frames.length,
      probeDisplayWidth: videoGeometry?.displayWidth ?? null,
      probeDisplayHeight: videoGeometry?.displayHeight ?? null,
      probeRotation: videoGeometry?.rotation ?? null,
    });

    throwIfCancelled(signal);

    const sourceWidth = frames[0]!.width;
    const sourceHeight = frames[0]!.height;

    emitProgress(
      onProgress,
      {
        stage: 'detecting_players',
        message: 'Detecting players',
        jobId,
        framesDone: 0,
        framesTotal: frames.length,
        processedDurationMs: 0,
      },
      totalDurationMs
    );

    const detections = await timeStage(
      'person_detection_inference',
      () =>
        detectPeopleInAllFrames(frames, (done, total, processedDurationMs) => {
          throwIfCancelled(signal);
          emitProgress(
            onProgress,
            {
              stage: 'detecting_players',
              message: 'Detecting players',
              jobId,
              framesDone: done,
              framesTotal: total,
              processedDurationMs:
                processedDurationMs ?? Math.round((done / Math.max(1, total)) * totalDurationMs),
            },
            totalDurationMs
          );
        }),
      { framesProcessed: frames.length }
    );

    throwIfCancelled(signal);

    emitProgress(
      onProgress,
      {
        stage: 'building_tracks',
        message: 'Building player tracks',
        jobId,
        processedDurationMs: frames[frames.length - 1]?.timestampMs ?? totalDurationMs,
      },
      totalDurationMs
    );

    const objectTracks = await timeStage(
      'association_and_reidentification',
      () => buildObjectTracks(frames, detections),
      { framesProcessed: frames.length }
    );
    throwIfCancelled(signal);

    emitProgress(
      onProgress,
      { stage: 'matching_references', message: 'Matching your player', jobId },
      totalDurationMs
    );

    let selection = playerSelection;

    const refFrame =
      frames.find((f) => Math.abs(f.timestampMs - playerSelection.timestampMs) < 800) ?? frames[0]!;
    const tapAudit = mapClientTapToFrameNormalized(
      playerSelection,
      refFrame.width,
      refFrame.height
    );
    logTapCoordinateAudit(tapAudit, jobId);

    const mappedTap = {
      normalizedX: tapAudit.mappedNormalizedX,
      normalizedY: tapAudit.mappedNormalizedY,
    };

    const initialMatch = await timeStage('identity_matching', () =>
      matchReferencesToTrack(objectTracks, selection, frames, detections, { mappedTap })
    );

    await saveTapDebugFrame({
      frame: refFrame,
      audit: tapAudit,
      candidates: initialMatch.tapCandidates,
      jobId,
    });

    let trackId = initialMatch.trackId;
    let identityScoreFinal = initialMatch.score;
    let identityFromTapContainment = initialMatch.identityFromTapContainment;

    if (!trackId) {
      const secondRef = await timeStage('second_reference_prompt', () =>
        maybeRequestSecondReference({
          selection,
          trackId,
          identityScore: identityScoreFinal,
          objectTracks,
          frames,
          detections,
          clipDurationMs: totalDurationMs,
          jobId,
          onConfirmationRequired,
        })
      );
      selection = secondRef.selection;
      trackId = secondRef.trackId;
      identityScoreFinal = secondRef.identityScore;
      if (trackId) {
        const rematch = await matchReferencesToTrack(objectTracks, selection, frames, detections, {
          mappedTap,
        });
        identityFromTapContainment = rematch.identityFromTapContainment;
      }
    }

    throwIfCancelled(signal);

    let keyframes: TrackingTimelineResult['keyframes'] = [];
    let fragmentReconnectReport: ReconnectionReport | null = null;
    if (trackId) {
      const matched = objectTracks.find((t) => t.trackId === trackId);
      if (matched) {
        keyframes = exportTrackTimeline(matched, trackId);
      }
    }

    emitProgress(
      onProgress,
      { stage: 'verifying_identity', message: 'Verifying identity across clip', jobId },
      totalDurationMs
    );

    const recovery = await timeStage('identity_recovery', () =>
      recoverIdentityWithAutoReferences({
        frames,
        detections,
        objectTracks,
        selection,
        trackId,
        initialKeyframes: keyframes,
        identityScore: identityScoreFinal,
      })
    );

    trackId = recovery.trackId;
    identityScoreFinal = recovery.identityScore;

    if (trackId) {
      const matched = objectTracks.find((t) => t.trackId === trackId);
      if (matched) {
        const reconnected = await timeStage('fragment_reconnect', () =>
          reconnectTrackFragments({
            anchorTrack: matched,
            anchorTrackId: trackId!,
            allTracks: objectTracks,
            frames,
            detections,
            clipDurationMs: totalDurationMs,
            fps: trackingFps,
          })
        );
        keyframes = reconnected.keyframes;
        fragmentReconnectReport = reconnected.report;

        console.log('[TrackingPipeline] Fragment reconnection', {
          jobId,
          originalTrackCoverageRatio: reconnected.report.originalTrackCoverageRatio,
          mergedTrackIds: reconnected.report.mergedTrackIds,
          mergedCoverageRatio: reconnected.report.mergedCoverageRatio,
          confirmedDurationMs: reconnected.report.confirmedDurationMs,
          lostDurationMs: reconnected.report.lostDurationMs,
          remainingLostIntervals: reconnected.report.remainingLostIntervals,
          acceptedFragments: reconnected.report.mergedTrackIds.filter((id) => id !== trackId),
        });

        try {
          await generateFragmentReconnectDebug({
            jobId: jobId ?? 'unknown',
            frames,
            allTracks: objectTracks,
            anchorTrackId: trackId!,
            report: reconnected.report,
          });
        } catch (error) {
          console.warn('[FragmentReconnectDebug] Failed', {
            message: error instanceof Error ? error.message : String(error),
          });
        }
      }
    } else {
      keyframes = recovery.keyframes;
    }

    const refinementWindows = findRefinementWindows(
      keyframes.map((k) => ({
        timestampMs: k.timestampMs,
        box: k.box,
        state: k.state,
        confidence: k.confidence,
        coordinateSource: k.coordinateSource,
      })),
      totalDurationMs
    );

    if (refinementWindows.length > 0 && trackId) {
      emitProgress(
        onProgress,
        { stage: 'refining_track', message: 'Refining track', jobId },
        totalDurationMs
      );

      const tapFrame = frames.find(
        (f) => Math.abs(f.timestampMs - playerSelection.timestampMs) < 800
      ) ?? frames[0];
      const refBox = estimateBoxFromTap(playerSelection.normalizedX, playerSelection.normalizedY);
      const anchorAppearance = tapFrame
        ? await extractAppearanceFeatures(tapFrame.jpeg, tapFrame.width, tapFrame.height, refBox)
        : null;

      const refined = await timeStage(
        'pass2_targeted_refinement',
        () =>
          refineKeyframesInWindows({
            videoPath: tempPath,
            clipDurationMs: totalDurationMs,
            windows: refinementWindows,
            keyframes: keyframes.map((k) => ({
              timestampMs: k.timestampMs,
              box: k.box,
              state: k.state,
              confidence: k.confidence,
              coordinateSource: k.coordinateSource,
            })),
            anchorAppearance,
          }),
        { framesProcessed: refinementWindows.length }
      );

      keyframes = refined.map((k) => ({
        ...k,
        trackId: trackId!,
      }));
    }

    if (rebuildFromMs != null && prefixKeyframes?.length) {
      keyframes = mergeTrackingPrefix(prefixKeyframes, keyframes, rebuildFromMs);
    }

    const matchedTrack = trackId ? objectTracks.find((t) => t.trackId === trackId) : null;
    const selectedTrackDetectionCount =
      matchedTrack?.samples.filter((s) => s.source === 'detection' && s.state !== 'LOST').length ?? 0;
    const confirmedSampleCount = keyframes.filter(isConfirmedVisible).length;
    const refinedSampleCount = keyframes.filter(
      (k) => k.coordinateSource === 'detection' && k.state !== 'LOST'
    ).length;

    console.log('[TrackingPipeline] Pre-serialization audit', {
      selectedTrackId: trackId,
      selectedTrackDetectionCount,
      mergedTrackIds: fragmentReconnectReport?.mergedTrackIds ?? (trackId ? [trackId] : []),
      confirmedSampleCount,
      refinedSampleCount,
      firstFiveSamples: [...keyframes]
        .sort((a, b) => a.timestampMs - b.timestampMs)
        .slice(0, 5)
        .map((k) => ({
          timestampMs: k.timestampMs,
          trackId: k.trackId,
          state: k.state,
          confidence: k.confidence,
          box: k.box,
          coordinateSource: k.coordinateSource,
        })),
    });

    keyframes = expandToFullClipTimeline({
      sparseKeyframes: keyframes,
      videoDurationMs: totalDurationMs,
      fps: trackingFps,
      trackId,
    });

    await timeStage('timeline_serialization', async () => {
      emitPartialKeyframes(keyframes, onPartialKeyframes);
    });

    if (keyframes.length === 0 || !trackId) {
      throw new Error(FAILURE_MESSAGE);
    }

    const detectionCount = detections.length;
    const reliability = assessTimelineReliability({
      keyframes,
      videoDurationMs: totalDurationMs,
      fps: trackingFps,
      identityScore: identityScoreFinal,
      identityFromTapContainment,
    });
    const reliable = reliability.reliable;
    const coverageMetrics = reliability.metrics;

    assertTimelineSerialization({
      keyframes,
      selectedTrackDetectionCount,
      metrics: coverageMetrics,
    });

    console.log('[TrackingPipeline] Coverage validation', {
      jobId,
      videoDurationMs: coverageMetrics.videoDurationMs,
      firstKeyframeMs: coverageMetrics.firstKeyframeMs,
      lastKeyframeMs: coverageMetrics.lastKeyframeMs,
      confirmedDurationMs: coverageMetrics.confirmedDurationMs,
      confirmedCoverageRatio: coverageMetrics.confirmedCoverageRatio,
      lostDurationMs: coverageMetrics.lostDurationMs,
      reliable,
      reliabilityReasons: reliability.reasons,
    });

    console.log('[TrackingPipeline] Identity result', {
      jobId,
      selectedTrackId: trackId,
      identityScore: identityScoreFinal,
      identityFromTapContainment,
      keyframesCount: keyframes.length,
      reliable,
      confirmedFrames: keyframes.filter((k) => k.state === 'CONFIRMED').length,
      lostFrames: coverageMetrics.lostFrames,
      lostIntervalsCount: coverageMetrics.lostIntervalsCount,
    });

    const intervals = buildIntervalsFromFullClipKeyframes(keyframes);
    const identityConfidence =
      playerSelection.identityProfile?.identityConfidence ??
      (playerSelection.reducedTrackingConfidence ? 'LOW' : 'HIGH');

    const timeline: TrackingTimelineResult = {
      sourceWidth,
      sourceHeight,
      fps: trackingFps,
      selectedTrackId: trackId,
      reliable,
      failureMessage: reliable ? undefined : FAILURE_MESSAGE,
      detectionsPerFrame: detectionCount / Math.max(1, frames.length),
      trackedFrameCount: keyframes.length,
      keyframes,
    };

    const playerTracking: PlayerTrackingData = {
      keyframes: toPlayerKeyframes(keyframes),
      userCorrections: [],
      previewAccepted: false,
      identityConfidence: reliable ? identityConfidence : 'LOW',
      sourceWidth,
      sourceHeight,
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

    const slowest = summarizeStageTimings(jobId);
    const totalMs = Date.now() - pipelineStarted;

    console.log('[TrackingPipeline] Complete', {
      jobId,
      totalDurationMs: totalMs,
      slowestStage: slowest?.stage,
      slowestStageMs: slowest?.durationMs,
      frameCount: frames.length,
      detectionCount,
      trackCount: objectTracks.length,
      selectedTrackId: trackId,
      identityScore: identityScoreFinal,
      reliable,
      keyframeCount: keyframes.length,
      refinementWindows: refinementWindows.length,
    });

    return { timeline, playerTracking };
  } finally {
    try {
      await fs.rm(tempDir, { recursive: true, force: true });
    } catch {
      // Best-effort cleanup
    }
  }
}
