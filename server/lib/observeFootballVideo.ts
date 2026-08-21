import type { GoogleGenAI, Part } from '@google/genai';
import type { AnalysisRequestMetadata } from './types.js';
import type {
  DenseFrame,
  ObservationSequenceEvent,
  VideoObservation,
} from './factualEventTypes.js';
import { callGeminiJson } from './geminiJsonCall.js';
import { extractJsonText } from './parseResponse.js';
import { ServerAnalysisError } from './analysisErrors.js';
import { getFocusTimestampSec } from './videoWindow.js';
import { splitFramesIntoBatches, type FrameBatch } from './frameBatching.js';
import { logVideoUnderstandingJson } from './videoUnderstandingLog.js';

const OBSERVATION_CONFIDENCE_MIN = 0.65;

function buildObserverSystemInstruction(): string {
  return `You are observing a football video.

Your ONLY job is to reconstruct what visibly happens, in chronological order.

Rules:
- Use ONLY visible evidence from the supplied frames.
- Do NOT coach, rate, or advise.
- Do NOT infer an action because it would make football sense.
- Do NOT invent passes, tackles, crosses, shots, assists, goals, or player involvement.
- Distinguish carefully between: selected_player, teammate, opponent, unknown.
- If identity cannot be maintained visually, mark actor as unknown and lower confidence.
- Every important event MUST include visualEvidence describing what you actually see.
- Prefer fewer, well-supported events over many speculative ones.

Return valid JSON only.`;
}

function buildObserverUserPrompt(params: {
  frameCount: number;
  fps: number;
  videoDurationMs: number;
  tapTimestampMs: number;
  batch?: FrameBatch;
}): string {
  const intervalMs = 1000 / params.fps;
  const batchBlock = params.batch
    ? `SEGMENT ${params.batch.batchIndex + 1} of ${params.batch.batchCount} (~${params.batch.startMs}ms–${params.batch.endMs}ms).
Only describe events visible in THIS segment. Do not invent events outside this time range.`
    : `Clip duration ~${params.videoDurationMs}ms. Cover the ENTIRE clip chronologically.`;

  return `REFERENCE IMAGE:
The first image shows the player the user selected at ${(params.tapTimestampMs / 1000).toFixed(1)}s.
Use kit, body shape, and location continuity to identify that player when possible.
There is NO tracking data — only this reference and chronological frames.

${batchBlock}

FRAMES:
You receive ${params.frameCount} chronological JPEG frames at ${params.fps} FPS from a display-oriented upright video.
Frame 1 in this set ≈ ${params.batch?.startMs ?? 0}ms; spacing ≈ ${intervalMs}ms between consecutive frames.

Return strict JSON:
{
  "sequence": [
    {
      "timestampMs": number,
      "actor": "selected_player | teammate | opponent | unknown",
      "action": "plain description of visible action only",
      "confidence": 0.0,
      "visualEvidence": "what you see that supports this"
    }
  ],
  "goalVisible": true | false | "uncertain",
  "selectedPlayerActions": ["only actions visibly performed by the selected player"],
  "uncertainties": ["anything you cannot confirm visually"]
}`;
}

function buildObservationParts(params: {
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

function parseSequence(raw: unknown): ObservationSequenceEvent[] {
  if (!Array.isArray(raw)) return [];
  const events: ObservationSequenceEvent[] = [];

  for (const item of raw) {
    if (!item || typeof item !== 'object') continue;
    const row = item as Record<string, unknown>;
    const confidence = asNumber(row.confidence);
    if (confidence < OBSERVATION_CONFIDENCE_MIN) continue;

    events.push({
      timestampMs: asNumber(row.timestampMs),
      actor: asString(row.actor, 'unknown'),
      action: asString(row.action),
      confidence,
      visualEvidence: asString(row.visualEvidence),
    });
  }

  return events.sort((a, b) => a.timestampMs - b.timestampMs);
}

export function parseVideoObservation(raw: string): VideoObservation {
  let parsed: unknown;
  try {
    parsed = JSON.parse(extractJsonText(raw));
  } catch (error) {
    throw new ServerAnalysisError(
      `Video observation returned invalid JSON: ${error instanceof Error ? error.message : String(error)}`,
      'INVALID_GEMINI_RESPONSE'
    );
  }

  if (!parsed || typeof parsed !== 'object') {
    throw new ServerAnalysisError('Video observation was not a JSON object', 'INVALID_GEMINI_RESPONSE');
  }

  const obj = parsed as Record<string, unknown>;
  return {
    sequence: parseSequence(obj.sequence),
    goalVisible: asBoolOrUncertain(obj.goalVisible),
    selectedPlayerActions: Array.isArray(obj.selectedPlayerActions)
      ? obj.selectedPlayerActions.filter((item): item is string => typeof item === 'string')
      : [],
    uncertainties: Array.isArray(obj.uncertainties)
      ? obj.uncertainties.filter((item): item is string => typeof item === 'string')
      : [],
  };
}

function mergeObservations(observations: VideoObservation[]): VideoObservation {
  const mergedSequence = observations
    .flatMap((obs) => obs.sequence)
    .sort((a, b) => a.timestampMs - b.timestampMs);

  const deduped: ObservationSequenceEvent[] = [];
  for (const event of mergedSequence) {
    const last = deduped[deduped.length - 1];
    if (
      last &&
      Math.abs(last.timestampMs - event.timestampMs) <= 250 &&
      last.action.toLowerCase() === event.action.toLowerCase() &&
      last.actor === event.actor
    ) {
      if (event.confidence > last.confidence) {
        deduped[deduped.length - 1] = event;
      }
      continue;
    }
    deduped.push(event);
  }

  const goalVisible = observations.some((obs) => obs.goalVisible === true)
    ? true
    : observations.every((obs) => obs.goalVisible === false)
      ? false
      : 'uncertain';

  return {
    sequence: deduped,
    goalVisible,
    selectedPlayerActions: [...new Set(observations.flatMap((obs) => obs.selectedPlayerActions))],
    uncertainties: [...new Set(observations.flatMap((obs) => obs.uncertainties))],
  };
}

async function observeBatch(params: {
  ai: GoogleGenAI;
  modelName: string;
  metadata: AnalysisRequestMetadata;
  referenceCropBase64: string;
  batch: FrameBatch;
  fps: number;
  videoDurationMs: number;
  tapTimestampMs: number;
  requestId: string;
}): Promise<VideoObservation> {
  const prompt = buildObserverUserPrompt({
    frameCount: params.batch.frames.length,
    fps: params.fps,
    videoDurationMs: params.videoDurationMs,
    tapTimestampMs: params.tapTimestampMs,
    batch: params.batch,
  });

  const parts = buildObservationParts({
    referenceCropBase64: params.referenceCropBase64,
    frames: params.batch.frames,
    prompt,
  });

  const raw = await callGeminiJson({
    ai: params.ai,
    modelName: params.modelName,
    label: `observe-football-video-batch-${params.batch.batchIndex + 1}`,
    systemInstruction: buildObserverSystemInstruction(),
    parts,
    temperature: 0.1,
    requestId: params.requestId,
  });

  return parseVideoObservation(raw);
}

/** Phase 1 — visual observation only (no coaching). Supports temporal batching. */
export async function observeFootballVideo(params: {
  ai: GoogleGenAI;
  modelName: string;
  metadata: AnalysisRequestMetadata;
  frames: DenseFrame[];
  fps: number;
  videoDurationMs: number;
  referenceCropBase64: string;
  requestId: string;
}): Promise<{ observation: VideoObservation; batched: boolean; batchCount: number }> {
  const tapTimestampMs = Math.round(
    getFocusTimestampSec(params.metadata.playerSelection, params.videoDurationMs) * 1000
  );

  const batches = splitFramesIntoBatches(params.frames);
  const batched = batches.length > 1;

  if (batched) {
    logVideoUnderstandingJson(
      'Observation batching',
      {
        requestId: params.requestId,
        totalFrames: params.frames.length,
        batchCount: batches.length,
        reason: 'frame_count_exceeds_gemini_inline_limit',
      },
      params.requestId
    );
  }

  const observations: VideoObservation[] = [];
  for (const batch of batches) {
    observations.push(
      await observeBatch({
        ai: params.ai,
        modelName: params.modelName,
        metadata: params.metadata,
        referenceCropBase64: params.referenceCropBase64,
        batch,
        fps: params.fps,
        videoDurationMs: params.videoDurationMs,
        tapTimestampMs,
        requestId: params.requestId,
      })
    );
  }

  return {
    observation: mergeObservations(observations),
    batched,
    batchCount: batches.length,
  };
}
