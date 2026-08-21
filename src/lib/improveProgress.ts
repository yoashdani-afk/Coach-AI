export const XP_PER_DRILL = 10;
export const XP_PER_LEVEL = 50;

export function improveSkillKey(categoryId: string, skillId: string): string {
  return `${categoryId}/${skillId}`;
}

export interface SkillProgress {
  totalXp: number;
  level: number;
  xpIntoLevel: number;
  xpPerLevel: number;
}

export function getSkillProgress(totalXp: number): SkillProgress {
  const safeXp = Math.max(0, totalXp);
  return {
    totalXp: safeXp,
    level: Math.floor(safeXp / XP_PER_LEVEL) + 1,
    xpIntoLevel: safeXp % XP_PER_LEVEL,
    xpPerLevel: XP_PER_LEVEL,
  };
}

export function formatSkillProgress(totalXp: number): string {
  const { level, xpIntoLevel, xpPerLevel } = getSkillProgress(totalXp);
  return `Level ${level} · ${xpIntoLevel}/${xpPerLevel} XP`;
}
