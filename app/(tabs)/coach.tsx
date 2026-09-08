import { ScrollView, View, Text } from 'react-native';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { ScreenHeader } from '@/components/layout/ScreenHeader';
import { ImproveCategoryGrid } from '@/components/improve/ImproveCategoryGrid';
import { Button, Card } from '@/components/ui';
import { getAllImproveCategories } from '@/lib/improveContent';

export default function CoachScreen() {
  const router = useRouter();
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
          <Card variant="outlined" className="gap-3">
            <View>
              <Text className="text-text-primary font-semibold text-base">
                Personalized session
              </Text>
              <Text className="text-text-secondary text-sm leading-5 mt-1">
                Answer a few questions and get a tailored set of drills for today.
              </Text>
            </View>
            <Button
              label="Build a session"
              onPress={() => router.push('/improve/session')}
              fullWidth
            />
          </Card>

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
