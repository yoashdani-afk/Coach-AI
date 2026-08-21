import type { Request, Response } from 'express';
import { randomUUID } from 'node:crypto';
import type { AnalysisRequestMetadata } from '../lib/types.js';
import {
  attachVideoToJob,
  cancelTrackingJobRecord,
  createTrackingJobRecord,
  getTrackingJob,
  serializeJobSnapshot,
  startTrackingJobProcessing,
} from '../lib/tracking/trackingJobStore.js';

const MAX_CLIP_DURATION_MS = 5 * 60 * 1000;

function parseMetadata(raw: string): AnalysisRequestMetadata {
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    throw new Error('Invalid metadata JSON');
  }
  if (!parsed || typeof parsed !== 'object') throw new Error('Metadata must be a JSON object');
  const m = parsed as AnalysisRequestMetadata;
  if (!m.playerSelection || typeof m.playerSelection !== 'object') {
    throw new Error('metadata.playerSelection is required');
  }
  if (m.clip?.durationMs && m.clip.durationMs > MAX_CLIP_DURATION_MS) {
    throw new Error('Clip exceeds maximum duration (5 minutes)');
  }
  return m;
}

/** POST /api/tracking/jobs — accept upload, return jobId, process asynchronously. */
export async function handleCreateTrackingJob(req: Request, res: Response): Promise<void> {
  try {
    const file = req.file;
    const metadataRaw = typeof req.body.metadata === 'string' ? req.body.metadata : '';
    if (!file?.buffer?.length || !metadataRaw) {
      res.status(400).json({ error: 'Missing video or metadata' });
      return;
    }

    const metadata = parseMetadata(metadataRaw);
    const jobId = randomUUID();

    createTrackingJobRecord({
      jobId,
      metadata,
      originalName: file.originalname || metadata.clip?.fileName || 'clip.mp4',
      mimeType: file.mimetype || 'video/mp4',
    });

    attachVideoToJob(jobId, file.buffer);

    res.status(202).json({ jobId, status: 'processing' });

    startTrackingJobProcessing(jobId);
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Failed to create tracking job';
    res.status(400).json({ error: message });
  }
}

/** GET /api/tracking/jobs/:jobId — poll status + events since cursor. */
export function handleGetTrackingJob(req: Request, res: Response): void {
  const jobId = req.params.jobId;
  const sinceEventId = Number(req.query.sinceEventId ?? 0);

  const job = getTrackingJob(jobId);
  if (!job) {
    res.status(404).json({ error: 'Job not found' });
    return;
  }

  res.json(serializeJobSnapshot(job, sinceEventId));
}

/** GET /api/tracking/jobs/:jobId/events — SSE stream. */
export function handleTrackingJobEvents(req: Request, res: Response): void {
  const jobId = req.params.jobId;
  const job = getTrackingJob(jobId);
  if (!job) {
    res.status(404).json({ error: 'Job not found' });
    return;
  }

  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Connection', 'keep-alive');

  let sinceEventId = Number(req.query.sinceEventId ?? 0);
  let closed = false;

  const sendEvents = () => {
    if (closed) return;
    const events = job.events.filter((e) => e.id > sinceEventId);
    for (const event of events) {
      res.write(`id: ${event.id}\n`);
      res.write(`event: ${event.type}\n`);
      res.write(`data: ${JSON.stringify(event.payload)}\n\n`);
      sinceEventId = event.id;
    }
    if (job.status === 'complete' || job.status === 'failed' || job.status === 'cancelled') {
      res.write(`event: done\ndata: ${JSON.stringify({ status: job.status })}\n\n`);
      res.end();
      closed = true;
      clearInterval(timer);
    }
  };

  sendEvents();
  const timer = setInterval(sendEvents, 500);

  req.on('close', () => {
    closed = true;
    clearInterval(timer);
  });
}

/** DELETE /api/tracking/jobs/:jobId */
export function handleCancelTrackingJob(req: Request, res: Response): void {
  const jobId = req.params.jobId;
  const ok = cancelTrackingJobRecord(jobId);
  res.json({ ok, jobId });
}
