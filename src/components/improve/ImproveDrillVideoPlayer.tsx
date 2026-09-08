import { useCallback, useRef, useState } from 'react';
import { Linking, Pressable, Text, View, useWindowDimensions } from 'react-native';
import YoutubePlayer, { PLAYER_STATES, type YoutubeIframeRef } from 'react-native-youtube-iframe';
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
  const playerRef = useRef<YoutubeIframeRef>(null);
  const [playing, setPlaying] = useState(true);
  const videoId = extractYouTubeVideoId(videoUrl);
  const startSeconds = videoTimestampSeconds ?? 0;
  const playerWidth = Math.max(280, width - 32);
  const playerHeight = Math.round((playerWidth * 9) / 16);

  const openExternalVideo = useCallback(() => {
    Linking.openURL(buildDrillVideoUrl(videoUrl, videoTimestampSeconds)).catch(() => {
      // User cancelled or URL could not be opened — no-op.
    });
  }, [videoTimestampSeconds, videoUrl]);

  const handleReady = useCallback(() => {
    if (startSeconds > 0) {
      playerRef.current?.seekTo(startSeconds, true);
    }
    setPlaying(true);
  }, [startSeconds]);

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

  return (
    <View>
      <Text className="text-text-muted text-xs uppercase tracking-wider mb-2">Watch demo</Text>
      <Card variant="outlined" className="p-0 overflow-hidden">
        <YoutubePlayer
          ref={playerRef}
          height={playerHeight}
          width={playerWidth}
          play={playing}
          videoId={videoId}
          forceAndroidAutoplay
          initialPlayerParams={{
            start: startSeconds,
            modestbranding: true,
            rel: false,
          }}
          webViewProps={{
            allowsInlineMediaPlayback: true,
            mediaPlaybackRequiresUserAction: false,
          }}
          onReady={handleReady}
          onChangeState={(state: PLAYER_STATES) => {
            if (state === PLAYER_STATES.ENDED) {
              setPlaying(false);
            }
          }}
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
