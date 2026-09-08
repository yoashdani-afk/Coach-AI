import { View } from 'react-native';
import { useRouter } from 'expo-router';
import { SelectCard, SelectGridItem } from '@/components/profile/SelectCard';
import type { ImproveDifficultyTierMeta } from '@/types/improve';

interface ImproveDifficultyTierGridProps {
  categoryId: string;
  skillId: string;
  tiers: ImproveDifficultyTierMeta[];
}

export function ImproveDifficultyTierGrid({
  categoryId,
  skillId,
  tiers,
}: ImproveDifficultyTierGridProps) {
  const router = useRouter();

  return (
    <View className="flex-row flex-wrap gap-3">
      {tiers.map((tier) => (
        <SelectGridItem key={tier.id}>
          <SelectCard
            label={tier.label}
            icon={tier.icon}
            selected={false}
            onPress={() => router.push(`/improve/${categoryId}/${skillId}/tier/${tier.id}`)}
            compact
          />
        </SelectGridItem>
      ))}
    </View>
  );
}
