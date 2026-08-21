import { useEffect, useState } from 'react';
import { View } from 'react-native';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { TrackingBuildView } from '@/components/analysis/TrackingBuildView';
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

  const hasRequirements = Boolean(clip && analysisMode && playerSelection && profile);

  useEffect(() => {
    if (!hasRequirements) {
      console.log('[Navigation] destination', '/(upload)/identify');
      router.replace('/(upload)/identify');
    }
  }, [hasRequirements, router]);

  if (!hasRequirements || !clip || !analysisMode || !playerSelection || !profile) {
    return null;
  }

  const handleApproved = (tracking: PlayerTrackingData) => {
    if (submitting) return;
    setSubmitting(true);
    setPlayerTracking(tracking);
    if (analysisMode === 'COACH_ME') {
      console.log('[Navigation] destination', '/(upload)/question');
      router.push('/(upload)/question');
    } else {
      console.log('[Navigation] destination', '/(upload)/analysing');
      router.push('/(upload)/analysing');
    }
  };

  return (
    <View className="flex-1 bg-background" style={{ paddingBottom: insets.bottom }}>
      <TrackingBuildView
        clip={clip}
        uri={clip.uri}
        playerSelection={playerSelection}
        profile={profile}
        mode={analysisMode}
        onApproved={handleApproved}
        onCancel={() => {
          console.log('[Navigation] destination', '/(upload)/identify');
          router.replace('/(upload)/identify');
        }}
        onRetapPlayer={() => {
          console.log('[Navigation] destination', '/(upload)/identify');
          router.replace('/(upload)/identify');
        }}
      />
    </View>
  );
}
