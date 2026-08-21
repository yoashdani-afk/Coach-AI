import type { GoogleGenAI } from '@google/genai';
import type { AnalysisRequestMetadata } from './types.js';
import type {
  CompletePlayEventFact,
  DenseFrame,
  FactualEventAnalysis,
  SelectedPlayerEventFact,
  VideoUnderstandingResult,
  VerifiedEventFact,
  VideoObservation,
  VideoVerificationResult,
} from './factualEventTypes.js';
import { observeFootballVideo } from './observeFootballVideo.js';
import {
  MIN_VERIFICATION_OVERALL_CONFIDENCE,
  verifyFootballObservation,
} from './verifyFootballObservation.js';
import { buildVideoEvidenceAuditPayload } from './videoEvidenceAudit.js';
import {
  logVideoUnderstandingJson,
  logVideoUnderstandingLine,
} from './videoUnderstandingLog.js';
import { splitFramesIntoBatches } from './frameBatching.js';

function inferPlayType(events: VerifiedEventFact[]): FactualEventAnalysis['playType'] {
  const blob = events.map((event) => `${event.action} ${event.visualEvidence}`).join(' ').toLowerCase();
  if (/\bcorner\b/.test(blob)) return 'corner';
  if (/\bfree kick\b|\bfree-kick\b/.test(blob)) return 'free_kick';
  if (/\bthrow[- ]in\b/.test(blob)) return 'throw_in';
  if (/\bpenalty\b/.test(blob)) return 'penalty';
  if (/\bset piece\b|\bset-piece\b/.test(blob)) return 'unknown';
  return 'open_play';
}

function verifiedToFactual(
  observation: VideoObservation,
  verification: VideoVerificationResult
): FactualEventAnalysis {
  const completePlayTimeline: CompletePlayEventFact[] = verification.verifiedEvents.map((event) => ({
    startMs: event.timestampMs,
    endMs: event.timestampMs + 200,
    event: event.action,
    actor: event.actor,
    confidence: event.confidence,
    evidence: event.visualEvidence,
  }));

  const selectedPlayerTimeline: SelectedPlayerEventFact[] = verification.verifiedEvents
    .filter((event) => event.actor === 'selected_player')
    .map((event) => ({
      startMs: event.timestampMs,
      endMs: event.timestampMs + 200,
      action: event.action,
      confidence: event.confidence,
      visible: true,
      evidence: event.visualEvidence,
    }));

  const goalOccurred =
    observation.goalVisible === true
      ? true
      : observation.goalVisible === false
        ? false
        : verification.verifiedEvents.some((event) => /\bgoal\b/i.test(event.action))
          ? true
          : 'uncertain';

  return {
    playType: inferPlayType(verification.verifiedEvents),
    goalOccurred,
    completePlayTimeline,
    selectedPlayerTimeline,
    uncertainEvents: [
      ...observation.uncertainties,
      ...verification.rejectedEvents.map(
        (event) => `Rejected: ${event.action} @ ${event.timestampMs}ms — ${event.visualEvidence}`
      ),
    ],
  };
}

export function isVideoUnderstandingConfidentEnough(verification: VideoVerificationResult): boolean {
  if (verification.overallConfidence < MIN_VERIFICATION_OVERALL_CONFIDENCE) return false;
  if (verification.verifiedEvents.length === 0) return false;
  return true;
}

function logUnderstandingStages(
  requestId: string,
  observation: VideoObservation,
  verification: VideoVerificationResult
): void {
  logVideoUnderstandingLine('REQUEST ID', requestId);
  logVideoUnderstandingJson('OBSERVATION', observation, requestId);
  logVideoUnderstandingJson('VERIFICATION', verification, requestId);
  logVideoUnderstandingJson('REJECTED CLAIMS', verification.rejectedEvents, requestId);
  logVideoUnderstandingJson('VERIFIED TIMELINE', verification.verifiedEvents, requestId);
  logVideoUnderstandingJson(
    'SELECTED PLAYER ACTIONS',
    verification.verifiedEvents.filter((event) => event.actor === 'selected_player'),
    requestId
  );
  logVideoUnderstandingJson('OVERALL CONFIDENCE', verification.overallConfidence, requestId);
}

/** Observe → verify → convert to factual timeline for coaching. */
export async function runVideoUnderstandingPipeline(params: {
  requestId: string;
  ai: GoogleGenAI;
  modelName: string;
  metadata: AnalysisRequestMetadata;
  mimeType: string;
  frames: DenseFrame[];
  fps: number;
  videoDurationMs: number;
  width: number;
  height: number;
  referenceCropBase64: string;
}): Promise<VideoUnderstandingResult> {
  const frameBatches = splitFramesIntoBatches(params.frames);
  const batched = frameBatches.length > 1;

  buildVideoEvidenceAuditPayload({
    requestId: params.requestId,
    model: params.modelName,
    metadata: params.metadata,
    mimeType: params.mimeType,
    frames: params.frames,
    fps: params.fps,
    width: params.width,
    height: params.height,
    referenceIncluded: true,
    batched,
    batchCount: frameBatches.length,
  });

  const { observation } = await observeFootballVideo({
    ai: params.ai,
    modelName: params.modelName,
    metadata: params.metadata,
    frames: params.frames,
    fps: params.fps,
    videoDurationMs: params.videoDurationMs,
    referenceCropBase64: params.referenceCropBase64,
    requestId: params.requestId,
  });

  const verification = await verifyFootballObservation({
    ai: params.ai,
    modelName: params.modelName,
    observation,
    frames: params.frames,
    fps: params.fps,
    referenceCropBase64: params.referenceCropBase64,
    requestId: params.requestId,
  });

  const factual = verifiedToFactual(observation, verification);

  logUnderstandingStages(params.requestId, observation, verification);

  return {
    observation,
    verification,
    factual,
    auditModel: params.modelName,
  };
}
