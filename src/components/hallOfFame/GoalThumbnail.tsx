import { useEffect } from 'react';
import { View } from 'react-native';
import { useVideoPlayer, VideoView } from 'expo-video';

interface VideoGoalThumbnailProps {
  uri: string;
  timestampMs: number;
  className?: string;
}

function VideoGoalThumbnail({ uri, timestampMs, className = '' }: VideoGoalThumbnailProps) {
  const player = useVideoPlayer(uri, (p) => {
    p.loop = false;
    p.muted = true;
  });

  useEffect(() => {
    const seconds = Math.max(0, timestampMs / 1000);
    player.currentTime = seconds;
    player.pause();
  }, [player, timestampMs]);

  return (
    <View className={`overflow-hidden bg-surface ${className}`}>
      <VideoView
        player={player}
        style={{ width: '100%', height: '100%' }}
        contentFit="cover"
        nativeControls={false}
      />
    </View>
  );
}

interface GoalThumbnailProps {
  uri: string;
  timestampMs: number;
  className?: string;
}

export function GoalThumbnail({ uri, timestampMs, className = '' }: GoalThumbnailProps) {
  if (uri.startsWith('demo://')) {
    return (
      <View
        className={`bg-surface-elevated items-center justify-center overflow-hidden ${className}`}
      >
        <View className="absolute inset-0 bg-primary/10" />
        <View className="w-10 h-10 rounded-full bg-primary/20 items-center justify-center">
          <View className="w-4 h-4 rounded-full bg-primary/60" />
        </View>
      </View>
    );
  }

  return <VideoGoalThumbnail uri={uri} timestampMs={timestampMs} className={className} />;
}
