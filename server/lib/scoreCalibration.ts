import type { AnalysisScore, AnalysisTrackingMetadataLog, PlayerTrackingData } from './types.js';

export interface ScoreCalibrationInput {
  mode: 'GOAL' | 'PERFORMANCE';
  rawScores: AnalysisScore[];
  strengths: string[];
  improvements: string[];
  summary: string;
  whatHappened: string;
  whyItMattered: string;
  betterOption: string;
  professionalInsight: string;
  trackingMetadata?: AnalysisTrackingMetadataLog | null;
  playerTracking?: PlayerTrackingData | null;
  identityConfidence?: 'HIGH' | 'LOW';
}

export interface ScoreCalibrationResult {
  scores: AnalysisScore[];
  rawScores: AnalysisScore[];
  capsApplied: string[];
  consistencyCorrections: string[];
}

const IMPROVEMENT_CATEGORY_KEYWORDS: Record<string, string[]> = {
  Scanning: ['scan', 'scanning', 'awareness', 'picture', 'look', 'head'],
  'Decision Making': ['decision', 'choice', 'option', 'read', 'judgment', 'selection', 'pass choice'],
  Decision: ['decision', 'choice', 'option', 'read', 'judgment', 'selection'],
  Positioning: ['position', 'positioning', 'line', 'spacing', 'angle'],
  Movement: ['movement', 'run', 'off the ball', 'timing', 'support'],
  'First Touch': ['first touch', 'touch', 'receive', 'cushion', 'control'],
  Composure: ['composure', 'calm', 'rushed', 'panic', ' hurried'],
  Communication: ['communication', 'organise', 'organize', 'call', 'direct'],
  Finish: ['finish', 'shot', 'strike', 'placement', 'conversion'],
  Technique: ['technique', 'touch', 'body shape', 'footwork', 'mechanics', 'form'],
  Difficulty: ['difficulty', 'pressure', 'contested'],
  Creativity: ['creativity', 'creative', 'predictable'],
};

const POSSESSION_UNCERTAIN_PHRASES = [
  'possession uncertain',
  'outcome uncertain',
  'could not confirm',
  'could not be confirmed',
  'not visually confirmed',
  'identity could not',
  'uncertain whether',
];

function roundScore(value: number): number {
  return Math.round(Math.min(10, Math.max(1, value)) * 10) / 10;
}

function normalizeLabel(label: string): string {
  return label.trim().toLowerCase().replace(/[^a-z0-9]+/g, ' ');
}

function textBlob(input: ScoreCalibrationInput): string {
  return [
    input.summary,
    input.whatHappened,
    input.whyItMattered,
    input.betterOption,
    input.professionalInsight,
    ...input.strengths,
    ...input.improvements,
  ]
    .join(' ')
    .toLowerCase();
}

function improvementMentionsCategory(improvements: string[], label: string): boolean {
  const keywords = IMPROVEMENT_CATEGORY_KEYWORDS[label] ?? [normalizeLabel(label)];
  const blob = improvements.join(' ').toLowerCase();
  return keywords.some((kw) => blob.includes(kw));
}

function hasPossessionUncertainty(input: ScoreCalibrationInput): boolean {
  const blob = textBlob(input);
  return POSSESSION_UNCERTAIN_PHRASES.some((phrase) => blob.includes(phrase));
}

function hasLowIdentityConfidence(input: ScoreCalibrationInput): boolean {
  if (input.identityConfidence === 'LOW') return true;
  if (input.playerTracking?.identityConfidence === 'LOW') return true;
  return false;
}

function sequenceNotFullyVisible(
  trackingMetadata?: AnalysisTrackingMetadataLog | null,
  playerTracking?: PlayerTrackingData | null
): boolean {
  if (playerTracking?.lostIntervals?.length) return true;
  if (playerTracking?.uncertainIntervals?.length) return true;
  if ((trackingMetadata?.uncertainIntervals?.length ?? 0) > 0) return true;
  if ((trackingMetadata?.selectedPlayerVisiblePercentage ?? 1) < 0.75) return true;
  if ((trackingMetadata?.playerTrackingConfidence ?? 1) < 0.75) return true;
  return false;
}

function calibrateCategoryScore(
  label: string,
  raw: number,
  input: ScoreCalibrationInput,
  capsApplied: string[],
  consistencyCorrections: string[]
): number {
  let score = raw;

  if (score >= 9.5 && input.improvements.length > 0) {
    score = Math.min(score, 8.9);
    capsApplied.push(`${label}: capped from ${raw} — report contains improvement areas`);
    consistencyCorrections.push(`${label} reduced because improvements were noted`);
  }

  if (improvementMentionsCategory(input.improvements, label)) {
    const cap = 8.5;
    if (score > cap) {
      capsApplied.push(`${label}: capped at ${cap} — improvement text mentions this category`);
      consistencyCorrections.push(`${label} capped due to matching improvement criticism`);
      score = cap;
    }
  }

  if (hasPossessionUncertainty(input)) {
    if (label === 'Decision Making' || label === 'Decision' || label === 'Composure') {
      const cap = 8.0;
      if (score > cap) {
        capsApplied.push(`${label}: capped at ${cap} — possession/outcome uncertainty in report`);
        score = cap;
      }
    }
  }

  if (score >= 10 && input.improvements.length === 0) {
    const blob = textBlob(input);
    const hasWeaknessSignal =
      /\bcould improve\b|\bneeds to\b|\bwork on\b|\bnext time\b|\bavoid\b|\b better\b/.test(
        blob
      );
    if (hasWeaknessSignal) {
      score = 9.2;
      capsApplied.push(`${label}: 10.0 rejected — narrative contains coaching criticism`);
      consistencyCorrections.push(`${label} reduced from 10.0 due to narrative contradiction`);
    }
  }

  if (score >= 9.5 && input.strengths.length <= 1 && input.improvements.length >= 1) {
    score = Math.min(score, 8.8);
    capsApplied.push(`${label}: capped — limited strengths vs clear improvements`);
  }

  return roundScore(score);
}

export function calibrateScores(input: ScoreCalibrationInput): ScoreCalibrationResult {
  const capsApplied: string[] = [];
  const consistencyCorrections: string[] = [];
  const rawScores = input.rawScores.map((s) => ({ ...s, value: roundScore(s.value) }));

  let scores = rawScores.map((score) => ({
    label: score.label,
    value: calibrateCategoryScore(
      score.label,
      score.value,
      input,
      capsApplied,
      consistencyCorrections
    ),
  }));

  if (sequenceNotFullyVisible(input.trackingMetadata, input.playerTracking)) {
    for (const score of scores) {
      if (score.value > 8.5) {
        capsApplied.push(
          `${score.label}: capped at 8.5 — full sequence or player identity not fully confirmed`
        );
        score.value = 8.5;
      }
    }
  }

  if (hasLowIdentityConfidence(input)) {
    for (const score of scores) {
      if (score.value > 8.0) {
        capsApplied.push(`${score.label}: capped at 8.0 — LOW identity confidence`);
        score.value = 8.0;
      }
    }
    capsApplied.push('LOW identity confidence — Hall of Fame / exceptional scores disallowed');
  }

  if (input.playerTracking?.previewAccepted === false) {
    capsApplied.push('Tracking preview not accepted — scores left unchanged by tracking gate');
  }

  const hasMeaningfulImprovements = input.improvements.some((item) => item.trim().length > 12);
  if (hasMeaningfulImprovements) {
    for (const score of scores) {
      if (score.value >= 10) {
        score.value = 8.9;
        capsApplied.push(`${score.label}: no 10.0 when meaningful improvement areas exist`);
      }
    }
  }

  console.log('[ScoreCalibration] Raw category scores', rawScores);
  console.log('[ScoreCalibration] Calibrated category scores', scores);
  if (capsApplied.length > 0) {
    console.log('[ScoreCalibration] Caps applied', capsApplied);
  }
  if (consistencyCorrections.length > 0) {
    console.log('[ScoreCalibration] Consistency corrections', consistencyCorrections);
  }

  return { scores, rawScores, capsApplied, consistencyCorrections };
}

/** Calibrated overall — not a simple mean or max. */
export function calibrateOverallScore(
  scores: AnalysisScore[],
  input: ScoreCalibrationInput,
  capsApplied: string[]
): number {
  if (scores.length === 0) return 0;

  const values = scores.map((s) => s.value);
  const mean = values.reduce((a, b) => a + b, 0) / values.length;
  const min = Math.min(...values);
  const max = Math.max(...values);
  const spread = max - min;

  let overall = mean;

  if (input.improvements.length > 0) {
    overall = mean * 0.6 + min * 0.4;
    capsApplied.push('Overall pulled toward weaker categories due to improvement areas');
  }

  if (spread > 1.2) {
    overall = Math.min(overall, max - 0.35);
    capsApplied.push('Overall capped below peak category due to score spread');
  }

  if (sequenceNotFullyVisible(input.trackingMetadata, input.playerTracking)) {
    overall = Math.min(overall, 8.5);
    capsApplied.push('Overall capped at 8.5 — incomplete visibility/tracking confidence');
  }

  if (hasLowIdentityConfidence(input)) {
    overall = Math.min(overall, 8.0);
    capsApplied.push('Overall capped at 8.0 — LOW identity confidence');
  }

  if (hasPossessionUncertainty(input)) {
    overall = Math.min(overall, 8.2);
  }

  const exceptional =
    values.filter((v) => v >= 9.2).length >= 2 &&
    input.improvements.length === 0 &&
    !sequenceNotFullyVisible(input.trackingMetadata, input.playerTracking);

  if (!exceptional) {
    overall = Math.min(overall, 9.4);
  }

  return roundScore(overall);
}
