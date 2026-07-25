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
  initialSeekSeconds,
  normalizedToContainer,
  tapToNormalized,
} from '@/lib/videoLayout';
import type { PlayerSelection } from '@/types/analysis';

const LOAD_TIMEOUT_MS = 12_000;
const DEFAULT_ASPECT = 16 / 9;

interface PlayerSelectionFrameProps {
  uri: string;
  clipDurationMs: number;
  initialSelection?: PlayerSelection | null;
  onSelectionChange: (selection: PlayerSelection | null) => void;
  onRetry: () => void;
  onChooseAnother: () => void;
}

type LoadState = 'loading' | 'ready' | 'error';

export function PlayerSelectionFrame({
  uri,
  clipDurationMs,
  initialSelection,
  onSelectionChange,
  onRetry,
  onChooseAnother,
}: PlayerSelectionFrameProps) {
  const [loadState, setLoadState] = useState<LoadState>('loading');
  const [containerSize, setContainerSize] = useState({ width: 0, height: 0 });
  const [videoSize, setVideoSize] = useState({ width: 0, height: 0 });
  const [timestampMs, setTimestampMs] = useState(initialSelection?.timestampMs ?? 0);
  const [normalized, setNormalized] = useState<{ x: number; y: number } | null>(
    initialSelection
      ? { x: initialSelection.normalizedX, y: initialSelection.normalizedY }
      : null
  );
  const [showScrubber, setShowScrubber] = useState(false);
  const [scrubWidth, setScrubWidth] = useState(0);
  const hasSeeked = useRef(false);
  const loadTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const player = useVideoPlayer(uri, (p) => {
    p.loop = false;
    p.muted = true;
    p.timeUpdateEventInterval = 0.2;
  });

  const clearLoadTimeout = useCallback(() => {
    if (loadTimeoutRef.current) {
      clearTimeout(loadTimeoutRef.current);
      loadTimeoutRef.current = null;
    }
  }, []);

  const markReady = useCallback(() => {
    clearLoadTimeout();
    setLoadState((prev) => (prev === 'error' ? prev : 'ready'));
  }, [clearLoadTimeout]);

  const markError = useCallback(() => {
    clearLoadTimeout();
    setLoadState('error');
  }, [clearLoadTimeout]);

  useEffect(() => {
    loadTimeoutRef.current = setTimeout(() => {
      setLoadState((prev) => (prev === 'loading' ? 'error' : prev));
    }, LOAD_TIMEOUT_MS);

    return clearLoadTimeout;
  }, [uri, clearLoadTimeout]);

  useEffect(() => {
    hasSeeked.current = false;
    setLoadState('loading');
    setNormalized(
      initialSelection
        ? { x: initialSelection.normalizedX, y: initialSelection.normalizedY }
        : null
    );
    setTimestampMs(initialSelection?.timestampMs ?? 0);
  }, [uri, initialSelection]);

  useEffect(() => {
    const statusSub = player.addListener('statusChange', ({ status, error }) => {
      if (status === 'error') {
        console.warn('[PlayerSelectionFrame] Video status error:', error);
        markError();
        return;
      }
      if (status === 'readyToPlay' && !hasSeeked.current) {
        hasSeeked.current = true;
        const seekTo = initialSeekSeconds(player.duration);
        player.currentTime = seekTo;
        player.pause();
        setTimestampMs(Math.round(seekTo * 1000));
        markReady();
      }
    });

    const sourceSub = player.addListener('sourceLoad', ({ availableVideoTracks, duration }) => {
      const track = availableVideoTracks[0];
      if (track?.size?.width && track.size.height) {
        setVideoSize({ width: track.size.width, height: track.size.height });
      }
      if (!hasSeeked.current && duration > 0) {
        hasSeeked.current = true;
        const seekTo = initialSeekSeconds(duration);
        player.currentTime = seekTo;
        player.pause();
        setTimestampMs(Math.round(seekTo * 1000));
        markReady();
      }
    });

    const timeSub = player.addListener('timeUpdate', ({ currentTime }) => {
      setTimestampMs(Math.round(currentTime * 1000));
    });

    return () => {
      statusSub.remove();
      sourceSub.remove();
      timeSub.remove();
    };
  }, [player, markReady, markError]);

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

  const emitSelection = useCallback(
    (nextNormalized: { x: number; y: number }, nextTimestampMs: number) => {
      if (contentRect.width <= 0 || contentRect.height <= 0) return;

      const selection: PlayerSelection = {
        normalizedX: nextNormalized.x,
        normalizedY: nextNormalized.y,
        timestampMs: nextTimestampMs,
        displayWidth: contentRect.width,
        displayHeight: contentRect.height,
      };
      onSelectionChange(selection);
    },
    [contentRect.width, contentRect.height, onSelectionChange]
  );

  useEffect(() => {
    if (normalized && contentRect.width > 0 && contentRect.height > 0) {
      emitSelection(normalized, timestampMs);
    }
  }, [contentRect.width, contentRect.height, normalized, timestampMs, emitSelection]);

  const handleLayout = (event: LayoutChangeEvent) => {
    const { width, height } = event.nativeEvent.layout;
    setContainerSize({ width, height });
  };

  const handleTap = (event: GestureResponderEvent) => {
    if (loadState !== 'ready') return;

    const { locationX, locationY } = event.nativeEvent;
    const mapped = tapToNormalized(locationX, locationY, contentRect);
    if (!mapped) return;

    const next = { x: mapped.normalizedX, y: mapped.normalizedY };
    setNormalized(next);
    emitSelection(next, timestampMs);
  };

  const seekToMs = (ms: number) => {
    const maxMs = clipDurationMs > 0 ? clipDurationMs : player.duration * 1000;
    const clamped = Math.max(0, Math.min(maxMs, ms));
    player.currentTime = clamped / 1000;
    player.pause();
    setTimestampMs(clamped);
    if (normalized) {
      emitSelection(normalized, clamped);
    }
  };

  const handleScrubPress = (event: GestureResponderEvent) => {
    if (scrubWidth <= 0) return;
    const pct = Math.max(0, Math.min(1, event.nativeEvent.locationX / scrubWidth));
    const maxMs = clipDurationMs > 0 ? clipDurationMs : player.duration * 1000;
    seekToMs(Math.round(pct * maxMs));
  };

  const handleRetry = () => {
    hasSeeked.current = false;
    setLoadState('loading');
    clearLoadTimeout();
    loadTimeoutRef.current = setTimeout(() => {
      setLoadState((prev) => (prev === 'loading' ? 'error' : prev));
    }, LOAD_TIMEOUT_MS);
    player.replaceAsync(uri).catch(() => markError());
  };

  if (loadState === 'error') {
    return (
      <Card variant="outlined" className="items-center py-10 px-6 gap-4">
        <Text className="text-text-primary font-semibold text-center text-base">
          This clip could not be previewed.
        </Text>
        <Text className="text-text-secondary text-sm text-center leading-5">
          Try again or choose a different video from your library.
        </Text>
        <View className="w-full gap-3 mt-2">
          <Button label="Retry" onPress={handleRetry} fullWidth />
          <Button label="Choose another clip" variant="secondary" onPress={onChooseAnother} fullWidth />
        </View>
      </Card>
    );
  }

  const maxMs = clipDurationMs > 0 ? clipDurationMs : Math.max(player.duration * 1000, 1);
  const scrubProgress = maxMs > 0 ? timestampMs / maxMs : 0;

  return (
    <View className="gap-4">
      <View
        className="w-full rounded-2xl overflow-hidden bg-surface border border-border relative"
        style={{ aspectRatio: DEFAULT_ASPECT }}
        onLayout={handleLayout}
      >
        <VideoView
          player={player}
          style={{ width: '100%', height: '100%' }}
          contentFit="contain"
          nativeControls={false}
          onFirstFrameRender={markReady}
        />

        <Pressable
          onPress={handleTap}
          style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0 }}
        >
          {loadState === 'loading' ? (
            <View className="flex-1 items-center justify-center bg-background/70">
              <ActivityIndicator size="large" color="#00C853" />
              <Text className="text-text-muted text-sm mt-3">Loading frame…</Text>
            </View>
          ) : null}

          {markerPosition ? (
            <PlayerSelectionMarker x={markerPosition.x} y={markerPosition.y} />
          ) : loadState === 'ready' ? (
            <View className="absolute bottom-3 left-0 right-0 items-center px-4">
              <View className="bg-background/80 rounded-full px-4 py-2">
                <Text className="text-text-secondary text-xs">Tap yourself in the frame</Text>
              </View>
            </View>
          ) : null}
        </Pressable>
      </View>

      <Card variant="outlined" className="flex-row gap-3 items-start">
        <Text className="text-lg">👆</Text>
        <Text className="text-text-secondary text-sm leading-5 flex-1">
          Your selection helps the coach follow the correct player throughout the clip.
        </Text>
      </Card>

      {showScrubber ? (
        <View className="gap-3">
          <View className="flex-row items-center justify-between">
            <Text className="text-text-muted text-sm">Selected moment</Text>
            <Text className="text-text-primary text-sm font-medium">
              {formatDuration(timestampMs)}
              {clipDurationMs > 0 ? ` / ${formatDuration(clipDurationMs)}` : ''}
            </Text>
          </View>

          <Pressable
            onPress={handleScrubPress}
            onLayout={(e) => setScrubWidth(e.nativeEvent.layout.width)}
            className="h-8 justify-center"
          >
            <View className="h-2 bg-surface-elevated rounded-full overflow-hidden">
              <View className="h-full bg-primary/40 rounded-full" style={{ width: '100%' }} />
              <View
                className="absolute top-0 left-0 h-full bg-primary rounded-full"
                style={{ width: `${scrubProgress * 100}%` }}
              />
              <View
                className="absolute top-1/2 w-4 h-4 rounded-full bg-primary border-2 border-background"
                style={{
                  left: `${scrubProgress * 100}%`,
                  marginLeft: -8,
                  marginTop: -8,
                }}
              />
            </View>
          </Pressable>

          <View className="flex-row justify-between gap-2">
            <Button
              label="−3s"
              variant="secondary"
              size="sm"
              className="flex-1"
              onPress={() => seekToMs(timestampMs - 3000)}
            />
            <Button
              label="−1s"
              variant="secondary"
              size="sm"
              className="flex-1"
              onPress={() => seekToMs(timestampMs - 1000)}
            />
            <Button
              label="+1s"
              variant="secondary"
              size="sm"
              className="flex-1"
              onPress={() => seekToMs(timestampMs + 1000)}
            />
            <Button
              label="+3s"
              variant="secondary"
              size="sm"
              className="flex-1"
              onPress={() => seekToMs(timestampMs + 3000)}
            />
          </View>
        </View>
      ) : null}

      <Button
        label={showScrubber ? 'Hide moment picker' : 'Choose a different moment'}
        variant="secondary"
        onPress={() => setShowScrubber((v) => !v)}
        fullWidth
      />
    </View>
  );
}
