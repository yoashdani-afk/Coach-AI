import { View, Text } from 'react-native';
import { formatSkillProgress, getSkillProgress } from '@/lib/improveProgress';
import { useImproveProgressStore } from '@/stores/improveProgressStore';

interface ImproveSkillProgressBadgeProps {
  categoryId: string;
  skillId: string;
  showBar?: boolean;
}

export function ImproveSkillProgressBadge({
  categoryId,
  skillId,
  showBar = false,
}: ImproveSkillProgressBadgeProps) {
  const skillXp = useImproveProgressStore((state) => {
    const key = `${categoryId}/${skillId}`;
    return state.skillXp[key] ?? 0;
  });

  const label = formatSkillProgress(skillXp);
  const { xpIntoLevel, xpPerLevel } = getSkillProgress(skillXp);
  const progressPct = (xpIntoLevel / xpPerLevel) * 100;

  return (
    <View className="gap-1.5">
      <Text className="text-primary text-xs font-semibold">{label}</Text>
      {showBar ? (
        <View className="h-1.5 bg-surface-elevated rounded-full overflow-hidden">
          <View className="h-full bg-primary rounded-full" style={{ width: `${progressPct}%` }} />
        </View>
      ) : null}
    </View>
  );
}
