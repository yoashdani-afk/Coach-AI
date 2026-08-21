import * as FileSystem from 'expo-file-system';
import { toRequestMetadata, type AnalysisRequestPayload } from '@/analysis/models/AnalysisRequest';
import { analysisEndpoint, logAnalysisApiTarget } from '@/lib/analysisConfig';
import type {
  PlayerTrackingData,
  TrackingBuildDebugState,
  TrackingBuildProgress,
  TrackingConfirmationResponse,
  TrackingIdentityConfirmation,
} from '@/types/analysis';

const TRACK_PREVIEW_PATH = '/api/track-player-preview';
export const UPLOAD_STALL_TIMEOUT_MS = 20_000;
export const TRACKING_JOB_TIMEOUT_MS = 90_000;

export type TrackingBuildFailureReason =
  | 'upload_stalled'
  | 'job_timeout'
  | 'cancelled'
  | 'network'
  | 'server'
  | 'health';

export class TrackingBuildError extends Error {
  readonly reason: TrackingBuildFailureReason;

  constructor(reason: TrackingBuildFailureReason, message: string) {
    super(message);
    this.name = 'TrackingBuildError';
    this.reason = reason;
  }
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

function createJobId(): string {
  if (typeof globalThis.crypto?.randomUUID === 'function') {
    return globalThis.crypto.randomUUID();
  }
  return `job-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
}

function mapBackendStage(stage: string): TrackingBuildProgress['stage'] {
  switch (stage) {
    case 'job_accepted':
      return 'job_accepted';
    case 'decoding_frames':
      return 'decoding_frames';
    case 'detecting_players':
      return 'detecting_players';
    case 'building_tracks':
      return 'building_tracks';
    case 'matching_references':
      return 'matching_references';
    case 'verifying_identity':
      return 'verifying_identity';
    case 'complete':
      return 'complete';
    case 'failed':
      return 'failed';
    default:
      return 'job_accepted';
  }
}

function stageMessage(stage: TrackingBuildProgress['stage']): string {
  switch (stage) {
    case 'checking_server':
      return 'Checking analysis server';
    case 'uploading':
      return 'Uploading video';
    case 'upload_complete':
      return 'Upload complete';
    case 'job_accepted':
      return 'Processing on server';
    case 'decoding_frames':
      return 'Decoding video frames';
    case 'detecting_players':
      return 'Detecting players';
    case 'building_tracks':
      return 'Building player tracks';
    case 'matching_references':
      return 'Matching your references';
    case 'verifying_identity':
      return 'Verifying identity';
    case 'complete':
      return 'Tracking ready';
    case 'failed':
      return 'Tracking failed';
  }
}

async function resolveFileSizeBytes(uri: string, known: number | null): Promise<number | null> {
  if (known != null && known > 0) return known;
  try {
    const info = await FileSystem.getInfoAsync(uri);
    if (info.exists && 'size' in info && typeof info.size === 'number' && info.size > 0) {
      return info.size;
    }
  } catch (error) {
    console.warn('[TrackingBuild] Could not read file size from URI', {
      uri,
      message: error instanceof Error ? error.message : String(error),
    });
  }
  return known;
}

async function validateClipUri(uri: string): Promise<void> {
  if (!uri || uri.trim().length === 0) {
    throw new TrackingBuildError('network', 'Video file URI is missing.');
  }

  try {
    const info = await FileSystem.getInfoAsync(uri);
    if (!info.exists) {
      throw new TrackingBuildError(
        'network',
        'Video file is not accessible on this device. If the clip is in iCloud, open it in Photos and wait for it to download fully.'
      );
    }
  } catch (error) {
    if (error instanceof TrackingBuildError) throw error;
    console.warn('[TrackingBuild] File existence check failed — continuing upload attempt', {
      uri,
      message: error instanceof Error ? error.message : String(error),
    });
  }
}

interface NdjsonEvent {
  type: string;
  stage?: string;
  message?: string;
  jobId?: string;
  framesDone?: number;
  framesTotal?: number;
  tracking?: PlayerTrackingData;
  error?: string;
  checkpointId?: string;
  kind?: 'identify' | 'no_clear_view';
  timestampMs?: number;
  box?: TrackingIdentityConfirmation['box'];
  qualityScore?: number;
  previewImageBase64?: string;
  anchorTimestampMs?: number;
}

function parseNdjsonLines(
  chunk: string,
  onEvent: (event: NdjsonEvent) => void
): string {
  const lines = chunk.split('\n');
  const remainder = lines.pop() ?? '';
  for (const line of lines) {
    if (!line.trim()) continue;
    try {
      onEvent(JSON.parse(line) as NdjsonEvent);
    } catch (error) {
      console.warn('[TrackingBuild] Failed to parse backend line', {
        line: line.slice(0, 200),
        message: error instanceof Error ? error.message : String(error),
      });
    }
  }
  return remainder;
}

function uploadRatio(sent: number, total: number | null): number | null {
  if (total == null || total <= 0) return null;
  return Math.min(1, sent / total);
}

function frameRatio(done?: number, total?: number): number | null {
  if (done == null || total == null || total <= 0) return null;
  return Math.min(1, done / total);
}

export interface BuildTrackingTimelineOptions {
  request: Pick<AnalysisRequestPayload, 'clip' | 'mode' | 'profile' | 'playerSelection'>;
  signal?: AbortSignal;
  onProgress?: (progress: TrackingBuildProgress) => void;
  onDebug?: (debug: TrackingBuildDebugState) => void;
  onConfirmationRequired?: (
    confirmation: TrackingIdentityConfirmation
  ) => Promise<TrackingConfirmationResponse>;
  rebuildFromTracking?: PlayerTrackingData;
  uploadStallTimeoutMs?: number;
  jobTimeoutMs?: number;
}

export async function submitTrackingConfirmation(
  jobId: string,
  checkpointId: string,
  response: TrackingConfirmationResponse
): Promise<void> {
  const url = analysisEndpoint(`/api/track-player-preview/${jobId}/confirm`);
  console.log('[TrackingBuild] Submitting identity confirmation', {
    jobId,
    checkpointId,
    action: response.action,
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
}

export async function buildTrackingTimelineWithUpload(
  options: BuildTrackingTimelineOptions
): Promise<PlayerTrackingData> {
  const {
    request,
    signal,
    onProgress,
    onDebug,
    onConfirmationRequired,
    rebuildFromTracking,
    uploadStallTimeoutMs = UPLOAD_STALL_TIMEOUT_MS,
    jobTimeoutMs = TRACKING_JOB_TIMEOUT_MS,
  } = options;

  const started = Date.now();
  const jobId = createJobId();
  const url = `${analysisEndpoint(TRACK_PREVIEW_PATH)}?stream=1`;
  const fileName = inferFileName(request.clip.fileName);
  const mimeType = inferMimeType(request.clip.fileName);
  const fileUri = request.clip.uri;

  await validateClipUri(fileUri);
  const fileSizeBytes = await resolveFileSizeBytes(fileUri, request.clip.fileSizeBytes);

  const metadata = toRequestMetadata({ ...request, question: '', context: null });
  if (rebuildFromTracking?.rebuildFromMs != null) {
    metadata.playerTracking = {
      ...rebuildFromTracking,
      keyframes: rebuildFromTracking.keyframes.filter(
        (k) => k.timestampMs < rebuildFromTracking.rebuildFromMs!
      ),
      rebuildFromMs: rebuildFromTracking.rebuildFromMs,
      previewAccepted: false,
    };
  }

  let currentStage: TrackingBuildProgress['stage'] = 'uploading';
  let uploadBytesSent = 0;
  let uploadBytesTotal: number | null = fileSizeBytes;
  let framesDone: number | undefined;
  let framesTotal: number | undefined;
  let httpStatus: number | null = null;
  let lastBackendResponse: string | null = null;
  let backendJobId: string | null = jobId;
  let lastProgressAt = Date.now();
  let xhr: XMLHttpRequest | null = null;

  const publishDebug = (errorMessage: string | null = null) => {
    onDebug?.({
      apiUrl: url,
      fileUri,
      fileName: request.clip.fileName,
      mimeType,
      fileSizeBytes,
      uploadBytesSent,
      uploadBytesTotal,
      elapsedMs: Date.now() - started,
      httpStatus,
      jobId: backendJobId,
      lastBackendResponse,
      currentStage,
      errorMessage,
    });
  };

  const publishProgress = (update: Partial<TrackingBuildProgress> & { stage: TrackingBuildProgress['stage'] }) => {
    currentStage = update.stage;
    if (update.uploadBytesSent != null) uploadBytesSent = update.uploadBytesSent;
    if (update.uploadBytesTotal !== undefined) uploadBytesTotal = update.uploadBytesTotal ?? null;
    if (update.framesDone != null) framesDone = update.framesDone;
    if (update.framesTotal != null) framesTotal = update.framesTotal;
    if (update.jobId !== undefined) backendJobId = update.jobId ?? backendJobId;

    lastProgressAt = Date.now();

    let progressRatio: number | null = null;
    if (currentStage === 'uploading') {
      progressRatio = uploadRatio(uploadBytesSent, uploadBytesTotal);
    } else if (
      currentStage === 'decoding_frames' ||
      currentStage === 'detecting_players'
    ) {
      progressRatio = frameRatio(framesDone, framesTotal);
    }

    const payload: TrackingBuildProgress = {
      stage: currentStage,
      message: update.message ?? stageMessage(currentStage),
      progressRatio,
      uploadBytesSent,
      uploadBytesTotal,
      framesDone,
      framesTotal,
      jobId: backendJobId,
    };

    onProgress?.(payload);
    publishDebug();
  };

  const cancelRemoteJob = () => {
    if (!backendJobId) return;
    const cancelUrl = analysisEndpoint(`/api/track-player-preview/${backendJobId}`);
    fetch(cancelUrl, { method: 'DELETE' }).catch((error) => {
      console.warn('[TrackingBuild] Remote cancel failed', {
        jobId: backendJobId,
        message: error instanceof Error ? error.message : String(error),
      });
    });
  };

  console.log('[TrackingBuild] Upload start', {
    jobId,
    url,
    fileUri,
    fileName,
    mimeType,
    fileSizeBytes,
    durationMs: request.clip.durationMs,
  });

  publishProgress({ stage: 'uploading', message: 'Uploading video', jobId });

  return new Promise<PlayerTrackingData>((resolve, reject) => {
    let ndjsonRemainder = '';
    let trackingResult: PlayerTrackingData | null = null;
    let settled = false;

    const fail = (error: TrackingBuildError) => {
      if (settled) return;
      settled = true;
      clearTimers();
      console.error('[TrackingBuild] Failed', {
        reason: error.reason,
        message: error.message,
        jobId: backendJobId,
        elapsedMs: Date.now() - started,
      });
      publishDebug(error.message);
      reject(error);
    };

    const succeed = (tracking: PlayerTrackingData) => {
      if (settled) return;
      settled = true;
      clearTimers();
      console.log('[TrackingBuild] Complete', {
        jobId: backendJobId,
        keyframeCount: tracking.keyframes?.length ?? 0,
        elapsedMs: Date.now() - started,
      });
      publishProgress({ stage: 'complete', message: 'Tracking ready' });
      resolve(tracking);
    };

    const stallTimer = setInterval(() => {
      if (settled) return;
      const idleMs = Date.now() - lastProgressAt;
      if (idleMs >= uploadStallTimeoutMs && currentStage === 'uploading') {
        xhr?.abort();
        cancelRemoteJob();
        fail(new TrackingBuildError('upload_stalled', 'Upload appears to be stuck.'));
      }
    }, 1_000);

    const jobTimer = setTimeout(() => {
      if (settled) return;
      xhr?.abort();
      cancelRemoteJob();
      fail(new TrackingBuildError('job_timeout', 'Tracking is taking longer than expected.'));
    }, jobTimeoutMs);

    const clearTimers = () => {
      clearInterval(stallTimer);
      clearTimeout(jobTimer);
    };

    if (signal) {
      if (signal.aborted) {
        fail(new TrackingBuildError('cancelled', 'Tracking upload cancelled.'));
        return;
      }
      signal.addEventListener(
        'abort',
        () => {
          xhr?.abort();
          cancelRemoteJob();
          fail(new TrackingBuildError('cancelled', 'Tracking upload cancelled.'));
        },
        { once: true }
      );
    }

    const formData = new FormData();
    formData.append('metadata', JSON.stringify(metadata));
    formData.append('video', {
      uri: fileUri,
      name: fileName,
      type: mimeType,
    } as unknown as Blob);

    xhr = new XMLHttpRequest();
    xhr.open('POST', url);
    xhr.setRequestHeader('X-Tracking-Job-Id', jobId);
    xhr.responseType = 'text';

    xhr.upload.onprogress = (event) => {
      if (settled) return;
      if (event.lengthComputable) {
        uploadBytesTotal = event.total;
        uploadBytesSent = event.loaded;
      } else if (event.loaded > 0) {
        uploadBytesSent = event.loaded;
      }

      console.log('[TrackingBuild] Upload progress', {
        loaded: uploadBytesSent,
        total: uploadBytesTotal,
        lengthComputable: event.lengthComputable,
      });

      publishProgress({
        stage: 'uploading',
        message: uploadBytesTotal
          ? `Uploading video (${formatBytes(uploadBytesSent)} / ${formatBytes(uploadBytesTotal)})`
          : `Uploading video (${formatBytes(uploadBytesSent)} sent)`,
      });
    };

    xhr.upload.onload = () => {
      if (settled) return;
      console.log('[TrackingBuild] Upload complete', {
        jobId,
        uploadBytesSent,
        uploadBytesTotal,
        elapsedMs: Date.now() - started,
      });
      publishProgress({ stage: 'upload_complete', message: 'Upload complete' });
    };

    let parsedResponseLength = 0;
    let confirmationChain = Promise.resolve();

    const handleBackendChunk = () => {
      if (!xhr || settled) return;
      const fullText = xhr.responseText;
      if (fullText.length <= parsedResponseLength) return;

      const chunk = fullText.slice(parsedResponseLength);
      parsedResponseLength = fullText.length;
      lastBackendResponse = fullText.slice(-400);

      ndjsonRemainder = parseNdjsonLines(ndjsonRemainder + chunk, (event) => {
        lastBackendResponse = JSON.stringify(event);
        if (event.type === 'progress' && event.stage) {
          const stage = mapBackendStage(event.stage);
          if (event.jobId) backendJobId = event.jobId;
          publishProgress({
            stage,
            message: event.message ?? stageMessage(stage),
            framesDone: event.framesDone,
            framesTotal: event.framesTotal,
            jobId: backendJobId,
          });
        } else if (event.type === 'confirmation_required' && event.checkpointId) {
          const kind = (event.kind as TrackingIdentityConfirmation['kind']) ?? 'second_reference';
          if (kind === 'second_reference' && (!event.box || event.timestampMs == null)) {
            console.warn('[TrackingBuild] Ignoring invalid second_reference event', event);
            return;
          }

          const confirmation: TrackingIdentityConfirmation = {
            kind,
            checkpointId: event.checkpointId,
            jobId: event.jobId ?? backendJobId ?? jobId,
            timestampMs: event.timestampMs,
            box: event.box,
            qualityScore: event.qualityScore,
            anchorTimestampMs: event.anchorTimestampMs,
          };

          lastProgressAt = Date.now();

          confirmationChain = confirmationChain.then(async () => {
            const response = onConfirmationRequired
              ? await onConfirmationRequired(confirmation)
              : { action: 'skip_reference' as const };
            await submitTrackingConfirmation(confirmation.jobId, confirmation.checkpointId, response);
          });
        } else if (event.type === 'result' && event.tracking) {
          trackingResult = event.tracking;
          if (event.jobId) backendJobId = event.jobId;
        } else if (event.type === 'error') {
          fail(new TrackingBuildError('server', event.error ?? 'Tracking pipeline failed'));
        }
      });
    };

    xhr.onreadystatechange = () => {
      if (!xhr || settled) return;

      if (xhr.readyState === XMLHttpRequest.HEADERS_RECEIVED) {
        httpStatus = xhr.status;
        const headerJobId = xhr.getResponseHeader('X-Tracking-Job-Id');
        if (headerJobId) backendJobId = headerJobId;
        console.log('[TrackingBuild] Server headers received', {
          status: xhr.status,
          jobId: backendJobId,
        });
      }

      if (xhr.readyState === XMLHttpRequest.LOADING || xhr.readyState === XMLHttpRequest.DONE) {
        handleBackendChunk();
      }

      if (xhr.readyState === XMLHttpRequest.DONE) {
        httpStatus = xhr.status;
        publishDebug();

        if (xhr.status === 0) {
          fail(
            new TrackingBuildError(
              'network',
              signal?.aborted
                ? 'Tracking upload cancelled.'
                : 'Network request failed before reaching the analysis server.'
            )
          );
          return;
        }

        if (xhr.status < 200 || xhr.status >= 300) {
          fail(
            new TrackingBuildError(
              'server',
              xhr.responseText?.slice(0, 300) || `Tracking request failed (${xhr.status}).`
            )
          );
          return;
        }

        if (ndjsonRemainder.trim()) {
          parseNdjsonLines(`${ndjsonRemainder}\n`, (event) => {
            if (event.type === 'result' && event.tracking) trackingResult = event.tracking;
            if (event.type === 'error') {
              fail(new TrackingBuildError('server', event.error ?? 'Tracking pipeline failed'));
            }
          });
        }

        confirmationChain
          .then(() => {
            if (!trackingResult) {
              fail(new TrackingBuildError('server', 'Tracking pipeline returned no timeline.'));
              return;
            }
            succeed(trackingResult);
          })
          .catch((error) => {
            fail(
              new TrackingBuildError(
                'server',
                error instanceof Error ? error.message : 'Tracking pipeline failed'
              )
            );
          });
      }
    };

    xhr.onerror = () => {
      fail(
        new TrackingBuildError(
          'network',
          'Network error while uploading video. Check that your phone and Mac are on the same Wi‑Fi and EXPO_PUBLIC_ANALYSIS_API_URL points to your Mac LAN IP.'
        )
      );
    };

    xhr.ontimeout = () => {
      fail(new TrackingBuildError('job_timeout', 'Tracking is taking longer than expected.'));
    };

    logAnalysisApiTarget('POST', TRACK_PREVIEW_PATH);
    console.log('[TrackingBuild] Request sent', { jobId, url });

    try {
      xhr.send(formData);
    } catch (error) {
      fail(
        new TrackingBuildError(
          'network',
          error instanceof Error ? error.message : 'Could not start video upload.'
        )
      );
    }
  });
}

function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

export function createReducedTrackingFallback(): PlayerTrackingData {
  return {
    keyframes: [],
    userCorrections: [],
    confirmedIntervals: [],
    uncertainIntervals: [],
    lostIntervals: [],
    previewAccepted: true,
    reliable: false,
    identityConfidence: 'LOW',
    failureMessage: 'Tracking confidence reduced.',
  };
}
