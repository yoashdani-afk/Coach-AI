import { useCallback } from 'react';
import { Linking, Pressable, Text, View, useWindowDimensions } from 'react-native';
import { Card } from '@/components/ui';
import { buildDrillVideoUrl, extractYouTubeVideoId } from '@/lib/improveDrillDisplay';

interface ImproveDrillVideoPlayerProps {
  videoUrl: string;
  videoTimestamp?: string;
  videoTimestampSeconds?: number;
}

export function ImproveDrillVideoPlayer({
  videoUrl,
  videoTimestamp,
  videoTimestampSeconds,
}: ImproveDrillVideoPlayerProps) {
  const { width } = useWindowDimensions();
  const videoId = extractYouTubeVideoId(videoUrl);
  const startSeconds = videoTimestampSeconds ?? 0;
  const playerWidth = Math.max(280, width - 32);
  const playerHeight = Math.round((playerWidth * 9) / 16);

  const openExternalVideo = useCallback(() => {
    Linking.openURL(buildDrillVideoUrl(videoUrl, videoTimestampSeconds)).catch(() => {
      // User cancelled or URL could not be opened — no-op.
    });
  }, [videoTimestampSeconds, videoUrl]);

  if (!videoId) {
    return (
      <View>
        <Text className="text-text-muted text-xs uppercase tracking-wider mb-2">Watch demo</Text>
        <Pressable onPress={openExternalVideo} className="active:opacity-80">
          <Card variant="outlined" className="flex-row items-center justify-between gap-3">
            <Text className="text-text-primary font-semibold text-base">Open in YouTube</Text>
            {videoTimestamp ? (
              <Text className="text-text-muted text-sm">Skip to {videoTimestamp}</Text>
            ) : null}
          </Card>
        </Pressable>
      </View>
    );
  }

  const embedSrc = `https://www.youtube.com/embed/${videoId}?start=${Math.max(0, startSeconds)}&rel=0&modestbranding=1`;

  return (
    <View>
      <Text className="text-text-muted text-xs uppercase tracking-wider mb-2">Watch demo</Text>
      <Card variant="outlined" className="p-0 overflow-hidden">
        <iframe
          title="Drill demo video"
          src={embedSrc}
          width={playerWidth}
          height={playerHeight}
          style={{ border: 0, display: 'block', maxWidth: '100%' }}
          allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
          allowFullScreen
        />
      </Card>
      <Pressable onPress={openExternalVideo} className="active:opacity-80 mt-3">
        <View className="flex-row items-center justify-between gap-3 px-1">
          <Text className="text-primary text-sm font-semibold">Open in YouTube</Text>
          {videoTimestamp ? (
            <Text className="text-text-muted text-sm">Skip to {videoTimestamp}</Text>
          ) : null}
        </View>
      </Pressable>
    </View>
  );
}
