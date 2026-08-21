import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { GoogleGenAI } from '@google/genai';
import { generateCoachingFromTimeline } from './generateCoachingFromTimeline.js';
import { extractDenseFrames } from './denseFrameExtraction.js';
import { normalizeAnalysisVideo } from './normalizeAnalysisVideo.js';
import {
  extractPlayerGroundingFrames,
  logPlayerGroundingExtraction,
} from './playerFrameMarker.js';
import {
  buildInsufficientEvidenceResponse,
  COACHING_TIMELINE_RETRY_SUFFIX,
  logCoachingConsistency,
  validateCoachingAgainstFactualTimeline,
} from './coachingConsistency.js';
import {
  isVideoUnderstandingConfidentEnough,
  runVideoUnderstandingPipeline,
} from './videoUnderstandingPipeline.js';
import {
  logVideoUnderstandingCoachingSkipped,
  logVideoUnderstandingFinalStatus,
} from './videoUnderstandingLog.js';
import { ServerAnalysisError } from './analysisErrors.js';
import {
  invalidateModelCache,
  normalizeModelId,
  resolveAnalysisModel,
} from './geminiModelResolver.js';
import { isModelUnavailableError } from './geminiLogger.js';
import type {
  AnalysisRequestMetadata,
  AnalysisResponse,
  AnalyseVideoApiResponse,
  InsufficientEvidenceResponse,
} from './types.js';

const MAX_MODEL_ATTEMPTS = 8;

function getApiKey(): string {
  const key = process.env.GEMINI_API_KEY?.trim();
  if (!key || key === 'PASTE_KEY_HERE') {
    throw new ServerAnalysisError('GEMINI_API_KEY is not set on the server', 'MISSING_API_KEY');
  }
  return key;
}

/**
 * Dense timeline pipeline:
 * normalized video → dense frames → observe → verify → coaching from verified timeline.
 */
export async function analyseVideoWithDenseTimeline(params: {
  requestId: string;
  videoBuffer: Buffer;
  mimeType: string;
  originalName: string;
  metadata: AnalysisRequestMetadata;
}): Promise<AnalyseVideoApiResponse> {
  const apiKey = getApiKey();
  const tempDir = await fs.mkdtemp(path.join(os.tmpdir(), 'coach-ai-dense-'));
  const safeName = params.originalName.replace(/[^\w.-]+/g, '_') || 'clip.mp4';
  const tempPath = path.join(tempDir, safeName);
  const ai = new GoogleGenAI({ apiKey });
  const failedModels: string[] = [];
  const { requestId } = params;

  try {
    await fs.writeFile(tempPath, params.videoBuffer);

    const normalizedAnalysisVideoPath = path.join(tempDir, `normalized-${safeName}`);
    const debugMarkedFramePath = path.join(tempDir, 'grounding-marked-debug.jpg');
    const normalizedMedia = await normalizeAnalysisVideo(tempPath, normalizedAnalysisVideoPath);

    const groundingFrames = await extractPlayerGroundingFrames(
      normalizedMedia.normalizedAnalysisVideoPath,
      params.metadata.playerSelection,
      params.metadata.clip.durationMs,
      debugMarkedFramePath
    );
    logPlayerGroundingExtraction(params.metadata.playerSelection, groundingFrames);

    const referenceCropBase64 =
      groundingFrames.identityReferenceCropsBase64?.[0] ??
      groundingFrames.cleanCropBase64 ??
      groundingFrames.cleanFrameBase64;

    if (!referenceCropBase64) {
      throw new ServerAnalysisError(
        'Could not extract selected-player reference crop for event analysis',
        'GEMINI_PROCESSING_FAILED'
      );
    }

    const denseFrames = await extractDenseFrames(
      normalizedMedia.normalizedAnalysisVideoPath,
      params.metadata.clip.durationMs
    );

    if (denseFrames.frames.length === 0) {
      throw new ServerAnalysisError('Dense frame extraction produced no frames', 'GEMINI_PROCESSING_FAILED');
    }

    console.log('[Analysis] Dense timeline pipeline', {
      requestId,
      frameCount: denseFrames.frames.length,
      normalizedWidth: denseFrames.width,
      normalizedHeight: denseFrames.height,
      debugMarkedFramePath: groundingFrames.debugMarkedFramePath,
    });

    let lastError: unknown;

    while (failedModels.length < MAX_MODEL_ATTEMPTS) {
      const modelName = await resolveAnalysisModel(ai, failedModels);

      try {
        const understanding = await runVideoUnderstandingPipeline({
          requestId,
          ai,
          modelName,
          metadata: params.metadata,
          mimeType: params.mimeType,
          frames: denseFrames.frames,
          fps: denseFrames.fps,
          videoDurationMs: denseFrames.videoDurationMs,
          width: denseFrames.width,
          height: denseFrames.height,
          referenceCropBase64,
        });

        if (!isVideoUnderstandingConfidentEnough(understanding.verification)) {
          const reason = 'verification_confidence_below_threshold_or_no_verified_events';
          logVideoUnderstandingCoachingSkipped(requestId, reason);
          logVideoUnderstandingFinalStatus(requestId, 'insufficient_evidence', {
            overallConfidence: understanding.verification.overallConfidence,
            verifiedEventCount: understanding.verification.verifiedEvents.length,
            rejectedEventCount: understanding.verification.rejectedEvents.length,
            reason,
          });
          return buildInsufficientEvidenceResponse(requestId, reason);
        }

        const factual = understanding.factual;

        let coachingRetryUsed = false;

        const runCoaching = (extraInstruction = '') =>
          generateCoachingFromTimeline({
            ai,
            modelName,
            metadata: params.metadata,
            factual,
            extraInstruction,
            requestId,
          });

        let coaching = await runCoaching('');
        let consistency = validateCoachingAgainstFactualTimeline(coaching, factual);
        logCoachingConsistency(consistency, coachingRetryUsed);

        if (!consistency.passed && !coachingRetryUsed) {
          coachingRetryUsed = true;
          console.warn('[CoachingConsistency] Retrying coaching generation once', { requestId });
          coaching = await runCoaching(COACHING_TIMELINE_RETRY_SUFFIX);
          consistency = validateCoachingAgainstFactualTimeline(coaching, factual);
          logCoachingConsistency(consistency, coachingRetryUsed);
        }

        if (!consistency.passed) {
          const reason = 'coaching_narrative_inconsistent_with_verified_timeline';
          logVideoUnderstandingCoachingSkipped(requestId, reason);
          logVideoUnderstandingFinalStatus(requestId, 'insufficient_evidence', {
            overallConfidence: understanding.verification.overallConfidence,
            unsupportedActions: consistency.unsupportedActions,
            reason,
          });
          return buildInsufficientEvidenceResponse(requestId, reason);
        }

        logVideoUnderstandingFinalStatus(requestId, 'success', {
          overallConfidence: understanding.verification.overallConfidence,
          verifiedEventCount: understanding.verification.verifiedEvents.length,
          mode: params.metadata.mode,
        });

        return { ...coaching, status: 'success', requestId };
      } catch (error) {
        lastError = error;

        if (isModelUnavailableError(error)) {
          failedModels.push(normalizeModelId(modelName));
          invalidateModelCache();
          continue;
        }

        throw error;
      }
    }

    throw lastError ?? new Error('All discovered Gemini models failed');
  } catch (error) {
    logVideoUnderstandingFinalStatus(requestId, 'error', {
      message: error instanceof Error ? error.message : String(error),
    });
    throw error;
  } finally {
    await fs.rm(tempDir, { recursive: true, force: true }).catch(() => undefined);
  }
}
