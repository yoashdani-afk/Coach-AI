import type { Request, Response } from 'express';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import {
  extractPlayerGroundingFrames,
  logPlayerGroundingExtraction,
} from '../lib/playerFrameMarker.js';
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

  if (!m.playerSelection || typeof m.playerSelection !== 'object') {
    throw new Error('metadata.playerSelection is required');
  }
  if (m.clip?.durationMs && m.clip.durationMs > MAX_CLIP_DURATION_MS) {
    throw new Error('Clip exceeds maximum duration for v1 analysis (5 minutes)');
  }

  return m;
}

/**
 * POST /api/debug-player-frame
 *
 * Dev-only frame extraction preview — returns clean + marked frames and pixel coords.
 */
export async function handleDebugPlayerFrame(req: Request, res: Response): Promise<void> {
  if (process.env.NODE_ENV === 'production') {
    res.status(404).json({ error: 'Not found' });
    return;
  }

  try {
    const file = req.file;
    if (!file?.buffer?.length) {
      res.status(400).json({ error: 'Missing video file', code: 'UPLOAD_FAILED' });
      return;
    }

    const metadataRaw = typeof req.body.metadata === 'string' ? req.body.metadata : '';
    if (!metadataRaw) {
      res.status(400).json({ error: 'Missing metadata field', code: 'UPLOAD_FAILED' });
      return;
    }

    const metadata = parseMetadata(metadataRaw);
    const tempDir = await fs.mkdtemp(path.join(os.tmpdir(), 'coach-ai-debug-'));
    const safeName = (file.originalname || metadata.clip?.fileName || 'clip.mp4').replace(
      /[^\w.-]+/g,
      '_'
    );
    const tempPath = path.join(tempDir, safeName);

    try {
      await fs.writeFile(tempPath, file.buffer);

      const result = await extractPlayerGroundingFrames(
        tempPath,
        metadata.playerSelection,
        metadata.clip.durationMs
      );
      logPlayerGroundingExtraction(metadata.playerSelection, result);

      res.json({
        success: result.success,
        timestampMs: result.timestampMs,
        tapNormalizedX: result.tapNormalizedX,
        tapNormalizedY: result.tapNormalizedY,
        frameWidth: result.frameWidth,
        frameHeight: result.frameHeight,
        markerPixelX: result.markerPixelX,
        markerPixelY: result.markerPixelY,
        clampedNormalizedX: result.clampedNormalizedX,
        clampedNormalizedY: result.clampedNormalizedY,
        frameIsDisplayOriented: result.frameIsDisplayOriented,
        geometry: result.geometry,
        cleanFrameBase64: result.cleanFrameBase64,
        markedFrameBase64: result.markedFrameBase64,
        cleanCropBase64: result.cleanCropBase64,
        nearbyCropBase64: result.nearbyCropBase64,
        mimeType: result.mimeType,
        error: result.error,
      });
    } finally {
      await fs.rm(tempDir, { recursive: true, force: true });
    }
  } catch (error) {
    console.error('[debug-player-frame]', error);
    const message = error instanceof Error ? error.message : 'Debug frame extraction failed';
    res.status(500).json({ error: message });
  }
}
