import { View, Text } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { ScreenHeader } from '@/components/layout/ScreenHeader';
import { Card } from '@/components/ui';

export default function CoachScreen() {
  const insets = useSafeAreaInsets();

  return (
    <View className="flex-1 bg-background">
      <ScreenHeader title="AI Coach" subtitle="Your personal coach" />
      <View className="flex-1 px-4" style={{ paddingBottom: insets.bottom + 24 }}>
        <Card variant="outlined" className="items-center py-12 mt-4 gap-4">
          <View className="w-16 h-16 rounded-2xl bg-primary-muted items-center justify-center">
            <Ionicons name="chatbubbles-outline" size={32} color="#00C853" />
          </View>
          <Text className="text-text-primary text-lg font-semibold text-center">Ask your coach</Text>
          <Text className="text-text-secondary text-sm text-center leading-6 px-4">
            After your first clip analysis, chat with your AI coach about your performance, drills, and
            how to improve.
          </Text>
        </Card>
      </View>
    </View>
  );
}
