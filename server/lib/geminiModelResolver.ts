import { GoogleGenAI, type Model } from '@google/genai';
import { ServerAnalysisError } from './analysisErrors.js';

const MODEL_CACHE_TTL_MS = 5 * 60 * 1000;

let cachedCandidates: string[] | null = null;
let cacheExpiresAt = 0;

/** Strip the `models/` prefix returned by the Models API. */
export function normalizeModelId(raw: string): string {
  return raw.replace(/^models\//, '').trim();
}

function supportsGenerateContent(model: Model): boolean {
  const actions = model.supportedActions ?? [];
  return actions.some(
    (action) => action.toLowerCase() === 'generatecontent' || action === 'generateContent'
  );
}

/** Exclude models that cannot perform multimodal text+video understanding. */
function isExcludedModelId(id: string): boolean {
  const lower = id.toLowerCase();
  const excludePatterns = [
    'embed',
    'embedding',
    'imagen',
    'veo',
    'lyria',
    'tts',
    'live',
    'translate',
    'robotics',
    'aqa',
    'nano-banana',
    'gemma',
    'text-embedding',
    'embedding-001',
    'image-generation',
    'computer-use',
    'deep-research',
  ];
  return excludePatterns.some((pattern) => lower.includes(pattern));
}

/**
 * Rank models for short-form video coaching analysis.
 * Higher score = preferred. No hardcoded model names — purely derived from API metadata + heuristics.
 */
function scoreModel(id: string): number {
  if (isExcludedModelId(id)) return -1;

  const lower = id.toLowerCase();
  let score = 0;

  if (!lower.startsWith('gemini')) return -1;

  // Production aliases that track the current Flash release — ideal for new AI Studio projects.
  if (lower.endsWith('-latest')) score += 200;
  if (lower === 'gemini-flash-latest') score += 50;
  if (lower === 'gemini-pro-latest') score += 20;

  // Prefer Flash over Pro for latency/cost on short clips.
  if (lower.includes('flash') && !lower.includes('flash-lite')) score += 80;
  if (lower.includes('flash-lite')) score += 30;
  if (lower.includes('-pro') && !lower.includes('flash')) score += 40;

  // Prefer newer major versions when listed.
  const majorMatch = lower.match(/gemini-(\d+)/);
  if (majorMatch) score += Number(majorMatch[1]) * 15;

  // Stable IDs beat preview/experimental when scores are otherwise close.
  if (lower.includes('preview')) score -= 15;
  if (lower.includes('experimental')) score -= 25;
  if (lower.includes('-exp')) score -= 20;

  // Deprioritize image-only or specialty variants.
  if (lower.includes('-image')) score -= 40;
  if (lower.includes('-lite') && !lower.includes('flash-lite')) score -= 10;

  return score;
}

export async function listVideoAnalysisModels(ai: GoogleGenAI): Promise<string[]> {
  const pager = await ai.models.list();
  const scored: { id: string; score: number; displayName?: string }[] = [];

  for await (const model of pager) {
    if (!model.name || !supportsGenerateContent(model)) continue;

    const id = normalizeModelId(model.name);
    const modelScore = scoreModel(id);
    if (modelScore < 0) continue;

    scored.push({
      id,
      score: modelScore,
      displayName: model.displayName,
    });
  }

  scored.sort((a, b) => b.score - a.score || a.id.localeCompare(b.id));

  console.log(
    '[Gemini] Models discovered via models.list (generateContent-capable, ranked):',
    scored.slice(0, 10).map((m) => ({ id: m.id, score: m.score, displayName: m.displayName }))
  );

  return scored.map((m) => m.id);
}

export function invalidateModelCache(): void {
  cachedCandidates = null;
  cacheExpiresAt = 0;
}

async function getCachedCandidates(ai: GoogleGenAI): Promise<string[]> {
  const now = Date.now();
  if (cachedCandidates && now < cacheExpiresAt) {
    return cachedCandidates;
  }

  const discovered = await listVideoAnalysisModels(ai);
  if (discovered.length === 0) {
    throw new ServerAnalysisError(
      'No generateContent-capable Gemini models were returned for this API key. Verify billing and AI Studio project access.',
      'GEMINI_PROCESSING_FAILED'
    );
  }

  cachedCandidates = discovered;
  cacheExpiresAt = now + MODEL_CACHE_TTL_MS;
  return discovered;
}

/**
 * Resolves the model for this request.
 * - Uses GEMINI_MODEL env override when set (not hardcoded in source).
 * - Otherwise picks the top-ranked model from models.list().
 * - Pass excludeIds to skip models that returned 404 for this key.
 */
export async function resolveAnalysisModel(
  ai: GoogleGenAI,
  excludeIds: string[] = []
): Promise<string> {
  const override = process.env.GEMINI_MODEL?.trim();
  if (override) {
    const normalized = normalizeModelId(override);
    if (!excludeIds.includes(normalized)) {
      console.log('[Gemini] Using GEMINI_MODEL override:', normalized);
      return normalized;
    }
  }

  const candidates = (await getCachedCandidates(ai)).filter((id) => !excludeIds.includes(id));

  if (candidates.length === 0) {
    throw new ServerAnalysisError(
      'All discovered Gemini models were excluded after failures. Set GEMINI_MODEL to a model available in your AI Studio project.',
      'GEMINI_PROCESSING_FAILED'
    );
  }

  const selected = candidates[0];
  console.log('[Gemini] Resolved model from API discovery:', selected);
  return selected;
}

/**
 * Legacy full-video pipeline only.
 * - GEMINI_LEGACY_MODEL if set
 * - else GEMINI_MODEL if set
 * - else models.list() discovery (Flash-biased ranking unchanged)
 */
export async function resolveLegacyAnalysisModel(
  ai: GoogleGenAI,
  excludeIds: string[] = []
): Promise<string> {
  const legacyOverride = process.env.GEMINI_LEGACY_MODEL?.trim();
  if (legacyOverride) {
    const normalized = normalizeModelId(legacyOverride);
    if (!excludeIds.includes(normalized)) {
      console.log('[Gemini] Using GEMINI_LEGACY_MODEL override:', normalized);
      return normalized;
    }
  }
  return resolveAnalysisModel(ai, excludeIds);
}

/** Warm-up: discover models at server start so misconfiguration fails fast. */
export async function warmupModelDiscovery(apiKey: string): Promise<string | null> {
  try {
    const ai = new GoogleGenAI({ apiKey });
    const model = await resolveAnalysisModel(ai);
    return model;
  } catch (error) {
    console.warn('[Gemini] Model discovery warmup failed:', error instanceof Error ? error.message : error);
    return null;
  }
}
