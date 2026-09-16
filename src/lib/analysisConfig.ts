import { Platform } from 'react-native';
import Constants from 'expo-constants';

function trimTrailingSlash(url: string): string {
  return url.replace(/\/$/, '');
}

const envLanUrl = trimTrailingSlash(process.env.EXPO_PUBLIC_ANALYSIS_API_URL ?? '');
const envPublicUrl = trimTrailingSlash(process.env.EXPO_PUBLIC_ANALYSIS_API_PUBLIC_URL ?? '');
const usePublicBackend = process.env.EXPO_PUBLIC_ANALYSIS_USE_PUBLIC_BACKEND === 'true';

/** Sticky once we see a CoreSimulator (or Android emulator) path this JS session. */
let cachedIsSimulator: boolean | null = null;

function looksLikeSimulatorUri(videoUri: string): boolean {
  return (
    /CoreSimulator/i.test(videoUri) ||
    /Android\/data\/.*\/emulator/i.test(videoUri) ||
    /\/Emulator\//i.test(videoUri)
  );
}

/**
 * True on iOS Simulator / Android Emulator when detectable from a local file URI.
 *
 * Do NOT import expo-device: `requireNativeModule('ExpoDevice')` throws when the
 * native module is not in the binary, which unregisters identify/analysing routes.
 *
 * Note: expo-constants removed `Constants.isDevice` — never use it.
 */
export function isLocalSimulator(videoUri?: string | null): boolean {
  if (cachedIsSimulator === true) return true;

  if (typeof videoUri === 'string' && looksLikeSimulatorUri(videoUri)) {
    cachedIsSimulator = true;
    return true;
  }

  return false;
}

/** Host running Metro (same machine as the analysis server in local/Expo Go dev). */
function getDevPackagerHost(): string | null {
  const hostUri =
    Constants.expoConfig?.hostUri ??
    Constants.expoGoConfig?.debuggerHost ??
    (Constants.manifest as { debuggerHost?: string } | null)?.debuggerHost ??
    null;

  if (!hostUri || typeof hostUri !== 'string') return null;
  const host = hostUri.split(':')[0]?.trim();
  if (!host) return null;
  return host;
}

export type GetAnalysisApiUrlOptions = {
  /** Local file URI — used to detect iOS Simulator via CoreSimulator path. */
  videoUri?: string | null;
};

/**
 * Resolve analysis API base URL at call time (not module load) so Expo hostUri is available
 * and Wi‑Fi IP changes don't leave a stale EXPO_PUBLIC_ANALYSIS_API_URL baked in.
 */
export function getAnalysisApiUrl(options?: GetAnalysisApiUrlOptions): string {
  if (usePublicBackend && envPublicUrl.length > 0) {
    return envPublicUrl;
  }

  // Expo web → always localhost on the Mac
  if (Platform.OS === 'web') {
    return 'http://localhost:3001';
  }

  // Seed simulator cache from this call's URI when present
  if (options?.videoUri) {
    isLocalSimulator(options.videoUri);
  }

  // iOS Simulator / Android Emulator → localhost (Android emulator loopback is 10.0.2.2)
  if (isLocalSimulator(options?.videoUri)) {
    if (Platform.OS === 'android') return 'http://10.0.2.2:3001';
    return 'http://localhost:3001';
  }

  // Physical device in __DEV__: use the same LAN host as Metro (never trust a stale .env IP)
  if (typeof __DEV__ !== 'undefined' && __DEV__) {
    const packagerHost = getDevPackagerHost();
    if (packagerHost && packagerHost !== 'localhost' && packagerHost !== '127.0.0.1') {
      return `http://${packagerHost}:3001`;
    }
  }

  return envLanUrl;
}

export function isAnalysisApiConfigured(options?: GetAnalysisApiUrlOptions): boolean {
  return getAnalysisApiUrl(options).length > 0;
}

export type AnalysisApiUrlMode = 'lan' | 'public' | 'unset';

export function getAnalysisApiUrlMode(options?: GetAnalysisApiUrlOptions): AnalysisApiUrlMode {
  const url = getAnalysisApiUrl(options);
  if (!url) return 'unset';
  if (usePublicBackend && envPublicUrl.length > 0) return 'public';
  return 'lan';
}

export function analysisEndpoint(path: string, options?: GetAnalysisApiUrlOptions): string {
  const base = getAnalysisApiUrl(options);
  return `${base}${path.startsWith('/') ? path : `/${path}`}`;
}

/** Logs which backend URL the client will call (safe — no secrets). */
export function logAnalysisApiTarget(
  method: string,
  path: string,
  options?: GetAnalysisApiUrlOptions
): void {
  const url = analysisEndpoint(path, options);
  console.log('[Analysis] API target', {
    method,
    url,
    mode: getAnalysisApiUrlMode(options),
    platform: Platform.OS,
    isSimulator: isLocalSimulator(options?.videoUri),
    packagerHost: getDevPackagerHost(),
    usePublicBackend,
    hasLanUrl: envLanUrl.length > 0,
    hasPublicUrl: envPublicUrl.length > 0,
  });
}
