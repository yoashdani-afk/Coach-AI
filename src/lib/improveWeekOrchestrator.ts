import { getAllImproveCategories } from '@/lib/improveContent';
import { generateImproveSession } from '@/lib/improveSessionGenerator';
import type { ImproveCategoryId } from '@/types/improve';
import type { ImprovementGoal, PlayerProfile } from '@/types/profile';
import {
  SESSION_DURATION_DRILL_COUNTS,
  type SessionDurationMinutes,
  type SessionInputs,
  type SessionIntensity,
  type SessionSituation,
} from '@/types/improveSession';
import {
  WEEK_DAY_ORDER,
  nextWeekDay,
  previousWeekDay,
  type WeekDayDraft,
  type WeekDayId,
  type WeekDayPlan,
  type WeekDayRole,
  type WeekFocusPreference,
  type WeekFocusSkill,
  type WeekMatchContext,
  type WeekSituation,
  type WeeklyRegimen,
} from '@/types/improveWeek';

interface SkillPair {
  categoryId: ImproveCategoryId;
  skillId: string;
}

/** Skills that need a partner/group — only assignable when that day’s Partner toggle is on. */
const PARTNER_REQUIRED_SKILL_IDS = new Set([
  'passing',
  'scanning',
  'positioning',
  'communication',
]);

const TECHNICAL_SKILL_IDS = new Set([
  'first-touch',
  'shooting',
  'dribbling',
  'juggling',
  'passing',
]);

const MENTAL_SKILL_IDS = new Set([
  'confidence',
  'composure',
  'decision-making',
  'scanning',
  'positioning',
  'communication',
]);

const PHYSICAL_SKILL_IDS = new Set(['speed', 'agility', 'strength', 'stamina']);

const LIGHT_SKILL_IDS = [
  'first-touch',
  'shooting',
  'dribbling',
  'juggling',
  'confidence',
  'composure',
  'decision-making',
  'passing',
  'scanning',
  'positioning',
  'communication',
] as const;

const FULL_TECHNICAL_IDS = [
  'first-touch',
  'shooting',
  'dribbling',
  'juggling',
] as const;

const FULL_PHYSICAL_IDS = ['speed', 'agility'] as const;

const PRE_MATCH_SKILL_IDS = [
  'first-touch',
  'shooting',
  'dribbling',
  'juggling',
  'confidence',
  'composure',
  'decision-making',
  'passing',
  'scanning',
] as const;

function createWeekId(): string {
  return `week-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
}

function skillTitle(pair: SkillPair): string {
  const category = getAllImproveCategories().find((c) => c.id === pair.categoryId);
  const skill = category?.skills.find((s) => s.id === pair.skillId);
  return skill?.title ?? pair.skillId;
}

function findSkillPair(skillId: string): SkillPair | null {
  for (const category of getAllImproveCategories()) {
    const skill = category.skills.find((s) => s.id === skillId);
    if (skill) return { categoryId: category.id, skillId: skill.id };
  }
  return null;
}

function mapGoalToSkill(goal: ImprovementGoal): SkillPair | null {
  switch (goal) {
    case 'FIRST_TOUCH':
      return { categoryId: 'technical', skillId: 'first-touch' };
    case 'PASSING':
      return { categoryId: 'technical', skillId: 'passing' };
    case 'SHOOTING':
      return { categoryId: 'technical', skillId: 'shooting' };
    case 'DRIBBLING':
      return { categoryId: 'technical', skillId: 'dribbling' };
    case 'CONFIDENCE':
      return { categoryId: 'mental', skillId: 'confidence' };
    case 'FITNESS':
      return { categoryId: 'physical', skillId: 'speed' };
    case 'MOVEMENT':
    case 'DEFENDING':
      return { categoryId: 'physical', skillId: 'agility' };
    case 'POSITIONING':
    case 'DECISION_MAKING':
    case 'FOOTBALL_IQ':
      return { categoryId: 'mental', skillId: 'composure' };
    default:
      return null;
  }
}

function eligibleDrillCount(skillId: string, hasPartner: boolean): number {
  const pair = findSkillPair(skillId);
  if (!pair) return 0;
  const category = getAllImproveCategories().find((c) => c.id === pair.categoryId);
  const skill = category?.skills.find((s) => s.id === skillId);
  if (!skill) return 0;
  return skill.drills.filter((d) => hasPartner || d.requiresPartner === 'solo').length;
}

function isSkillEligible(
  skillId: string,
  hasPartner: boolean,
  durationMinutes: SessionDurationMinutes
): boolean {
  if (!hasPartner && PARTNER_REQUIRED_SKILL_IDS.has(skillId)) return false;
  const count = eligibleDrillCount(skillId, hasPartner);
  if (count === 0) return false;
  const desired = SESSION_DURATION_DRILL_COUNTS[durationMinutes];
  if (count < 2) return false;
  if (count < desired && count < 3) return false;
  return true;
}

function preferenceScore(skillId: string, preference: WeekFocusPreference): number {
  const isTech = TECHNICAL_SKILL_IDS.has(skillId) || MENTAL_SKILL_IDS.has(skillId);
  const isPhys = PHYSICAL_SKILL_IDS.has(skillId);
  const isHeavy = skillId === 'strength' || skillId === 'stamina';

  switch (preference) {
    case 'technical':
      if (isTech) return 3;
      if (isHeavy) return -2;
      if (isPhys) return 0;
      return 0;
    case 'physical':
      if (isPhys && !isHeavy) return 3;
      if (isHeavy) return 1;
      if (isTech) return 0;
      return 0;
    case 'balanced':
    default:
      if (isTech || (isPhys && !isHeavy)) return 1;
      return 0;
  }
}

/** Classify a single day from toggles + available time (no match overrides). */
export function classifyWeekDay(
  draft: WeekDayDraft,
  weekSituation: WeekSituation
): WeekDayRole {
  if (draft.availableMinutes == null) return 'rest';

  if (draft.teamTraining && draft.gymSession) {
    return 'recovery';
  }

  if (weekSituation === 'recovery-week') {
    if (draft.teamTraining || draft.gymSession) return 'recovery';
    if (draft.availableMinutes <= 15) return 'recovery';
    return 'light';
  }

  if (draft.teamTraining || draft.gymSession) {
    return 'light';
  }

  if (draft.availableMinutes <= 15) return 'light';
  return 'full';
}

function applyMatchOverrides(
  drafts: WeekDayDraft[],
  roles: WeekDayRole[],
  matchDay: WeekDayId | null
): { roles: WeekDayRole[]; matchContexts: Array<WeekMatchContext | undefined> } {
  const next = [...roles];
  const matchContexts: Array<WeekMatchContext | undefined> = drafts.map(() => undefined);
  if (matchDay == null) return { roles: next, matchContexts };

  const matchIdx = drafts.findIndex((d) => d.day === matchDay);
  if (matchIdx < 0) return { roles: next, matchContexts };

  const taperDay = previousWeekDay(matchDay);
  const postDay = nextWeekDay(matchDay);
  const taperIdx = drafts.findIndex((d) => d.day === taperDay);
  const postIdx = drafts.findIndex((d) => d.day === postDay);

  // P1 Match day
  const matchDraft = drafts[matchIdx]!;
  if (matchDraft.availableMinutes == null) {
    next[matchIdx] = 'rest';
  } else if (matchDraft.teamTraining && matchDraft.gymSession) {
    next[matchIdx] = 'light'; // pre-match light rather than double-load recovery
  } else {
    next[matchIdx] = 'light';
  }
  matchContexts[matchIdx] = 'match';

  // P2 Match−1 taper
  if (taperIdx >= 0) {
    const taperDraft = drafts[taperIdx]!;
    if (taperDraft.availableMinutes != null) {
      if (next[taperIdx] === 'full') next[taperIdx] = 'light';
      matchContexts[taperIdx] = 'taper';
    }
  }

  // P3 Match+1 post → recovery (unless unavailable)
  if (postIdx >= 0) {
    const postDraft = drafts[postIdx]!;
    if (postDraft.availableMinutes == null) {
      next[postIdx] = 'rest';
    } else {
      next[postIdx] = 'recovery';
      matchContexts[postIdx] = 'post';
    }
  }

  return { roles: next, matchContexts };
}

/**
 * Ensure at least one rest day. Prefer converting a recovery day after a heavy
 * double-load, else the last light day, else the last full day.
 * Avoid converting match / taper / post days when alternatives exist.
 */
export function ensureRestDay(
  drafts: WeekDayDraft[],
  roles: WeekDayRole[],
  matchContexts?: Array<WeekMatchContext | undefined>
): WeekDayRole[] {
  const next = [...roles];
  if (next.includes('rest')) return next;

  const isProtected = (i: number) => matchContexts?.[i] != null;

  const recoveryIdx = drafts.findIndex(
    (d, i) =>
      next[i] === 'recovery' &&
      d.teamTraining &&
      d.gymSession &&
      !isProtected(i)
  );
  if (recoveryIdx >= 0) {
    next[recoveryIdx] = 'rest';
    return next;
  }

  const lightIdx = [...next]
    .map((r, i) => (r === 'light' && !isProtected(i) ? i : -1))
    .filter((i) => i >= 0);
  if (lightIdx.length > 0) {
    next[lightIdx[lightIdx.length - 1]!] = 'rest';
    return next;
  }

  const fullIdx = [...next]
    .map((r, i) => (r === 'full' && !isProtected(i) ? i : -1))
    .filter((i) => i >= 0);
  if (fullIdx.length > 0) {
    next[fullIdx[fullIdx.length - 1]!] = 'rest';
    return next;
  }

  // Last resort: any non-protected day, else last day
  const anyIdx = next.findIndex((_, i) => !isProtected(i) && next[i] !== 'rest');
  if (anyIdx >= 0) {
    next[anyIdx] = 'rest';
  } else if (next.length > 0) {
    next[next.length - 1] = 'rest';
  }

  return next;
}

function candidateSkillsForRole(
  role: 'light' | 'full',
  weekSituation: WeekSituation,
  matchContext?: WeekMatchContext
): string[] {
  if (matchContext === 'match') {
    return [...PRE_MATCH_SKILL_IDS];
  }

  if (role === 'light') {
    return [...LIGHT_SKILL_IDS];
  }

  const physical = [...FULL_PHYSICAL_IDS];
  const technical = [...FULL_TECHNICAL_IDS];
  const heavy: string[] = [];

  if (weekSituation === 'off-season') {
    heavy.push('strength', 'stamina');
  } else if (weekSituation === 'in-season') {
    heavy.push('strength');
  }

  const mixed: string[] = [];
  const maxLen = Math.max(physical.length, technical.length, heavy.length);
  for (let i = 0; i < maxLen; i += 1) {
    if (physical[i]) mixed.push(physical[i]!);
    if (technical[i]) mixed.push(technical[i]!);
    if (heavy[i]) mixed.push(heavy[i]!);
  }
  return mixed;
}

function skillAllowedOnRole(
  skillId: string,
  role: 'light' | 'full',
  matchContext?: WeekMatchContext
): boolean {
  if (matchContext === 'taper' || matchContext === 'match') {
    if (skillId === 'strength' || skillId === 'stamina') return false;
  }
  if (role === 'light' && (skillId === 'strength' || skillId === 'stamina')) {
    return false;
  }
  if (role === 'light' && (skillId === 'speed' || skillId === 'agility')) {
    // Light days stay technical/mental; physical speed/agility only on full
    return false;
  }
  return true;
}

function pickSkillForDay(options: {
  role: 'light' | 'full';
  weekSituation: WeekSituation;
  focusPreference: WeekFocusPreference;
  hasPartner: boolean;
  durationMinutes: SessionDurationMinutes;
  usedSkillIds: Set<string>;
  strengthCount: number;
  staminaCount: number;
  profileGoals: ImprovementGoal[];
  matchContext?: WeekMatchContext;
  pinnedSkillId?: string;
}): SkillPair | null {
  if (options.pinnedSkillId) {
    const pinned = findSkillPair(options.pinnedSkillId);
    if (
      pinned &&
      skillAllowedOnRole(pinned.skillId, options.role, options.matchContext) &&
      isSkillEligible(pinned.skillId, options.hasPartner, options.durationMinutes)
    ) {
      return pinned;
    }
  }

  const maxStrength = options.weekSituation === 'off-season' ? 2 : 1;
  const maxStamina = options.weekSituation === 'off-season' ? 1 : 0;

  const pool = candidateSkillsForRole(
    options.role,
    options.weekSituation,
    options.matchContext
  );

  const goalSkills = options.profileGoals
    .map(mapGoalToSkill)
    .filter((p): p is SkillPair => p != null)
    .map((p) => p.skillId);

  const scored = pool
    .filter((id) => skillAllowedOnRole(id, options.role, options.matchContext))
    .map((skillId) => ({
      skillId,
      score:
        preferenceScore(skillId, options.focusPreference) * 10 +
        (goalSkills.includes(skillId) ? 5 : 0) +
        (options.usedSkillIds.has(skillId) ? 0 : 3),
    }))
    .sort((a, b) => b.score - a.score);

  const tryPick = (preferUnused: boolean): SkillPair | null => {
    for (const { skillId } of scored) {
      if (preferUnused && options.usedSkillIds.has(skillId)) continue;
      if (skillId === 'strength' && options.strengthCount >= maxStrength) continue;
      if (skillId === 'stamina' && options.staminaCount >= maxStamina) continue;
      if (!isSkillEligible(skillId, options.hasPartner, options.durationMinutes)) {
        continue;
      }
      return findSkillPair(skillId);
    }
    return null;
  };

  return tryPick(true) ?? tryPick(false);
}

function sessionSituationForDay(
  role: WeekDayRole,
  weekSituation: WeekSituation,
  matchContext?: WeekMatchContext
): SessionSituation {
  if (matchContext === 'match') return 'pre-match';
  if (role === 'recovery' || matchContext === 'post') return 'recovery-day';
  if (weekSituation === 'off-season') return 'off-season';
  if (weekSituation === 'recovery-week') return 'in-season';
  return 'in-season';
}

function intensityForDay(
  role: WeekDayRole,
  weekSituation: WeekSituation,
  matchContext?: WeekMatchContext
): SessionIntensity {
  if (matchContext === 'taper' || matchContext === 'match') return 'low';
  if (role === 'recovery' || role === 'light' || matchContext === 'post') return 'low';
  if (weekSituation === 'off-season') return 'medium';
  return 'medium';
}

function durationForDay(
  role: WeekDayRole,
  availableMinutes: SessionDurationMinutes,
  matchContext?: WeekMatchContext
): SessionDurationMinutes {
  if (matchContext === 'match') {
    return Math.min(availableMinutes, 15) as SessionDurationMinutes;
  }
  if (role === 'recovery' || matchContext === 'post') {
    return 15;
  }
  return availableMinutes;
}

function toFocusSkill(pair: SkillPair): WeekFocusSkill {
  return {
    categoryId: pair.categoryId,
    skillId: pair.skillId,
    title: skillTitle(pair),
  };
}

function pinPrioritySkills(options: {
  drafts: WeekDayDraft[];
  roles: WeekDayRole[];
  matchContexts: Array<WeekMatchContext | undefined>;
  prioritySkillIds: string[];
  focusPreference: WeekFocusPreference;
  weekSituation: WeekSituation;
}): { pins: Map<number, string>; notes: string[] } {
  const pins = new Map<number, string>();
  const notes: string[] = [];
  const usedDays = new Set<number>();

  for (const skillId of options.prioritySkillIds) {
    const pair = findSkillPair(skillId);
    if (!pair) {
      notes.push(`Priority skill “${skillId}” was not found and was skipped.`);
      continue;
    }

    const title = skillTitle(pair);
    let placed = false;

    const slotScores: Array<{ index: number; score: number }> = [];
    for (let i = 0; i < options.drafts.length; i += 1) {
      const role = options.roles[i]!;
      const matchContext = options.matchContexts[i];
      if (role !== 'light' && role !== 'full') continue;
      if (usedDays.has(i)) continue;
      if (matchContext === 'post') continue;

      const draft = options.drafts[i]!;
      const availableMinutes = draft.availableMinutes ?? 15;
      const durationMinutes = durationForDay(role, availableMinutes, matchContext);

      if (!skillAllowedOnRole(skillId, role, matchContext)) continue;
      if (!isSkillEligible(skillId, draft.hasPartner, durationMinutes)) continue;

      const score =
        preferenceScore(skillId, options.focusPreference) * 10 +
        (role === 'full' ? 2 : 0) +
        (matchContext === 'taper' || matchContext === 'match' ? -5 : 0);
      slotScores.push({ index: i, score });
    }

    slotScores.sort((a, b) => b.score - a.score);
    if (slotScores.length > 0) {
      const best = slotScores[0]!;
      pins.set(best.index, skillId);
      usedDays.add(best.index);
      placed = true;
    }

    if (!placed) {
      const needsPartner = PARTNER_REQUIRED_SKILL_IDS.has(skillId);
      notes.push(
        needsPartner
          ? `${title} needs a partner day — not scheduled.`
          : `${title} couldn’t fit this week’s filters — not scheduled.`
      );
    }
  }

  return { pins, notes };
}

export interface BuildWeeklyRegimenInput {
  weekSituation: WeekSituation;
  age: number;
  days: WeekDayDraft[];
  matchDay: WeekDayId | null;
  focusPreference: WeekFocusPreference;
  prioritySkillIds: string[];
}

/**
 * Classify days, assign skill rotation, and generate a session per training day
 * using the existing single-session generator.
 */
export function buildWeeklyRegimen(
  input: BuildWeeklyRegimenInput,
  profile: PlayerProfile | null
): WeeklyRegimen {
  const drafts = WEEK_DAY_ORDER.map(
    (day) =>
      input.days.find((d) => d.day === day) ?? {
        day,
        teamTraining: false,
        gymSession: false,
        hasPartner: false,
        availableMinutes: null,
      }
  );

  let roles = drafts.map((d) => classifyWeekDay(d, input.weekSituation));
  const matchApplied = applyMatchOverrides(drafts, roles, input.matchDay);
  roles = matchApplied.roles;
  const matchContexts = matchApplied.matchContexts;
  roles = ensureRestDay(drafts, roles, matchContexts);

  const { pins, notes } = pinPrioritySkills({
    drafts,
    roles,
    matchContexts,
    prioritySkillIds: input.prioritySkillIds,
    focusPreference: input.focusPreference,
    weekSituation: input.weekSituation,
  });

  const usedSkillIds = new Set<string>();
  let strengthCount = 0;
  let staminaCount = 0;
  const profileGoals = profile?.improvementGoals ?? [];

  const days: WeekDayPlan[] = drafts.map((draft, index) => {
    const role = roles[index]!;
    const matchContext = matchContexts[index];

    if (role === 'rest') {
      return {
        day: draft.day,
        role,
        teamTraining: draft.teamTraining,
        gymSession: draft.gymSession,
        hasPartner: draft.hasPartner,
        availableMinutes: draft.availableMinutes,
        session: null,
        matchContext,
      };
    }

    const availableMinutes = draft.availableMinutes ?? 15;
    const durationMinutes = durationForDay(role, availableMinutes, matchContext);
    const situation = sessionSituationForDay(role, input.weekSituation, matchContext);
    const intensity = intensityForDay(role, input.weekSituation, matchContext);

    let focus: WeekFocusSkill;
    if (role === 'recovery' || matchContext === 'post') {
      focus = toFocusSkill({ categoryId: 'recovery', skillId: 'recovery-mobility' });
    } else {
      const picked = pickSkillForDay({
        role: role === 'full' ? 'full' : 'light',
        weekSituation: input.weekSituation,
        focusPreference: input.focusPreference,
        hasPartner: draft.hasPartner,
        durationMinutes,
        usedSkillIds,
        strengthCount,
        staminaCount,
        profileGoals,
        matchContext,
        pinnedSkillId: pins.get(index),
      });

      if (!picked) {
        focus = toFocusSkill({ categoryId: 'recovery', skillId: 'recovery-mobility' });
      } else {
        focus = toFocusSkill(picked);
        usedSkillIds.add(picked.skillId);
        if (picked.skillId === 'strength') strengthCount += 1;
        if (picked.skillId === 'stamina') staminaCount += 1;
      }
    }

    const sessionInputs: SessionInputs = {
      target:
        role === 'recovery' ||
        matchContext === 'post' ||
        focus.skillId === 'recovery-mobility'
          ? { kind: 'skill', categoryId: 'recovery', skillId: 'recovery-mobility' }
          : {
              kind: 'skill',
              categoryId: focus.categoryId,
              skillId: focus.skillId,
            },
      situation,
      intensity,
      age: input.age,
      durationMinutes,
      hasPartner: draft.hasPartner,
    };

    const session = generateImproveSession(sessionInputs, profile);

    const resolvedRole: WeekDayRole =
      role !== 'recovery' &&
      focus.skillId === 'recovery-mobility' &&
      matchContext !== 'match'
        ? 'recovery'
        : role;

    return {
      day: draft.day,
      role: resolvedRole,
      teamTraining: draft.teamTraining,
      gymSession: draft.gymSession,
      hasPartner: draft.hasPartner,
      availableMinutes: draft.availableMinutes,
      focusSkill: focus,
      session,
      matchContext,
    };
  });

  return {
    id: createWeekId(),
    createdAt: new Date().toISOString(),
    weekSituation: input.weekSituation,
    age: input.age,
    matchDay: input.matchDay,
    focusPreference: input.focusPreference,
    prioritySkillIds: input.prioritySkillIds,
    days,
    notes,
  };
}

/** Regenerate a single day’s session from its stored plan inputs. */
export function regenerateWeekDaySession(
  regimen: WeeklyRegimen,
  dayId: WeekDayDraft['day'],
  profile: PlayerProfile | null
): WeeklyRegimen {
  const days = regimen.days.map((day) => {
    if (day.day !== dayId || day.role === 'rest' || !day.focusSkill) {
      return day;
    }

    const availableMinutes = day.availableMinutes ?? 15;
    const durationMinutes = durationForDay(
      day.role === 'recovery' ? 'recovery' : day.role,
      availableMinutes,
      day.matchContext
    );
    const situation = sessionSituationForDay(
      day.role,
      regimen.weekSituation,
      day.matchContext
    );
    const intensity = intensityForDay(day.role, regimen.weekSituation, day.matchContext);

    const sessionInputs: SessionInputs = {
      target: {
        kind: 'skill',
        categoryId: day.focusSkill.categoryId,
        skillId: day.focusSkill.skillId,
      },
      situation,
      intensity,
      age: regimen.age,
      durationMinutes,
      hasPartner: day.hasPartner,
    };

    return {
      ...day,
      session: generateImproveSession(sessionInputs, profile),
    };
  });

  return {
    ...regimen,
    id: createWeekId(),
    createdAt: new Date().toISOString(),
    days,
  };
}

/** Preview classifications (no sessions) for the review step. */
export function previewWeekRoles(
  weekSituation: WeekSituation,
  days: WeekDayDraft[],
  matchDay: WeekDayId | null = null
): Array<{
  day: WeekDayDraft['day'];
  role: WeekDayRole;
  matchContext?: WeekMatchContext;
}> {
  const drafts = WEEK_DAY_ORDER.map(
    (day) =>
      days.find((d) => d.day === day) ?? {
        day,
        teamTraining: false,
        gymSession: false,
        hasPartner: false,
        availableMinutes: null,
      }
  );
  let roles = drafts.map((d) => classifyWeekDay(d, weekSituation));
  const matchApplied = applyMatchOverrides(drafts, roles, matchDay);
  roles = ensureRestDay(drafts, matchApplied.roles, matchApplied.matchContexts);
  return drafts.map((d, i) => ({
    day: d.day,
    role: roles[i]!,
    matchContext: matchApplied.matchContexts[i],
  }));
}

/** Skills eligible for priority pick UI (excludes warm-up). */
export function listPrioritySkillOptions(): Array<{
  categoryId: ImproveCategoryId;
  categoryTitle: string;
  skillId: string;
  title: string;
  needsPartner: boolean;
}> {
  const options: Array<{
    categoryId: ImproveCategoryId;
    categoryTitle: string;
    skillId: string;
    title: string;
    needsPartner: boolean;
  }> = [];

  for (const category of getAllImproveCategories()) {
    for (const skill of category.skills) {
      if (skill.id === 'warm-up') continue;
      options.push({
        categoryId: category.id,
        categoryTitle: category.title,
        skillId: skill.id,
        title: skill.title,
        needsPartner: PARTNER_REQUIRED_SKILL_IDS.has(skill.id),
      });
    }
  }
  return options;
}
