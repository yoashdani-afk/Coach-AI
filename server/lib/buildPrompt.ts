import type { AnalysisRequestMetadata } from './types.js';
import {
  describeMarkerRegion,
  getClipDurationSec,
  getFocusTimestampSec,
} from './videoWindow.js';

const PERFORMANCE_SCORE_LABELS = [
  'Decision Making',
  'Positioning',
  'Scanning',
  'Movement',
  'First Touch',
  'Composure',
  'Communication',
];

/** Allowed values for Performance-only primaryImprovementArea (or null). */
export const PERFORMANCE_PRIMARY_IMPROVEMENT_AREAS = [
  'Decision Making',
  'Positioning',
  'Scanning',
  'Movement',
  'First Touch',
  'Composure',
  'Communication',
] as const;

export type PerformancePrimaryImprovementArea =
  (typeof PERFORMANCE_PRIMARY_IMPROVEMENT_AREAS)[number];

/** Parse Performance-only primary improvement fields; invalid/missing → null (never throws). */
export function parsePerformancePrimaryImprovement(obj: Record<string, unknown>): {
  primaryImprovementArea: PerformancePrimaryImprovementArea | null;
  primaryImprovementReasoning: string | null;
} {
  const rawArea = obj.primaryImprovementArea;
  let primaryImprovementArea: PerformancePrimaryImprovementArea | null = null;

  if (typeof rawArea === 'string') {
    const trimmed = rawArea.trim();
    if (
      trimmed.length > 0 &&
      trimmed.toLowerCase() !== 'null' &&
      (PERFORMANCE_PRIMARY_IMPROVEMENT_AREAS as readonly string[]).includes(trimmed)
    ) {
      primaryImprovementArea = trimmed as PerformancePrimaryImprovementArea;
    }
  }

  let primaryImprovementReasoning: string | null = null;
  if (primaryImprovementArea != null) {
    const rawReason = obj.primaryImprovementReasoning;
    if (typeof rawReason === 'string' && rawReason.trim().length > 0) {
      primaryImprovementReasoning = rawReason.trim();
    }
  }

  return { primaryImprovementArea, primaryImprovementReasoning };
}

const GOAL_SCORE_LABELS = [
  'Finish',
  'Technique',
  'Difficulty',
  'Creativity',
  'Decision',
  'Composure',
];

function scoreLabelsForMode(mode: AnalysisRequestMetadata['mode']): string[] {
  switch (mode) {
    case 'PERFORMANCE':
      return PERFORMANCE_SCORE_LABELS;
    case 'GOAL':
      return GOAL_SCORE_LABELS;
    default:
      return [];
  }
}

function objectiveTimelineBlock(clipDurationSec: number): string {
  return `OBJECTIVE TIMELINE (MANDATORY before coaching):

Watch the entire ${clipDurationSec.toFixed(1)}s clip from first frame to final frame.

First determine what objectively happens in the clip from beginning to end.
Do not assume any specific event type.

Only report an event if it is visually supported in the footage.

Build completePlayTimeline.events chronologically with:
- timestamp
- eventType (neutral visible label: pass, shot, goal, set_piece, duel, dribble, run, save, possession_change, final_outcome, other)
- description (neutral, factual — describe what you see, not what you expect)
- confidence (0.0–1.0)

Build selectedPlayerTimeline.events separately for the MARKED player only:
- timestamp
- action
- identityState: CONFIRMED | PROBABLE | UNCONFIRMED
- identityConfidence (0.0–1.0)
- actionConfidence (0.0–1.0)
- evidenceUsed

Only assign individual actions to the selected player when identityState is CONFIRMED.
If involvement is uncertain, say so — do not invent actions.`;
}

function goalModeBlock(): string {
  return `GOAL MODE RULES:
1. First determine whether a goal actually occurs.
2. Determine the sequence immediately leading to the goal.
3. Determine whether the selected player is the shooter, assister, set-piece taker, supporting player, or not confidently involved.
4. Never invent defensive actions or passes that are not visible.
5. Base scores only on CONFIRMED involvement.`;
}

function modeTaskInstructions(mode: AnalysisRequestMetadata['mode']): string {
  switch (mode) {
    case 'COACH_ME':
      return `TASK: After timelines and identity verification, answer the coaching question using CONFIRMED selected-player events plus honest team-level context where identity was UNCONFIRMED.`;
    case 'PERFORMANCE':
      // primaryImprovement rules live late (pre-schema) — avoid duplicating null-handling here.
      return `TASK: After timelines and identity verification, score performance using only CONFIRMED selected-player actions visible in the clip.`;
    case 'GOAL':
      return `TASK: After timelines and identity verification, analyse the goal sequence and the selected player's CONFIRMED role.`;
  }
}

/** Shared condensed Goal tier anchors (also used by dense coaching path). */
export function goalScoreCalibrationBlock(): string {
  return `SCORE CALIBRATION (GOAL MODE — fixed anchor tiers):
Place overall and category scores in the matching tier (fixed anchors, not a free-floating 1–10):
- 9.5–10 (World-class): Extremely rare, near-flawless technique (e.g. bicycle, long-range under real pressure).
- 8–9.4 (Excellent): Clear skill — well-struck first-time, composed 1v1, or strong combination play.
- 6.5–7.9 (Good/solid): Decent technique, moderate difficulty; fairly standard finish.
- 5–6.4 (Average): Simple/low-difficulty finish (tap-in, open goal); still a goal, nothing remarkable.
- Below 5: Rare for a scored goal — heavily fortunate/deflected with essentially no skill.

Also: if improvements[] mentions a category, that category cannot be 10.0; do not score UNCONFIRMED phases.`;
}

function scoringCalibrationBlock(mode: AnalysisRequestMetadata['mode']): string {
  if (mode === 'COACH_ME') return '';

  if (mode === 'GOAL') {
    return goalScoreCalibrationBlock();
  }

  return `SCORE CALIBRATION:
Scale: 1.0–3.9 poor | 4.0–5.9 below average | 6.0–6.9 competent | 7.0–7.9 good | 8.0–8.9 excellent | 9.0+ outstanding (rare)
- Base scores only on visually confirmed actions.
- If improvements[] mentions a category, that category cannot be 10.0.
- If selected-player involvement is UNCONFIRMED, do not score unverified phases.`;
}

function primaryImprovementBlock(mode: AnalysisRequestMetadata['mode']): string {
  if (mode !== 'PERFORMANCE') return '';

  return `PRIMARY IMPROVEMENT (PERFORMANCE ONLY — required fields):
- primaryImprovementArea: exactly one of ${PERFORMANCE_PRIMARY_IMPROVEMENT_AREAS.map((a) => `"${a}"`).join(', ')}, OR null.
- primaryImprovementReasoning: 1–2 sentences explaining why that area is the priority, OR null.
- Use null for BOTH fields when performance is strong across the board with no clear single weakness.
- Do NOT force the lowest-scoring category if there is no meaningful standout weakness.`;
}

function playerTrackingBlock(metadata: AnalysisRequestMetadata): string {
  const tracking = metadata.playerTracking;
  if (!tracking?.previewAccepted) return '';

  return `USER-CONFIRMED TRACKING PREVIEW:
The user verified player tracking before analysis. Treat their corrections as hard identity anchors.
Confirmed intervals (ms): ${JSON.stringify(tracking.confirmedIntervals)}
Lost / out-of-view intervals (ms): ${JSON.stringify(tracking.lostIntervals)}`;
}

function selectionQualityBlock(metadata: AnalysisRequestMetadata): string {
  const identityConfidence =
    metadata.playerSelection.identityProfile?.identityConfidence ??
    (metadata.playerSelection.reducedTrackingConfidence ? 'LOW' : 'HIGH');

  if (identityConfidence === 'LOW') {
    return `IDENTITY CONFIDENCE: LOW — be conservative. Prefer team-level facts over invented individual actions.`;
  }
  if (metadata.playerSelection.trackingQualityWarning) {
    return `SELECTION QUALITY NOTE: Reference images may show a small or distant player. Require stronger evidence for CONFIRMED attribution.`;
  }
  return '';
}

function identityProfileBlock(metadata: AnalysisRequestMetadata): string {
  const profile = metadata.playerSelection.identityProfile;
  if (!profile?.references.length) return '';

  const lines = profile.references.map(
    (ref, index) =>
      `${index + 1}) ${ref.label} reference at ${(ref.timestampMs / 1000).toFixed(1)}s — tap (${ref.normalizedX.toFixed(3)}, ${ref.normalizedY.toFixed(3)})`
  );

  return `IDENTITY REFERENCES (${profile.identityConfidence} confidence):
${lines.join('\n')}
Use reference crops to identify the marked player. Do not confuse them with nearby players.`;
}

/** System instruction — elite academy coach persona (stable across requests). */
export function buildSystemInstruction(): string {
  return `You are an experienced UEFA Pro Licence academy coach providing personalised video analysis to a football player.

Watch the FULL clip before responding.

Rules:
1. Observe first. Report only what is visually supported.
2. Never invent actions or certainty.
3. Speak in second person ("you") only for CONFIRMED selected-player actions.
4. Be specific with body shape, timing, space, and pressure when evidence supports it.
5. Return valid JSON only — no markdown, no code fences.

Build completePlayTimeline (objective) AND selectedPlayerTimeline (attributed) before writing coaching fields.
Use CONFIRMED / PROBABLE / UNCONFIRMED honestly.

CRITICAL: Do not analyse the player nearest the ball unless they are the marked player.`;
}

/** User prompt — reference frames, full video context, profile, and task. */
export function buildUserPrompt(
  metadata: AnalysisRequestMetadata,
  referenceImageCount: number,
  extraInstruction = ''
): string {
  const { profile, playerSelection, clip } = metadata;
  const focusTimestampSec = getFocusTimestampSec(playerSelection, clip.durationMs);
  const clipDurationSec = getClipDurationSec(clip.durationMs);
  const region = describeMarkerRegion(
    playerSelection.normalizedX,
    playerSelection.normalizedY
  );
  const scoreLabels = scoreLabelsForMode(metadata.mode);

  const referenceBlock =
    referenceImageCount > 0
      ? `REFERENCE IMAGES (read in order before the video):
Images show the marked player. The video and images are already display-oriented (upright).
Order sent to you:
1+) Identity reference crops
${referenceImageCount > 2 ? 'Next) Clean full frame (no marker)' : ''}
${referenceImageCount > 3 ? 'Then) Full frame with corner marker pointing at the player' : ''}
${referenceImageCount > 4 ? 'Additional nearby-frame crops for identification' : ''}

STAGE 1 — IDENTIFY the marked player. Return stage1_playerIdentity:
- selectedPlayerVisualDescription, selectedPlayerKitColor, selectedPlayerApproxPosition, selectedPlayerNearbyPlayers, identityConfidence`
      : `PLAYER MARKER at ${focusTimestampSec.toFixed(1)}s (${region}). Return stage1_playerIdentity before timelines.`;

  const videoBlock = `FULL VIDEO (display-oriented, upright):
Analyse all ${clipDurationSec.toFixed(1)}s from start to finish.`;

  const attributionBlock = `ATTRIBUTION (after timelines, before coaching):
Return attributionVerification summarising CONFIRMED selected-player actions.
Use "uncertain" when involvement was not visually confirmed.`;

  const questionBlock =
    metadata.mode === 'COACH_ME'
      ? `COACHING QUESTION: "${metadata.question ?? 'Analyse this moment'}" (${metadata.questionType ?? 'CUSTOM'})`
      : '';

  const scoresBlock =
    scoreLabels.length > 0
      ? `SCORES: ${scoreLabels.join(', ')} — base on CONFIRMED actions only.`
      : 'SCORES: [] for COACH_ME.';

  const goalBlock = metadata.mode === 'GOAL' ? goalModeBlock() : '';

  const performanceImprovementSchema =
    metadata.mode === 'PERFORMANCE'
      ? `,
  "primaryImprovementArea": "Decision Making|Positioning|Scanning|Movement|First Touch|Composure|Communication|null",
  "primaryImprovementReasoning": "string|null"`
      : '';

  return `${modeTaskInstructions(metadata.mode)}

PLAYER: ${profile.firstName}, ${profile.age}, ${profile.mainPosition}, ${profile.playingLevel}

${referenceBlock}

${videoBlock}

${objectiveTimelineBlock(clipDurationSec)}

${goalBlock}

${selectionQualityBlock(metadata)}

${identityProfileBlock(metadata)}

${playerTrackingBlock(metadata)}

${attributionBlock}

${questionBlock}

${scoresBlock}

${extraInstruction}

${scoringCalibrationBlock(metadata.mode)}

${primaryImprovementBlock(metadata.mode)}

Return JSON (identity → timelines → attribution → coaching):
{
  "stage1_playerIdentity": {
    "selectedPlayerVisualDescription": "string",
    "selectedPlayerKitColor": "string",
    "selectedPlayerApproxPosition": "string",
    "selectedPlayerNearbyPlayers": "string",
    "identityConfidence": 0.0
  },
  "completePlayTimeline": {
    "finalFrameAnalysed": true,
    "timelineConfidence": 0.0,
    "events": [{
      "timestamp": "X.Xs",
      "eventType": "pass|shot|goal|set_piece|tackle|duel|dribble|run|save|cross|possession_change|final_outcome|other",
      "description": "string",
      "passType": "none|short|long|cross|uncertain",
      "passRecipient": "string",
      "possessionOutcome": "retained|lost|contested|uncertain|none",
      "confidence": 0.0
    }]
  },
  "selectedPlayerTimeline": {
    "events": [{
      "timestamp": "X.Xs",
      "action": "string",
      "identityState": "CONFIRMED|PROBABLE|UNCONFIRMED",
      "identityConfidence": 0.0,
      "actionConfidence": 0.0,
      "evidenceUsed": "string"
    }],
    "excludedUncertainActions": ["string"]
  },
  "reidentificationAttempts": [{
    "timestamp": "X.Xs",
    "result": "confirmed|probable|rejected|still_searching",
    "evidenceUsed": "string",
    "identityConfidence": 0.0
  }],
  "analysisTrackingMetadata": {
    "playerTrackingConfidence": 0.0,
    "completePlayConfidence": 0.0,
    "uncertainIntervals": ["X.Xs–Y.Ys"],
    "selectedPlayerVisiblePercentage": 0.0,
    "reidentificationCount": 0
  },
  "attributionVerification": {
    "selectedPlayerTouchedBall": "true|false|uncertain",
    "selectedPlayerAction": "string",
    "selectedPlayerFinalLocation": "string",
    "confidence": 0.0,
    "evidenceTimestamps": ["string"]
  },
  "title": "string",
  "summary": "string",
  "whatHappened": "string",
  "whyItMattered": "string",
  "betterOption": "string",
  "professionalInsight": "string",
  "trainingAdvice": ["string"],
  "strengths": ["string"],
  "improvements": ["string"],
  "scores": [{ "label": "string", "value": 0 }],
  "awards": ["string"]${performanceImprovementSchema}
}`;
}

/** @deprecated Use buildSystemInstruction + buildUserPrompt */
export function buildCoachingPrompt(metadata: AnalysisRequestMetadata): string {
  return `${buildSystemInstruction()}\n\n${buildUserPrompt(metadata, 0)}`;
}
