import type {
  LegacyPlayingLevel,
  PlayerProfile,
  PlayingLevel,
  HeightDisplayUnit,
  WeightDisplayUnit,
} from '@/types/profile';

export const MIN_PLAYER_AGE = 8;
export const MAX_PLAYER_AGE = 60;

const ISO_DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

export function isValidIsoDateString(value: string): boolean {
  if (!ISO_DATE_RE.test(value)) return false;
  const [year, month, day] = value.split('-').map(Number);
  if (!year || !month || !day) return false;
  const date = new Date(Date.UTC(year, month - 1, day));
  return (
    date.getUTCFullYear() === year &&
    date.getUTCMonth() === month - 1 &&
    date.getUTCDate() === day
  );
}

/** Whole years since date of birth (UTC), same calendar-day basis as validation band. */
export function calculateAge(dateOfBirth: string, asOf: Date = new Date()): number {
  if (!isValidIsoDateString(dateOfBirth)) return NaN;

  const [year, month, day] = dateOfBirth.split('-').map(Number);
  let age = asOf.getFullYear() - year!;
  const monthDiff = asOf.getMonth() + 1 - month!;
  if (monthDiff < 0 || (monthDiff === 0 && asOf.getDate() < day!)) {
    age -= 1;
  }
  return age;
}

export function isAgeInValidBand(dateOfBirth: string): boolean {
  const age = calculateAge(dateOfBirth);
  return Number.isFinite(age) && age >= MIN_PLAYER_AGE && age <= MAX_PLAYER_AGE;
}

export function formatDateOfBirthForDisplay(dateOfBirth: string): string {
  if (!isValidIsoDateString(dateOfBirth)) return dateOfBirth;
  const [year, month, day] = dateOfBirth.split('-').map(Number);
  const date = new Date(year!, month! - 1, day!);
  return date.toLocaleDateString(undefined, {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  });
}

export function migrateLegacyPlayingLevel(value: unknown): PlayingLevel | null {
  if (typeof value !== 'string') return null;

  const map: Record<string, PlayingLevel> = {
    BEGINNER: 'GRASSROOTS_SCHOOL',
    GRASSROOTS: 'GRASSROOTS_SCHOOL',
    SCHOOL: 'GRASSROOTS_SCHOOL',
    GRASSROOTS_SCHOOL: 'GRASSROOTS_SCHOOL',
    ACADEMY: 'ACADEMY',
    AMATEUR: 'VETERAN_SUNDAY',
    SEMI_PROFESSIONAL: 'SEMI_PRO',
    SEMI_PRO: 'SEMI_PRO',
    PROFESSIONAL: 'PROFESSIONAL',
    VETERAN_SUNDAY: 'VETERAN_SUNDAY',
  };

  return map[value] ?? null;
}

export function parseHeightToCm(value: string, unit: HeightDisplayUnit): number | null {
  const trimmed = value.trim();
  if (!trimmed) return null;

  if (unit === 'cm') {
    const cm = Number(trimmed);
    return Number.isFinite(cm) && cm > 0 ? Math.round(cm) : null;
  }

  const ftInMatch = trimmed.match(/^(\d+)\s*[''′]?\s*(\d+)?/);
  if (!ftInMatch) return null;
  const feet = Number(ftInMatch[1]);
  const inches = Number(ftInMatch[2] ?? 0);
  if (!Number.isFinite(feet) || feet < 0 || !Number.isFinite(inches) || inches < 0) return null;
  return Math.round(feet * 30.48 + inches * 2.54);
}

export function parseWeightToKg(value: string, unit: WeightDisplayUnit): number | null {
  const trimmed = value.trim();
  if (!trimmed) return null;

  const amount = Number(trimmed);
  if (!Number.isFinite(amount) || amount <= 0) return null;

  if (unit === 'kg') return Math.round(amount * 10) / 10;
  return Math.round((amount / 2.20462) * 10) / 10;
}

export function formatHeightForDisplay(heightCm: number | null, unit: HeightDisplayUnit): string {
  if (heightCm == null) return '—';
  if (unit === 'cm') return `${heightCm} cm`;

  const totalInches = Math.round(heightCm / 2.54);
  const feet = Math.floor(totalInches / 12);
  const inches = totalInches % 12;
  return `${feet}'${inches}"`;
}

export function formatWeightForDisplay(weightKg: number | null, unit: WeightDisplayUnit): string {
  if (weightKg == null) return '—';
  if (unit === 'kg') return `${weightKg} kg`;
  return `${Math.round(weightKg * 2.20462 * 10) / 10} lb`;
}

function asString(value: unknown): string {
  return typeof value === 'string' ? value.trim() : '';
}

function asNumber(value: unknown): number | null {
  const n = Number(value);
  return Number.isFinite(n) ? n : null;
}

function asBool(value: unknown): boolean | null {
  if (typeof value === 'boolean') return value;
  return null;
}

/** True when every required expanded-profile field is present and valid. */
export function isExpandedProfileComplete(profile: PlayerProfile): boolean {
  if (profile.firstName.trim().length < 2) return false;
  if (!isValidIsoDateString(profile.dateOfBirth) || !isAgeInValidBand(profile.dateOfBirth)) return false;
  if (profile.nationality.trim().length < 2) return false;
  if (profile.countryPlayingIn.trim().length < 2) return false;
  if (profile.yearsPlayingFootball < 0 || profile.yearsInPrimaryPosition < 0) return false;
  if (profile.yearsInPrimaryPosition > profile.yearsPlayingFootball) return false;
  if (!profile.mainPosition || !profile.preferredFoot || !profile.playingLevel) return false;
  if (profile.playingStyle.length < 1) return false;
  if (profile.improvementGoals.length < 1 || profile.feedbackAreas.length < 1) return false;
  return true;
}

/**
 * Migrate persisted profile JSON to the expanded schema.
 * Does NOT invent dateOfBirth — missing DOB marks profile incomplete.
 */
export function migrateStoredProfile(raw: unknown): PlayerProfile | null {
  if (!raw || typeof raw !== 'object') return null;

  const obj = raw as Record<string, unknown>;

  const firstName = asString(obj.firstName);
  if (!firstName) return null;

  const dateOfBirth = asString(obj.dateOfBirth);
  const hasValidDob = dateOfBirth.length > 0 && isValidIsoDateString(dateOfBirth);

  const nationality = asString(obj.nationality);
  const countryPlayingIn =
    asString(obj.countryPlayingIn) || asString(obj.country);

  const playingLevel = migrateLegacyPlayingLevel(obj.playingLevel);
  if (!playingLevel) return null;

  const mainPosition = obj.mainPosition as PlayerProfile['mainPosition'] | undefined;
  if (!mainPosition) return null;

  const preferredFoot = obj.preferredFoot as PlayerProfile['preferredFoot'] | undefined;
  if (!preferredFoot) return null;

  const yearsPlayingFootball = asNumber(obj.yearsPlayingFootball);
  const yearsInPrimaryPosition = asNumber(obj.yearsInPrimaryPosition);

  let isGoalkeeper = asBool(obj.isGoalkeeper);
  if (isGoalkeeper == null) {
    isGoalkeeper = mainPosition === 'GOALKEEPER';
  }

  const playingStyle = Array.isArray(obj.playingStyle)
    ? obj.playingStyle.filter((item): item is string => typeof item === 'string')
    : [];

  const improvementGoals = Array.isArray(obj.improvementGoals)
    ? (obj.improvementGoals as PlayerProfile['improvementGoals'])
    : [];

  const feedbackAreas = Array.isArray(obj.feedbackAreas)
    ? (obj.feedbackAreas as PlayerProfile['feedbackAreas'])
    : [];

  const profile: PlayerProfile = {
    firstName,
    dateOfBirth: hasValidDob ? dateOfBirth : '',
    age: hasValidDob ? calculateAge(dateOfBirth) : asNumber(obj.age) ?? 0,
    nationality,
    countryPlayingIn,
    yearsPlayingFootball: yearsPlayingFootball ?? -1,
    yearsInPrimaryPosition: yearsInPrimaryPosition ?? -1,
    isGoalkeeper,
    mainPosition,
    secondaryPosition: (obj.secondaryPosition as PlayerProfile['secondaryPosition']) ?? null,
    preferredFoot,
    playingLevel,
    club: asString(obj.club) || null,
    clubLevel: asString(obj.clubLevel) || null,
    heightCm: asNumber(obj.heightCm),
    weightKg: asNumber(obj.weightKg),
    heightDisplayUnit:
      obj.heightDisplayUnit === 'ft_in' ? 'ft_in' : 'cm',
    weightDisplayUnit:
      obj.weightDisplayUnit === 'lb' ? 'lb' : 'kg',
    playingStyle,
    improvementGoals,
    feedbackAreas,
    isComplete: false,
    analysesUsedThisMonth: asNumber(obj.analysesUsedThisMonth) ?? 0,
    updatedAt: asString(obj.updatedAt) || new Date().toISOString(),
  };

  profile.isComplete = isExpandedProfileComplete(profile);

  return profile;
}
