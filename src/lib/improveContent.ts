import { IMPROVE_CATEGORIES } from '@/content/improveContent';
import type { Href } from 'expo-router';
import {
  IMPROVE_AGILITY_FOCUS_AREAS,
  IMPROVE_DIFFICULTY_TIERS,
  IMPROVE_MUSCLE_GROUPS,
  IMPROVE_RECOVERY_FOCUS_AREAS,
  IMPROVE_SPEED_FOCUS_AREAS,
  type ImproveAgilityFocusId,
  type ImproveAgilityFocusMeta,
  type ImproveCategory,
  type ImproveCategoryId,
  type ImproveDifficultyTierId,
  type ImproveDifficultyTierMeta,
  type ImproveDrill,
  type ImproveDrillDifficulty,
  type ImproveMuscleGroupId,
  type ImproveMuscleGroupMeta,
  type ImproveRecoveryFocusId,
  type ImproveRecoveryFocusMeta,
  type ImproveSkill,
  type ImproveSpeedFocusId,
  type ImproveSpeedFocusMeta,
} from '@/types/improve';

export function getImproveCategory(categoryId: string): ImproveCategory | undefined {
  return IMPROVE_CATEGORIES.find((category) => category.id === categoryId);
}

export function isImproveCategoryId(value: string): value is ImproveCategoryId {
  return IMPROVE_CATEGORIES.some((category) => category.id === value);
}

export function listSkillsForCategory(categoryId: string): ImproveSkill[] {
  return getImproveCategory(categoryId)?.skills ?? [];
}

export function getImproveSkill(categoryId: string, skillId: string): ImproveSkill | undefined {
  return getImproveCategory(categoryId)?.skills.find((skill) => skill.id === skillId);
}

export function listDrillsForSkill(categoryId: string, skillId: string): ImproveDrill[] {
  return getImproveSkill(categoryId, skillId)?.drills ?? [];
}

export function getImproveDrill(
  categoryId: string,
  skillId: string,
  drillId: string
): ImproveDrill | undefined {
  return getImproveSkill(categoryId, skillId)?.drills.find((drill) => drill.id === drillId);
}

export function getAllImproveCategories(): ImproveCategory[] {
  return IMPROVE_CATEGORIES;
}

/** Category list route, or skill route when the category has exactly one skill. */
export function getImproveCategoryRoute(category: ImproveCategory): Href {
  if (category.skills.length === 1) {
    return `/improve/${category.id}/${category.skills[0].id}` as Href;
  }
  return `/improve/${category.id}` as Href;
}

export function isImproveMuscleGroupId(value: string): value is ImproveMuscleGroupId {
  return IMPROVE_MUSCLE_GROUPS.some((group) => group.id === value);
}

export function getImproveMuscleGroupMeta(
  muscleGroupId: string
): ImproveMuscleGroupMeta | undefined {
  return IMPROVE_MUSCLE_GROUPS.find((group) => group.id === muscleGroupId);
}

/** True when at least one drill is tagged with a muscle group (gates the picker UI). */
export function skillHasMuscleGroups(skill: ImproveSkill): boolean {
  return skill.drills.some((drill) => drill.muscleGroup != null);
}

/** Muscle groups present on this skill's drills, in canonical IMPROVE_MUSCLE_GROUPS order. */
export function listMuscleGroupsForSkill(skill: ImproveSkill): ImproveMuscleGroupMeta[] {
  const present = new Set(
    skill.drills
      .map((drill) => drill.muscleGroup)
      .filter((group): group is ImproveMuscleGroupId => group != null)
  );
  return IMPROVE_MUSCLE_GROUPS.filter((group) => present.has(group.id));
}

export function listDrillsForMuscleGroup(
  categoryId: string,
  skillId: string,
  muscleGroupId: string
): ImproveDrill[] {
  return listDrillsForSkill(categoryId, skillId).filter(
    (drill) => drill.muscleGroup === muscleGroupId
  );
}

export function isImproveSpeedFocusId(value: string): value is ImproveSpeedFocusId {
  return IMPROVE_SPEED_FOCUS_AREAS.some((focus) => focus.id === value);
}

export function getImproveSpeedFocusMeta(
  speedFocusId: string
): ImproveSpeedFocusMeta | undefined {
  return IMPROVE_SPEED_FOCUS_AREAS.find((focus) => focus.id === speedFocusId);
}

/** True when at least one drill is tagged with a speed focus (gates the picker UI). */
export function skillHasSpeedFocus(skill: ImproveSkill): boolean {
  return skill.drills.some((drill) => drill.speedFocus != null);
}

/** Speed focus areas present on this skill's drills, in canonical IMPROVE_SPEED_FOCUS_AREAS order. */
export function listSpeedFocusAreasForSkill(skill: ImproveSkill): ImproveSpeedFocusMeta[] {
  const present = new Set(
    skill.drills
      .map((drill) => drill.speedFocus)
      .filter((focus): focus is ImproveSpeedFocusId => focus != null)
  );
  return IMPROVE_SPEED_FOCUS_AREAS.filter((focus) => present.has(focus.id));
}

export function listDrillsForSpeedFocus(
  categoryId: string,
  skillId: string,
  speedFocusId: string
): ImproveDrill[] {
  return listDrillsForSkill(categoryId, skillId).filter(
    (drill) => drill.speedFocus === speedFocusId
  );
}

export function isImproveAgilityFocusId(value: string): value is ImproveAgilityFocusId {
  return IMPROVE_AGILITY_FOCUS_AREAS.some((focus) => focus.id === value);
}

export function getImproveAgilityFocusMeta(
  agilityFocusId: string
): ImproveAgilityFocusMeta | undefined {
  return IMPROVE_AGILITY_FOCUS_AREAS.find((focus) => focus.id === agilityFocusId);
}

/** True when at least one drill is tagged with an agility focus (gates the picker UI). */
export function skillHasAgilityFocus(skill: ImproveSkill): boolean {
  return skill.drills.some((drill) => drill.agilityFocus != null);
}

/** Agility focus areas present on this skill's drills, in canonical IMPROVE_AGILITY_FOCUS_AREAS order. */
export function listAgilityFocusAreasForSkill(skill: ImproveSkill): ImproveAgilityFocusMeta[] {
  const present = new Set(
    skill.drills
      .map((drill) => drill.agilityFocus)
      .filter((focus): focus is ImproveAgilityFocusId => focus != null)
  );
  return IMPROVE_AGILITY_FOCUS_AREAS.filter((focus) => present.has(focus.id));
}

export function listDrillsForAgilityFocus(
  categoryId: string,
  skillId: string,
  agilityFocusId: string
): ImproveDrill[] {
  return listDrillsForSkill(categoryId, skillId).filter(
    (drill) => drill.agilityFocus === agilityFocusId
  );
}

export function isImproveRecoveryFocusId(value: string): value is ImproveRecoveryFocusId {
  return IMPROVE_RECOVERY_FOCUS_AREAS.some((focus) => focus.id === value);
}

export function getImproveRecoveryFocusMeta(
  recoveryFocusId: string
): ImproveRecoveryFocusMeta | undefined {
  return IMPROVE_RECOVERY_FOCUS_AREAS.find((focus) => focus.id === recoveryFocusId);
}

/** True when at least one drill is tagged with a recovery focus (gates the picker UI). */
export function skillHasRecoveryFocus(skill: ImproveSkill): boolean {
  return skill.drills.some((drill) => drill.recoveryFocus != null);
}

/** Recovery focus areas present on this skill's drills, in canonical IMPROVE_RECOVERY_FOCUS_AREAS order. */
export function listRecoveryFocusAreasForSkill(skill: ImproveSkill): ImproveRecoveryFocusMeta[] {
  const present = new Set(
    skill.drills
      .map((drill) => drill.recoveryFocus)
      .filter((focus): focus is ImproveRecoveryFocusId => focus != null)
  );
  return IMPROVE_RECOVERY_FOCUS_AREAS.filter((focus) => present.has(focus.id));
}

export function listDrillsForRecoveryFocus(
  categoryId: string,
  skillId: string,
  recoveryFocusId: string
): ImproveDrill[] {
  return listDrillsForSkill(categoryId, skillId).filter(
    (drill) => drill.recoveryFocus === recoveryFocusId
  );
}

function parseDifficultyTierId(value: string): ImproveDrillDifficulty | undefined {
  const parsed = Number(value);
  if (parsed === 1 || parsed === 2 || parsed === 3 || parsed === 4 || parsed === 5) {
    return parsed;
  }
  return undefined;
}

export function isImproveDifficultyTierId(value: string): value is `${ImproveDifficultyTierId}` {
  return parseDifficultyTierId(value) != null;
}

export function getImproveDifficultyTierMeta(
  tierId: string
): ImproveDifficultyTierMeta | undefined {
  const difficulty = parseDifficultyTierId(tierId);
  if (difficulty == null) return undefined;
  return IMPROVE_DIFFICULTY_TIERS.find((tier) => tier.id === difficulty);
}

/** True when this skill opts into difficulty-tier navigation. */
export function skillUsesDifficultyTiers(skill: ImproveSkill): boolean {
  return skill.useDifficultyTiers === true;
}

/** Difficulty tiers present on this skill's drills, in canonical IMPROVE_DIFFICULTY_TIERS order. */
export function listDifficultyTiersForSkill(skill: ImproveSkill): ImproveDifficultyTierMeta[] {
  const present = new Set(skill.drills.map((drill) => drill.difficulty));
  return IMPROVE_DIFFICULTY_TIERS.filter((tier) => present.has(tier.id));
}

export function listDrillsForDifficultyTier(
  categoryId: string,
  skillId: string,
  tierId: string
): ImproveDrill[] {
  const difficulty = parseDifficultyTierId(tierId);
  if (difficulty == null) return [];
  return listDrillsForSkill(categoryId, skillId).filter(
    (drill) => drill.difficulty === difficulty
  );
}
