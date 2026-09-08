import { useEffect } from 'react';
import { ScrollView, View, Text } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { ScreenHeader } from '@/components/layout/ScreenHeader';
import { ImproveSkillListItem } from '@/components/improve/ImproveSkillListItem';
import { Button } from '@/components/ui';
import {
  getImproveCategory,
  getImproveCategoryRoute,
  listSkillsForCategory,
} from '@/lib/improveContent';

export default function ImproveCategoryScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { categoryId } = useLocalSearchParams<{ categoryId: string }>();
  const category = categoryId ? getImproveCategory(categoryId) : undefined;
  const skills = categoryId ? listSkillsForCategory(categoryId) : [];

  useEffect(() => {
    if (category && skills.length === 1) {
      router.replace(getImproveCategoryRoute(category));
    }
  }, [category, router, skills.length]);

  if (!category) {
    return (
      <View className="flex-1 bg-background">
        <ScreenHeader title="Not found" showBack onBack={() => router.back()} />
        <View className="flex-1 items-center justify-center px-8 gap-4">
          <Text className="text-text-secondary text-center leading-6">
            That category could not be found.
          </Text>
          <Button label="Go back" variant="secondary" onPress={() => router.back()} />
        </View>
      </View>
    );
  }

  if (skills.length === 1) {
    return null;
  }

  return (
    <View className="flex-1 bg-background">
      <ScreenHeader
        title={category.title}
        subtitle={`${skills.length} ${skills.length === 1 ? 'skill' : 'skills'}`}
        showBack
        onBack={() => router.back()}
      />
      <ScrollView
        className="flex-1 px-4"
        contentContainerStyle={{ paddingBottom: insets.bottom + 24, gap: 12 }}
        showsVerticalScrollIndicator={false}
      >
        <Text className="text-text-secondary text-sm leading-5 mb-1">{category.description}</Text>
        {skills.map((skill) => (
          <ImproveSkillListItem
            key={skill.id}
            skill={skill}
            onPress={() => router.push(`/improve/${category.id}/${skill.id}`)}
          />
        ))}
      </ScrollView>
    </View>
  );
}
