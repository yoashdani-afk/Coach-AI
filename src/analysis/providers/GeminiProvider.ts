import type { AnalysisRequestPayload } from '@/analysis/models/AnalysisRequest';
import { toRequestMetadata } from '@/analysis/models/AnalysisRequest';
import {
  isAnalysisResponse,
  isInsufficientEvidenceResponse,
  type AnalyseVideoApiResponse,
  type AnalysisResponse,
} from '@/analysis/models/AnalysisResponse';
import { analysisEndpoint, logAnalysisApiTarget } from '@/lib/analysisConfig';
import {
  GeminiAnalysisError,
  parseServerErrorBody,
  PlayerGroundingError,
} from '@/lib/analysisErrors';

const ANALYSE_PATH = '/api/analyse-video';
const REQUEST_TIMEOUT_MS = 120_000;

function inferMimeType(fileName: string | null): string {
  const name = (fileName ?? '').toLowerCase();
  if (name.endsWith('.mov')) return 'video/quicktime';
  if (name.endsWith('.webm')) return 'video/webm';
  return 'video/mp4';
}

/**
 * Sends the clip and coaching context to the server-side Gemini provider.
 * The API key stays on the server — never included in this request.
 */
export async function analyseWithGemini(
  request: AnalysisRequestPayload
): Promise<AnalyseVideoApiResponse> {
  const metadata = toRequestMetadata(request);
  const formData = new FormData();

  formData.append('metadata', JSON.stringify(metadata));
  formData.append('video', {
    uri: request.clip.uri,
    name: request.clip.fileName ?? 'clip.mp4',
    type: inferMimeType(request.clip.fileName),
  } as unknown as Blob);

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);

  try {
    logAnalysisApiTarget('POST', ANALYSE_PATH);

    let response: Response;
    try {
      response = await fetch(analysisEndpoint(ANALYSE_PATH), {
        method: 'POST',
        body: formData,
        signal: controller.signal,
      });
    } catch (error) {
      if (error instanceof Error && error.name === 'AbortError') {
        throw new GeminiAnalysisError(
          'server unreachable',
          'Analysis server request timed out'
        );
      }
      throw new GeminiAnalysisError(
        'server unreachable',
        error instanceof Error ? error.message : 'Could not reach analysis server'
      );
    }

    const bodyText = await response.text();

    if (!response.ok) {
      const parsed = parseServerErrorBody(bodyText);
      if (parsed.code === 'PLAYER_GROUNDING_FAILED') {
        throw new PlayerGroundingError(parsed.message);
      }
      throw new GeminiAnalysisError(
        parsed.category ?? 'Gemini processing failed',
        parsed.message,
        parsed.code
      );
    }

    let parsed: unknown;
    try {
      parsed = JSON.parse(bodyText);
    } catch {
      throw new GeminiAnalysisError(
        'invalid Gemini response',
        'Analysis API returned non-JSON response'
      );
    }

    if (isInsufficientEvidenceResponse(parsed)) {
      console.log('[Analysis] Insufficient evidence from server', {
        requestId: parsed.requestId,
        message: parsed.message,
      });
      return parsed;
    }

    if (!isAnalysisResponse(parsed)) {
      throw new GeminiAnalysisError(
        'invalid Gemini response',
        'Analysis API returned an invalid coaching response shape'
      );
    }

    return parsed;
  } finally {
    clearTimeout(timeout);
  }
}

export const GeminiProvider = {
  analyse: analyseWithGemini,
};
