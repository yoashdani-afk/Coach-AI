import type { Request, Response } from 'express';
import { ApiError } from '@google/genai';
import { analyseVideoWithGemini } from '../lib/geminiProvider.js';
import { isServerAnalysisError } from '../lib/analysisErrors.js';
import { createAnalysisRequestId } from '../lib/analysisRequestId.js';
import { isInsufficientEvidenceResponse } from '../lib/types.js';
import type { AnalysisRequestMetadata } from '../lib/types.js';

const MAX_CLIP_DURATION_MS = 5 * 60 * 1000;

function parseMetadata(raw: string): AnalysisRequestMetadata {
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    throw new Error('Invalid metadata JSON');
  }

  if (!parsed || typeof parsed !== 'object') {
    throw new Error('Metadata must be a JSON object');
  }

  const m = parsed as AnalysisRequestMetadata;

  if (!m.mode || !['COACH_ME', 'PERFORMANCE', 'GOAL'].includes(m.mode)) {
    throw new Error('metadata.mode must be COACH_ME, PERFORMANCE, or GOAL');
  }
  if (!m.playerSelection || typeof m.playerSelection !== 'object') {
    throw new Error('metadata.playerSelection is required');
  }
  if (!m.profile || typeof m.profile !== 'object') {
    throw new Error('metadata.profile is required');
  }
  if (m.mode === 'COACH_ME' && !m.question?.trim()) {
    throw new Error('metadata.question is required for COACH_ME mode');
  }
  if (m.clip?.durationMs && m.clip.durationMs > MAX_CLIP_DURATION_MS) {
    throw new Error('Clip exceeds maximum duration for v1 analysis (5 minutes)');
  }

  return m;
}

function respondWithError(res: Response, status: number, error: string, code?: string): void {
  res.status(status).json(code ? { error, code } : { error });
}

/**
 * POST /api/analyse-video
 *
 * multipart/form-data:
 * - video: video file
 * - metadata: JSON string (AnalysisRequestMetadata)
 *
 * Reads GEMINI_API_KEY from server environment — never from the client.
 */
export async function handleAnalyseVideo(req: Request, res: Response): Promise<void> {
  try {
    const file = req.file;
    if (!file?.buffer?.length) {
      respondWithError(res, 400, 'Missing video file', 'UPLOAD_FAILED');
      return;
    }

    const metadataRaw = typeof req.body.metadata === 'string' ? req.body.metadata : '';
    if (!metadataRaw) {
      respondWithError(res, 400, 'Missing metadata field', 'UPLOAD_FAILED');
      return;
    }

    const metadata = parseMetadata(metadataRaw);
    const requestId = createAnalysisRequestId();

    console.log('[Analysis] Video uploaded successfully', {
      requestId,
      bytes: file.buffer.length,
      mode: metadata.mode,
      pipeline: process.env.ANALYSIS_PIPELINE?.trim() || 'dense_timeline',
      /** Client-reported clip duration — compare across re-uploads of the "same" clip. */
      clipDurationMs: metadata.clip?.durationMs ?? null,
    });

    // TODO: future — crop/extract frames around playerSelection.timestampMs
    // TODO: future — run player tracking model using normalized tap coordinates
    // TODO: future — ball tracking to validate passing/shooting claims

    const analysis = await analyseVideoWithGemini({
      requestId,
      videoBuffer: file.buffer,
      mimeType: file.mimetype || 'video/mp4',
      originalName: file.originalname || metadata.clip.fileName || 'clip.mp4',
      metadata,
    });

    if (isInsufficientEvidenceResponse(analysis)) {
      console.log('[Analysis] Insufficient evidence — no report generated', {
        requestId: analysis.requestId,
        reason: analysis.reason,
      });
      res.json(analysis);
      return;
    }

    console.log('[Analysis] Gemini response received', { mode: metadata.mode, requestId });

    res.json(analysis);
  } catch (error) {
    console.error('[analyse-video]', error);

    if (isServerAnalysisError(error)) {
      const status =
        error.code === 'UPLOAD_FAILED'
          ? 400
          : error.code === 'PLAYER_GROUNDING_FAILED'
            ? 422
            : 500;
      respondWithError(res, status, error.message, error.code);
      return;
    }

    if (error instanceof ApiError) {
      respondWithError(res, error.status, error.message, 'GEMINI_PROCESSING_FAILED');
      return;
    }

    const message = error instanceof Error ? error.message : 'Analysis failed';
    if (message.includes('metadata') || message.includes('Metadata')) {
      respondWithError(res, 400, message, 'UPLOAD_FAILED');
      return;
    }

    respondWithError(res, 500, message, 'GEMINI_PROCESSING_FAILED');
  }
}
