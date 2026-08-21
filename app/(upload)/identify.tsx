import { useEffect, useState } from 'react';
import { View, Text, ScrollView } from 'react-native';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { PlayerSelectionFrame } from '@/components/analysis/PlayerSelectionFrame';
import { Button } from '@/components/ui';
import { ScreenHeader } from '@/components/layout/ScreenHeader';
import { buildSingleReferenceProfile } from '@/lib/identityProfile';
import { useUploadStore } from '@/stores/uploadStore';
import type { PlayerSelection } from '@/types/analysis';

export default function IdentifyPlayerScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const clip = useUploadStore((s) => s.clip);
  const analysisMode = useUploadStore((s) => s.analysisMode);
  const setPlayerSelection = useUploadStore((s) => s.setPlayerSelection);
  const setPlayerTracking = useUploadStore((s) => s.setPlayerTracking);
  const clearDraft = useUploadStore((s) => s.clearDraft);

  const [primarySelection, setPrimarySelection] = useState<PlayerSelection | null>(null);

  useEffect(() => {
    if (!clip || !analysisMode) {
      router.replace('/(upload)');
    }
  }, [clip, analysisMode, router]);

  if (!clip || !analysisMode) {
    return null;
  }

  const handleConfirm = () => {
    if (!primarySelection) return;

    const identityProfile = buildSingleReferenceProfile(primarySelection);
    const finalSelection: PlayerSelection = {
      ...primarySelection,
      identityProfile,
      ...(primarySelection.reducedTrackingConfidence ? { reducedTrackingConfidence: true } : {}),
    };

    console.log('[PlayerSelection] ANALYSE SELECTED PLAYER', {
      mode: analysisMode,
      timestampMs: finalSelection.timestampMs,
      normalizedX: finalSelection.normalizedX,
      normalizedY: finalSelection.normalizedY,
    });

    setPlayerSelection(finalSelection);
    setPlayerTracking(null);

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
        subtitle="Tap yourself once. We'll analyse this player in your clip."
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
          fileName={clip.fileName}
          clipDurationMs={clip.durationMs}
          initialSelection={null}
          onSelectionChange={setPrimarySelection}
          onRetry={() => setPrimarySelection(null)}
          onChooseAnother={handleChooseAnother}
        />
        <Text className="text-text-muted text-sm text-center leading-5 px-2">
          One tap is enough. Analysis starts after you confirm your selection.
        </Text>
      </ScrollView>

      <View
        className="absolute bottom-0 left-0 right-0 px-4 pt-4 bg-background border-t border-border"
        style={{ paddingBottom: insets.bottom + 16 }}
      >
        <Button
          label="Analyse this player"
          onPress={handleConfirm}
          disabled={!primarySelection}
          fullWidth
          size="lg"
        />
      </View>
    </View>
  );
}
