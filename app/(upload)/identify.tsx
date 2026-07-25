import { useState } from 'react';
import { View, Text, ScrollView } from 'react-native';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { PlayerSelectionFrame } from '@/components/analysis/PlayerSelectionFrame';
import { Button } from '@/components/ui';
import { ScreenHeader } from '@/components/layout/ScreenHeader';
import { useUploadStore } from '@/stores/uploadStore';
import type { PlayerSelection } from '@/types/analysis';

export default function IdentifyPlayerScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const clip = useUploadStore((s) => s.clip);
  const analysisMode = useUploadStore((s) => s.analysisMode);
  const playerSelection = useUploadStore((s) => s.playerSelection);
  const setPlayerSelection = useUploadStore((s) => s.setPlayerSelection);
  const clearDraft = useUploadStore((s) => s.clearDraft);

  const [selection, setSelection] = useState<PlayerSelection | null>(playerSelection);

  if (!clip || !analysisMode) {
    router.replace('/(upload)');
    return null;
  }

  const handleConfirm = () => {
    if (!selection) return;
    setPlayerSelection(selection);
    if (analysisMode === 'COACH_ME') {
      router.push('/(upload)/question');
    } else {
      router.push('/(upload)/analysing');
    }
  };

  const handleChooseAnother = () => {
    clearDraft();
    router.replace('/(upload)');
  };

  return (
    <View className="flex-1 bg-background">
      <ScreenHeader
        title="Which player are you?"
        subtitle="Tap yourself in the frame so your coach analyses the correct player."
        showBack
        onBack={() => router.back()}
      />
      <ScrollView
        className="flex-1 px-4"
        contentContainerStyle={{ paddingBottom: insets.bottom + 120, gap: 16 }}
        showsVerticalScrollIndicator={false}
      >
        <PlayerSelectionFrame
          uri={clip.uri}
          clipDurationMs={clip.durationMs}
          initialSelection={playerSelection}
          onSelectionChange={setSelection}
          onRetry={() => setSelection(null)}
          onChooseAnother={handleChooseAnother}
        />

        <Text className="text-text-muted text-sm text-center leading-5 px-2">
          Make sure your full body is visible where possible.
        </Text>
      </ScrollView>

      <View
        className="absolute bottom-0 left-0 right-0 px-4 pt-4 bg-background border-t border-border"
        style={{ paddingBottom: insets.bottom + 16 }}
      >
        <Button
          label="Confirm player"
          onPress={handleConfirm}
          disabled={!selection}
          fullWidth
          size="lg"
        />
      </View>
    </View>
  );
}
