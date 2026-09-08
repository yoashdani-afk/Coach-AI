import { ServerAnalysisError } from './analysisErrors.js';
import {
  ATTRIBUTION_CONFIDENCE_THRESHOLD,
  IDENTITY_CONFIDENCE_THRESHOLD,
  PLAYER_GROUNDING_USER_MESSAGE,
} from './playerGrounding.js';
import type { AnalysisResponse, AnalysisScore, AnalysisTrackingMetadataLog } from './types.js';
import { calibrateScores } from './scoreCalibration.js';
import { parsePerformancePrimaryImprovement } from './buildPrompt.js';
import {
  buildUncertainAnalysisResponse,
  validateNarrativeAgainstTimeline,
} from './narrativeConsistency.js';

const LOG_TRUNCATE_CHARS = 10_000;

function asString(value: unknown, fallback = ''): string {
  return typeof value === 'string' ? value.trim() : fallback;
}

function asStringArray(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return value
    .filter((item): item is string => typeof item === 'string')
    .map((s) => s.trim())
    .filter(Boolean);
}

function asConfidence(value: unknown): number {
  const raw = Number(value);
  if (Number.isNaN(raw)) return 0;
  return Math.min(1, Math.max(0, raw));
}

function asScores(value: unknown): AnalysisScore[] {
  if (!Array.isArray(value)) return [];
  return value
    .map((item) => {
      if (!item || typeof item !== 'object') return null;
      const row = item as Record<string, unknown>;
      const label = asString(row.label);
      const raw = Number(row.value);
      if (!label || Number.isNaN(raw)) return null;
      return {
        label,
        value: Math.round(Math.min(10, Math.max(0, raw)) * 10) / 10,
      };
    })
    .filter((s): s is AnalysisScore => s !== null);
}

export interface PlayerIdentityLog {
  selectedPlayerVisualDescription: string;
  selectedPlayerKitColor: string;
  selectedPlayerApproxPosition: string;
  selectedPlayerNearbyPlayers: string;
  identityConfidence: number;
}

export interface AttributionVerificationLog {
  selectedPlayerTouchedBall: string;
  selectedPlayerAction: string;
  selectedPlayerFinalLocation: string;
  confidence: number;
  evidenceTimestamps: string[];
}

export interface CompletePlayEventLog {
  timestamp: string;
  eventType: string;
  description: string;
  passType: string;
  passRecipient: string;
  possessionOutcome: string;
  confidence: number;
}

export interface CompletePlayTimelineLog {
  finalFrameAnalysed: boolean;
  timelineConfidence: number;
  events: CompletePlayEventLog[];
}

export interface SelectedPlayerEventLog {
  timestamp: string;
  action: string;
  identityState: string;
  identityConfidence: number;
  actionConfidence: number;
  evidenceUsed: string;
}

export interface SelectedPlayerTimelineLog {
  events: SelectedPlayerEventLog[];
  excludedUncertainActions: string[];
}

export interface ReidentificationAttemptLog {
  timestamp: string;
  result: string;
  evidenceUsed: string;
  identityConfidence: number;
}

function readCompletePlayTimeline(obj: Record<string, unknown>): CompletePlayTimelineLog | null {
  const block = obj.completePlayTimeline;
  if (!block || typeof block !== 'object') return null;

  const row = block as Record<string, unknown>;
  const events: CompletePlayEventLog[] = [];

  if (Array.isArray(row.events)) {
    for (const item of row.events) {
      if (!item || typeof item !== 'object') continue;
      const event = item as Record<string, unknown>;
      events.push({
        timestamp: asString(event.timestamp),
        eventType: asString(event.eventType, 'other'),
        description: asString(event.description),
        passType: asString(event.passType, 'none'),
        passRecipient: asString(event.passRecipient),
        possessionOutcome: asString(event.possessionOutcome, 'none'),
        confidence: asConfidence(event.confidence),
      });
    }
  }

  return {
    finalFrameAnalysed: row.finalFrameAnalysed === true,
    timelineConfidence: asConfidence(row.timelineConfidence),
    events,
  };
}

function readSelectedPlayerTimeline(obj: Record<string, unknown>): SelectedPlayerTimelineLog | null {
  const block = obj.selectedPlayerTimeline;
  if (!block || typeof block !== 'object') return null;

  const row = block as Record<string, unknown>;
  const events: SelectedPlayerEventLog[] = [];

  if (Array.isArray(row.events)) {
    for (const item of row.events) {
      if (!item || typeof item !== 'object') continue;
      const event = item as Record<string, unknown>;
      events.push({
        timestamp: asString(event.timestamp),
        action: asString(event.action),
        identityState: asString(event.identityState, 'UNCONFIRMED'),
        identityConfidence: asConfidence(event.identityConfidence),
        actionConfidence: asConfidence(event.actionConfidence),
        evidenceUsed: asString(event.evidenceUsed),
      });
    }
  }

  return {
    events,
    excludedUncertainActions: asStringArray(row.excludedUncertainActions),
  };
}

function readReidentificationAttempts(obj: Record<string, unknown>): ReidentificationAttemptLog[] {
  const raw = obj.reidentificationAttempts;
  if (!Array.isArray(raw)) return [];

  const attempts: ReidentificationAttemptLog[] = [];
  for (const item of raw) {
    if (!item || typeof item !== 'object') continue;
    const row = item as Record<string, unknown>;
    attempts.push({
      timestamp: asString(row.timestamp),
      result: asString(row.result, 'still_searching'),
      evidenceUsed: asString(row.evidenceUsed),
      identityConfidence: asConfidence(row.identityConfidence),
    });
  }
  return attempts;
}

function readAnalysisTrackingMetadata(
  obj: Record<string, unknown>
): AnalysisTrackingMetadataLog | null {
  const block = obj.analysisTrackingMetadata;
  if (!block || typeof block !== 'object') return null;

  const row = block as Record<string, unknown>;
  return {
    playerTrackingConfidence: asConfidence(row.playerTrackingConfidence),
    completePlayConfidence: asConfidence(row.completePlayConfidence),
    uncertainIntervals: asStringArray(row.uncertainIntervals),
    selectedPlayerVisiblePercentage: asConfidence(row.selectedPlayerVisiblePercentage),
    reidentificationCount: Number(row.reidentificationCount) || 0,
  };
}

function logDualTimelineEvidence(
  completePlay: CompletePlayTimelineLog | null,
  selectedPlayer: SelectedPlayerTimelineLog | null,
  reidentificationAttempts: ReidentificationAttemptLog[],
  trackingMetadata: AnalysisTrackingMetadataLog | null
): void {
  const warnings: string[] = [];

  if (!completePlay) {
    warnings.push('completePlayTimeline missing from Gemini response');
  } else {
    if (!completePlay.finalFrameAnalysed) {
      warnings.push('completePlayTimeline.finalFrameAnalysed is false — clip may be incomplete');
    }
    if (completePlay.events.length <= 2) {
      warnings.push('Complete play timeline has very few events — multi-phase sequence may be under-reported');
    }

    for (const event of completePlay.events) {
      if (
        event.passType === 'clearance' &&
        (event.possessionOutcome === 'retained' ||
          /teammate|retained|received|finds|completed|progress/i.test(event.description))
      ) {
        warnings.push(
          `Possible pass mislabel at ${event.timestamp}: clearance but possession appears retained/progressive`
        );
      }
    }

    const hasDefensive = completePlay.events.some((e) =>
      /defensive|duel|tackle|interception|recovery|possession_won/i.test(e.eventType)
    );
    const hasAttacking = completePlay.events.some((e) =>
      /pass|overlap|cross|shot|chance|zone_progression|supporting_run/i.test(e.eventType)
    );
    const hasOverlap = completePlay.events.some((e) => e.eventType === 'overlap');
    const hasCross = completePlay.events.some((e) =>
      e.eventType === 'cross' || e.passType === 'cross'
    );
    const hasSecondPhase = completePlay.events.some((e) =>
      /overlap|cross|chance_created|final_outcome|zone_progression/i.test(e.eventType)
    );

    if (hasAttacking && !hasDefensive) {
      warnings.push('Complete play has attacking events but no defensive phase — earlier recovery may be missing');
    }
    if (hasAttacking && !hasSecondPhase) {
      warnings.push(
        'Complete play may have ended after first pass — overlap/cross/chance/final_outcome not logged'
      );
    }

    console.log('[DualTimeline] Second-phase detection', {
      hasOverlap,
      hasCross,
      hasSecondPhase,
      overlapEvents: completePlay.events.filter((e) => e.eventType === 'overlap'),
      crossEvents: completePlay.events.filter(
        (e) => e.eventType === 'cross' || e.passType === 'cross'
      ),
      finalOutcomeEvents: completePlay.events.filter((e) => e.eventType === 'final_outcome'),
    });
  }

  if (!selectedPlayer) {
    warnings.push('selectedPlayerTimeline missing from Gemini response');
  } else {
    const confirmed = selectedPlayer.events.filter((e) => e.identityState === 'CONFIRMED');
    const probable = selectedPlayer.events.filter((e) => e.identityState === 'PROBABLE');
    const unconfirmed = selectedPlayer.events.filter((e) => e.identityState === 'UNCONFIRMED');

    if (confirmed.length === 0 && selectedPlayer.events.length > 0) {
      warnings.push('No CONFIRMED selected-player events — coaching may rely on team-level facts only');
    }
    if (probable.length > 0) {
      warnings.push(
        `${probable.length} PROBABLE event(s) must not appear as fact in coaching fields`
      );
    }
    if (unconfirmed.length > 0) {
      warnings.push(`${unconfirmed.length} UNCONFIRMED event(s) excluded from individual attribution`);
    }

    const playerOverlap = selectedPlayer.events.filter((e) => /overlap/i.test(e.action));
    const playerCross = selectedPlayer.events.filter((e) => /cross/i.test(e.action));
    console.log('[DualTimeline] Selected-player second phase', {
      confirmedOverlap: playerOverlap.filter((e) => e.identityState === 'CONFIRMED'),
      confirmedCross: playerCross.filter((e) => e.identityState === 'CONFIRMED'),
      excludedUncertainActions: selectedPlayer.excludedUncertainActions,
    });
  }

  const outOfFrameEvents =
    completePlay?.events.filter((e) => e.eventType === 'selected_player_temporarily_out_of_frame') ??
    [];
  if (outOfFrameEvents.length > 0 && reidentificationAttempts.length === 0) {
    warnings.push('Player went out of frame but no reidentificationAttempts were logged');
  }

  console.log('[DualTimeline] Complete play timeline', {
    finalFrameAnalysed: completePlay?.finalFrameAnalysed ?? false,
    timelineConfidence: completePlay?.timelineConfidence ?? 0,
    eventCount: completePlay?.events.length ?? 0,
    events: completePlay?.events.map((event) => ({
      timestamp: event.timestamp,
      eventType: event.eventType,
      description: event.description,
      passType: event.passType,
      passRecipient: event.passRecipient,
      possessionOutcome: event.possessionOutcome,
      confidence: event.confidence,
    })),
  });

  console.log('[DualTimeline] Selected-player timeline', {
    eventCount: selectedPlayer?.events.length ?? 0,
    confirmedCount:
      selectedPlayer?.events.filter((e) => e.identityState === 'CONFIRMED').length ?? 0,
    probableCount:
      selectedPlayer?.events.filter((e) => e.identityState === 'PROBABLE').length ?? 0,
    unconfirmedCount:
      selectedPlayer?.events.filter((e) => e.identityState === 'UNCONFIRMED').length ?? 0,
    events: selectedPlayer?.events.map((event) => ({
      timestamp: event.timestamp,
      action: event.action,
      identityState: event.identityState,
      identityConfidence: event.identityConfidence,
      actionConfidence: event.actionConfidence,
      evidenceUsed: event.evidenceUsed,
    })),
    excludedUncertainActions: selectedPlayer?.excludedUncertainActions,
  });

  if (reidentificationAttempts.length > 0) {
    console.log('[DualTimeline] Re-identification attempts', reidentificationAttempts);
  }

  if (trackingMetadata) {
    console.log('[DualTimeline] Tracking metadata', trackingMetadata);
  } else {
    warnings.push('analysisTrackingMetadata missing from Gemini response');
  }

  if (outOfFrameEvents.length > 0) {
    console.log('[DualTimeline] Out-of-frame intervals', {
      count: outOfFrameEvents.length,
      timestamps: outOfFrameEvents.map((e) => e.timestamp),
      uncertainIntervals: trackingMetadata?.uncertainIntervals,
    });
  }

  for (const warning of warnings) {
    console.warn('[DualTimeline]', warning);
  }
}

function truncateForLog(text: string): string {
  if (text.length <= LOG_TRUNCATE_CHARS) return text;
  return `${text.slice(0, LOG_TRUNCATE_CHARS)}… [truncated ${text.length - LOG_TRUNCATE_CHARS} chars]`;
}

function stripMarkdownFences(text: string): string {
  const trimmed = text.trim();
  const fullWrap = trimmed.match(/^```(?:json)?\s*\n?([\s\S]*?)\n?```\s*$/i);
  if (fullWrap) return fullWrap[1].trim();

  const embedded = trimmed.match(/```(?:json)?\s*\n?([\s\S]*?)\n?```/i);
  if (embedded) return embedded[1].trim();

  return trimmed;
}

/** Extract the first balanced `{ ... }` object, respecting JSON string escaping. */
function extractBalancedJsonObject(text: string): string | null {
  const start = text.indexOf('{');
  if (start < 0) return null;

  let depth = 0;
  let inString = false;
  let escape = false;

  for (let i = start; i < text.length; i++) {
    const ch = text[i];

    if (inString) {
      if (escape) {
        escape = false;
      } else if (ch === '\\') {
        escape = true;
      } else if (ch === '"') {
        inString = false;
      }
      continue;
    }

    if (ch === '"') {
      inString = true;
      continue;
    }

    if (ch === '{') depth++;
    if (ch === '}') {
      depth--;
      if (depth === 0) return text.slice(start, i + 1);
    }
  }

  return null;
}

function repairCommonJsonIssues(jsonText: string): string {
  return jsonText.replace(/,\s*([}\]])/g, '$1');
}

/** Strip accidental markdown fences and surrounding prose before parsing. */
export function extractJsonText(raw: string): string {
  const withoutFences = stripMarkdownFences(raw.trim());
  const balanced = extractBalancedJsonObject(withoutFences);
  if (balanced) return balanced.trim();

  const start = withoutFences.indexOf('{');
  const end = withoutFences.lastIndexOf('}');
  if (start >= 0 && end > start) return withoutFences.slice(start, end + 1).trim();

  return withoutFences.trim();
}

function parseJsonText(jsonText: string): { parsed: unknown; cleanedJson: string } {
  const candidates = [jsonText, repairCommonJsonIssues(jsonText)];
  const uniqueCandidates = [...new Set(candidates.filter(Boolean))];

  let lastError: Error | undefined;

  for (const candidate of uniqueCandidates) {
    try {
      return { parsed: JSON.parse(candidate), cleanedJson: candidate };
    } catch (error) {
      lastError = error instanceof Error ? error : new Error(String(error));
    }
  }

  throw lastError ?? new Error('JSON.parse failed');
}

function readStage1Identity(obj: Record<string, unknown>): PlayerIdentityLog {
  const stage1 = obj.stage1_playerIdentity;
  if (!stage1 || typeof stage1 !== 'object') {
    return {
      selectedPlayerVisualDescription: '',
      selectedPlayerKitColor: '',
      selectedPlayerApproxPosition: '',
      selectedPlayerNearbyPlayers: '',
      identityConfidence: 0,
    };
  }

  const row = stage1 as Record<string, unknown>;
  return {
    selectedPlayerVisualDescription: asString(row.selectedPlayerVisualDescription),
    selectedPlayerKitColor: asString(row.selectedPlayerKitColor),
    selectedPlayerApproxPosition: asString(row.selectedPlayerApproxPosition),
    selectedPlayerNearbyPlayers: asString(row.selectedPlayerNearbyPlayers),
    identityConfidence: asConfidence(row.identityConfidence),
  };
}

function readAttributionVerification(obj: Record<string, unknown>): AttributionVerificationLog {
  const block = obj.attributionVerification;
  if (!block || typeof block !== 'object') {
    return {
      selectedPlayerTouchedBall: 'uncertain',
      selectedPlayerAction: '',
      selectedPlayerFinalLocation: '',
      confidence: 0,
      evidenceTimestamps: [],
    };
  }

  const row = block as Record<string, unknown>;
  return {
    selectedPlayerTouchedBall: asString(row.selectedPlayerTouchedBall, 'uncertain'),
    selectedPlayerAction: asString(row.selectedPlayerAction),
    selectedPlayerFinalLocation: asString(row.selectedPlayerFinalLocation),
    confidence: asConfidence(row.confidence),
    evidenceTimestamps: asStringArray(row.evidenceTimestamps),
  };
}

function logParsedPlayerGrounding(obj: Record<string, unknown>): void {
  const identity = readStage1Identity(obj);
  const attribution = readAttributionVerification(obj);

  console.log('[Grounding] Gemini player identity', {
    selectedPlayerVisualDescription: identity.selectedPlayerVisualDescription,
    selectedPlayerKitColor: identity.selectedPlayerKitColor,
    selectedPlayerApproxPosition: identity.selectedPlayerApproxPosition,
    selectedPlayerNearbyPlayers: identity.selectedPlayerNearbyPlayers,
    identityConfidence: identity.identityConfidence,
    selectedPlayerTouchedBall: attribution.selectedPlayerTouchedBall,
    selectedPlayerAction: attribution.selectedPlayerAction,
    selectedPlayerFinalLocation: attribution.selectedPlayerFinalLocation,
    attributionConfidence: attribution.confidence,
    evidenceTimestamps: attribution.evidenceTimestamps,
  });
}

function validatePlayerGrounding(
  identity: PlayerIdentityLog,
  attribution: AttributionVerificationLog
): void {
  const reasons: string[] = [];

  if (identity.identityConfidence < IDENTITY_CONFIDENCE_THRESHOLD) {
    reasons.push(`identityConfidence=${identity.identityConfidence.toFixed(2)}`);
  }
  if (!identity.selectedPlayerVisualDescription) {
    reasons.push('missing selectedPlayerVisualDescription');
  }
  if (attribution.confidence < ATTRIBUTION_CONFIDENCE_THRESHOLD) {
    reasons.push(`attributionConfidence=${attribution.confidence.toFixed(2)}`);
  }
  if (
    attribution.selectedPlayerTouchedBall === 'uncertain' &&
    attribution.confidence < ATTRIBUTION_CONFIDENCE_THRESHOLD
  ) {
    reasons.push('selectedPlayerTouchedBall=uncertain');
  }

  if (reasons.length > 0) {
    console.warn('[Grounding] Player identity rejected', {
      ...identity,
      attributionConfidence: attribution.confidence,
      selectedPlayerTouchedBall: attribution.selectedPlayerTouchedBall,
      evidenceTimestamps: attribution.evidenceTimestamps,
      rejectionReasons: reasons,
    });
    throw new ServerAnalysisError(PLAYER_GROUNDING_USER_MESSAGE, 'PLAYER_GROUNDING_FAILED');
  }
}

/** Log player identity and attribution fields returned by Gemini. */
export function logPlayerGroundingFromResponse(raw: string): void {
  try {
    const extracted = extractJsonText(raw);
    const { parsed } = parseJsonText(extracted);
    if (!parsed || typeof parsed !== 'object') return;
    logParsedPlayerGrounding(parsed as Record<string, unknown>);
  } catch (error) {
    if (error instanceof ServerAnalysisError) throw error;
    console.warn('[Grounding] Failed to parse player identity from response', {
      message: error instanceof Error ? error.message : String(error),
    });
  }
}

/** @deprecated Use logPlayerGroundingFromResponse */
export function logAttributionFromResponse(raw: string): void {
  logPlayerGroundingFromResponse(raw);
}

export function parseGeminiJson(
  raw: string,
  options?: {
    mode?: 'GOAL' | 'PERFORMANCE' | 'COACH_ME';
    playerTracking?: import('./types.js').PlayerTrackingData;
    playerSelection?: import('./types.js').PlayerSelection;
    validateNarrative?: boolean;
  }
): AnalysisResponse {
  console.log('[Gemini] Raw response before parse', {
    chars: raw.length,
    body: truncateForLog(raw),
  });

  const extracted = extractJsonText(raw);

  console.log('[Gemini] Cleaned JSON before parse', {
    chars: extracted.length,
    body: truncateForLog(extracted),
  });

  let parsed: unknown;
  let cleanedJson: string;

  try {
    const result = parseJsonText(extracted);
    parsed = result.parsed;
    cleanedJson = result.cleanedJson;
  } catch (error) {
    const detail = error instanceof Error ? error.message : String(error);
    throw new ServerAnalysisError(
      `Gemini returned invalid JSON: ${detail}`,
      'INVALID_GEMINI_RESPONSE'
    );
  }

  console.log('[Gemini] JSON parse succeeded', {
    cleanedChars: cleanedJson.length,
    schemaValidation: 'pending',
  });

  if (!parsed || typeof parsed !== 'object') {
    throw new ServerAnalysisError(
      'Gemini response was not a JSON object',
      'INVALID_GEMINI_RESPONSE'
    );
  }

  const obj = parsed as Record<string, unknown>;
  const trackingMetadata = readAnalysisTrackingMetadata(obj);
  logParsedPlayerGrounding(obj);
  logDualTimelineEvidence(
    readCompletePlayTimeline(obj),
    readSelectedPlayerTimeline(obj),
    readReidentificationAttempts(obj),
    trackingMetadata
  );

  const identity = readStage1Identity(obj);
  const attribution = readAttributionVerification(obj);
  validatePlayerGrounding(identity, attribution);

  const rawScores = asScores(obj.scores);
  const strengths = asStringArray(obj.strengths);
  const improvements = asStringArray(obj.improvements);
  let summary = asString(obj.summary, 'Analysis complete.');
  const whatHappened = asString(obj.whatHappened);
  const whyItMattered = asString(obj.whyItMattered);
  const betterOption = asString(obj.betterOption);
  const professionalInsight = asString(obj.professionalInsight);

  const completePlay = readCompletePlayTimeline(obj);
  const selectedPlayer = readSelectedPlayerTimeline(obj);

  if (options?.validateNarrative !== false) {
    const narrativeCheck = validateNarrativeAgainstTimeline({
      whatHappened,
      summary,
      completePlay,
      selectedPlayer,
    });

    if (!narrativeCheck.ok) {
      console.warn('[NarrativeConsistency] Gate fired', {
        contradictions: narrativeCheck.contradictions,
      });
      throw new ServerAnalysisError(
        `Narrative contradicted observed timeline: ${narrativeCheck.contradictions.join(', ')}`,
        'NARRATIVE_TIMELINE_MISMATCH'
      );
    }

    console.log('[NarrativeConsistency] Gate passed');
  }

  const identityConfidence =
    options?.playerSelection?.identityProfile?.identityConfidence ??
    (options?.playerSelection?.reducedTrackingConfidence ? 'LOW' : 'HIGH');

  const lowIdentityDisclaimer =
    'Player identity became uncertain during later phases of the clip. Earlier actions were analysed with high confidence.';

  if (
    identityConfidence === 'LOW' &&
    !summary.toLowerCase().includes('identity became uncertain') &&
    !summary.toLowerCase().includes('analysed with high confidence')
  ) {
    summary = `${lowIdentityDisclaimer} ${summary}`;
  }

  let calibratedScoreList = rawScores;
  if (options?.mode === 'GOAL' || options?.mode === 'PERFORMANCE') {
    const calibration = calibrateScores({
      mode: options.mode,
      rawScores,
      strengths,
      improvements,
      summary,
      whatHappened,
      whyItMattered,
      betterOption,
      professionalInsight,
      trackingMetadata,
      playerTracking: options.playerTracking,
      identityConfidence,
    });
    calibratedScoreList = calibration.scores;
  }

  const response: AnalysisResponse = {
    title: asString(obj.title, 'Coaching analysis'),
    summary,
    whatHappened,
    whyItMattered,
    betterOption,
    professionalInsight,
    trainingAdvice: asStringArray(obj.trainingAdvice),
    strengths,
    improvements,
    scores: calibratedScoreList,
    awards: asStringArray(obj.awards),
  };

  if (options?.mode === 'PERFORMANCE') {
    const primary = parsePerformancePrimaryImprovement(obj);
    response.primaryImprovementArea = primary.primaryImprovementArea;
    response.primaryImprovementReasoning = primary.primaryImprovementReasoning;
  }

  if (!response.whatHappened || !response.whyItMattered) {
    throw new ServerAnalysisError(
      'Gemini response missing required coaching fields',
      'INVALID_GEMINI_RESPONSE'
    );
  }

  console.log('[Gemini] Response schema validation passed', {
    title: response.title,
    scoreCount: response.scores.length,
    trainingAdviceCount: response.trainingAdvice.length,
  });

  return response;
}

/** Safe fallback when narrative cannot be aligned to the observed timeline after retry. */
export function uncertainAnalysisResponse(): AnalysisResponse {
  return buildUncertainAnalysisResponse();
}
