import { IMPROVE_CATEGORIES } from '@/content/improveContent';
import type { ImproveCategory, ImproveCategoryId, ImproveDrill, ImproveSkill } from '@/types/improve';

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
