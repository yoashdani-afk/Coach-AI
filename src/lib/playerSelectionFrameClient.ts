import { Platform } from 'react-native';
import {
  ANALYSIS_API_URL,
  analysisEndpoint,
  isAnalysisApiConfigured,
  logAnalysisApiTarget,
} from '@/lib/analysisConfig';

const VIDEO_FRAME_PATH = '/api/video/frame';

export type SelectionFrameOrientation = 'landscape' | 'portrait';

export interface PlayerSelectionFrameResponse {
  imageUri: string;
  width: number;
  height: number;
  orientation: SelectionFrameOrientation;
  timestampMs: number;
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

function assertReachableFromPhone(apiUrl: string): void {
  const lower = apiUrl.toLowerCase();
  if (
    lower.includes('localhost') ||
    lower.includes('127.0.0.1') ||
    lower.includes('[::1]')
  ) {
    throw new Error(
      `Analysis API URL must be your Mac LAN IP, not localhost (${apiUrl}). Update EXPO_PUBLIC_ANALYSIS_API_URL and restart Expo with --clear.`
    );
  }
}

interface VideoFrameApiResponse {
  success: boolean;
  timestampMs?: number;
  width?: number;
  height?: number;
  orientation?: SelectionFrameOrientation;
  mimeType?: string;
  imageBase64?: string;
  error?: string;
}

/** Request one display-oriented JPEG from the analysis server (ffmpeg). */
export async function requestPlayerSelectionFrame(params: {
  videoUri: string;
  fileName: string | null;
  clipDurationMs: number;
  timestampMs: number;
  signal?: AbortSignal;
}): Promise<PlayerSelectionFrameResponse> {
  if (!isAnalysisApiConfigured) {
    throw new Error(
      'Analysis server is not configured. Set EXPO_PUBLIC_ANALYSIS_API_URL to your Mac LAN IP and restart Expo with --clear.'
    );
  }

  assertReachableFromPhone(ANALYSIS_API_URL);

  const url = analysisEndpoint(VIDEO_FRAME_PATH);

  console.log('[PlayerSelection] FRAME REQUEST', {
    url,
    apiUrl: ANALYSIS_API_URL,
    timestampMs: params.timestampMs,
    videoUri: params.videoUri,
  });

  logAnalysisApiTarget('POST', VIDEO_FRAME_PATH);

  const formData = new FormData();
  formData.append(
    'metadata',
    JSON.stringify({
      timestampMs: params.timestampMs,
      clip: {
        durationMs: params.clipDurationMs,
        fileName: params.fileName,
      },
    })
  );
  if (Platform.OS === 'web') {
    // Browser FormData requires a real Blob/File — RN's { uri, name, type } descriptor is ignored.
    const videoRes = await fetch(params.videoUri, { signal: params.signal });
    if (!videoRes.ok) {
      throw new Error(`Could not read video for frame upload (${videoRes.status})`);
    }
    const videoBlob = await videoRes.blob();
    formData.append('video', videoBlob, inferFileName(params.fileName));
  } else {
    formData.append('video', {
      uri: params.videoUri,
      name: inferFileName(params.fileName),
      type: inferMimeType(params.fileName),
    } as unknown as Blob);
  }

  let res: Response;
  try {
    res = await fetch(url, {
      method: 'POST',
      body: formData,
      signal: params.signal,
    });
  } catch (error) {
    const detail = error instanceof Error ? error.message : String(error);
    throw new Error(
      `Cannot reach analysis server at ${url}. Start the server on your Mac and confirm phone + Mac are on the same Wi‑Fi. (${detail})`,
      { cause: error }
    );
  }

  let body: VideoFrameApiResponse;
  try {
    body = (await res.json()) as VideoFrameApiResponse;
  } catch (error) {
    const detail = error instanceof Error ? error.message : String(error);
    throw new Error(`Invalid JSON from analysis server (${res.status}): ${detail}`);
  }

  console.log('[PlayerSelection] FRAME RESPONSE', {
    ok: res.ok,
    success: body.success,
    width: body.width,
    height: body.height,
    orientation: body.orientation,
    status: res.status,
  });

  if (!res.ok || !body.success || !body.imageBase64 || !body.width || !body.height) {
    throw new Error(body.error ?? `Frame request failed (${res.status})`);
  }

  const orientation: SelectionFrameOrientation =
    body.orientation ?? (body.width >= body.height ? 'landscape' : 'portrait');

  console.log('[PlayerSelection] FRAME READY', {
    width: body.width,
    height: body.height,
    orientation,
  });

  return {
    imageUri: `data:image/jpeg;base64,${body.imageBase64}`,
    width: body.width,
    height: body.height,
    orientation,
    timestampMs: body.timestampMs ?? params.timestampMs,
  };
}
