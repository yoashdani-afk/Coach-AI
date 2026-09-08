import { View } from 'react-native';
import { useRouter } from 'expo-router';
import { SelectCard, SelectGridItem } from '@/components/profile/SelectCard';
import type { ImproveMuscleGroupMeta } from '@/types/improve';

interface ImproveMuscleGroupGridProps {
  categoryId: string;
  skillId: string;
  muscleGroups: ImproveMuscleGroupMeta[];
}

export function ImproveMuscleGroupGrid({
  categoryId,
  skillId,
  muscleGroups,
}: ImproveMuscleGroupGridProps) {
  const router = useRouter();

  return (
    <View className="flex-row flex-wrap gap-3">
      {muscleGroups.map((group) => (
        <SelectGridItem key={group.id}>
          <SelectCard
            label={group.label}
            icon={group.icon}
            selected={false}
            onPress={() => router.push(`/improve/${categoryId}/${skillId}/muscle/${group.id}`)}
            compact
          />
        </SelectGridItem>
      ))}
    </View>
  );
}
