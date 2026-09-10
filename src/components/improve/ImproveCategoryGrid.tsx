import { View, Text, Pressable } from 'react-native';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { getImproveCategoryRoute } from '@/lib/improveContent';
import type { ImproveCategory, ImproveCategoryId } from '@/types/improve';

/** Category accents for Coach Improve tiles only — not shared SelectCard styling. */
export const IMPROVE_CATEGORY_ACCENTS: Record<ImproveCategoryId, string> = {
  physical: '#FFB300',
  recovery: '#2DD4BF',
  technical: '#00C853',
  tactical: '#5B8DEF',
  mental: '#A78BFA',
};

interface ImproveCategoryGridProps {
  categories: ImproveCategory[];
}

function ImproveCategoryTile({
  category,
  onPress,
}: {
  category: ImproveCategory;
  onPress: () => void;
}) {
  const accent = IMPROVE_CATEGORY_ACCENTS[category.id];

  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={category.title}
      className="rounded-2xl bg-surface border border-border overflow-hidden active:opacity-80"
      style={{
        minHeight: 100,
        borderLeftWidth: 2,
        borderLeftColor: accent,
      }}
    >
      <View
        pointerEvents="none"
        style={{
          position: 'absolute',
          top: 0,
          right: 0,
          bottom: 0,
          left: 0,
          backgroundColor: `${accent}0F`,
        }}
      />
      <View className="p-3.5 flex-1">
        <View pointerEvents="none" style={{ position: 'absolute', bottom: -6, right: -8 }}>
          <Ionicons name={category.icon} size={56} color={accent} style={{ opacity: 0.06 }} />
        </View>

        <View
          className="items-center justify-center mb-2.5"
          style={{
            width: 44,
            height: 44,
            borderRadius: 12,
            backgroundColor: `${accent}33`,
          }}
        >
          <Ionicons name={category.icon} size={22} color={accent} />
        </View>
        <Text className="text-text-primary font-semibold text-sm">{category.title}</Text>
        {category.description ? (
          <Text className="text-text-muted text-xs mt-1 leading-4" numberOfLines={2}>
            {category.description}
          </Text>
        ) : null}
      </View>
    </Pressable>
  );
}

export function ImproveCategoryGrid({ categories }: ImproveCategoryGridProps) {
  const router = useRouter();
  const lastIndex = categories.length - 1;
  const centerLastTile = categories.length % 2 === 1;

  return (
    <View className="flex-row flex-wrap gap-3">
      {categories.map((category, index) => {
        const isCenteredLast = centerLastTile && index === lastIndex;
        const tile = (
          <ImproveCategoryTile
            category={category}
            onPress={() => router.push(getImproveCategoryRoute(category))}
          />
        );

        if (isCenteredLast) {
          return (
            <View key={category.id} className="w-full items-center">
              <View className="w-[48%]">{tile}</View>
            </View>
          );
        }

        return (
          <View key={category.id} className="w-[48%]">
            {tile}
          </View>
        );
      })}
    </View>
  );
}
