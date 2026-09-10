import type { ComponentProps } from 'react';
import type { Ionicons } from '@expo/vector-icons';
import type { ImproveCategoryId } from '@/types/improve';
import type { GeneratedSession, SessionDurationMinutes } from '@/types/improveSession';

export type WeekDayId = 'mon' | 'tue' | 'wed' | 'thu' | 'fri' | 'sat' | 'sun';

/** Week-level situation (maps into per-day SessionSituation). */
export type WeekSituation = 'in-season' | 'off-season' | 'recovery-week';

export type WeekFocusPreference = 'technical' | 'physical' | 'balanced';

export type WeekDayAvailableMinutes = SessionDurationMinutes | null;

export type WeekDayRole = 'rest' | 'recovery' | 'light' | 'full';

/** Match-adjacent context for UI chips (not a separate role). */
export type WeekMatchContext = 'match' | 'taper' | 'post';

export interface WeekDayDraft {
  day: WeekDayId;
  teamTraining: boolean;
  gymSession: boolean;
  /** Partner / teammates available for this day’s individual work. */
  hasPartner: boolean;
  /** null = not available to train individually. */
  availableMinutes: WeekDayAvailableMinutes;
}

export interface WeekFocusSkill {
  categoryId: ImproveCategoryId;
  skillId: string;
  title: string;
}

export interface WeekDayPlan {
  day: WeekDayId;
  role: WeekDayRole;
  teamTraining: boolean;
  gymSession: boolean;
  hasPartner: boolean;
  availableMinutes: WeekDayAvailableMinutes;
  focusSkill?: WeekFocusSkill;
  session?: GeneratedSession | null;
  matchContext?: WeekMatchContext;
}

export interface WeeklyRegimen {
  id: string;
  createdAt: string;
  weekSituation: WeekSituation;
  age: number;
  matchDay: WeekDayId | null;
  focusPreference: WeekFocusPreference;
  prioritySkillIds: string[];
  days: WeekDayPlan[];
  /** User-facing notes (e.g. priority skill skipped). */
  notes: string[];
}

/** Wizard draft before generation. */
export interface WeekWizardDraft {
  weekSituation?: WeekSituation;
  age?: number;
  matchDay: WeekDayId | null;
  focusPreference: WeekFocusPreference;
  prioritySkillIds: string[];
  days: WeekDayDraft[];
}

export const WEEK_DAY_ORDER: WeekDayId[] = [
  'mon',
  'tue',
  'wed',
  'thu',
  'fri',
  'sat',
  'sun',
];

export const WEEK_DAY_LABELS: Record<WeekDayId, string> = {
  mon: 'Monday',
  tue: 'Tuesday',
  wed: 'Wednesday',
  thu: 'Thursday',
  fri: 'Friday',
  sat: 'Saturday',
  sun: 'Sunday',
};

export const WEEK_DAY_SHORT_LABELS: Record<WeekDayId, string> = {
  mon: 'Mon',
  tue: 'Tue',
  wed: 'Wed',
  thu: 'Thu',
  fri: 'Fri',
  sat: 'Sat',
  sun: 'Sun',
};

export const WEEK_SITUATION_OPTIONS: {
  id: WeekSituation;
  label: string;
  description: string;
}[] = [
  {
    id: 'in-season',
    label: 'In-season',
    description: 'Lighter individual work around team training',
  },
  {
    id: 'off-season',
    label: 'Off-season',
    description: 'More room for strength and building work',
  },
  {
    id: 'recovery-week',
    label: 'Recovery week',
    description: 'Prioritize mobility and easier sessions',
  },
];

export const WEEK_FOCUS_PREFERENCE_OPTIONS: {
  id: WeekFocusPreference;
  label: string;
  description: string;
}[] = [
  {
    id: 'technical',
    label: 'More Technical',
    description: 'Bias toward ball work and execution skills',
  },
  {
    id: 'physical',
    label: 'More Physical',
    description: 'Bias toward speed, agility, and building work',
  },
  {
    id: 'balanced',
    label: 'Balanced',
    description: 'Rotate technical and physical evenly',
  },
];

export type WeekRoleIconName = ComponentProps<typeof Ionicons>['name'];

/** Role accents for week UI — consistent with Coach tab language. */
export const WEEK_ROLE_VISUAL: Record<
  WeekDayRole,
  { accent: string; icon: WeekRoleIconName; label: string }
> = {
  rest: { accent: '#6B6B73', icon: 'moon-outline', label: 'Rest day' },
  recovery: { accent: '#2DD4BF', icon: 'bandage-outline', label: 'Recovery & Mobility' },
  light: { accent: '#5B8DEF', icon: 'walk-outline', label: 'Light session' },
  full: { accent: '#00C853', icon: 'flash', label: 'Full session' },
};

export const WEEK_MATCH_CONTEXT_VISUAL: Record<
  WeekMatchContext,
  { accent: string; label: string }
> = {
  match: { accent: '#FF6B8A', label: 'Match' },
  taper: { accent: '#FFB300', label: 'Taper' },
  post: { accent: '#2DD4BF', label: 'Post-match' },
};

export const WEEK_DURATION_OPTIONS: SessionDurationMinutes[] = [15, 30, 45, 60];

export function createDefaultWeekDayDrafts(): WeekDayDraft[] {
  return WEEK_DAY_ORDER.map((day) => ({
    day,
    teamTraining: false,
    gymSession: false,
    hasPartner: false,
    // Weekdays default to 30 min; weekend default unavailable
    availableMinutes: day === 'sat' || day === 'sun' ? null : 30,
  }));
}

export function previousWeekDay(day: WeekDayId): WeekDayId {
  const idx = WEEK_DAY_ORDER.indexOf(day);
  return WEEK_DAY_ORDER[(idx + 6) % 7]!;
}

export function nextWeekDay(day: WeekDayId): WeekDayId {
  const idx = WEEK_DAY_ORDER.indexOf(day);
  return WEEK_DAY_ORDER[(idx + 1) % 7]!;
}
