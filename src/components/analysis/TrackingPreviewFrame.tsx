import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { View, Text, LayoutChangeEvent } from 'react-native';
import { useVideoPlayer, VideoView } from 'expo-video';
import { TrackingMarkerOverlay } from '@/components/analysis/TrackingMarkerOverlay';
import { Button, Card } from '@/components/ui';
import { usePlaybackTimestamp } from '@/hooks/usePlaybackTimestamp';
import {
  getTrackingSourceDimensions,
  lookupSelectedPlayerAt,
} from '@/lib/selectedPlayerTrack';
import { computeVideoContentLayout, mapBoxHeadToScreen } from '@/lib/trackingMarkerLayout';
import type { PlayerSelection, PlayerTrackingData } from '@/types/analysis';

const DEFAULT_ASPECT = 16 / 9;

interface TrackingPreviewFrameProps {
  uri: string;
  playerSelection: PlayerSelection;
  tracking: PlayerTrackingData;
  onTrackingReady: (tracking: PlayerTrackingData) => void;
  onRetapPlayer: () => void;
}

type PreviewPhase = 'playing' | 'occluded';

export function TrackingPreviewFrame({
  uri,
  tracking: initialTracking,
  onTrackingReady,
  onRetapPlayer,
  playerSelection,
}: TrackingPreviewFrameProps) {
  const [phase, setPhase] = useState<PreviewPhase>('playing');
  const [tracking] = useState<PlayerTrackingData>(initialTracking);
  const [containerSize, setContainerSize] = useState({ width: 0, height: 0 });

  const hasStartedPlayback = useRef(false);
  const lostStreakRef = useRef(0);
  const occludedHandledRef = useRef(false);

  const player = useVideoPlayer(uri, (p) => {
    p.loop = false;
    p.muted = true;
    p.timeUpdateEventInterval = 0.05;
  });

  const timestampMs = usePlaybackTimestamp(player, phase === 'playing');

  useEffect(() => {
    if (hasStartedPlayback.current) return;
    hasStartedPlayback.current = true;
    player.currentTime = 0;
    player.play();
  }, [player]);

  const trackingUnavailable = tracking.keyframes.length === 0;

  const { sourceWidth, sourceHeight } = getTrackingSourceDimensions(tracking, playerSelection);

  const videoLayout = useMemo(
    () =>
      computeVideoContentLayout(
        containerSize.width,
        containerSize.height,
        sourceWidth,
        sourceHeight
      ),
    [containerSize.width, containerSize.height, sourceWidth, sourceHeight]
  );

  const layoutReady = containerSize.width > 0 && containerSize.height > 0;

  const lookup = useMemo(() => {
    if (!layoutReady || trackingUnavailable) return null;
    return lookupSelectedPlayerAt(tracking, timestampMs);
  }, [tracking, timestampMs, layoutReady, trackingUnavailable]);

  const displayMapped = useMemo(() => {
    if (!lookup || !layoutReady) return null;
    return mapBoxHeadToScreen(lookup.normalizedBox, videoLayout);
  }, [lookup, layoutReady, videoLayout]);

  const showMarker = Boolean(displayMapped && lookup && phase === 'playing');

  useEffect(() => {
    if (phase !== 'playing' || occludedHandledRef.current || trackingUnavailable) return;

    const isHidden = !lookup;

    lostStreakRef.current = isHidden ? lostStreakRef.current + 1 : 0;
    if (lostStreakRef.current < 4) return;

    occludedHandledRef.current = true;
    lostStreakRef.current = 0;
    player.pause();
    setPhase('occluded');
  }, [phase, lookup, trackingUnavailable, player]);

  const handleSkipMoment = useCallback(() => {
    occludedHandledRef.current = false;
    lostStreakRef.current = 0;
    setPhase('playing');
    player.currentTime = Math.min(tracking.keyframes[tracking.keyframes.length - 1]?.timestampMs ?? timestampMs + 2000, timestampMs + 2000) / 1000;
    player.play();
  }, [tracking.keyframes, timestampMs, player]);

  const handleConfirm = useCallback(() => {
    player.pause();
    onTrackingReady({ ...tracking, previewAccepted: true });
  }, [tracking, onTrackingReady, player]);

  const handleLayout = (event: LayoutChangeEvent) => {
    const { width, height } = event.nativeEvent.layout;
    setContainerSize({ width, height });
  };

  if (trackingUnavailable) {
    return (
      <Card variant="outlined" className="items-center py-10 px-6 gap-4">
        <Text className="text-text-primary font-semibold text-center text-base">
          We couldn&apos;t build a track for this clip.
        </Text>
        <Text className="text-text-secondary text-sm text-center leading-5">
          Try selecting yourself again on a clearer moment.
        </Text>
        <Button label="Retap player" onPress={onRetapPlayer} fullWidth size="lg" />
      </Card>
    );
  }

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
        />

        {showMarker && displayMapped && lookup ? (
          <TrackingMarkerOverlay
            marker={displayMapped}
            layout={videoLayout}
            state={lookup.identityState}
          />
        ) : null}

        {phase === 'occluded' ? (
          <View className="absolute inset-0 justify-end bg-background/50 px-4 pb-4">
            <Card variant="outlined" className="gap-3 py-4 px-4">
              <Text className="text-text-primary font-semibold text-center text-base">
                We can&apos;t clearly see you here
              </Text>
              <Text className="text-text-secondary text-sm text-center leading-5">
                Move a few seconds later until you&apos;re visible again.
              </Text>
              <Button label="Skip this moment" onPress={handleSkipMoment} fullWidth size="lg" />
            </Card>
          </View>
        ) : null}
      </View>

      <View className="gap-3">
        <Button
          label="Looks correct"
          onPress={handleConfirm}
          disabled={phase === 'occluded'}
          fullWidth
          size="lg"
        />
        <Button label="Retap player" variant="secondary" onPress={onRetapPlayer} fullWidth />
      </View>
    </View>
  );
}
