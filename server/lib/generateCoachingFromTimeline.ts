import type { GoogleGenAI, Part } from '@google/genai';
import type { AnalysisRequestMetadata, AnalysisResponse, AnalysisScore } from './types.js';
import type { FactualEventAnalysis } from './factualEventTypes.js';
import { callGeminiJson } from './geminiJsonCall.js';
import { extractJsonText } from './parseResponse.js';
import { ServerAnalysisError } from './analysisErrors.js';
import { calibrateScores } from './scoreCalibration.js';
import { goalScoreCalibrationBlock, parsePerformancePrimaryImprovement } from './buildPrompt.js';

function asString(value: unknown, fallback = ''): string {
  return typeof value === 'string' ? value.trim() : fallback;
}

function asStringArray(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return value.filter((item): item is string => typeof item === 'string').map((s) => s.trim()).filter(Boolean);
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
      return { label, value: Math.round(Math.min(10, Math.max(0, raw)) * 10) / 10 };
    })
    .filter((s): s is AnalysisScore => s !== null);
}

function buildCoachingSystemInstruction(): string {
  return `You are an experienced UEFA Pro Licence academy coach.

You may ONLY reference events present in the supplied VERIFIED factual timeline.

You are forbidden from introducing football events absent from that verified timeline.

If selected-player involvement is uncertain, say so explicitly.

Do not convert team-level events into selected-player actions unless the verified timeline supports it.

Return valid JSON only — no markdown.`;
}

function goalModeRules(factual: FactualEventAnalysis): string {
  if (factual.goalOccurred !== true) {
    return `GOAL MODE:
goalOccurred is NOT true in the factual timeline.
Do NOT generate a goal rating report.
Explain what happened objectively and whether the selected player's involvement was confirmed or uncertain.
Return scores as an empty array.`;
  }

  return `GOAL MODE:
goalOccurred is true.
First classify the selected player's role as one of:
- scorer
- assister
- set-piece taker
- supporting player
- no confirmed involvement
- uncertain

Only score attributes relevant to that confirmed role.
Do not credit actions that are absent from the verified timeline.`;
}

function buildCoachingUserPrompt(
  metadata: AnalysisRequestMetadata,
  factual: FactualEventAnalysis,
  extraInstruction = ''
): string {
  const { profile, mode } = metadata;
  const questionBlock =
    mode === 'COACH_ME'
      ? `COACHING QUESTION: "${metadata.question ?? 'Analyse this moment'}" (${metadata.questionType ?? 'CUSTOM'})`
      : '';

  const scoresBlock =
    mode === 'GOAL'
      ? 'SCORES: Finish, Technique, Difficulty, Creativity, Decision, Composure — only if role is confirmed.'
      : mode === 'PERFORMANCE'
        ? 'SCORES: Decision Making, Positioning, Scanning, Movement, First Touch, Composure, Communication — only for CONFIRMED actions.'
        : 'SCORES: [] for COACH_ME.';

  const goalCalibration = mode === 'GOAL' ? goalScoreCalibrationBlock() : '';

  const performanceImprovementBlock =
    mode === 'PERFORMANCE'
      ? `PRIMARY IMPROVEMENT (required):
- primaryImprovementArea: one of "Decision Making"|"Positioning"|"Scanning"|"Movement"|"First Touch"|"Composure"|"Communication", OR null
- primaryImprovementReasoning: 1–2 sentences, OR null
- Use null for both when there is no clear single weakness — do not force the lowest score.`
      : '';

  const performanceImprovementSchema =
    mode === 'PERFORMANCE'
      ? `,
  "primaryImprovementArea": "Decision Making|Positioning|Scanning|Movement|First Touch|Composure|Communication|null",
  "primaryImprovementReasoning": "string|null"`
      : '';

  const modeRules = mode === 'GOAL' ? goalModeRules(factual) : '';

  return `${modeRules}

PLAYER: ${profile.firstName}, ${profile.age}, ${profile.mainPosition}, ${profile.playingLevel}
MODE: ${mode}

FACTUAL TIMELINES (verified — authoritative; do not add events):
${JSON.stringify(
  {
    verifiedOnly: true,
    playType: factual.playType,
    goalOccurred: factual.goalOccurred,
    completePlayTimeline: factual.completePlayTimeline,
    selectedPlayerTimeline: factual.selectedPlayerTimeline,
    uncertainEvents: factual.uncertainEvents,
  },
  null,
  2
)}

${questionBlock}

${scoresBlock}

${goalCalibration}

${performanceImprovementBlock}

${extraInstruction}

Do not add events beyond the FACTUAL TIMELINES above.

Return JSON:
{
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

export function parseCoachingFromTimelineJson(
  raw: string,
  metadata: AnalysisRequestMetadata
): AnalysisResponse {
  let parsed: unknown;
  try {
    parsed = JSON.parse(extractJsonText(raw));
  } catch (error) {
    throw new ServerAnalysisError(
      `Coaching response invalid JSON: ${error instanceof Error ? error.message : String(error)}`,
      'INVALID_GEMINI_RESPONSE'
    );
  }

  if (!parsed || typeof parsed !== 'object') {
    throw new ServerAnalysisError('Coaching response was not a JSON object', 'INVALID_GEMINI_RESPONSE');
  }

  const obj = parsed as Record<string, unknown>;
  const rawScores = asScores(obj.scores);
  const strengths = asStringArray(obj.strengths);
  const improvements = asStringArray(obj.improvements);
  const summary = asString(obj.summary, 'Analysis complete.');
  const whatHappened = asString(obj.whatHappened);
  const whyItMattered = asString(obj.whyItMattered);
  const betterOption = asString(obj.betterOption);
  const professionalInsight = asString(obj.professionalInsight);

  if (!whatHappened || !whyItMattered) {
    throw new ServerAnalysisError('Coaching response missing required fields', 'INVALID_GEMINI_RESPONSE');
  }

  let scores = rawScores;
  if (metadata.mode === 'GOAL' || metadata.mode === 'PERFORMANCE') {
    scores = calibrateScores({
      mode: metadata.mode,
      rawScores,
      strengths,
      improvements,
      summary,
      whatHappened,
      whyItMattered,
      betterOption,
      professionalInsight,
      identityConfidence:
        metadata.playerSelection.identityProfile?.identityConfidence ??
        (metadata.playerSelection.reducedTrackingConfidence ? 'LOW' : 'HIGH'),
    }).scores;
  }

  return {
    title: asString(obj.title, 'Coaching analysis'),
    summary,
    whatHappened,
    whyItMattered,
    betterOption,
    professionalInsight,
    trainingAdvice: asStringArray(obj.trainingAdvice),
    strengths,
    improvements,
    scores,
    awards: asStringArray(obj.awards),
    ...(metadata.mode === 'PERFORMANCE' ? parsePerformancePrimaryImprovement(obj) : {}),
  };
}

/** Second Gemini call — coaching generated ONLY from factual timelines (no raw video). */
export async function generateCoachingFromTimeline(params: {
  ai: GoogleGenAI;
  modelName: string;
  metadata: AnalysisRequestMetadata;
  factual: FactualEventAnalysis;
  extraInstruction?: string;
  requestId?: string;
}): Promise<AnalysisResponse> {
  const parts: Part[] = [
    {
      text: buildCoachingUserPrompt(params.metadata, params.factual, params.extraInstruction ?? ''),
    },
  ];

  const raw = await callGeminiJson({
    ai: params.ai,
    modelName: params.modelName,
    label: 'generate-coaching-from-timeline',
    systemInstruction: buildCoachingSystemInstruction(),
    parts,
    temperature: 0.3,
    requestId: params.requestId,
  });

  return parseCoachingFromTimelineJson(raw, params.metadata);
}
