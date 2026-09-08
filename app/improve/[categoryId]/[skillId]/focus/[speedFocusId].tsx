import { ScrollView, View, Text } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { ScreenHeader } from '@/components/layout/ScreenHeader';
import { ImproveDrillList } from '@/components/improve/ImproveDrillList';
import { Button } from '@/components/ui';
import {
  getImproveCategory,
  getImproveSkill,
  getImproveSpeedFocusMeta,
  listDrillsForSpeedFocus,
  skillHasSpeedFocus,
} from '@/lib/improveContent';

export default function ImproveSpeedFocusDrillListScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { categoryId, skillId, speedFocusId } = useLocalSearchParams<{
    categoryId: string;
    skillId: string;
    speedFocusId: string;
  }>();

  const category = categoryId ? getImproveCategory(categoryId) : undefined;
  const skill = categoryId && skillId ? getImproveSkill(categoryId, skillId) : undefined;
  const focusArea = speedFocusId ? getImproveSpeedFocusMeta(speedFocusId) : undefined;
  const drills =
    categoryId && skillId && speedFocusId
      ? listDrillsForSpeedFocus(categoryId, skillId, speedFocusId)
      : [];

  if (!category || !skill || !focusArea || !skillHasSpeedFocus(skill)) {
    return (
      <View className="flex-1 bg-background">
        <ScreenHeader title="Not found" showBack onBack={() => router.back()} />
        <View className="flex-1 items-center justify-center px-8 gap-4">
          <Text className="text-text-secondary text-center leading-6">
            That focus area could not be found.
          </Text>
          <Button label="Go back" variant="secondary" onPress={() => router.back()} />
        </View>
      </View>
    );
  }

  return (
    <View className="flex-1 bg-background">
      <ScreenHeader
        title={focusArea.label}
        subtitle={skill.title}
        showBack
        onBack={() => router.back()}
      />
      <ScrollView
        className="flex-1 px-4"
        contentContainerStyle={{ paddingBottom: insets.bottom + 24, gap: 16 }}
        showsVerticalScrollIndicator={false}
      >
        <View>
          <Text className="text-text-muted text-xs uppercase tracking-wider mb-2">Drills to try</Text>
          <ImproveDrillList categoryId={category.id} skillId={skill.id} drills={drills} />
        </View>
      </ScrollView>
    </View>
  );
}
