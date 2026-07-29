import { useEffect, useRef } from 'react';
import { View, StyleSheet } from 'react-native';
import { useVideoPlayer, VideoView } from 'expo-video';

/** Fixed thumbnail frame — 16:9, never stretched. */
export const THUMBNAIL_ASPECT = 16 / 9;

export const THUMBNAIL_WIDTH = {
  default: 112,
  compact: 96,
} as const;

function thumbnailHeight(width: number): number {
  return Math.round(width / THUMBNAIL_ASPECT);
}

/** Bias cover crop toward the tapped player (upper frame = less empty grass). */
function focalContentPosition(normalizedY?: number): { dx: number; dy: number } {
  const y = normalizedY ?? 0.38;
  return {
    dx: 0,
    dy: Math.round((0.42 - y) * 120),
  };
}

function ThumbnailGradientOverlay() {
  return (
    <View pointerEvents="none" style={StyleSheet.absoluteFillObject} className="justify-end">
      <View className="h-2 bg-black/10" />
      <View className="h-2 bg-black/20" />
      <View className="h-2.5 bg-black/30" />
      <View className="h-3 bg-black/45" />
    </View>
  );
}

interface VideoGoalThumbnailProps {
  uri: string;
  timestampMs: number;
  width: number;
  focalNormalizedY?: number;
}

function VideoGoalThumbnail({
  uri,
  timestampMs,
  width,
  focalNormalizedY,
}: VideoGoalThumbnailProps) {
  const height = thumbnailHeight(width);
  const hasSeeked = useRef(false);

  const player = useVideoPlayer(uri, (p) => {
    p.loop = false;
    p.muted = true;
  });

  useEffect(() => {
    hasSeeked.current = false;
  }, [uri, timestampMs]);

  useEffect(() => {
    const seekToFrame = (durationSec: number) => {
      if (hasSeeked.current) return;
      hasSeeked.current = true;
      const maxSec = Math.max(0, durationSec - 0.05);
      const targetSec = Math.min(maxSec, Math.max(0, timestampMs / 1000));
      player.currentTime = targetSec;
      player.pause();
    };

    if (player.duration > 0) {
      seekToFrame(player.duration);
    }

    const statusSub = player.addListener('statusChange', ({ status }) => {
      if (status === 'readyToPlay' && player.duration > 0) {
        seekToFrame(player.duration);
      }
    });

    const sourceSub = player.addListener('sourceLoad', ({ duration }) => {
      if (duration > 0) {
        seekToFrame(duration);
      }
    });

    return () => {
      statusSub.remove();
      sourceSub.remove();
    };
  }, [player, timestampMs]);

  const contentPosition = focalContentPosition(focalNormalizedY);

  return (
    <View
      style={{ width, height, aspectRatio: THUMBNAIL_ASPECT }}
      className="overflow-hidden rounded-xl bg-surface"
    >
      <VideoView
        player={player}
        style={StyleSheet.absoluteFillObject}
        contentFit="cover"
        contentPosition={contentPosition}
        nativeControls={false}
      />
      <ThumbnailGradientOverlay />
    </View>
  );
}

interface GoalThumbnailProps {
  uri: string;
  timestampMs: number;
  compact?: boolean;
  focalNormalizedY?: number;
}

export function GoalThumbnail({
  uri,
  timestampMs,
  compact = false,
  focalNormalizedY,
}: GoalThumbnailProps) {
  const width = compact ? THUMBNAIL_WIDTH.compact : THUMBNAIL_WIDTH.default;

  if (uri.startsWith('demo://')) {
    const height = thumbnailHeight(width);
    return (
      <View
        style={{ width, height, aspectRatio: THUMBNAIL_ASPECT }}
        className="overflow-hidden rounded-xl bg-surface-elevated items-center justify-center"
      >
        <View className="absolute inset-0 bg-primary/10" />
        <View className="w-10 h-10 rounded-full bg-primary/20 items-center justify-center">
          <View className="w-4 h-4 rounded-full bg-primary/60" />
        </View>
        <ThumbnailGradientOverlay />
      </View>
    );
  }

  return (
    <VideoGoalThumbnail
      uri={uri}
      timestampMs={timestampMs}
      width={width}
      focalNormalizedY={focalNormalizedY}
    />
  );
}
