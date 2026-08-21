import { View } from 'react-native';
import { useRouter } from 'expo-router';
import { SelectCard, SelectGridItem } from '@/components/profile/SelectCard';
import type { ImproveCategory } from '@/types/improve';

interface ImproveCategoryGridProps {
  categories: ImproveCategory[];
}

export function ImproveCategoryGrid({ categories }: ImproveCategoryGridProps) {
  const router = useRouter();

  return (
    <View className="flex-row flex-wrap gap-3">
      {categories.map((category) => (
        <SelectGridItem key={category.id}>
          <SelectCard
            label={category.title}
            description={category.description}
            icon={category.icon}
            selected={false}
            onPress={() => router.push(`/improve/${category.id}`)}
            compact
          />
        </SelectGridItem>
      ))}
    </View>
  );
}
