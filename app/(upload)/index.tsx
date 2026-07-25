import { useState } from 'react';
import { View, Text, Pressable, Alert } from 'react-native';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { Button } from '@/components/ui';
import { ScreenHeader } from '@/components/layout/ScreenHeader';
import { pickVideoFromLibrary, getICloudNotDownloadedMessage } from '@/lib/videoPicker';
import { FREE_TIER_ANALYSES_PER_MONTH } from '@/lib/constants';
import { useAnalysisStore } from '@/stores/analysisStore';
import { getRemainingAnalyses, hasCompleteProfile, useProfileStore } from '@/stores/profileStore';
import { useUploadStore } from '@/stores/uploadStore';

export default function PickClipScreen() {
  const router = useRouter();
  const profile = useProfileStore((s) => s.profile);
  const remaining = getRemainingAnalyses(profile);
  const isAnalysing = useAnalysisStore((s) => s.isAnalysing);
  const clearDraft = useUploadStore((s) => s.clearDraft);
  const setClip = useUploadStore((s) => s.setClip);
  const [picking, setPicking] = useState(false);

  const handlePick = async () => {
    if (isAnalysing) {
      Alert.alert('Analysis in progress', 'Please wait for your current analysis to finish.');
      return;
    }
    if (remaining <= 0) {
      Alert.alert(
        'No analyses remaining',
        `You have used all ${FREE_TIER_ANALYSES_PER_MONTH} free analyses this month.`
      );
      return;
    }

    setPicking(true);
    try {
      const result = await pickVideoFromLibrary();
      if (result.ok) {
        setClip(result.clip);
        router.push('/(upload)/mode');
      } else if (result.reason === 'icloud_not_downloaded') {
        Alert.alert('Video not downloaded', getICloudNotDownloadedMessage(), [
          { text: 'Cancel', style: 'cancel' },
          { text: 'Retry', onPress: () => handlePick() },
        ]);
      } else if (result.reason === 'error') {
        Alert.alert(
          'Could not select video',
          'Something went wrong opening your library. Please try again.',
          [
            { text: 'Cancel', style: 'cancel' },
            { text: 'Choose another video', onPress: () => handlePick() },
          ]
        );
      }
    } catch (error) {
      console.error('[upload] Uncaught video pick error:', error);
      Alert.alert('Could not select video', 'Something went wrong. Please try again.', [
        { text: 'Cancel', style: 'cancel' },
        { text: 'Choose another video', onPress: () => handlePick() },
      ]);
    } finally {
      setPicking(false);
    }
  };

  const handleBack = () => {
    clearDraft();
    router.back();
  };

  if (!hasCompleteProfile(profile)) {
    return (
      <View className="flex-1 bg-background">
        <ScreenHeader title="Ask the Coach" showBack onBack={handleBack} />
        <View className="flex-1 items-center justify-center px-8">
          <Text className="text-text-secondary text-center mb-6 leading-6">
            Complete your player profile before asking the coach about a clip.
          </Text>
          <Button label="Set up profile" onPress={() => router.replace('/(onboarding)/setup')} fullWidth />
        </View>
      </View>
    );
  }

  return (
    <View className="flex-1 bg-background">
      <ScreenHeader
        title="Ask the Coach"
        subtitle="Select a short clip from training or a match"
        showBack
        onBack={handleBack}
      />
      <View className="flex-1 px-4 items-center justify-center">
        <Pressable
          onPress={handlePick}
          disabled={picking}
          className="border-2 border-dashed border-border rounded-2xl py-16 px-8 items-center gap-3 active:opacity-80 w-full"
        >
          <View className="w-16 h-16 rounded-2xl bg-primary-muted items-center justify-center">
            <Ionicons name="videocam-outline" size={32} color="#00C853" />
          </View>
          <Text className="text-text-primary font-semibold text-lg text-center">
            {picking ? 'Opening library…' : 'Choose from library'}
          </Text>
          <Text className="text-text-muted text-sm text-center leading-5">
            Video only · 10 seconds to 5 minutes{'\n'}
            {remaining} of {FREE_TIER_ANALYSES_PER_MONTH} analyses left this month
          </Text>
        </Pressable>
      </View>
    </View>
  );
}
