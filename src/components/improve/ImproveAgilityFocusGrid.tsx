import { View } from 'react-native';
import { useRouter } from 'expo-router';
import { SelectCard, SelectGridItem } from '@/components/profile/SelectCard';
import type { ImproveAgilityFocusMeta } from '@/types/improve';

interface ImproveAgilityFocusGridProps {
  categoryId: string;
  skillId: string;
  focusAreas: ImproveAgilityFocusMeta[];
}

export function ImproveAgilityFocusGrid({
  categoryId,
  skillId,
  focusAreas,
}: ImproveAgilityFocusGridProps) {
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
              router.push(`/improve/${categoryId}/${skillId}/agility-focus/${focus.id}`)
            }
            compact
          />
        </SelectGridItem>
      ))}
    </View>
  );
}
