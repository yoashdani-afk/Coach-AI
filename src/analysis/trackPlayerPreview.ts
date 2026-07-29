import { toRequestMetadata, type AnalysisRequestPayload } from '@/analysis/models/AnalysisRequest';
import { analysisEndpoint, logAnalysisApiTarget } from '@/lib/analysisConfig';
import { createTrackingFromIdentityProfile } from '@/lib/identityProfile';
import type { PlayerSelection, PlayerTrackingData } from '@/types/analysis';

const TRACK_PREVIEW_PATH = '/api/track-player-preview';
const REQUEST_TIMEOUT_MS = 90_000;

function inferMimeType(fileName: string | null): string {
  const name = (fileName ?? '').toLowerCase();
  if (name.endsWith('.mov')) return 'video/quicktime';
  if (name.endsWith('.webm')) return 'video/webm';
  return 'video/mp4';
}

/** Instant local tracking from identity profile — shown before server response arrives. */
export function createInitialTrackingFromSelection(
  playerSelection: PlayerSelection,
  clipDurationMs: number
): PlayerTrackingData {
  return createTrackingFromIdentityProfile(playerSelection, clipDurationMs);
}

export async function fetchPlayerTrackingPreview(
  request: Pick<AnalysisRequestPayload, 'clip' | 'mode' | 'profile' | 'playerSelection'>
): Promise<PlayerTrackingData> {
  const metadata = toRequestMetadata({
    ...request,
    question: '',
    context: null,
  });

  const formData = new FormData();
  formData.append('metadata', JSON.stringify(metadata));
  formData.append('video', {
    uri: request.clip.uri,
    name: request.clip.fileName ?? 'clip.mp4',
    type: inferMimeType(request.clip.fileName),
  } as unknown as Blob);

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);
  const started = Date.now();

  try {
    logAnalysisApiTarget('POST', TRACK_PREVIEW_PATH);
    const response = await fetch(analysisEndpoint(TRACK_PREVIEW_PATH), {
      method: 'POST',
      body: formData,
      signal: controller.signal,
    });

    const bodyText = await response.text();
    if (!response.ok) {
      throw new Error(bodyText || 'Tracking preview request failed');
    }

    const parsed = JSON.parse(bodyText) as PlayerTrackingData;
    console.log('[TrackingPreview] Server tracking received', {
      keyframeCount: parsed.keyframes?.length ?? 0,
      durationMs: Date.now() - started,
    });
    return parsed;
  } finally {
    clearTimeout(timeout);
  }
}
