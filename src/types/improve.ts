import type { ComponentProps } from 'react';
import type { Ionicons } from '@expo/vector-icons';

export type ImproveCategoryId = 'physical' | 'recovery' | 'technical' | 'tactical' | 'mental';

export type ImproveIconName = ComponentProps<typeof Ionicons>['name'];

export type ImproveDrillPartnerRequirement = 'solo' | 'partner' | 'group';

export type ImproveDrillDifficulty = 1 | 2 | 3 | 4 | 5;

/** Session sequencing stage — used to order single-skill personalized sessions. */
export type ImproveSessionFlow = 'foundation' | 'combination' | 'dynamic' | 'game-realistic';

export type ImproveMuscleGroupId =
  | 'core'
  | 'quads'
  | 'hamstrings'
  | 'glutes'
  | 'calves'
  | 'upper-body'
  | 'adductors'
  | 'hip-flexors';

/** Speed-skill training focus — separate from Strength muscle groups. */
export type ImproveSpeedFocusId = 'acceleration' | 'top-speed' | 'running-form' | 'fast-feet';

/** Agility-skill training focus — separate from Strength/Speed tags. */
export type ImproveAgilityFocusId = 'ladder-drills' | 'general';

/** Recovery-skill training focus — separate from other drill tag types. */
export type ImproveRecoveryFocusId =
  | 'stretching'
  | 'fascia-release'
  | 'mobility-functionality'
  | 'biohacks';

export interface ImproveDrill {
  id: string;
  title: string;
  equipment: string[];
  duration: string;
  requiresPartner: ImproveDrillPartnerRequirement;
  difficulty: ImproveDrillDifficulty;
  creator: string;
  steps: string[];
  coachingCues: string[];
  commonMistakes: string[];
  videoUrl?: string;
  videoTimestamp?: string;
  videoTimestampSeconds?: number;
  /**
   * Optional session-flow stage for personalized session ordering.
   * When present on single-skill sessions: foundation → combination → dynamic → game-realistic,
   * then difficulty within each stage. Untagged drills keep difficulty-only sort.
   */
  sessionFlow?: ImproveSessionFlow;
  /** Optional primary muscle group — used to gate Strength-style muscle selection. */
  muscleGroup?: ImproveMuscleGroupId;
  /** Optional Speed training focus — used to gate Speed-style focus selection. */
  speedFocus?: ImproveSpeedFocusId;
  /** Optional Agility training focus — used to gate Agility-style focus selection. */
  agilityFocus?: ImproveAgilityFocusId;
  /** Optional Recovery training focus — used to gate Recovery-style focus selection. */
  recoveryFocus?: ImproveRecoveryFocusId;
}

export interface ImproveSkill {
  id: string;
  title: string;
  summary?: string;
  explanation: string;
  drills: ImproveDrill[];
  /** When true, show difficulty-tier picker grouped by drill.difficulty (1–5). */
  useDifficultyTiers?: boolean;
}

export interface ImproveCategory {
  id: ImproveCategoryId;
  title: string;
  description: string;
  icon: ImproveIconName;
  skills: ImproveSkill[];
}

export interface ImproveMuscleGroupMeta {
  id: ImproveMuscleGroupId;
  label: string;
  icon: ImproveIconName;
}

export const IMPROVE_MUSCLE_GROUPS: ImproveMuscleGroupMeta[] = [
  { id: 'core', label: 'Core', icon: 'body-outline' },
  { id: 'quads', label: 'Quads', icon: 'fitness-outline' },
  { id: 'hamstrings', label: 'Hamstrings', icon: 'walk-outline' },
  { id: 'glutes', label: 'Glutes', icon: 'barbell-outline' },
  { id: 'calves', label: 'Calves', icon: 'footsteps-outline' },
  { id: 'upper-body', label: 'Upper Body', icon: 'shirt-outline' },
  { id: 'adductors', label: 'Adductors', icon: 'git-branch-outline' },
  { id: 'hip-flexors', label: 'Hip Flexors', icon: 'swap-vertical-outline' },
];

export interface ImproveSpeedFocusMeta {
  id: ImproveSpeedFocusId;
  label: string;
  icon: ImproveIconName;
}

export const IMPROVE_SPEED_FOCUS_AREAS: ImproveSpeedFocusMeta[] = [
  { id: 'acceleration', label: 'Acceleration', icon: 'flash-outline' },
  { id: 'top-speed', label: 'Top Speed', icon: 'speedometer-outline' },
  { id: 'running-form', label: 'Running Form', icon: 'walk-outline' },
  { id: 'fast-feet', label: 'Fast Feet', icon: 'footsteps-outline' },
];

export interface ImproveAgilityFocusMeta {
  id: ImproveAgilityFocusId;
  label: string;
  icon: ImproveIconName;
}

export const IMPROVE_AGILITY_FOCUS_AREAS: ImproveAgilityFocusMeta[] = [
  { id: 'ladder-drills', label: 'Ladder Drills', icon: 'grid-outline' },
  { id: 'general', label: 'General', icon: 'fitness-outline' },
];

export interface ImproveRecoveryFocusMeta {
  id: ImproveRecoveryFocusId;
  label: string;
  icon: ImproveIconName;
}

export const IMPROVE_RECOVERY_FOCUS_AREAS: ImproveRecoveryFocusMeta[] = [
  { id: 'stretching', label: 'Stretching', icon: 'expand-outline' },
  { id: 'fascia-release', label: 'Foam Rolling', icon: 'pulse-outline' },
  { id: 'mobility-functionality', label: 'Mobility & Functionality', icon: 'walk-outline' },
  { id: 'biohacks', label: 'Biohacks', icon: 'sparkles-outline' },
];

/** Difficulty tier id matches ImproveDrillDifficulty (1–5). */
export type ImproveDifficultyTierId = ImproveDrillDifficulty;

export interface ImproveDifficultyTierMeta {
  id: ImproveDifficultyTierId;
  label: string;
  icon: ImproveIconName;
}

export const IMPROVE_DIFFICULTY_TIERS: ImproveDifficultyTierMeta[] = [
  { id: 1, label: 'Ultra Beginner', icon: 'leaf-outline' },
  { id: 2, label: 'Beginner', icon: 'school-outline' },
  { id: 3, label: 'Intermediate', icon: 'trending-up-outline' },
  { id: 4, label: 'Advanced', icon: 'flame-outline' },
  { id: 5, label: 'Very Advanced', icon: 'trophy-outline' },
];
