import type { Request, Response } from 'express';
import { trackPlayerPreviewWithGemini } from '../lib/trackPlayerPreview.js';
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
 * POST /api/track-player-preview
 *
 * Returns keyframes + intervals for the tracking confirmation UI.
 */
export async function handleTrackPlayerPreview(req: Request, res: Response): Promise<void> {
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

    console.log('[TrackingPreview] Starting player tracking preview', {
      bytes: file.buffer.length,
      timestampMs: metadata.playerSelection.timestampMs,
    });

    const tracking = await trackPlayerPreviewWithGemini({
      videoBuffer: file.buffer,
      mimeType: file.mimetype || 'video/mp4',
      originalName: file.originalname || metadata.clip?.fileName || 'clip.mp4',
      metadata,
    });

    res.json(tracking);
  } catch (error) {
    console.error('[track-player-preview]', error);
    const message = error instanceof Error ? error.message : 'Tracking preview failed';
    res.status(500).json({ error: message, code: 'TRACKING_PREVIEW_FAILED' });
  }
}
