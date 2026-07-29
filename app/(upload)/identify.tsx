import { useEffect, useState } from 'react';
import { View, Text, ScrollView } from 'react-native';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { PlayerSelectionFrame } from '@/components/analysis/PlayerSelectionFrame';
import { ReferenceCaptureFrame } from '@/components/analysis/ReferenceCaptureFrame';
import { Button } from '@/components/ui';
import { ScreenHeader } from '@/components/layout/ScreenHeader';
import { buildIdentityProfile } from '@/lib/identityProfile';
import { useUploadStore } from '@/stores/uploadStore';
import type { IdentityReference, PlayerSelection } from '@/types/analysis';

type IdentifyStep = 'primary' | 'secondary' | 'tertiary';

export default function IdentifyPlayerScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const clip = useUploadStore((s) => s.clip);
  const analysisMode = useUploadStore((s) => s.analysisMode);
  const setPlayerSelection = useUploadStore((s) => s.setPlayerSelection);
  const setPlayerTracking = useUploadStore((s) => s.setPlayerTracking);
  const clearDraft = useUploadStore((s) => s.clearDraft);

  const [step, setStep] = useState<IdentifyStep>('primary');
  const [primarySelection, setPrimarySelection] = useState<PlayerSelection | null>(null);
  const [secondaryReference, setSecondaryReference] = useState<IdentityReference | null>(null);

  useEffect(() => {
    if (!clip || !analysisMode) {
      router.replace('/(upload)');
    }
  }, [clip, analysisMode, router]);

  if (!clip || !analysisMode) {
    return null;
  }

  const reducedConfidence = primarySelection?.reducedTrackingConfidence ?? false;
  const secondaryStartMs = Math.min(
    clip.durationMs,
    Math.max(0, (primarySelection?.timestampMs ?? 0) + 3000)
  );

  const finishIdentityProfile = (secondary: IdentityReference, tertiary?: IdentityReference | null) => {
    if (!primarySelection) return;

    const identityConfidence = reducedConfidence ? 'LOW' : 'HIGH';
    const identityProfile = buildIdentityProfile(
      primarySelection,
      secondary,
      tertiary,
      identityConfidence
    );

    const finalSelection: PlayerSelection = {
      ...primarySelection,
      identityProfile,
      ...(reducedConfidence ? { reducedTrackingConfidence: true } : {}),
    };

    setPlayerSelection(finalSelection);
    setPlayerTracking(null);
    router.push('/(upload)/track-preview');
  };

  const handlePrimaryConfirm = () => {
    if (!primarySelection) return;
    setStep('secondary');
  };

  const handleSecondaryCapture = (reference: IdentityReference) => {
    setSecondaryReference(reference);
    if (reducedConfidence) {
      setStep('tertiary');
      return;
    }
    finishIdentityProfile(reference);
  };

  const handleTertiaryCapture = (reference: IdentityReference) => {
    if (!secondaryReference) return;
    finishIdentityProfile(secondaryReference, reference);
  };

  const handleTertiarySkip = () => {
    if (!secondaryReference) return;
    finishIdentityProfile(secondaryReference);
  };

  const handleChooseAnother = () => {
    clearDraft();
    router.replace('/(upload)');
  };

  const handleBack = () => {
    if (step === 'tertiary') {
      setStep('secondary');
      return;
    }
    if (step === 'secondary') {
      setStep('primary');
      return;
    }
    router.back();
  };

  const header =
    step === 'primary'
      ? {
          title: 'Which player are you?',
          subtitle: 'Tap yourself in the frame so your coach analyses the correct player.',
        }
      : step === 'secondary'
        ? {
            title: 'One more clear moment',
            subtitle: 'Scrub a few seconds later and tap yourself again for better tracking.',
          }
        : {
            title: 'Final reference (optional)',
            subtitle: 'One more tap helps us follow you after the camera moves.',
          };

  return (
    <View className="flex-1 bg-background">
      <ScreenHeader
        title={header.title}
        subtitle={header.subtitle}
        showBack
        onBack={handleBack}
      />
      <ScrollView
        className="flex-1 px-4"
        contentContainerStyle={{ paddingBottom: insets.bottom + 120, gap: 16 }}
        showsVerticalScrollIndicator={false}
      >
        {step === 'primary' ? (
          <>
            <PlayerSelectionFrame
              uri={clip.uri}
              clipDurationMs={clip.durationMs}
              initialSelection={null}
              onSelectionChange={setPrimarySelection}
              onRetry={() => setPrimarySelection(null)}
              onChooseAnother={handleChooseAnother}
            />
            <Text className="text-text-muted text-sm text-center leading-5 px-2">
              Make sure your full body is visible where possible.
            </Text>
          </>
        ) : null}

        {step === 'secondary' && primarySelection ? (
          <ReferenceCaptureFrame
            uri={clip.uri}
            clipDurationMs={clip.durationMs}
            title="Choose one more clear moment"
            hint="Scrub to a moment a few seconds later when you are still clearly visible — different angle or kit lighting helps re-identification after camera pans."
            initialTimestampMs={secondaryStartMs}
            referenceLabel="secondary"
            onCapture={(reference) => handleSecondaryCapture(reference)}
          />
        ) : null}

        {step === 'tertiary' && primarySelection ? (
          <ReferenceCaptureFrame
            uri={clip.uri}
            clipDurationMs={clip.durationMs}
            title="Optional third reference"
            hint="Because tracking may be difficult in this clip, one more tap later in the play can help us reconnect after you leave the frame."
            initialTimestampMs={Math.min(clip.durationMs, secondaryStartMs + 4000)}
            referenceLabel="tertiary"
            onCapture={(reference) => handleTertiaryCapture(reference)}
            onSkip={handleTertiarySkip}
            skipLabel="Skip — continue with two references"
          />
        ) : null}
      </ScrollView>

      {step === 'primary' ? (
        <View
          className="absolute bottom-0 left-0 right-0 px-4 pt-4 bg-background border-t border-border"
          style={{ paddingBottom: insets.bottom + 16 }}
        >
          <Button
            label="Confirm player"
            onPress={handlePrimaryConfirm}
            disabled={!primarySelection}
            fullWidth
            size="lg"
          />
        </View>
      ) : null}
    </View>
  );
}
