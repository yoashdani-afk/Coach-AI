import type { Request, Response } from 'express';
import { trackPlayerPreviewWithGemini } from '../lib/trackPlayerPreview.js';
import { cancelTrackingJob, createTrackingJobId, registerTrackingJob, releaseTrackingJob } from '../lib/tracking/jobRegistry.js';
import { clearConfirmationsForJob, resolveConfirmation } from '../lib/tracking/confirmationRegistry.js';
import type { AnalysisRequestMetadata } from '../lib/types.js';
import type { TrackingPipelineProgress } from '../lib/tracking/types.js';

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

function writeProgress(res: Response, progress: TrackingPipelineProgress): void {
  res.write(`${JSON.stringify({ type: 'progress', ...progress })}\n`);
}

interface JobLifecycle {
  uploadCompleted: boolean;
  responseCompleted: boolean;
  clientAborted: boolean;
  jobCancelled: boolean;
}

/**
 * POST /api/track-player-preview
 *
 * Streams NDJSON progress events, then a final result line.
 * Accept ?stream=0 for legacy JSON-only response.
 */
export async function handleTrackPlayerPreview(req: Request, res: Response): Promise<void> {
  const jobId =
    (typeof req.headers['x-tracking-job-id'] === 'string' && req.headers['x-tracking-job-id']) ||
    createTrackingJobId();

  const jobSignal = registerTrackingJob(jobId);
  const lifecycle: JobLifecycle = {
    uploadCompleted: false,
    responseCompleted: false,
    clientAborted: false,
    jobCancelled: false,
  };

  const cancelJob = (reason: string): void => {
    if (lifecycle.jobCancelled || lifecycle.responseCompleted) return;
    lifecycle.jobCancelled = true;
    console.log('[TrackingPreview] Cancelling job', {
      jobId,
      reason,
      uploadCompleted: lifecycle.uploadCompleted,
      responseCompleted: lifecycle.responseCompleted,
      clientAborted: lifecycle.clientAborted,
      writableEnded: res.writableEnded,
    });
    cancelTrackingJob(jobId, reason);
  };

  const onReqAborted = (): void => {
    lifecycle.clientAborted = true;
    if (lifecycle.responseCompleted) return;

    if (!lifecycle.uploadCompleted) {
      cancelJob('request_aborted_during_upload');
      return;
    }

    cancelJob('request_aborted_during_processing');
  };

  const onResFinish = (): void => {
    lifecycle.responseCompleted = true;
    console.log('[TrackingPreview] Response finished normally', { jobId });
  };

  const onResClose = (): void => {
    if (lifecycle.responseCompleted || res.writableEnded) {
      console.log('[TrackingPreview] Response socket closed after completion', {
        jobId,
        writableEnded: res.writableEnded,
      });
      return;
    }

    cancelJob('response_socket_closed_early');
    clearConfirmationsForJob(jobId);
  };

  req.on('aborted', onReqAborted);
  res.on('finish', onResFinish);
  res.on('close', onResClose);

  const cleanupListeners = (): void => {
    req.off('aborted', onReqAborted);
    res.off('finish', onResFinish);
    res.off('close', onResClose);
  };

  try {
    const file = req.file;
    if (!file?.buffer?.length) {
      res.status(400).json({ error: 'Missing video file', code: 'UPLOAD_FAILED' });
      return;
    }

    // Multer has fully received the multipart body before this handler runs.
    lifecycle.uploadCompleted = true;
    console.log('[TrackingPreview] Request upload finished normally', {
      jobId,
      bytes: file.buffer.length,
    });

    const metadataRaw = typeof req.body.metadata === 'string' ? req.body.metadata : '';
    if (!metadataRaw) {
      res.status(400).json({ error: 'Missing metadata field', code: 'UPLOAD_FAILED' });
      return;
    }

    const metadata = parseMetadata(metadataRaw);
    const useStream = req.query.stream !== '0';

    console.log('[TrackingPreview] Upload received — starting CV pipeline', {
      jobId,
      bytes: file.buffer.length,
      mimeType: file.mimetype,
      originalName: file.originalname,
      timestampMs: metadata.playerSelection.timestampMs,
      stream: useStream,
    });

    if (useStream) {
      res.setHeader('Content-Type', 'application/x-ndjson');
      res.setHeader('Cache-Control', 'no-cache');
      res.setHeader('Connection', 'keep-alive');
      res.setHeader('X-Tracking-Job-Id', jobId);
      writeProgress(res, {
        stage: 'job_accepted',
        message: 'Upload complete',
        jobId,
      });
    }

    const tracking = await trackPlayerPreviewWithGemini({
      videoBuffer: file.buffer,
      mimeType: file.mimetype || 'video/mp4',
      originalName: file.originalname || metadata.clip?.fileName || 'clip.mp4',
      metadata,
      jobId,
      signal: jobSignal,
      rebuildFromMs: metadata.playerTracking?.rebuildFromMs,
      prefixKeyframes: metadata.playerTracking?.keyframes,
      onProgress: useStream
        ? (progress) => {
            writeProgress(res, progress);
          }
        : undefined,
      onConfirmationRequired: useStream
        ? (request) => {
            res.write(`${JSON.stringify({ type: 'confirmation_required', ...request })}\n`);
          }
        : undefined,
    });

    if (useStream) {
      res.write(`${JSON.stringify({ type: 'result', tracking, jobId })}\n`);
      res.end();
      lifecycle.responseCompleted = true;
      console.log('[TrackingPreview] Response sent — tracking complete', { jobId });
      return;
    }

    res.setHeader('X-Tracking-Job-Id', jobId);
    res.json(tracking);
    lifecycle.responseCompleted = true;
    console.log('[TrackingPreview] Response sent — tracking complete', { jobId });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Tracking preview failed';
    const isCancelled = message === 'Tracking job cancelled';

    if (isCancelled) {
      console.warn('[TrackingPreview] Pipeline stopped — job cancelled', {
        jobId,
        uploadCompleted: lifecycle.uploadCompleted,
        clientAborted: lifecycle.clientAborted,
        responseCompleted: lifecycle.responseCompleted,
      });
    } else {
      console.error('[TrackingPreview] Pipeline failure', {
        jobId,
        message,
        stack: error instanceof Error ? error.stack : undefined,
      });
    }

    if (res.headersSent) {
      if (!lifecycle.responseCompleted) {
        res.write(`${JSON.stringify({ type: 'error', error: message, jobId })}\n`);
        res.end();
        lifecycle.responseCompleted = true;
      }
      return;
    }

    res.status(isCancelled ? 499 : 500).json({
      error: message,
      code: isCancelled ? 'TRACKING_CANCELLED' : 'TRACKING_PREVIEW_FAILED',
    });
    lifecycle.responseCompleted = true;
  } finally {
    cleanupListeners();
    releaseTrackingJob(jobId);
  }
}

export function handleConfirmTrackPlayerPreview(req: Request, res: Response): void {
  const jobId = req.params.jobId;
  const body = req.body as {
    checkpointId?: string;
    action?: import('../lib/tracking/confirmationRegistry.js').ConfirmationAction;
    confirmed?: boolean;
    normalizedX?: number;
    normalizedY?: number;
  };

  if (!jobId || !body.checkpointId) {
    res.status(400).json({ error: 'Missing jobId or checkpointId' });
    return;
  }

  let action = body.action;
  if (!action) {
    if (body.confirmed === true) action = 'confirm';
    else if (body.confirmed === false) action = 'reject';
    else {
      res.status(400).json({ error: 'Missing action or confirmed' });
      return;
    }
  }

  const resolved = resolveConfirmation(body.checkpointId, {
    action,
    confirmed: body.confirmed,
    normalizedX: body.normalizedX,
    normalizedY: body.normalizedY,
  });

  console.log('[TrackingPreview] Identity confirmation response', {
    jobId,
    checkpointId: body.checkpointId,
    action,
    resolved,
  });

  res.json({ ok: resolved, checkpointId: body.checkpointId });
}

export function handleCancelTrackPlayerPreview(req: Request, res: Response): void {
  const jobId = req.params.jobId;
  if (!jobId) {
    res.status(400).json({ error: 'Missing job ID' });
    return;
  }

  const cancelled = cancelTrackingJob(jobId, 'explicit_user_cancellation');
  clearConfirmationsForJob(jobId);
  console.log('[TrackingPreview] Explicit user cancellation requested', { jobId, cancelled });
  res.json({ ok: true, cancelled, jobId });
}
