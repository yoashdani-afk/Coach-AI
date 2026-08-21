import type { AnalysisRequestMetadata, PlayerTrackingData } from '../types.js';
import type { TrackingPipelineProgress } from './types.js';
import type { ConfirmationRequest } from './confirmationRegistry.js';
import { trackPlayerPreviewWithGemini } from '../trackPlayerPreview.js';

export type TrackingJobStatus = 'queued' | 'uploading' | 'processing' | 'complete' | 'failed' | 'cancelled';

export interface TrackingJobEvent {
  id: number;
  type: 'progress' | 'keyframes' | 'complete' | 'error';
  payload: Record<string, unknown>;
}

export interface TrackingJobRecord {
  id: string;
  status: TrackingJobStatus;
  metadata: AnalysisRequestMetadata;
  videoBuffer: Buffer | null;
  originalName: string;
  mimeType: string;
  events: TrackingJobEvent[];
  partialKeyframes: PlayerTrackingData['keyframes'];
  processedDurationMs: number;
  totalDurationMs: number;
  result: PlayerTrackingData | null;
  error: string | null;
  createdAt: number;
  updatedAt: number;
}

const jobs = new Map<string, TrackingJobRecord>();
const abortControllers = new Map<string, AbortController>();
let nextEventId = 1;

const JOB_TTL_MS = 30 * 60 * 1000;

function pruneOldJobs(): void {
  const cutoff = Date.now() - JOB_TTL_MS;
  for (const [id, job] of jobs.entries()) {
    if (job.updatedAt < cutoff && (job.status === 'complete' || job.status === 'failed' || job.status === 'cancelled')) {
      jobs.delete(id);
      abortControllers.delete(id);
    }
  }
}

function pushEvent(job: TrackingJobRecord, type: TrackingJobEvent['type'], payload: Record<string, unknown>): TrackingJobEvent {
  const event: TrackingJobEvent = { id: nextEventId++, type, payload };
  job.events.push(event);
  job.updatedAt = Date.now();
  if (job.events.length > 500) job.events.splice(0, job.events.length - 500);
  return event;
}

export function createTrackingJobRecord(params: {
  jobId: string;
  metadata: AnalysisRequestMetadata;
  originalName: string;
  mimeType: string;
}): TrackingJobRecord {
  pruneOldJobs();
  const job: TrackingJobRecord = {
    id: params.jobId,
    status: 'queued',
    metadata: params.metadata,
    videoBuffer: null,
    originalName: params.originalName,
    mimeType: params.mimeType,
    events: [],
    partialKeyframes: [],
    processedDurationMs: 0,
    totalDurationMs: params.metadata.clip?.durationMs ?? 0,
    result: null,
    error: null,
    createdAt: Date.now(),
    updatedAt: Date.now(),
  };
  jobs.set(params.jobId, job);
  return job;
}

export function getTrackingJob(jobId: string): TrackingJobRecord | undefined {
  return jobs.get(jobId);
}

export function attachVideoToJob(jobId: string, videoBuffer: Buffer): TrackingJobRecord | undefined {
  const job = jobs.get(jobId);
  if (!job) return undefined;
  job.videoBuffer = videoBuffer;
  job.status = 'uploading';
  job.updatedAt = Date.now();
  return job;
}

export function cancelTrackingJobRecord(jobId: string): boolean {
  const controller = abortControllers.get(jobId);
  const job = jobs.get(jobId);
  if (!job) return false;
  if (controller) controller.abort();
  if (job.status !== 'complete' && job.status !== 'failed') {
    job.status = 'cancelled';
    pushEvent(job, 'error', { message: 'Tracking job cancelled' });
  }
  job.updatedAt = Date.now();
  return true;
}

export function getJobEventsSince(jobId: string, sinceEventId: number): TrackingJobEvent[] {
  const job = jobs.get(jobId);
  if (!job) return [];
  return job.events.filter((e) => e.id > sinceEventId);
}

export function startTrackingJobProcessing(jobId: string): void {
  const job = jobs.get(jobId);
  if (!job || !job.videoBuffer) return;

  const controller = new AbortController();
  abortControllers.set(jobId, controller);

  job.status = 'processing';
  job.updatedAt = Date.now();
  pushEvent(job, 'progress', {
    stage: 'job_accepted',
    message: 'Processing started',
    processedDurationMs: 0,
    totalDurationMs: job.totalDurationMs,
  });

  void (async () => {
    try {
      const result = await trackPlayerPreviewWithGemini({
        videoBuffer: job.videoBuffer!,
        mimeType: job.mimeType,
        originalName: job.originalName,
        metadata: job.metadata,
        jobId,
        signal: controller.signal,
        onProgress: (progress: TrackingPipelineProgress) => {
          if (job.status === 'cancelled') return;
          job.processedDurationMs = progress.processedDurationMs ?? job.processedDurationMs;
          if (progress.totalDurationMs != null) job.totalDurationMs = progress.totalDurationMs;
          pushEvent(job, 'progress', { ...progress });
        },
        onPartialKeyframes: (keyframes, processedUpToMs) => {
          if (job.status === 'cancelled') return;
          job.partialKeyframes = keyframes;
          job.processedDurationMs = processedUpToMs;
          pushEvent(job, 'keyframes', { keyframes, processedUpToMs });
        },
        onConfirmationRequired: (request: ConfirmationRequest) => {
          if (job.status === 'cancelled') return;
          pushEvent(job, 'progress', { type: 'confirmation_required', ...request });
        },
      });

      if (job.status === 'cancelled') return;

      if (!result.keyframes?.length) {
        throw new Error(
          result.failureMessage ??
            "We couldn't reliably follow you throughout this clip. Try retapping yourself on a clearer moment."
        );
      }

      if (result.reliable === false) {
        console.warn('[TrackingJob] Completed with unreliable tracking', {
          jobId,
          coverageRatio: result.coverageRatio,
          failureMessage: result.failureMessage,
        });
      }

      job.result = result;
      job.partialKeyframes = result.keyframes;
      job.processedDurationMs = job.totalDurationMs;
      job.status = 'complete';
      job.updatedAt = Date.now();
      console.log('[TrackingJob] Complete summary', {
        jobId,
        status: job.status,
        selectedTrackId: result.selectedTrackId ?? null,
        keyframesCount: result.keyframes.length,
        lostIntervalsCount: result.lostIntervals?.length ?? 0,
        confirmedIntervalsCount: result.confirmedIntervals?.length ?? 0,
        firstKeyframe: result.keyframes[0] ?? null,
        lastKeyframe: result.keyframes[result.keyframes.length - 1] ?? null,
      });
      pushEvent(job, 'complete', { tracking: result });
    } catch (error) {
      if (job.status === 'cancelled') return;
      const raw = error instanceof Error ? error.message : 'Tracking failed';
      const message = raw.startsWith('serialization_')
        ? 'Tracking finished but player positions could not be saved. Please try again.'
        : raw;
      job.status = 'failed';
      job.error = message;
      job.updatedAt = Date.now();
      pushEvent(job, 'error', { message });
      console.error('[TrackingJob] Failed', { jobId, message });
    } finally {
      abortControllers.delete(jobId);
      job.videoBuffer = null;
    }
  })();
}

export function serializeJobSnapshot(job: TrackingJobRecord, sinceEventId = 0) {
  return {
    jobId: job.id,
    status: job.status,
    processedDurationMs: job.processedDurationMs,
    totalDurationMs: job.totalDurationMs,
    partialKeyframes: job.partialKeyframes,
    result: job.result,
    error: job.error,
    events: getJobEventsSince(job.id, sinceEventId),
    lastEventId: job.events.length ? job.events[job.events.length - 1].id : 0,
  };
}
