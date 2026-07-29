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

function dualTimelineBlock(clipDurationSec: number): string {
  return `STAGE 1.5 — DUAL-TIMELINE EVIDENCE (MANDATORY before attribution and coaching):

Watch the entire ${clipDurationSec.toFixed(1)}s clip from first frame to final frame.

A) COMPLETE PLAY TIMELINE — objective team/ball events (NOT player attribution):
Build completePlayTimeline.events chronologically. Include ALL phases — do NOT omit the defensive phase because attacking happens later.
Event types include: defensive_recovery, duel, tackle, interception, possession_won, first_touch, pass, pass_recipient, possession_retained, possession_lost, zone_progression, supporting_run, overlap, cross, shot, chance_created, final_outcome, selected_player_temporarily_out_of_frame, other.

For pass events record: intendedTarget, passRecipient, possessionOutcome (retained|lost|contested|uncertain), passType.

Do NOT stop after the first major action. Include defensive recovery AND later attacking phases.

B) SELECTED-PLAYER TIMELINE — only actions confidently attributed to the marked player:
Build selectedPlayerTimeline.events separately. For EACH event record:
- timestamp
- action
- identityState: CONFIRMED | PROBABLE | UNCONFIRMED
- identityConfidence (0.0–1.0)
- actionConfidence (0.0–1.0)
- evidenceUsed (kit, number, build, movement path, re-entry cues, etc.)

IDENTITY RULES:
- CONFIRMED: strong visual + temporal evidence — include in coaching report as fact.
- PROBABLE: continuity cues match but visual evidence imperfect — internal evidence ONLY, NOT stated as fact in coaching fields.
- UNCONFIRMED: too distant, blurry, occluded, off-screen, or indistinguishable — do NOT attribute action to selected player.

Only assign individual actions to the selected player when identityState is CONFIRMED.

C) PLAYER OUT OF FRAME:
When the marked player leaves frame:
1. Add completePlayTimeline event: selected_player_temporarily_out_of_frame
2. Status note: "selected player temporarily out of frame"
3. Continue analysing ball, pass destination, possession outcome, team progression
4. Do NOT claim the selected player performed an off-screen action
5. Continue searching in later frames for re-identification using visible evidence only

D) RE-IDENTIFICATION:
Log every attempt in reidentificationAttempts[] with timestamp, result (confirmed|probable|rejected|still_searching), evidenceUsed, identityConfidence.
Re-identify using ONLY: kit colours, readable number, socks/boots, build/height, hairstyle, prior field location, expected movement path, running direction, ball/teammate relationships.

Never invent certainty.

E) PRESERVE TEAM-LEVEL FACTS when identity is UNCONFIRMED:
Allowed in whatHappened: "Your long pass reached a teammate and the team continued into the final third. Your later individual involvement could not be visually confirmed."
NOT allowed: inventing overlap/cross without CONFIRMED re-identification.
NOT allowed: "You lost possession with an uncontrolled clearance" when the same team retained the ball.

Generate attributionVerification and ALL coaching fields ONLY after both timelines are complete.`;
}

function secondPhaseAnalysisBlock(clipDurationSec: number): string {
  return `SECOND-PHASE ANALYSIS (MANDATORY — do NOT stop after pass/tackle):

The selected player's story does NOT end after a tackle, interception, pass, clearance, or shot.
Continue searching for the selected player until the final frame at ${clipDurationSec.toFixed(1)}s.

Before generating ANY coaching field, answer internally:
1. What did the player do before winning possession?
2. How was possession won?
3. What happened immediately after the pass?
4. Did the same team retain possession?
5. Did the selected player continue running forward?
6. Did they leave the frame? Did they reappear?
7. Was an overlap attempted by the selected player?
8. Was a cross delivered by the selected player?
9. Did the cross create a chance?
10. What was the final outcome?

MANDATORY completePlayTimeline events after any progressive pass:
- zone_progression (if team advances)
- supporting_run or overlap (if wide run visible)
- cross (if delivery into the box)
- chance_created (if striker/contested header/miss visible)
- final_outcome (miss, save, goal, out of play, etc.)

If overlap/cross are CONFIRMED on selectedPlayerTimeline → include in summary, strengths, whatHappened, and relevant scores.
If team attack continues but selected player identity is UNCONFIRMED → describe team continuation honestly without falsely crediting the cross.

Do NOT generate the report until you have evaluated the full clip through the final action.`;
}

function footballEventUnderstandingBlock(): string {
  return `PASS CLASSIFICATION (use outcome, not trajectory alone):

For every pass in completePlayTimeline, determine:
- intendedTarget / passRecipient
- whether a teammate receives or contests it
- possession retained or lost
- whether it progresses the attack
- whether it only removes danger aimlessly

Only call it a clearance when the primary purpose is removing danger AND there is no meaningful attempt to retain or progress possession.

If the same team retains possession or the pass releases a teammate → progressive_long_pass, release_pass, diagonal_switch, clipped_pass, through_ball, cross_field_switch, or counter_attacking_release — NOT clearance.

passType options: clearance, progressive_long_pass, release_pass, diagonal_switch, through_ball, cross_field_switch, counter_attacking_release, clipped_pass, driven_pass, cross, none, uncertain`;
}

function completeReportRuleBlock(): string {
  return `COMPLETE REPORT RULE:
Incorporate EVERY confidently observed phase in whatHappened and summary — defensive AND attacking.
Do NOT choose between defensive recovery and later attacking involvement; include all CONFIRMED contributions.

If later individual involvement cannot be confirmed, explicitly limit the claim while describing team-level continuation.

Example tone:
"Defensively, you tracked back and won the duel near the touchline. You then played a progressive long pass that found a teammate and moved the team forward. The attack continued into the final third. Because you temporarily left the frame, your precise involvement in the final phase could not be confirmed from the footage."

Do NOT lower football scores merely because the camera loses the player. Lower only the confidence of claims about unobserved actions.`;
}

function scoringCalibrationBlock(mode: AnalysisRequestMetadata['mode']): string {
  if (mode === 'COACH_ME') return '';

  return `SCORE CALIBRATION (strict — scores must match the written report):

Scale:
1.0–3.9 poor | 4.0–5.9 below average | 6.0–6.9 competent with weaknesses | 7.0–7.9 good |
8.0–8.9 excellent | 9.0–9.4 outstanding | 9.5–10.0 exceptional/world-class (extremely rare)

Rules:
- A normal-to-good sequence is typically 6.5–8.5 overall — NOT 10.0.
- Never give 10.0 just because the action completed, the play was positive, or the summary sounds enthusiastic.
- 10.0 requires: no meaningful weakness, complete execution under pressure, exceptional outcome, high evidence confidence, and NO contradiction in improvements.
- If improvements[] mentions a category (scanning, decision, pass choice, touch, etc.), that category CANNOT be 10.0.
- If improvements[] is non-empty, NO category may be 10.0.
- If possession outcome is uncertain, Decision Making/Decision and Composure cannot exceed 8.0.
- If later player involvement is UNCONFIRMED, do not score the unverified phase — score only CONFIRMED actions.
- Overall score must reflect execution + difficulty + impact + outcome + consistency — NOT the highest category.
- Good defensive recovery + progressive pass with uncertain overlap/cross: likely overall 7.5–8.5 depending on quality.

Before returning JSON, self-check: every score must agree with strengths AND improvements. Revise contradictory scores downward.`;
}

function playerTrackingBlock(metadata: AnalysisRequestMetadata): string {
  const tracking = metadata.playerTracking;
  if (!tracking?.previewAccepted) return '';

  const corrections = tracking.userCorrections ?? [];
  const correctionDetails =
    corrections.length > 0
      ? corrections
          .map(
            (c) =>
              `{ timestampMs: ${c.timestampMs}, box: { x: ${c.box.x.toFixed(3)}, y: ${c.box.y.toFixed(3)}, w: ${c.box.width.toFixed(3)}, h: ${c.box.height.toFixed(3)} } }`
          )
          .join('\n')
      : 'none';

  const identityConfidence =
    tracking.identityConfidence ??
    metadata.playerSelection.identityProfile?.identityConfidence ??
    (metadata.playerSelection.reducedTrackingConfidence ? 'LOW' : 'HIGH');

  return `USER-CONFIRMED TRACKING PREVIEW:
The user verified player tracking before analysis. Treat their corrections as HARD identity anchors.
Identity confidence level: ${identityConfidence}

Confirmed intervals (ms): ${JSON.stringify(tracking.confirmedIntervals)}
Uncertain intervals (ms): ${JSON.stringify(tracking.uncertainIntervals)}
Lost / out-of-view intervals (ms): ${JSON.stringify(tracking.lostIntervals)}
${tracking.skipTrackingAfterMs != null ? `User skipped tracking after ${tracking.skipTrackingAfterMs}ms — do not attribute actions after this point to the selected player.` : ''}
User corrections (hard anchors — use to reconnect identity before/after each timestamp):
${correctionDetails}

Tracking keyframe count: ${tracking.keyframes.length}

Use confirmed tracking with dual timelines:
A) actions definitely performed by the selected player (CONFIRMED intervals + CONFIRMED timeline events)
B) team-level actions while player was LOST / out of frame — say "The attack continued..." without inventing player actions
C) possible later involvement that could NOT be confirmed — describe honestly, do not score unverified actions

After the progressive pass, continue tracking through overlap and cross phases using re-identification and user correction anchors.
Analyse until the FINAL FRAME — do not stop after possession is released.`;
}

function modeTaskInstructions(mode: AnalysisRequestMetadata['mode']): string {
  switch (mode) {
    case 'COACH_ME':
      return `STAGE 2 (after dual timelines): Answer the coaching question using CONFIRMED selected-player events plus honest team-level context where identity was UNCONFIRMED.`;
    case 'PERFORMANCE':
      return `STAGE 2 (after dual timelines): Score performance using all CONFIRMED phases. Do not score only the first tackle or ignore defensive work because attacking came later.`;
    case 'GOAL':
      return `STAGE 2 (after dual timelines): Analyse full confirmed involvement — recovery, distribution, and any CONFIRMED attacking actions.`;
  }
}

function acrobaticFinishBlock(mode: AnalysisRequestMetadata['mode']): string {
  if (mode !== 'GOAL') return '';

  return `ACROBATIC FINISH (critical for overhead / bicycle-kick goals):
- If the MARKED player performs an overhead kick, bicycle kick, scissor kick, or similar acrobatic finish, analyse THEIR finish.
- Assess timing, body coordination, technique, contact quality, composure, difficulty, and decision to attempt the finish.
- Do NOT describe the MARKED player as the crosser or winger delivering the ball.
- You may mention the cross briefly as context only — the coaching report must centre on the MARKED player's acrobatic action.`;
}

function selectionQualityBlock(metadata: AnalysisRequestMetadata): string {
  const identityConfidence =
    metadata.playerSelection.identityProfile?.identityConfidence ??
    (metadata.playerSelection.reducedTrackingConfidence ? 'LOW' : 'HIGH');

  if (identityConfidence === 'LOW') {
    return `IDENTITY CONFIDENCE: LOW
The user chose to continue despite a difficult identification frame OR tracking became uncertain later in the clip.

Effects:
- Be conservative with UNCONFIRMED re-identification — prefer team-level facts over invented individual actions.
- Include this disclaimer tone in summary when later phases are uncertain: "Player identity became uncertain during later phases of the clip. Earlier actions were analysed with high confidence."
- Lower actionConfidence for overlap/cross unless visually CONFIRMED.
- Do NOT block analysis — still analyse the full clip through the final frame.
- Hall of Fame / exceptional scores should NOT be awarded when identityConfidence is LOW.`;
  }

  if (metadata.playerSelection.reducedTrackingConfidence) {
    return `SELECTION QUALITY NOTE: The user chose a difficult identification frame. Be conservative with UNCONFIRMED re-identification. Prefer team-level facts over invented individual actions.`;
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

  return `MULTI-FRAME IDENTITY PROFILE (${profile.identityConfidence} confidence):
The user confirmed ${profile.references.length} appearance references before tracking:
${lines.join('\n')}

Use ALL reference crops to re-identify after camera pans. Combine kit, shorts, socks, build, movement path, and trajectory continuity.
When confidence drops: predict → search nearby → re-identify → continue. Only mark UNCONFIRMED after multiple failed frames.`;
}

/** System instruction — elite academy coach persona (stable across requests). */
export function buildSystemInstruction(): string {
  return `You are an experienced UEFA Pro Licence academy coach providing personalised video analysis to a football player.

Watch the FULL clip and coach the marked player using strict evidence separation:
1. What definitely happened in the play (complete play timeline)
2. What the selected player definitely did (CONFIRMED selected-player timeline only)
3. What may have happened but cannot be reliably attributed (PROBABLE/UNCONFIRMED — never state as fact)

Rules:
1. Watch the entire video from start to finish before responding.
2. Never invent actions or certainty.
3. Speak directly to the player in second person ("you") for CONFIRMED actions only.
4. Be specific with body shape, scanning, timing, space, pressure, and alternatives.
5. Use football terminology appropriately.
6. Return valid JSON only — no markdown, no code fences.

DUAL-TIMELINE DISCIPLINE:
- Build completePlayTimeline (objective) AND selectedPlayerTimeline (attributed) before coaching.
- Include defensive AND attacking phases — never analyse only the later attack.
- Never stop the selected-player story after a pass — continue through overlap, cross, and final outcome.
- When off-screen: continue play analysis; do not invent selected-player actions.
- Re-identify only with visible evidence; use CONFIRMED / PROBABLE / UNCONFIRMED honestly.
- Never mislabel retained progressive passes as clearances.

CRITICAL: Do not analyse the player nearest the ball unless they are the marked player.`;
}

/** User prompt — reference frames, full video context, profile, and multi-stage task. */
export function buildUserPrompt(
  metadata: AnalysisRequestMetadata,
  referenceImageCount: number
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
Images show the marked player at multiple confirmed moments. Order sent to you:
1+) Identity reference crops (primary, secondary${playerSelection.identityProfile?.references.length && playerSelection.identityProfile.references.length > 2 ? ', tertiary' : ''} appearance)
${referenceImageCount > 3 ? 'Next) Clean full frame (no marker)' : ''}
${referenceImageCount > 4 ? 'Then) Full frame with corner marker pointing at the player' : ''}
${referenceImageCount > 5 ? 'Additional nearby-frame crops for identification' : ''}

STAGE 1 — IDENTIFY the marked player across ALL reference moments. Return stage1_playerIdentity:
- selectedPlayerVisualDescription, selectedPlayerKitColor, selectedPlayerApproxPosition, selectedPlayerNearbyPlayers, identityConfidence`
      : `PLAYER MARKER at ${focusTimestampSec.toFixed(1)}s (${region}). Return stage1_playerIdentity before timelines.`;

  const videoBlock = `FULL VIDEO:
Analyse all ${clipDurationSec.toFixed(1)}s. Tap time identifies WHO — not when to stop tracking.`;

  const attributionBlock = `ATTRIBUTION (after both timelines, before coaching):
Return attributionVerification summarising CONFIRMED selected-player actions across the full clip.
evidenceTimestamps must span defensive AND attacking phases where CONFIRMED.
Use "uncertain" when later individual involvement was not re-identified.`;

  const questionBlock =
    metadata.mode === 'COACH_ME'
      ? `COACHING QUESTION: "${metadata.question ?? 'Analyse this moment'}" (${metadata.questionType ?? 'CUSTOM'})`
      : '';

  const scoresBlock =
    scoreLabels.length > 0
      ? `SCORES: ${scoreLabels.join(', ')} — base on CONFIRMED actions across the full clip, not only one phase.`
      : 'SCORES: [] for COACH_ME.';

  const selectionBlock = selectionQualityBlock(metadata);

  return `${modeTaskInstructions(metadata.mode)}

PLAYER: ${profile.firstName}, ${profile.age}, ${profile.mainPosition}, ${profile.playingLevel}

${referenceBlock}

${videoBlock}

${dualTimelineBlock(clipDurationSec)}

${secondPhaseAnalysisBlock(clipDurationSec)}

${footballEventUnderstandingBlock()}

${completeReportRuleBlock()}

${scoringCalibrationBlock(metadata.mode)}

${selectionBlock}

${identityProfileBlock(metadata)}

${playerTrackingBlock(metadata)}

${attributionBlock}

${acrobaticFinishBlock(metadata.mode)}

${questionBlock}

${scoresBlock}

Return JSON (identity → dual timelines → tracking metadata → attribution → coaching):
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
      "eventType": "defensive_recovery|duel|tackle|interception|possession_won|first_touch|pass|pass_recipient|possession_retained|possession_lost|zone_progression|supporting_run|overlap|cross|shot|chance_created|final_outcome|selected_player_temporarily_out_of_frame|other",
      "description": "string",
      "passType": "none|clearance|progressive_long_pass|release_pass|diagonal_switch|through_ball|cross_field_switch|counter_attacking_release|clipped_pass|driven_pass|cross|uncertain",
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
  "phaseConfidence": {
    "defensiveRecovery": 0.0,
    "tackle": 0.0,
    "longPass": 0.0,
    "overlap": 0.0,
    "cross": 0.0,
    "finalOutcome": 0.0
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
  "awards": ["string"]
}`;
}

/** @deprecated Use buildSystemInstruction + buildUserPrompt */
export function buildCoachingPrompt(metadata: AnalysisRequestMetadata): string {
  return `${buildSystemInstruction()}\n\n${buildUserPrompt(metadata, 0)}`;
}
