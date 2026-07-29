import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  View,
  Text,
  Pressable,
  ActivityIndicator,
  LayoutChangeEvent,
  GestureResponderEvent,
} from 'react-native';
import { useVideoPlayer, VideoView } from 'expo-video';
import { PlayerSelectionMarker } from '@/components/analysis/PlayerSelectionMarker';
import { Button, Card } from '@/components/ui';
import { formatDuration } from '@/lib/format';
import {
  computeContentRect,
  normalizedToContainer,
  tapToNormalized,
  assessTrackingQuality,
} from '@/lib/videoLayout';
import type { IdentityReference, PlayerSelection } from '@/types/analysis';

const DEFAULT_ASPECT = 16 / 9;

interface ReferenceCaptureFrameProps {
  uri: string;
  clipDurationMs: number;
  title: string;
  hint: string;
  initialTimestampMs: number;
  referenceLabel: IdentityReference['label'];
  onCapture: (reference: IdentityReference, selection: PlayerSelection) => void;
  onSkip?: () => void;
  skipLabel?: string;
}

type LoadState = 'loading' | 'ready' | 'error';

export function ReferenceCaptureFrame({
  uri,
  clipDurationMs,
  title,
  hint,
  initialTimestampMs,
  referenceLabel,
  onCapture,
  onSkip,
  skipLabel = 'Skip',
}: ReferenceCaptureFrameProps) {
  const [loadState, setLoadState] = useState<LoadState>('loading');
  const [containerSize, setContainerSize] = useState({ width: 0, height: 0 });
  const [videoSize, setVideoSize] = useState({ width: 0, height: 0 });
  const [timestampMs, setTimestampMs] = useState(initialTimestampMs);
  const [normalized, setNormalized] = useState<{ x: number; y: number } | null>(null);
  const [scrubWidth, setScrubWidth] = useState(0);
  const hasSeeked = useRef(false);

  const player = useVideoPlayer(uri, (p) => {
    p.loop = false;
    p.muted = true;
    p.timeUpdateEventInterval = 0.2;
  });

  useEffect(() => {
    hasSeeked.current = false;
    setLoadState('loading');
    setNormalized(null);
    setTimestampMs(initialTimestampMs);
  }, [uri, initialTimestampMs]);

  useEffect(() => {
    const sourceSub = player.addListener('sourceLoad', ({ availableVideoTracks, duration }) => {
      const track = availableVideoTracks[0];
      if (track?.size?.width && track.size.height) {
        setVideoSize({ width: track.size.width, height: track.size.height });
      }
      if (!hasSeeked.current && duration > 0) {
        hasSeeked.current = true;
        const seekTo = Math.min(duration, initialTimestampMs / 1000);
        player.currentTime = seekTo;
        player.pause();
        setTimestampMs(Math.round(seekTo * 1000));
        setLoadState('ready');
      }
    });

    const timeSub = player.addListener('timeUpdate', ({ currentTime }) => {
      setTimestampMs(Math.round(currentTime * 1000));
    });

    return () => {
      sourceSub.remove();
      timeSub.remove();
    };
  }, [player, initialTimestampMs]);

  const aspectWidth = videoSize.width > 0 ? videoSize.width : DEFAULT_ASPECT * 100;
  const aspectHeight = videoSize.height > 0 ? videoSize.height : 100;
  const contentRect = useMemo(
    () => computeContentRect(containerSize.width, containerSize.height, aspectWidth, aspectHeight),
    [containerSize.width, containerSize.height, aspectWidth, aspectHeight]
  );

  const markerPosition = useMemo(() => {
    if (!normalized) return null;
    return normalizedToContainer(normalized.x, normalized.y, contentRect);
  }, [normalized, contentRect]);

  const handleTap = (event: GestureResponderEvent) => {
    if (loadState !== 'ready') return;
    const mapped = tapToNormalized(event.nativeEvent.locationX, event.nativeEvent.locationY, contentRect);
    if (!mapped) return;
    setNormalized({ x: mapped.normalizedX, y: mapped.normalizedY });
  };

  const seekToMs = (ms: number) => {
    const maxMs = clipDurationMs > 0 ? clipDurationMs : player.duration * 1000;
    const clamped = Math.max(0, Math.min(maxMs, ms));
    player.currentTime = clamped / 1000;
    player.pause();
    setTimestampMs(clamped);
  };

  const handleConfirm = useCallback(() => {
    if (!normalized || contentRect.width <= 0) return;

    const reference: IdentityReference = {
      normalizedX: normalized.x,
      normalizedY: normalized.y,
      timestampMs,
      label: referenceLabel,
    };

    const warning = assessTrackingQuality(normalized.x, normalized.y, contentRect);
    const selection: PlayerSelection = {
      normalizedX: normalized.x,
      normalizedY: normalized.y,
      timestampMs,
      displayWidth: contentRect.width,
      displayHeight: contentRect.height,
      ...(videoSize.width > 0 && videoSize.height > 0
        ? { videoWidth: videoSize.width, videoHeight: videoSize.height }
        : {}),
      ...(warning ? { trackingQualityWarning: true } : {}),
    };

    onCapture(reference, selection);
  }, [
    normalized,
    contentRect,
    timestampMs,
    referenceLabel,
    onCapture,
    videoSize.width,
    videoSize.height,
  ]);

  const maxMs = clipDurationMs > 0 ? clipDurationMs : Math.max(player.duration * 1000, 1);
  const scrubProgress = maxMs > 0 ? timestampMs / maxMs : 0;

  return (
    <View className="gap-4">
      <Card variant="outlined" className="gap-2">
        <Text className="text-text-primary text-sm font-semibold">{title}</Text>
        <Text className="text-text-secondary text-sm leading-5">{hint}</Text>
      </Card>

      <View
        className="w-full rounded-2xl overflow-hidden bg-surface border border-border relative"
        style={{ aspectRatio: DEFAULT_ASPECT }}
        onLayout={(e: LayoutChangeEvent) => {
          const { width, height } = e.nativeEvent.layout;
          setContainerSize({ width, height });
        }}
      >
        <VideoView player={player} style={{ width: '100%', height: '100%' }} contentFit="contain" nativeControls={false} />
        <Pressable onPress={handleTap} style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0 }}>
          {loadState === 'loading' ? (
            <View className="flex-1 items-center justify-center bg-background/70">
              <ActivityIndicator size="large" color="#00C853" />
            </View>
          ) : null}
          {markerPosition ? <PlayerSelectionMarker x={markerPosition.x} y={markerPosition.y} /> : null}
          {!markerPosition && loadState === 'ready' ? (
            <View className="absolute bottom-3 left-0 right-0 items-center px-4">
              <View className="bg-background/80 rounded-full px-4 py-2">
                <Text className="text-text-secondary text-xs">Tap yourself in this moment</Text>
              </View>
            </View>
          ) : null}
        </Pressable>
      </View>

      <View className="gap-3">
        <View className="flex-row items-center justify-between">
          <Text className="text-text-muted text-sm">Moment</Text>
          <Text className="text-text-primary text-sm font-medium">
            {formatDuration(timestampMs)}
            {clipDurationMs > 0 ? ` / ${formatDuration(clipDurationMs)}` : ''}
          </Text>
        </View>
        <Pressable
          onPress={(e) => {
            if (scrubWidth <= 0) return;
            const pct = Math.max(0, Math.min(1, e.nativeEvent.locationX / scrubWidth));
            seekToMs(Math.round(pct * maxMs));
          }}
          onLayout={(e) => setScrubWidth(e.nativeEvent.layout.width)}
          className="h-8 justify-center"
        >
          <View className="h-2 bg-surface-elevated rounded-full overflow-hidden">
            <View className="absolute top-0 left-0 h-full bg-primary rounded-full" style={{ width: `${scrubProgress * 100}%` }} />
          </View>
        </Pressable>
      </View>

      <View className="gap-3">
        <Button label="Confirm this moment" onPress={handleConfirm} disabled={!normalized} fullWidth size="lg" />
        {onSkip ? (
          <Button label={skipLabel} variant="secondary" onPress={onSkip} fullWidth />
        ) : null}
      </View>
    </View>
  );
}
