import { View } from 'react-native';
import { useRouter } from 'expo-router';
import { SelectCard, SelectGridItem } from '@/components/profile/SelectCard';
import { getImproveCategoryRoute } from '@/lib/improveContent';
import type { ImproveCategory } from '@/types/improve';

interface ImproveCategoryGridProps {
  categories: ImproveCategory[];
}

export function ImproveCategoryGrid({ categories }: ImproveCategoryGridProps) {
  const router = useRouter();
  const lastIndex = categories.length - 1;
  const centerLastTile = categories.length % 2 === 1;

  return (
    <View className="flex-row flex-wrap gap-3">
      {categories.map((category, index) => {
        const isCenteredLast = centerLastTile && index === lastIndex;

        if (isCenteredLast) {
          return (
            <View key={category.id} className="w-full items-center">
              <View className="w-[48%]">
                <SelectCard
                  label={category.title}
                  description={category.description}
                  icon={category.icon}
                  selected={false}
                  onPress={() => router.push(getImproveCategoryRoute(category))}
                  compact
                />
              </View>
            </View>
          );
        }

        return (
          <SelectGridItem key={category.id}>
            <SelectCard
              label={category.title}
              description={category.description}
              icon={category.icon}
              selected={false}
              onPress={() => router.push(getImproveCategoryRoute(category))}
              compact
            />
          </SelectGridItem>
        );
      })}
    </View>
  );
}
