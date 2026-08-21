import type { GoogleGenAI, Part } from '@google/genai';
import type { AnalysisRequestMetadata } from './types.js';
import type {
  DenseFrame,
  FactualEventAnalysis,
  CompletePlayEventFact,
  SelectedPlayerEventFact,
} from './factualEventTypes.js';
import { callGeminiJson } from './geminiJsonCall.js';
import { extractJsonText } from './parseResponse.js';
import { ServerAnalysisError } from './analysisErrors.js';
import { getFocusTimestampSec } from './videoWindow.js';

const EVENT_CONFIDENCE_MIN = 0.75;

function buildEventObserverSystemInstruction(): string {
  return `You are a football video event observer.

Your task is NOT to coach.

Determine only what is visibly supported by the supplied chronological frames.

Do not infer missing actions.

Do not invent passes, tackles, crosses, shots, goals, dribbles, or player identities.

If an action cannot be established from the frames, mark it uncertain.

First determine the team-level sequence of play.

Then determine the selected player's involvement separately.

No event may appear in completePlayTimeline unless confidence >= ${EVENT_CONFIDENCE_MIN}.

Do not guess player identity from proximity to the ball.

Return valid JSON only.`;
}

function buildEventObserverUserPrompt(params: {
  metadata: AnalysisRequestMetadata;
  frameCount: number;
  fps: number;
  videoDurationMs: number;
  tapTimestampMs: number;
}): string {
  const intervalMs = 1000 / params.fps;
  return `REFERENCE IMAGE:
The first image shows the player the user selected at ${(params.tapTimestampMs / 1000).toFixed(1)}s.
Use kit, body appearance, location continuity and surrounding context to identify that player when possible.
If identity is uncertain, mark actor as unknown or keep confidence below threshold.
Never assign an action to the selected player merely because that player is nearest the ball.
There is NO tracking data — only this reference and the chronological frames.

FRAMES:
You will receive ${params.frameCount} chronological JPEG frames extracted at ${params.fps} FPS from a display-oriented upright video.
Frame 1 ≈ 0ms, Frame 2 ≈ ${intervalMs}ms, Frame 3 ≈ ${intervalMs * 2}ms, etc., up to ~${params.videoDurationMs}ms.

Return strict JSON:
{
  "playType": "open_play | free_kick | corner | throw_in | penalty | unknown",
  "goalOccurred": true | false | "uncertain",
  "completePlayTimeline": [
    {
      "startMs": number,
      "endMs": number,
      "event": "short_pass | long_pass | shot | goal | cross | tackle | dribble | run | save | set_piece | other",
      "actor": "selected_player | teammate | opponent | unknown",
      "confidence": 0.0,
      "evidence": "short factual description"
    }
  ],
  "selectedPlayerTimeline": [
    {
      "startMs": number,
      "endMs": number,
      "action": "string",
      "confidence": 0.0,
      "visible": true,
      "evidence": "string"
    }
  ],
  "uncertainEvents": ["string"]
}`;
}

function asNumber(value: unknown, fallback = 0): number {
  const n = Number(value);
  return Number.isFinite(n) ? n : fallback;
}

function asString(value: unknown, fallback = ''): string {
  return typeof value === 'string' ? value.trim() : fallback;
}

function asBoolOrUncertain(value: unknown): boolean | 'uncertain' {
  if (value === true) return true;
  if (value === false) return false;
  if (value === 'uncertain') return 'uncertain';
  return 'uncertain';
}

function parseCompletePlayEvents(raw: unknown): CompletePlayEventFact[] {
  if (!Array.isArray(raw)) return [];
  const events: CompletePlayEventFact[] = [];

  for (const item of raw) {
    if (!item || typeof item !== 'object') continue;
    const row = item as Record<string, unknown>;
    const confidence = asNumber(row.confidence);
    if (confidence < EVENT_CONFIDENCE_MIN) continue;

    events.push({
      startMs: asNumber(row.startMs),
      endMs: asNumber(row.endMs),
      event: asString(row.event, 'other'),
      actor: asString(row.actor, 'unknown'),
      confidence,
      evidence: asString(row.evidence),
    });
  }

  return events.sort((a, b) => a.startMs - b.startMs);
}

function parseSelectedPlayerEvents(raw: unknown): SelectedPlayerEventFact[] {
  if (!Array.isArray(raw)) return [];
  const events: SelectedPlayerEventFact[] = [];

  for (const item of raw) {
    if (!item || typeof item !== 'object') continue;
    const row = item as Record<string, unknown>;

    events.push({
      startMs: asNumber(row.startMs),
      endMs: asNumber(row.endMs),
      action: asString(row.action),
      confidence: asNumber(row.confidence),
      visible: row.visible === true,
      evidence: asString(row.evidence),
    });
  }

  return events.sort((a, b) => a.startMs - b.startMs);
}

export function parseFactualEventAnalysis(raw: string): FactualEventAnalysis {
  let parsed: unknown;
  try {
    parsed = JSON.parse(extractJsonText(raw));
  } catch (error) {
    throw new ServerAnalysisError(
      `Event analysis returned invalid JSON: ${error instanceof Error ? error.message : String(error)}`,
      'INVALID_GEMINI_RESPONSE'
    );
  }

  if (!parsed || typeof parsed !== 'object') {
    throw new ServerAnalysisError('Event analysis response was not a JSON object', 'INVALID_GEMINI_RESPONSE');
  }

  const obj = parsed as Record<string, unknown>;
  const completePlayTimeline = parseCompletePlayEvents(obj.completePlayTimeline);
  const selectedPlayerTimeline = parseSelectedPlayerEvents(obj.selectedPlayerTimeline);
  const uncertainEvents = Array.isArray(obj.uncertainEvents)
    ? obj.uncertainEvents.filter((item): item is string => typeof item === 'string')
    : [];

  const result: FactualEventAnalysis = {
    playType: asString(obj.playType, 'unknown'),
    goalOccurred: asBoolOrUncertain(obj.goalOccurred),
    completePlayTimeline,
    selectedPlayerTimeline,
    uncertainEvents,
  };

  console.log('[EventAnalysis] COMPLETE PLAY', {
    playType: result.playType,
    goalOccurred: result.goalOccurred,
    events: result.completePlayTimeline,
  });

  console.log('[EventAnalysis] SELECTED PLAYER', {
    events: result.selectedPlayerTimeline,
    uncertainEvents: result.uncertainEvents,
  });

  return result;
}

function buildEventAnalysisParts(params: {
  referenceCropBase64: string;
  frames: DenseFrame[];
  prompt: string;
}): Part[] {
  const parts: Part[] = [
    { text: params.prompt },
    {
      inlineData: {
        mimeType: 'image/jpeg',
        data: params.referenceCropBase64,
      },
    },
  ];

  for (const frame of params.frames) {
    parts.push({
      inlineData: {
        mimeType: 'image/jpeg',
        data: frame.jpegBase64,
      },
    });
  }

  return parts;
}

/** First Gemini call — factual event timeline only (no coaching). */
export async function analyseFootballEvents(params: {
  ai: GoogleGenAI;
  modelName: string;
  metadata: AnalysisRequestMetadata;
  frames: DenseFrame[];
  fps: number;
  videoDurationMs: number;
  referenceCropBase64: string;
}): Promise<FactualEventAnalysis> {
  const tapTimestampMs = Math.round(
    getFocusTimestampSec(params.metadata.playerSelection, params.videoDurationMs) * 1000
  );

  const prompt = buildEventObserverUserPrompt({
    metadata: params.metadata,
    frameCount: params.frames.length,
    fps: params.fps,
    videoDurationMs: params.videoDurationMs,
    tapTimestampMs,
  });

  const parts = buildEventAnalysisParts({
    referenceCropBase64: params.referenceCropBase64,
    frames: params.frames,
    prompt,
  });

  const raw = await callGeminiJson({
    ai: params.ai,
    modelName: params.modelName,
    label: 'analyse-football-events',
    systemInstruction: buildEventObserverSystemInstruction(),
    parts,
    temperature: 0.15,
  });

  return parseFactualEventAnalysis(raw);
}
