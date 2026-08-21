import type { GoogleGenAI, Part } from '@google/genai';
import type {
  DenseFrame,
  VerifiedEventFact,
  VideoObservation,
  VideoVerificationResult,
} from './factualEventTypes.js';
import { callGeminiJson } from './geminiJsonCall.js';
import { extractJsonText } from './parseResponse.js';
import { ServerAnalysisError } from './analysisErrors.js';
import { splitFramesIntoBatches, type FrameBatch } from './frameBatching.js';
import { logVideoUnderstandingJson } from './videoUnderstandingLog.js';

const VERIFIED_CONFIDENCE_MIN = 0.6;

function buildVerifierSystemInstruction(): string {
  return `You are a football video fact-checker.

Verify every claimed event against the visual evidence (reference image + chronological frames).

Rules:
- Reject any event not clearly supported by visible evidence.
- Correct actor attribution when wrong.
- Correct event ordering when wrong.
- Do NOT add coaching, ratings, or new events not in the proposed sequence.
- Do NOT invent football actions to fill gaps.
- Prefer rejection over speculation.

Return valid JSON only.`;
}

function buildVerifierUserPrompt(params: {
  observation: VideoObservation;
  frameCount: number;
  fps: number;
  batch?: FrameBatch;
}): string {
  const batchBlock = params.batch
    ? `Verify ONLY events between ~${params.batch.startMs}ms and ~${params.batch.endMs}ms.`
    : 'Verify events across the full clip.';

  return `${batchBlock}

PROPOSED SEQUENCE (from first-pass observation):
${JSON.stringify(params.observation.sequence, null, 2)}

goalVisible: ${String(params.observation.goalVisible)}
uncertainties: ${JSON.stringify(params.observation.uncertainties)}

You receive ${params.frameCount} chronological frames at ${params.fps} FPS plus the selected-player reference.
Cross-check each proposed event. Reject unsupported claims.

Return strict JSON:
{
  "verifiedEvents": [
    {
      "timestampMs": number,
      "actor": "selected_player | teammate | opponent | unknown",
      "action": "string",
      "confidence": 0.0,
      "visualEvidence": "string",
      "correctionNote": "optional"
    }
  ],
  "rejectedEvents": [
    {
      "timestampMs": number,
      "actor": "string",
      "action": "string",
      "confidence": 0.0,
      "visualEvidence": "why rejected"
    }
  ],
  "correctedEvents": [
    {
      "timestampMs": number,
      "actor": "string",
      "action": "string",
      "confidence": 0.0,
      "visualEvidence": "string",
      "correctionNote": "what changed"
    }
  ],
  "overallConfidence": 0.0
}`;
}

function buildVerificationParts(params: {
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

function parseVerifiedEvents(raw: unknown, minConfidence: number): VerifiedEventFact[] {
  if (!Array.isArray(raw)) return [];
  const events: VerifiedEventFact[] = [];

  for (const item of raw) {
    if (!item || typeof item !== 'object') continue;
    const row = item as Record<string, unknown>;
    const confidence = asNumber(row.confidence);
    if (confidence < minConfidence) continue;

    events.push({
      timestampMs: asNumber(row.timestampMs),
      actor: asString(row.actor, 'unknown'),
      action: asString(row.action),
      confidence,
      visualEvidence: asString(row.visualEvidence),
      correctionNote: asString(row.correctionNote) || undefined,
    });
  }

  return events.sort((a, b) => a.timestampMs - b.timestampMs);
}

export function parseVideoVerification(raw: string): VideoVerificationResult {
  let parsed: unknown;
  try {
    parsed = JSON.parse(extractJsonText(raw));
  } catch (error) {
    throw new ServerAnalysisError(
      `Video verification returned invalid JSON: ${error instanceof Error ? error.message : String(error)}`,
      'INVALID_GEMINI_RESPONSE'
    );
  }

  if (!parsed || typeof parsed !== 'object') {
    throw new ServerAnalysisError('Video verification was not a JSON object', 'INVALID_GEMINI_RESPONSE');
  }

  const obj = parsed as Record<string, unknown>;
  return {
    verifiedEvents: parseVerifiedEvents(obj.verifiedEvents, VERIFIED_CONFIDENCE_MIN),
    rejectedEvents: parseVerifiedEvents(obj.rejectedEvents, 0),
    correctedEvents: parseVerifiedEvents(obj.correctedEvents, VERIFIED_CONFIDENCE_MIN),
    overallConfidence: Math.min(1, Math.max(0, asNumber(obj.overallConfidence))),
  };
}

function mergeVerifications(results: VideoVerificationResult[]): VideoVerificationResult {
  const verifiedEvents = results
    .flatMap((result) => [...result.verifiedEvents, ...result.correctedEvents])
    .sort((a, b) => a.timestampMs - b.timestampMs);

  const dedupedVerified: VerifiedEventFact[] = [];
  for (const event of verifiedEvents) {
    const last = dedupedVerified[dedupedVerified.length - 1];
    if (
      last &&
      Math.abs(last.timestampMs - event.timestampMs) <= 250 &&
      last.action.toLowerCase() === event.action.toLowerCase()
    ) {
      if (event.confidence > last.confidence) {
        dedupedVerified[dedupedVerified.length - 1] = event;
      }
      continue;
    }
    dedupedVerified.push(event);
  }

  const rejectedEvents = results.flatMap((result) => result.rejectedEvents);
  const correctedEvents = results.flatMap((result) => result.correctedEvents);
  const overallConfidence =
    results.length > 0
      ? results.reduce((sum, result) => sum + result.overallConfidence, 0) / results.length
      : 0;

  return {
    verifiedEvents: dedupedVerified,
    rejectedEvents,
    correctedEvents,
    overallConfidence,
  };
}

async function verifyBatch(params: {
  ai: GoogleGenAI;
  modelName: string;
  observation: VideoObservation;
  referenceCropBase64: string;
  batch: FrameBatch;
  fps: number;
  requestId: string;
}): Promise<VideoVerificationResult> {
  const prompt = buildVerifierUserPrompt({
    observation: params.observation,
    frameCount: params.batch.frames.length,
    fps: params.fps,
    batch: params.batch,
  });

  const parts = buildVerificationParts({
    referenceCropBase64: params.referenceCropBase64,
    frames: params.batch.frames,
    prompt,
  });

  const raw = await callGeminiJson({
    ai: params.ai,
    modelName: params.modelName,
    label: `verify-football-observation-batch-${params.batch.batchIndex + 1}`,
    systemInstruction: buildVerifierSystemInstruction(),
    parts,
    temperature: 0.1,
    requestId: params.requestId,
  });

  return parseVideoVerification(raw);
}

/** Phase 4 — second-pass visual verification of observed sequence. */
export async function verifyFootballObservation(params: {
  ai: GoogleGenAI;
  modelName: string;
  observation: VideoObservation;
  frames: DenseFrame[];
  fps: number;
  referenceCropBase64: string;
  requestId: string;
}): Promise<VideoVerificationResult> {
  const batches = splitFramesIntoBatches(params.frames);

  if (batches.length > 1) {
    logVideoUnderstandingJson(
      'Verification batching',
      {
        requestId: params.requestId,
        totalFrames: params.frames.length,
        batchCount: batches.length,
      },
      params.requestId
    );
  }

  const results: VideoVerificationResult[] = [];
  for (const batch of batches) {
    results.push(
      await verifyBatch({
        ai: params.ai,
        modelName: params.modelName,
        observation: params.observation,
        referenceCropBase64: params.referenceCropBase64,
        batch,
        fps: params.fps,
        requestId: params.requestId,
      })
    );
  }

  return mergeVerifications(results);
}

export const MIN_VERIFICATION_OVERALL_CONFIDENCE = 0.5;
