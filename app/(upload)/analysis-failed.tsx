import { View, Text } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { Button, Card } from '@/components/ui';
import { ScreenHeader } from '@/components/layout/ScreenHeader';

export default function AnalysisFailedScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { message, requestId } = useLocalSearchParams<{
    message?: string;
    requestId?: string;
  }>();

  const displayMessage =
    typeof message === 'string' && message.trim().length > 0
      ? message
      : "We couldn't analyse this clip confidently.";

  return (
    <View className="flex-1 bg-background">
      <ScreenHeader
        title="Analysis unavailable"
        subtitle="The footage could not be understood confidently enough."
        showBack
        onBack={() => router.back()}
      />
      <View
        className="flex-1 px-4 justify-center gap-6"
        style={{ paddingBottom: insets.bottom + 24 }}
      >
        <View className="items-center gap-4">
          <View className="w-20 h-20 rounded-2xl bg-surface border border-border items-center justify-center">
            <Ionicons name="alert-circle-outline" size={40} color="#FFB300" />
          </View>
          <Text className="text-text-primary text-xl font-bold text-center">
            We couldn&apos;t analyse this clip confidently.
          </Text>
          <Text className="text-text-secondary text-sm text-center leading-6 px-2">
            {displayMessage}
          </Text>
        </View>

        <Card variant="outlined" className="gap-2">
          <Text className="text-text-muted text-sm leading-5">
            No scores or coaching report were generated for this attempt.
          </Text>
          {requestId ? (
            <Text className="text-text-muted text-xs">Request ID: {requestId}</Text>
          ) : null}
        </Card>

        <View className="gap-3">
          <Button
            label="Try again"
            onPress={() => router.replace('/(upload)/identify')}
            fullWidth
            size="lg"
          />
          <Button
            label="Try another clip"
            variant="secondary"
            onPress={() => router.replace('/(upload)')}
            fullWidth
          />
        </View>
      </View>
    </View>
  );
}
