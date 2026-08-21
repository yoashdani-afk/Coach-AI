import type { Request, Response } from 'express';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { extractSelectionFrame } from '../lib/extractSelectionFrame.js';

const MAX_CLIP_DURATION_MS = 5 * 60 * 1000;

interface VideoFrameMetadata {
  timestampMs: number;
  clip?: {
    durationMs?: number;
    fileName?: string | null;
  };
}

function parseMetadata(raw: string): VideoFrameMetadata {
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    throw new Error('Invalid metadata JSON');
  }

  if (!parsed || typeof parsed !== 'object') {
    throw new Error('Metadata must be a JSON object');
  }

  const metadata = parsed as VideoFrameMetadata;

  if (typeof metadata.timestampMs !== 'number' || !Number.isFinite(metadata.timestampMs)) {
    throw new Error('metadata.timestampMs must be a number');
  }

  if (metadata.timestampMs < 0) {
    throw new Error('metadata.timestampMs must be >= 0');
  }

  if (metadata.clip?.durationMs && metadata.clip.durationMs > MAX_CLIP_DURATION_MS) {
    throw new Error('Clip exceeds maximum duration for v1 analysis (5 minutes)');
  }

  return metadata;
}

/**
 * POST /api/video/frame
 *
 * Extract one display-oriented JPEG at timestampMs for player selection UI.
 */
export async function handleVideoFrame(req: Request, res: Response): Promise<void> {
  try {
    const file = req.file;
    if (!file?.buffer?.length) {
      res.status(400).json({ success: false, error: 'Missing video file', code: 'UPLOAD_FAILED' });
      return;
    }

    const metadataRaw = typeof req.body.metadata === 'string' ? req.body.metadata : '';
    if (!metadataRaw) {
      res.status(400).json({ success: false, error: 'Missing metadata field', code: 'UPLOAD_FAILED' });
      return;
    }

    const metadata = parseMetadata(metadataRaw);
    const fileName = file.originalname || metadata.clip?.fileName || 'clip.mp4';

    console.log('[video-frame] REQUEST RECEIVED', {
      fileName,
      bytes: file.buffer.length,
      timestampMs: metadata.timestampMs,
    });
    const tempDir = await fs.mkdtemp(path.join(os.tmpdir(), 'coach-ai-frame-'));
    const safeName = (file.originalname || metadata.clip?.fileName || 'clip.mp4').replace(
      /[^\w.-]+/g,
      '_'
    );
    const tempPath = path.join(tempDir, safeName);

    try {
      await fs.writeFile(tempPath, file.buffer);

      const result = await extractSelectionFrame(tempPath, metadata.timestampMs);

      if (!result.success || !result.jpeg || !result.width || !result.height) {
        console.error('[video-frame] ERROR', {
          message: result.error ?? 'Could not extract frame',
          timestampMs: result.timestampMs,
        });
        res.status(422).json({
          success: false,
          error: result.error ?? 'Could not extract frame',
          timestampMs: result.timestampMs,
        });
        return;
      }

      console.log('[video-frame] RESPONSE', {
        width: result.width,
        height: result.height,
        orientation: result.orientation,
        bytes: result.jpeg.length,
      });

      res.json({
        success: true,
        timestampMs: result.timestampMs,
        width: result.width,
        height: result.height,
        orientation: result.orientation,
        mimeType: 'image/jpeg',
        imageBase64: result.jpeg.toString('base64'),
      });
    } finally {
      await fs.rm(tempDir, { recursive: true, force: true });
    }
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Frame extraction failed';
    console.error('[video-frame] ERROR', {
      message,
      stack: error instanceof Error ? error.stack : undefined,
    });
    res.status(500).json({ success: false, error: message });
  }
}
