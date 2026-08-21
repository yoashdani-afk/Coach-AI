import { toRequestMetadata, type AnalysisRequestPayload } from '@/analysis/models/AnalysisRequest';
import { analysisEndpoint, logAnalysisApiTarget } from '@/lib/analysisConfig';
import {
  normalizeTrackingKeyframe,
  normalizeTrackingResponse,
} from '@/lib/normalizeTrackingResponse';
import { logTrackingResponseSummary } from '@/lib/trackingResponseLog';
import type { PlayerTrackingData, TrackingConfirmationResponse, TrackingIdentityConfirmation, TrackingKeyframe } from '@/types/analysis';

export type TrackingJobStatus = 'queued' | 'uploading' | 'processing' | 'complete' | 'failed' | 'cancelled';

export interface TrackingJobSnapshot {
  jobId: string;
  status: TrackingJobStatus;
  processedDurationMs: number;
  totalDurationMs: number;
  partialKeyframes: TrackingKeyframe[];
  result: PlayerTrackingData | null;
  error: string | null;
  events: Array<{ id: number; type: string; payload: Record<string, unknown> }>;
  lastEventId: number;
}

export async function submitTrackingJobConfirmation(
  jobId: string,
  checkpointId: string,
  response: TrackingConfirmationResponse
): Promise<void> {
  const url = analysisEndpoint(`/api/track-player-preview/${jobId}/confirm`);
  console.log('[TrackingJob] Submitting second-reference confirmation', {
    jobId,
    checkpointId,
    action: response.action,
    normalizedX: response.normalizedX,
    normalizedY: response.normalizedY,
    receivedAt: Date.now(),
  });
  const res = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ checkpointId, ...response }),
  });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(text || 'Confirmation request failed');
  }
  console.log('[TrackingJob] Second-reference acknowledgement', { jobId, checkpointId, ok: true });
}

export function parseConfirmationEvent(
  event: TrackingJobSnapshot['events'][number]
): TrackingIdentityConfirmation | null {
  const payload = event.payload;
  if (payload.type !== 'confirmation_required' || typeof payload.checkpointId !== 'string') {
    return null;
  }
  return {
    kind: (payload.kind as TrackingIdentityConfirmation['kind']) ?? 'second_reference',
    checkpointId: payload.checkpointId,
    jobId: String(payload.jobId ?? ''),
    timestampMs: typeof payload.timestampMs === 'number' ? payload.timestampMs : undefined,
    box: payload.box as TrackingIdentityConfirmation['box'],
    qualityScore: typeof payload.qualityScore === 'number' ? payload.qualityScore : undefined,
    anchorTimestampMs:
      typeof payload.anchorTimestampMs === 'number' ? payload.anchorTimestampMs : undefined,
  };
}

export interface TrackingJobPollCallbacks {
  onSnapshot: (snapshot: TrackingJobSnapshot) => void;
  onStall?: () => void;
  onReconnect?: () => void;
  onConfirmationRequired?: (confirmation: TrackingIdentityConfirmation) => void;
  /** When true, stall detection is paused (awaiting user tap). */
  isAwaitingConfirmation?: () => boolean;
}

const POLL_MS = 450;
const STALL_MS = 15_000;

function normalizePartialKeyframes(raw: TrackingKeyframe[]): TrackingKeyframe[] {
  return raw
    .map((item) => normalizeTrackingKeyframe(item))
    .filter((item): item is TrackingKeyframe => item != null);
}

/** Extract tracking from poll snapshot — handles result, complete events, and partial fallback. */
export function extractTrackingFromSnapshot(snapshot: TrackingJobSnapshot): PlayerTrackingData | null {
  let tracking = snapshot.result ? normalizeTrackingResponse(snapshot.result) : null;

  if (snapshot.status === 'complete') {
    for (const event of snapshot.events) {
      if (event.type === 'complete') {
        const fromEvent = normalizeTrackingResponse(event.payload.tracking ?? event.payload.result);
        if (fromEvent && fromEvent.keyframes.length > (tracking?.keyframes.length ?? 0)) {
          tracking = fromEvent;
        }
      }
      if (event.type === 'keyframes' && Array.isArray(event.payload.keyframes)) {
        const partial = normalizePartialKeyframes(event.payload.keyframes as TrackingKeyframe[]);
        if (partial.length > (tracking?.keyframes.length ?? 0)) {
          tracking = normalizeTrackingResponse({
            ...(tracking ?? snapshot.result ?? {}),
            keyframes: partial,
          });
        }
      }
    }

    if ((!tracking || tracking.keyframes.length === 0) && snapshot.partialKeyframes.length > 0) {
      const partial = normalizePartialKeyframes(snapshot.partialKeyframes);
      tracking = normalizeTrackingResponse({
        ...(tracking ?? snapshot.result ?? {}),
        keyframes: partial,
      });
    }
  }

  return tracking;
}

function normalizeSnapshot(raw: TrackingJobSnapshot): TrackingJobSnapshot {
  const partialKeyframes = normalizePartialKeyframes(raw.partialKeyframes ?? []);
  const tracking = extractTrackingFromSnapshot({ ...raw, partialKeyframes });

  const normalized: TrackingJobSnapshot = {
    ...raw,
    partialKeyframes,
    result: tracking,
  };

  if (raw.status === 'complete' || raw.status === 'failed') {
    logTrackingResponseSummary(normalized, tracking);
  }

  return normalized;
}

function inferMimeType(fileName: string | null): string {
  const name = (fileName ?? '').toLowerCase();
  if (name.endsWith('.mov')) return 'video/quicktime';
  if (name.endsWith('.webm')) return 'video/webm';
  return 'video/mp4';
}

function inferFileName(fileName: string | null): string {
  if (fileName && fileName.trim().length > 0) return fileName;
  return 'clip.mp4';
}

export async function createTrackingJob(
  request: Pick<AnalysisRequestPayload, 'clip' | 'mode' | 'profile' | 'playerSelection'>,
  signal?: AbortSignal
): Promise<string> {
  const url = analysisEndpoint('/api/tracking/jobs');
  const fileName = inferFileName(request.clip.fileName);
  const mimeType = inferMimeType(request.clip.fileName);
  const metadata = toRequestMetadata({ ...request, question: '', context: null });

  const formData = new FormData();
  formData.append('metadata', JSON.stringify(metadata));
  formData.append('video', {
    uri: request.clip.uri,
    name: fileName,
    type: mimeType,
  } as unknown as Blob);

  logAnalysisApiTarget('POST', '/api/tracking/jobs');

  const res = await fetch(url, { method: 'POST', body: formData, signal });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(text || `Tracking job create failed (${res.status})`);
  }

  const body = (await res.json()) as { jobId: string };
  if (!body.jobId) throw new Error('Tracking job did not return jobId');
  return body.jobId;
}

export async function fetchTrackingJobSnapshot(
  jobId: string,
  sinceEventId = 0,
  signal?: AbortSignal
): Promise<TrackingJobSnapshot> {
  const url = `${analysisEndpoint(`/api/tracking/jobs/${jobId}`)}?sinceEventId=${sinceEventId}`;
  const res = await fetch(url, { signal });
  if (!res.ok) {
    if (res.status === 404) throw new Error('Tracking job not found');
    throw new Error(`Tracking poll failed (${res.status})`);
  }
  return normalizeSnapshot((await res.json()) as TrackingJobSnapshot);
}

export async function cancelTrackingJobRemote(jobId: string): Promise<void> {
  const url = analysisEndpoint(`/api/tracking/jobs/${jobId}`);
  await fetch(url, { method: 'DELETE' });
}

export function pollTrackingJob(
  jobId: string,
  callbacks: TrackingJobPollCallbacks,
  signal?: AbortSignal
): () => void {
  let sinceEventId = 0;
  let lastProgressAt = Date.now();
  let lastProcessedMs = -1;
  let stalled = false;
  let cancelled = false;

  const tick = async () => {
    if (cancelled) return;
    try {
      const snapshot = await fetchTrackingJobSnapshot(jobId, sinceEventId, signal);
      sinceEventId = snapshot.lastEventId;
      if (
        snapshot.processedDurationMs > lastProcessedMs ||
        snapshot.status === 'complete' ||
        snapshot.status === 'failed'
      ) {
        lastProcessedMs = snapshot.processedDurationMs;
        lastProgressAt = Date.now();
        if (stalled) {
          stalled = false;
          callbacks.onReconnect?.();
        }
      }

      for (const event of snapshot.events) {
        const confirmation = parseConfirmationEvent(event);
        if (confirmation) {
          lastProgressAt = Date.now();
          console.log('[TrackingJob] confirmation_required received', {
            jobId: snapshot.jobId,
            eventType: event.type,
            reason: confirmation.kind,
            requestedTimestampMs: confirmation.timestampMs ?? null,
            receivedAt: Date.now(),
            checkpointId: confirmation.checkpointId,
          });
          callbacks.onConfirmationRequired?.(confirmation);
        }
      }

      callbacks.onSnapshot(snapshot);
      if (
        snapshot.status === 'complete' ||
        snapshot.status === 'failed' ||
        snapshot.status === 'cancelled'
      ) {
        cancelled = true;
        clearInterval(pollTimer);
        clearInterval(stallTimer);
      }
    } catch (error) {
      if (signal?.aborted) return;
      console.warn('[TrackingJob] Poll error — will retry', {
        jobId,
        message: error instanceof Error ? error.message : String(error),
      });
    }
  };

  const pollTimer = setInterval(() => {
    void tick();
  }, POLL_MS);

  const stallTimer = setInterval(() => {
    if (cancelled) return;
    if (callbacks.isAwaitingConfirmation?.()) {
      lastProgressAt = Date.now();
      return;
    }
    if (Date.now() - lastProgressAt >= STALL_MS) {
      if (!stalled) {
        stalled = true;
        callbacks.onStall?.();
      }
    }
  }, 1_000);

  void tick();

  return () => {
    cancelled = true;
    clearInterval(pollTimer);
    clearInterval(stallTimer);
  };
}

export function formatTrackingSeconds(ms: number): string {
  return `${Math.max(0, Math.round(ms / 1000))}s`;
}
