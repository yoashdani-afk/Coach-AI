import { isDevPreviewMode } from '@/lib/supabase';
import { labelForFoot, labelForLevel, labelForPosition } from '@/lib/constants';
import type { ClipMetadata } from '@/types/analysis';
import type { PlayerProfile } from '@/types/profile';

export function hashString(input: string): number {
  let hash = 0;
  for (let i = 0; i < input.length; i++) {
    hash = (hash << 5) - hash + input.charCodeAt(i);
    hash |= 0;
  }
  return Math.abs(hash);
}

export function createReportId(clip: ClipMetadata, suffix: string): string {
  return `report-${Date.now()}-${hashString(clip.uri + suffix)}`;
}

export function baseReportFields(clip: ClipMetadata) {
  return {
    createdAt: new Date().toISOString(),
    isDemo: isDevPreviewMode,
    clip,
  };
}

export interface ProfileContext {
  positionLabel: string;
  levelLabel: string;
  footLabel: string;
  firstName: string;
  age: number;
  position: PlayerProfile['mainPosition'];
  level: PlayerProfile['playingLevel'];
  improvementGoals: PlayerProfile['improvementGoals'];
  feedbackAreas: PlayerProfile['feedbackAreas'];
}

export function buildProfileContext(profile: PlayerProfile): ProfileContext {
  return {
    positionLabel: labelForPosition(profile.mainPosition),
    levelLabel: labelForLevel(profile.playingLevel),
    footLabel: labelForFoot(profile.preferredFoot),
    firstName: profile.firstName,
    age: profile.age,
    position: profile.mainPosition,
    level: profile.playingLevel,
    improvementGoals: profile.improvementGoals,
    feedbackAreas: profile.feedbackAreas,
  };
}

/** Deterministic score in [min, max], rounded to one decimal. */
export function clampScore(value: number, min = 4, max = 9.5): number {
  return Math.round(Math.min(max, Math.max(min, value)) * 10) / 10;
}

const LEVEL_BASE: Record<PlayerProfile['playingLevel'], number> = {
  BEGINNER: 5.8,
  GRASSROOTS: 6.4,
  SCHOOL: 6.8,
  ACADEMY: 7.4,
  AMATEUR: 7.0,
  SEMI_PROFESSIONAL: 7.8,
  PROFESSIONAL: 8.4,
};

export function levelBaseScore(level: PlayerProfile['playingLevel']): number {
  return LEVEL_BASE[level];
}

export function ageAdjustment(age: number, category: 'COMPOSURE' | 'COMMUNICATION' | 'DEFAULT'): number {
  if (category === 'COMPOSURE' || category === 'COMMUNICATION') {
    if (age < 14) return -0.6;
    if (age < 17) return -0.3;
    if (age >= 23) return 0.2;
  }
  return 0;
}

export function positionBoost(
  position: PlayerProfile['mainPosition'],
  categoryKey: string
): number {
  const boosts: Partial<Record<PlayerProfile['mainPosition'], Record<string, number>>> = {
    STRIKER: { MOVEMENT: 0.8, FIRST_TOUCH: 0.6, DECISION_MAKING: 0.4 },
    WINGER: { MOVEMENT: 0.9, DECISION_MAKING: 0.5, FIRST_TOUCH: 0.4 },
    ATTACKING_MIDFIELDER: { DECISION_MAKING: 0.7, CREATIVITY: 0.8, COMPOSURE: 0.4 },
    CENTRAL_MIDFIELDER: { SCANNING: 0.7, PASSING: 0.5, COMMUNICATION: 0.6 },
    DEFENSIVE_MIDFIELDER: { POSITIONING: 0.8, DECISION_MAKING: 0.6, COMPOSURE: 0.5 },
    CENTRE_BACK: { POSITIONING: 0.9, COMPOSURE: 0.6, COMMUNICATION: 0.4 },
    FULL_BACK: { MOVEMENT: 0.7, POSITIONING: 0.5, DECISION_MAKING: 0.4 },
    WING_BACK: { MOVEMENT: 0.8, POSITIONING: 0.5, DECISION_MAKING: 0.3 },
    GOALKEEPER: { COMPOSURE: 0.9, COMMUNICATION: 0.8, POSITIONING: 0.5 },
  };
  return boosts[position]?.[categoryKey] ?? 0;
}

/** Lower score when player flagged this as a focus area — room to improve. */
export function focusPenalty(
  goals: PlayerProfile['improvementGoals'],
  feedback: PlayerProfile['feedbackAreas'],
  categoryKey: string
): number {
  const goalMap: Partial<Record<string, string[]>> = {
    DECISION_MAKING: ['DECISION_MAKING', 'FOOTBALL_IQ'],
    POSITIONING: ['POSITIONING'],
    SCANNING: ['FOOTBALL_IQ'],
    MOVEMENT: ['MOVEMENT'],
    FIRST_TOUCH: ['FIRST_TOUCH'],
    COMPOSURE: ['CONFIDENCE'],
    COMMUNICATION: ['PASSING'],
    FINISH: ['SHOOTING'],
    TECHNIQUE: ['DRIBBLING', 'FIRST_TOUCH'],
    CREATIVITY: ['DRIBBLING', 'FOOTBALL_IQ'],
    DIFFICULTY: ['SHOOTING'],
    DECISION: ['DECISION_MAKING'],
  };

  const linked = goalMap[categoryKey] ?? [categoryKey];
  const inGoals = linked.some((g) => goals.includes(g as PlayerProfile['improvementGoals'][number]));
  const inFeedback = linked.some((g) => feedback.includes(g as PlayerProfile['feedbackAreas'][number]));

  if (inGoals && inFeedback) return -1.1;
  if (inGoals || inFeedback) return -0.7;
  return 0;
}

export function averageScores(categories: { score: number }[]): number {
  if (categories.length === 0) return 0;
  const sum = categories.reduce((acc, c) => acc + c.score, 0);
  return clampScore(sum / categories.length, 4, 9.5);
}
