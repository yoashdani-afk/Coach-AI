import { useEffect, useState } from 'react';
import { View, ScrollView } from 'react-native';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { TrackingPreviewFrame } from '@/components/analysis/TrackingPreviewFrame';
import { ScreenHeader } from '@/components/layout/ScreenHeader';
import { useUploadStore } from '@/stores/uploadStore';
import { useProfileStore } from '@/stores/profileStore';
import type { PlayerTrackingData } from '@/types/analysis';

export default function TrackPreviewScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const clip = useUploadStore((s) => s.clip);
  const analysisMode = useUploadStore((s) => s.analysisMode);
  const playerSelection = useUploadStore((s) => s.playerSelection);
  const setPlayerTracking = useUploadStore((s) => s.setPlayerTracking);
  const profile = useProfileStore((s) => s.profile);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (!clip || !analysisMode || !playerSelection || !profile) {
      router.replace('/(upload)/identify');
    }
  }, [clip, analysisMode, playerSelection, profile, router]);

  if (!clip || !analysisMode || !playerSelection || !profile) {
    return null;
  }

  const handleTrackingReady = (tracking: PlayerTrackingData) => {
    if (submitting) return;
    setSubmitting(true);
    setPlayerTracking(tracking);
    if (analysisMode === 'COACH_ME') {
      router.push('/(upload)/question');
    } else {
      router.push('/(upload)/analysing');
    }
  };

  const handleChooseAgain = () => {
    setPlayerTracking(null);
    router.replace('/(upload)/identify');
  };

  return (
    <View className="flex-1 bg-background">
      <ScreenHeader
        title="Confirm tracking"
        subtitle="Make sure the app follows the correct player through the full clip."
        showBack
        onBack={handleChooseAgain}
      />
      <ScrollView
        className="flex-1 px-4"
        contentContainerStyle={{ paddingBottom: insets.bottom + 24, gap: 16 }}
        showsVerticalScrollIndicator={false}
      >
        <TrackingPreviewFrame
          uri={clip.uri}
          clip={clip}
          playerSelection={playerSelection}
          profile={profile}
          mode={analysisMode}
          onTrackingReady={handleTrackingReady}
          onChooseAgain={handleChooseAgain}
        />
      </ScrollView>
    </View>
  );
}
