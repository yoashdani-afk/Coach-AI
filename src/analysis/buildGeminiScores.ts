import type { AnalysisMode } from '@/types/analysis';
import type { AnalysisResponse, AnalysisScore } from '@/analysis/models/AnalysisResponse';
import { hashString } from '@/lib/reports/shared';

export const GOAL_SCORE_LABELS = [
  'Finish',
  'Technique',
  'Difficulty',
  'Creativity',
  'Decision',
  'Composure',
] as const;

export const PERFORMANCE_SCORE_LABELS = [
  'Decision Making',
  'Positioning',
  'Scanning',
  'Movement',
  'First Touch',
  'Composure',
  'Communication',
] as const;

const CATEGORY_KEYWORDS: Record<string, string[]> = {
  Finish: ['finish', 'shot', 'strike', 'goal', 'placement', 'conversion', 'scored'],
  Technique: ['technique', 'touch', 'body shape', 'footwork', 'mechanics', 'form'],
  Difficulty: ['difficulty', 'pressure', 'defender', 'angle', 'tight', 'contested'],
  Creativity: ['creativity', 'creative', 'clever', 'skill', 'improvis'],
  Decision: ['decision', 'choice', 'option', 'timing', 'read'],
  Composure: ['composure', 'calm', 'controlled', 'patient', 'settled'],
  'Decision Making': ['decision', 'choice', 'read', 'judgment', 'selection'],
  Positioning: ['position', 'positioning', 'line', 'spacing', 'angle'],
  Scanning: ['scan', 'scanning', 'awareness', 'picture', 'look'],
  Movement: ['movement', 'run', 'off the ball', 'timing', 'support'],
  'First Touch': ['first touch', 'touch', 'receive', 'cushion'],
  Communication: ['communication', 'organise', 'organize', 'call', 'direct'],
};

function normalizeLabel(label: string): string {
  return label.trim().toLowerCase().replace(/[^a-z0-9]+/g, ' ');
}

function clampScore(value: number, min = 4, max = 9.4): number {
  return Math.round(Math.min(max, Math.max(min, value)) * 10) / 10;
}

function hashJitter(seed: string, label: string): number {
  const h = hashString(`${seed}:${label}`);
  return ((h % 5) - 2) / 10;
}

function findGeminiScore(scores: AnalysisScore[], expectedLabel: string): number | null {
  const expected = normalizeLabel(expectedLabel);

  for (const score of scores) {
    const label = normalizeLabel(score.label);
    if (label === expected) return clampScore(score.value, 1, 10);
  }

  for (const score of scores) {
    const label = normalizeLabel(score.label);
    if (label.includes(expected) || expected.includes(label)) {
      return clampScore(score.value, 1, 10);
    }
  }

  return null;
}

function textMentionsKeywords(text: string, keywords: string[]): boolean {
  const lower = text.toLowerCase();
  return keywords.some((keyword) => lower.includes(keyword));
}

function deriveScoreFromAnalysis(
  label: string,
  response: AnalysisResponse,
  seed: string
): number {
  const keywords = CATEGORY_KEYWORDS[label] ?? [normalizeLabel(label)];

  let strengthHits = 0;
  let improvementHits = 0;

  for (const text of response.strengths) {
    if (textMentionsKeywords(text, keywords)) strengthHits++;
  }
  for (const text of response.improvements) {
    if (textMentionsKeywords(text, keywords)) improvementHits++;
  }

  let base = 6.8;
  base += strengthHits * 0.55;
  base -= improvementHits * 1.0;

  if (response.improvements.length > 0) {
    base = Math.min(base, 8.4);
  }

  return clampScore(base + hashJitter(seed, label), 4, 8.8);
}

function labelsForMode(mode: AnalysisMode): readonly string[] {
  switch (mode) {
    case 'GOAL':
      return GOAL_SCORE_LABELS;
    case 'PERFORMANCE':
      return PERFORMANCE_SCORE_LABELS;
    default:
      return [];
  }
}

function labelToKey(label: string): string {
  return label
    .trim()
    .toUpperCase()
    .replace(/[^A-Z0-9]+/g, '_')
    .replace(/^_|_$/g, '');
}

function applyClientConsistencyCaps(
  categories: { label: string; key: string; score: number }[],
  response: AnalysisResponse
): { label: string; key: string; score: number }[] {
  const improvementsBlob = response.improvements.join(' ').toLowerCase();

  return categories.map((category) => {
    let score = category.score;
    const keywords = CATEGORY_KEYWORDS[category.label] ?? [normalizeLabel(category.label)];

    if (response.improvements.length > 0 && score >= 10) {
      score = 8.9;
    }

    if (keywords.some((kw) => improvementsBlob.includes(kw)) && score > 8.5) {
      score = 8.5;
    }

    return { ...category, score: clampScore(score, 1, 10) };
  });
}

/**
 * Builds category scores for GOAL / PERFORMANCE reports from Gemini output.
 * Server-side calibration is primary; client applies a final consistency pass.
 */
export function buildScoresFromGeminiResponse(
  mode: AnalysisMode,
  response: AnalysisResponse,
  seed: string
): { label: string; key: string; score: number }[] {
  const expected = labelsForMode(mode);
  if (expected.length === 0) {
    return response.scores.map((score, index) => ({
      label: score.label,
      key: labelToKey(score.label) || `CATEGORY_${index}`,
      score: clampScore(score.value, 1, 10),
    }));
  }

  const categories = expected.map((label) => {
    const fromGemini = findGeminiScore(response.scores, label);
    const score =
      fromGemini ?? deriveScoreFromAnalysis(label, response, `${seed}:${mode}`);

    return {
      label,
      key: labelToKey(label),
      score,
    };
  });

  const calibrated = applyClientConsistencyCaps(categories, response);
  console.log('[ScoreCalibration] Client category scores', calibrated);
  return calibrated;
}

export function overallScoreFromCategories(
  categories: { score: number }[],
  response?: AnalysisResponse
): number {
  if (categories.length === 0) return 0;

  const values = categories.map((c) => c.score);
  const mean = values.reduce((acc, c) => acc + c, 0) / values.length;
  const min = Math.min(...values);
  const max = Math.max(...values);

  let overall = mean;

  if (response?.improvements?.length) {
    overall = mean * 0.62 + min * 0.38;
  }

  if (max - min > 1.2) {
    overall = Math.min(overall, max - 0.35);
  }

  if (response?.improvements?.length) {
    overall = Math.min(overall, 9.2);
  }

  const rounded = Math.round(Math.min(10, Math.max(1, overall)) * 10) / 10;
  console.log('[ScoreCalibration] Client overall score', {
    rawMean: Math.round(mean * 10) / 10,
    overall: rounded,
  });
  return rounded;
}
