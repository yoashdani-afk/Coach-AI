import type { ImproveCategoryId, ImproveDrill } from '@/types/improve';

export type SessionSituation =
  | 'pre-match'
  | 'in-season'
  | 'off-season'
  | 'recovery-day'
  | 'rehab';

export type SessionIntensity = 'low' | 'medium' | 'high';

export type SessionLocation = 'gym' | 'field' | 'home';

export type SessionDurationMinutes = 15 | 30 | 45 | 60;

export type SessionTargetKind = 'profile' | 'skill';

export type SessionTarget =
  | { kind: 'profile' }
  | { kind: 'skill'; categoryId: ImproveCategoryId; skillId: string };

export interface SessionInputs {
  target: SessionTarget;
  situation: SessionSituation;
  /**
   * Auto-resolved by the generator from eligible drills.
   * Omitted for Recovery day / Rehab (no location hard-filter).
   */
  location?: SessionLocation;
  intensity: SessionIntensity;
  age: number;
  durationMinutes: SessionDurationMinutes;
  hasPartner: boolean;
}

export interface SessionDrillRef {
  categoryId: ImproveCategoryId;
  skillId: string;
  drill: ImproveDrill;
}

export interface GeneratedSession {
  id: string;
  createdAt: string;
  inputs: SessionInputs;
  drills: SessionDrillRef[];
  /** User-facing notes (target ignored, fallback widened, etc.) */
  notes: string[];
}

/** Persisted history record — no XP/levels. */
export interface ImproveSessionHistoryEntry {
  id: string;
  createdAt: string;
  completedAt?: string;
  inputs: SessionInputs;
  drills: Array<{
    categoryId: ImproveCategoryId;
    skillId: string;
    drillId: string;
  }>;
  completedDrillIds: string[];
}

export const SESSION_DURATION_DRILL_COUNTS: Record<SessionDurationMinutes, number> = {
  15: 3,
  30: 5,
  45: 7,
  60: 9,
};

export const SESSION_STRENGTH_AGE_CUTOFF = 14;

export const SESSION_SITUATION_OPTIONS: {
  id: SessionSituation;
  label: string;
  description: string;
}[] = [
  {
    id: 'pre-match',
    label: 'Pre-match',
    description: 'Short, light activation before kickoff',
  },
  {
    id: 'in-season',
    label: 'In-season',
    description: 'Balanced training during the season',
  },
  {
    id: 'off-season',
    label: 'Off-season',
    description: 'Full range, including heavier work',
  },
  {
    id: 'recovery-day',
    label: 'Recovery day',
    description: 'Mobility and recovery only',
  },
  {
    id: 'rehab',
    label: 'Rehab / returning from injury',
    description: 'Gentle recovery work — not medical advice',
  },
];

export const SESSION_INTENSITY_OPTIONS: {
  id: SessionIntensity;
  label: string;
  description: string;
}[] = [
  { id: 'low', label: 'Low', description: 'Easier drills (about difficulty 1–2)' },
  { id: 'medium', label: 'Medium', description: 'Moderate challenge (about 2–4)' },
  { id: 'high', label: 'High', description: 'Harder work (about 3–5)' },
];

export const SESSION_LOCATION_OPTIONS: {
  id: SessionLocation;
  label: string;
  description: string;
  icon: 'barbell-outline' | 'football-outline' | 'home-outline';
}[] = [
  {
    id: 'gym',
    label: 'Gym',
    description: 'Free weights, machines, cables, benches',
    icon: 'barbell-outline',
  },
  {
    id: 'field',
    label: 'Field / outdoor',
    description: 'Pitch or open space — cones, ladder, goals',
    icon: 'football-outline',
  },
  {
    id: 'home',
    label: 'Home / limited space',
    description: 'Bodyweight, wall, mat, ball, foam roller',
    icon: 'home-outline',
  },
];

export const SESSION_DURATION_OPTIONS: SessionDurationMinutes[] = [15, 30, 45, 60];

export const REHAB_DISCLAIMER =
  'This is not medical advice. Follow your physio or doctor’s guidance, and stop anything that causes pain or feels unsafe.';
