import type { ImproveCategoryId } from '@/types/improve';
import type { SessionTarget } from '@/types/improveSession';

/** Labels Gemini may return for Performance primaryImprovementArea. */
export const PERFORMANCE_PRIMARY_IMPROVEMENT_AREAS = [
  'Decision Making',
  'Positioning',
  'Scanning',
  'Movement',
  'First Touch',
  'Composure',
  'Communication',
] as const;

export type PerformancePrimaryImprovementArea =
  (typeof PERFORMANCE_PRIMARY_IMPROVEMENT_AREAS)[number];

export interface MappedImproveSkill {
  categoryId: ImproveCategoryId;
  skillId: string;
}

/** Maps a Performance primary improvement label to an Improve skill route. */
export function mapPerformanceImprovementToSkill(
  area: string
): MappedImproveSkill | null {
  switch (area) {
    case 'Decision Making':
      return { categoryId: 'tactical', skillId: 'decision-making' };
    case 'Positioning':
      return { categoryId: 'tactical', skillId: 'positioning' };
    case 'Scanning':
      return { categoryId: 'tactical', skillId: 'scanning' };
    case 'Movement':
      return { categoryId: 'physical', skillId: 'agility' };
    case 'First Touch':
      return { categoryId: 'technical', skillId: 'first-touch' };
    case 'Composure':
      return { categoryId: 'mental', skillId: 'composure' };
    case 'Communication':
      return { categoryId: 'mental', skillId: 'communication' };
    default:
      return null;
  }
}

export function performanceImprovementSkillHref(area: string): string | null {
  const mapped = mapPerformanceImprovementToSkill(area);
  if (!mapped) return null;
  return `/improve/${mapped.categoryId}/${mapped.skillId}`;
}

export function performanceImprovementToSessionTarget(area: string): SessionTarget | null {
  const mapped = mapPerformanceImprovementToSkill(area);
  if (!mapped) return null;
  return { kind: 'skill', categoryId: mapped.categoryId, skillId: mapped.skillId };
}
