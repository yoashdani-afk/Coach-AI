import { View } from 'react-native';
import { useRouter } from 'expo-router';
import { SelectCard, SelectGridItem } from '@/components/profile/SelectCard';
import type { ImproveRecoveryFocusMeta } from '@/types/improve';

interface ImproveRecoveryFocusGridProps {
  categoryId: string;
  skillId: string;
  focusAreas: ImproveRecoveryFocusMeta[];
}

export function ImproveRecoveryFocusGrid({
  categoryId,
  skillId,
  focusAreas,
}: ImproveRecoveryFocusGridProps) {
  const router = useRouter();

  return (
    <View className="flex-row flex-wrap gap-3">
      {focusAreas.map((focus) => (
        <SelectGridItem key={focus.id}>
          <SelectCard
            label={focus.label}
            icon={focus.icon}
            selected={false}
            onPress={() =>
              router.push(`/improve/${categoryId}/${skillId}/recovery-focus/${focus.id}`)
            }
            compact
          />
        </SelectGridItem>
      ))}
    </View>
  );
}
