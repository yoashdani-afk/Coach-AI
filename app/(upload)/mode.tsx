import { View, Text, ScrollView } from 'react-native';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { AnalysisModeCard } from '@/components/analysis/AnalysisModeCard';
import { Card } from '@/components/ui';
import { ScreenHeader } from '@/components/layout/ScreenHeader';
import { ANALYSIS_MODES } from '@/lib/constants';
import { formatDuration, formatFileSize } from '@/lib/format';
import { useUploadStore } from '@/stores/uploadStore';
import type { AnalysisMode } from '@/types/analysis';

export default function ModeScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const clip = useUploadStore((s) => s.clip);
  const setAnalysisMode = useUploadStore((s) => s.setAnalysisMode);
  const setPlayerSelection = useUploadStore((s) => s.setPlayerSelection);

  if (!clip) {
    router.replace('/(upload)');
    return null;
  }

  const handleSelectMode = (mode: AnalysisMode) => {
    setAnalysisMode(mode);
    setPlayerSelection(null);
    router.push('/(upload)/identify');
  };

  return (
    <View className="flex-1 bg-background">
      <ScreenHeader
        title="How would you like your clip analysed?"
        subtitle="Choose one coaching mode for this clip"
        showBack
        onBack={() => router.back()}
      />
      <ScrollView
        className="flex-1 px-4"
        contentContainerStyle={{ paddingBottom: insets.bottom + 24, gap: 20 }}
        showsVerticalScrollIndicator={false}
      >
        <Card variant="outlined" className="flex-row items-center gap-3">
          <View className="w-11 h-11 rounded-xl bg-primary-muted items-center justify-center">
            <Ionicons name="videocam" size={22} color="#00C853" />
          </View>
          <View className="flex-1">
            <Text className="text-text-primary font-medium" numberOfLines={1}>
              {clip.fileName ?? 'Selected clip'}
            </Text>
            <Text className="text-text-muted text-sm mt-0.5">
              {formatDuration(clip.durationMs)} · {formatFileSize(clip.fileSizeBytes)}
            </Text>
          </View>
        </Card>

        <View className="gap-4">
          {ANALYSIS_MODES.map((item) => (
            <AnalysisModeCard
              key={item.mode}
              mode={item.mode}
              onPress={() => handleSelectMode(item.mode)}
            />
          ))}
        </View>
      </ScrollView>
    </View>
  );
}
