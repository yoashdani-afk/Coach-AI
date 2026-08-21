import { getTrackerServiceUrl } from './trackingEngine.js';

export interface BotsortTrackRequest {
  videoPath: string;
  referenceTimestampMs: number;
  normalizedTapX: number;
  normalizedTapY: number;
  clipDurationMs: number;
  jobId?: string;
}

export interface BotsortObservation {
  timestampMs: number;
  trackId: string;
  confidence: number;
  box: { x: number; y: number; width: number; height: number };
  state: 'CONFIRMED';
  coordinateSource: 'detection';
}

export interface BotsortTrackResponse {
  selectedTrackId: string;
  sourceWidth: number;
  sourceHeight: number;
  fps: number;
  observations: BotsortObservation[];
  lostIntervals: Array<{ startMs: number; endMs: number }>;
  stats: {
    selectedTrackId: string;
    totalFrames: number;
    framesWithSelectedPlayer: number;
    lostFrames: number;
    identitySwitches: number;
    coverageRatio: number;
  };
  debugVideoPath?: string | null;
}

export async function callBotsortTracker(payload: BotsortTrackRequest): Promise<BotsortTrackResponse> {
  const baseUrl = getTrackerServiceUrl();
  const response = await fetch(`${baseUrl}/track`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      videoPath: payload.videoPath,
      referenceTimestampMs: payload.referenceTimestampMs,
      normalizedTapX: payload.normalizedTapX,
      normalizedTapY: payload.normalizedTapY,
      clipDurationMs: payload.clipDurationMs,
      jobId: payload.jobId,
    }),
  });

  const body = (await response.json()) as BotsortTrackResponse & { error?: string };
  if (!response.ok) {
    throw new Error(body.error ?? `BoT-SORT tracker HTTP ${response.status}`);
  }

  return body;
}

export async function pingBotsortTracker(): Promise<boolean> {
  try {
    const response = await fetch(`${getTrackerServiceUrl()}/health`, { method: 'GET' });
    return response.ok;
  } catch {
    return false;
  }
}
