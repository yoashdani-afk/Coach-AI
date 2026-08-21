import { useCallback, useState } from 'react';
import {
  View,
  Text,
  ScrollView,
  Image,
  ActivityIndicator,
  Alert,
} from 'react-native';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { ScreenHeader } from '@/components/layout/ScreenHeader';
import { Button, Card } from '@/components/ui';
import { toRequestMetadata } from '@/analysis/models/AnalysisRequest';
import { buildAnalysisRequest } from '@/analysis/models/AnalysisRequest';
import { analysisEndpoint } from '@/lib/analysisConfig';
import { useProfileStore } from '@/stores/profileStore';
import { useUploadStore } from '@/stores/uploadStore';

interface DebugFrameResponse {
  success: boolean;
  timestampMs: number;
  tapNormalizedX: number;
  tapNormalizedY: number;
  frameWidth?: number;
  frameHeight?: number;
  markerPixelX?: number;
  markerPixelY?: number;
  clampedNormalizedX?: number;
  clampedNormalizedY?: number;
  frameIsDisplayOriented?: boolean;
  cleanFrameBase64?: string;
  markedFrameBase64?: string;
  mimeType?: string;
  error?: string;
  geometry?: {
    storedWidth: number;
    storedHeight: number;
    rotation: number;
    displayWidth: number;
    displayHeight: number;
    isMirrored: boolean;
  };
}

function inferMimeType(fileName: string | null): string {
  const name = (fileName ?? '').toLowerCase();
  if (name.endsWith('.mov')) return 'video/quicktime';
  if (name.endsWith('.webm')) return 'video/webm';
  return 'video/mp4';
}

export default function MarkerPreviewScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const profile = useProfileStore((s) => s.profile);
  const clip = useUploadStore((s) => s.clip);
  const playerSelection = useUploadStore((s) => s.playerSelection);
  const analysisMode = useUploadStore((s) => s.analysisMode);

  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<DebugFrameResponse | null>(null);

  const fetchPreview = useCallback(async () => {
    if (!clip || !playerSelection || !profile || !analysisMode) {
      Alert.alert(
        'No upload draft',
        'Upload a clip and select a player first, then return here.',
        [{ text: 'OK', onPress: () => router.replace('/(upload)/identify') }]
      );
      return;
    }

    setLoading(true);
    setResult(null);

    try {
      const request = buildAnalysisRequest({
        clip,
        mode: analysisMode,
        profile,
        playerSelection,
      });
      const metadata = toRequestMetadata(request);
      const formData = new FormData();
      formData.append('metadata', JSON.stringify(metadata));
      formData.append('video', {
        uri: clip.uri,
        name: clip.fileName ?? 'clip.mp4',
        type: inferMimeType(clip.fileName),
      } as unknown as Blob);

      const response = await fetch(analysisEndpoint('/api/debug-player-frame'), {
        method: 'POST',
        body: formData,
      });

      const bodyText = await response.text();
      let parsed: DebugFrameResponse;
      try {
        parsed = JSON.parse(bodyText) as DebugFrameResponse;
      } catch {
        throw new Error(bodyText || 'Invalid response from debug endpoint');
      }

      if (!response.ok) {
        throw new Error((parsed as { error?: string }).error ?? 'Debug request failed');
      }

      setResult(parsed);
    } catch (error) {
      Alert.alert(
        'Preview failed',
        error instanceof Error ? error.message : 'Could not extract marker preview'
      );
    } finally {
      setLoading(false);
    }
  }, [clip, playerSelection, profile, analysisMode, router]);

  if (!__DEV__) {
    return (
      <View className="flex-1 bg-background items-center justify-center px-6">
        <Text className="text-text-primary text-center">Debug preview is only available in development builds.</Text>
        <Button label="Go back" className="mt-6" onPress={() => router.back()} />
      </View>
    );
  }

  const imageMime = result?.mimeType ?? 'image/jpeg';

  return (
    <View className="flex-1 bg-background" style={{ paddingTop: insets.top }}>
      <ScreenHeader title="Marker preview" showBack onBack={() => router.back()} />

      <ScrollView
        className="flex-1 px-4"
        contentContainerStyle={{ paddingBottom: insets.bottom + 24, gap: 16 }}
      >
        <Card variant="outlined">
          <Text className="text-text-secondary text-sm leading-5">
            Dev-only check that the server marker lands on the player you tapped. Uses the current
            upload draft clip and player selection.
          </Text>
        </Card>

        <Button
          label={loading ? 'Extracting…' : 'Extract marker preview'}
          onPress={() => void fetchPreview()}
          disabled={loading}
          fullWidth
        />

        {loading ? (
          <View className="items-center py-8">
            <ActivityIndicator size="large" color="#00C853" />
          </View>
        ) : null}

        {result ? (
          <>
            <Card variant="outlined" className="gap-2">
              <Text className="text-text-muted text-xs uppercase tracking-wider">Coordinates</Text>
              <Text className="text-text-primary text-sm">
                Tap: ({result.tapNormalizedX.toFixed(3)}, {result.tapNormalizedY.toFixed(3)})
              </Text>
              <Text className="text-text-primary text-sm">
                Clamped: ({result.clampedNormalizedX?.toFixed(3)}, {result.clampedNormalizedY?.toFixed(3)})
              </Text>
              <Text className="text-text-primary text-sm">
                Marker pixels: ({result.markerPixelX}, {result.markerPixelY})
              </Text>
              <Text className="text-text-primary text-sm">
                Frame: {result.frameWidth}×{result.frameHeight}px @ {result.timestampMs}ms
              </Text>
              <Text className="text-text-secondary text-xs">
                Display-oriented frame: {result.frameIsDisplayOriented ? 'yes' : 'no'}
                {result.geometry
                  ? ` · rotation ${result.geometry.rotation}° · mirrored ${result.geometry.isMirrored ? 'yes' : 'no'}`
                  : ''}
              </Text>
              {result.error ? (
                <Text className="text-red-400 text-sm">{result.error}</Text>
              ) : null}
            </Card>

            {result.cleanFrameBase64 ? (
              <View className="gap-2">
                <Text className="text-text-muted text-xs uppercase tracking-wider">Clean frame</Text>
                <Image
                  source={{ uri: `data:${imageMime};base64,${result.cleanFrameBase64}` }}
                  style={{ width: '100%', aspectRatio: (result.frameWidth ?? 16) / (result.frameHeight ?? 9), borderRadius: 12 }}
                  resizeMode="contain"
                />
              </View>
            ) : null}

            {result.markedFrameBase64 ? (
              <View className="gap-2">
                <Text className="text-text-muted text-xs uppercase tracking-wider">Marked frame</Text>
                <Image
                  source={{ uri: `data:${imageMime};base64,${result.markedFrameBase64}` }}
                  style={{ width: '100%', aspectRatio: (result.frameWidth ?? 16) / (result.frameHeight ?? 9), borderRadius: 12 }}
                  resizeMode="contain"
                />
              </View>
            ) : null}
          </>
        ) : null}
      </ScrollView>
    </View>
  );
}
