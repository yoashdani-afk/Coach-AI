import { View } from 'react-native';
import { useRouter } from 'expo-router';
import { SelectCard, SelectGridItem } from '@/components/profile/SelectCard';
import type { ImproveSpeedFocusMeta } from '@/types/improve';

interface ImproveSpeedFocusGridProps {
  categoryId: string;
  skillId: string;
  focusAreas: ImproveSpeedFocusMeta[];
}

export function ImproveSpeedFocusGrid({
  categoryId,
  skillId,
  focusAreas,
}: ImproveSpeedFocusGridProps) {
  const router = useRouter();

  return (
    <View className="flex-row flex-wrap gap-3">
      {focusAreas.map((focus) => (
        <SelectGridItem key={focus.id}>
          <SelectCard
            label={focus.label}
            icon={focus.icon}
            selected={false}
            onPress={() => router.push(`/improve/${categoryId}/${skillId}/focus/${focus.id}`)}
            compact
          />
        </SelectGridItem>
      ))}
    </View>
  );
}
