import { ScrollView, View, Text } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { ScreenHeader } from '@/components/layout/ScreenHeader';
import { ImproveCategoryGrid } from '@/components/improve/ImproveCategoryGrid';
import { getAllImproveCategories } from '@/lib/improveContent';

export default function CoachScreen() {
  const insets = useSafeAreaInsets();
  const categories = getAllImproveCategories();

  return (
    <View className="flex-1 bg-background">
      <ScreenHeader title="AI Coach" subtitle="Your personal coach" />
      <ScrollView
        className="flex-1 px-4"
        contentContainerStyle={{ paddingBottom: insets.bottom + 24 }}
        showsVerticalScrollIndicator={false}
      >
        <View className="gap-3 mt-2">
          <View>
            <Text className="text-text-muted text-xs uppercase tracking-wider mb-1">Improve</Text>
            <Text className="text-text-secondary text-sm leading-5">
              Build specific skills off the pitch with guided explanations and drills.
            </Text>
          </View>
          <ImproveCategoryGrid categories={categories} />
        </View>
      </ScrollView>
    </View>
  );
}
