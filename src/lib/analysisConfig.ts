function trimTrailingSlash(url: string): string {
  return url.replace(/\/$/, '');
}

const lanUrl = trimTrailingSlash(process.env.EXPO_PUBLIC_ANALYSIS_API_URL ?? '');
const publicUrl = trimTrailingSlash(process.env.EXPO_PUBLIC_ANALYSIS_API_PUBLIC_URL ?? '');
const usePublicBackend = process.env.EXPO_PUBLIC_ANALYSIS_USE_PUBLIC_BACKEND === 'true';

/** Resolved base URL for the analysis API — single runtime source of truth for the client. */
export const ANALYSIS_API_URL =
  usePublicBackend && publicUrl.length > 0 ? publicUrl : lanUrl;

export const isAnalysisApiConfigured = ANALYSIS_API_URL.length > 0;

export type AnalysisApiUrlMode = 'lan' | 'public' | 'unset';

export function getAnalysisApiUrlMode(): AnalysisApiUrlMode {
  if (!isAnalysisApiConfigured) return 'unset';
  return usePublicBackend && publicUrl.length > 0 ? 'public' : 'lan';
}

export function analysisEndpoint(path: string): string {
  return `${ANALYSIS_API_URL}${path.startsWith('/') ? path : `/${path}`}`;
}

/** Logs which backend URL the client will call (safe — no secrets). */
export function logAnalysisApiTarget(method: string, path: string): void {
  const url = analysisEndpoint(path);
  console.log('[Analysis] API target', {
    method,
    url,
    mode: getAnalysisApiUrlMode(),
    usePublicBackend,
    hasLanUrl: lanUrl.length > 0,
    hasPublicUrl: publicUrl.length > 0,
  });
}
