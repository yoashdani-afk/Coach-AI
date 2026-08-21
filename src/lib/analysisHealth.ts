import {
  ANALYSIS_API_URL,
  analysisEndpoint,
  isAnalysisApiConfigured,
  logAnalysisApiTarget,
} from '@/lib/analysisConfig';

const HEALTH_TIMEOUT_MS = 8_000;

export async function checkAnalysisServerHealth(
  signal?: AbortSignal
): Promise<{ ok: true } | { ok: false; message: string }> {
  if (!isAnalysisApiConfigured) {
    return {
      ok: false,
      message:
        'Analysis API URL is not configured. Set EXPO_PUBLIC_ANALYSIS_API_URL to your Mac LAN IP (e.g. http://192.168.1.10:3001).',
    };
  }

  const url = analysisEndpoint('/health');
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), HEALTH_TIMEOUT_MS);

  const merged = signal
    ? (() => {
        if (signal.aborted) controller.abort();
        else signal.addEventListener('abort', () => controller.abort(), { once: true });
        return controller.signal;
      })()
    : controller.signal;

  try {
    logAnalysisApiTarget('GET', '/health');
    console.log('[TrackingBuild] Health check start', { url });

    const response = await fetch(url, { method: 'GET', signal: merged });
    const bodyText = await response.text();

    console.log('[TrackingBuild] Health check response', {
      url,
      status: response.status,
      body: bodyText.slice(0, 200),
    });

    if (!response.ok) {
      return { ok: false, message: `Analysis server health check failed (${response.status}).` };
    }

    let parsed: unknown;
    try {
      parsed = JSON.parse(bodyText);
    } catch {
      return { ok: false, message: 'Analysis server returned a non-JSON health response.' };
    }

    if (!parsed || typeof parsed !== 'object' || (parsed as { ok?: boolean }).ok !== true) {
      return { ok: false, message: 'Analysis server health check did not return ok: true.' };
    }

    return { ok: true };
  } catch (error) {
    const message =
      error instanceof Error && error.name === 'AbortError'
        ? 'Analysis server health check timed out.'
        : 'Cannot connect to the analysis server.';

    console.warn('[TrackingBuild] Health check failed', {
      url,
      message: error instanceof Error ? error.message : String(error),
    });
    return { ok: false, message };
  } finally {
    clearTimeout(timeout);
  }
}

export function getConfiguredAnalysisApiUrl(): string {
  return ANALYSIS_API_URL;
}
