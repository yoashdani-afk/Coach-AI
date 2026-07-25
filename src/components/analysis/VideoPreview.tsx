import { useEffect } from 'react';
import { View, ActivityIndicator } from 'react-native';
import { useVideoPlayer, VideoView } from 'expo-video';

interface VideoPreviewProps {
  uri: string;
  className?: string;
}

export function VideoPreview({ uri, className = '' }: VideoPreviewProps) {
  const player = useVideoPlayer(uri, (p) => {
    p.loop = true;
    p.muted = true;
  });

  useEffect(() => {
    player.play();
    return () => {
      player.pause();
    };
  }, [player]);

  return (
    <View className={`overflow-hidden rounded-xl bg-surface ${className}`}>
      <VideoView
        player={player}
        style={{ width: '100%', height: '100%' }}
        contentFit="cover"
        nativeControls
      />
    </View>
  );
}
