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
import { TrackingArrowMarker } from '@/components/analysis/TrackingArrowMarker';
import { TrackingDebugOverlay } from '@/components/analysis/TrackingDebugOverlay';
import { Button, Card } from '@/components/ui';
import {
  createInitialTrackingFromSelection,
  fetchPlayerTrackingPreview,
} from '@/analysis/trackPlayerPreview';
import {
  applyTrackingCorrection,
  firstReferenceTimestampMs,
  mergeRefinedTracking,
  skipTrackingFromTimestamp,
} from '@/lib/identityProfile';
import {
  interpolateTrackingAt,
  isTrackingLostAt,
} from '@/lib/trackingInterpolation';
import { estimateBoxFromTap } from '@/lib/trackingBox';
import { computeVideoContentLayout, mapBoxHeadToScreen } from '@/lib/trackingMarkerLayout';
import { tapToNormalized } from '@/lib/videoLayout';
import type { ClipMetadata, PlayerSelection, PlayerTrackingData } from '@/types/analysis';
import type { PlayerProfile } from '@/types/profile';

const DEFAULT_ASPECT = 16 / 9;
const SMOOTHING_ALPHA = 0.28;
const LOST_PAUSE_DEBOUNCE_MS = 350;

interface TrackingPreviewFrameProps {
  uri: string;
  clip: ClipMetadata;
  playerSelection: PlayerSelection;
  profile: PlayerProfile;
  mode: 'GOAL' | 'PERFORMANCE' | 'COACH_ME';
  onTrackingReady: (tracking: PlayerTrackingData) => void;
  onChooseAgain: () => void;
}

type PreviewPhase = 'playing' | 'paused' | 'lost' | 'error';

export function TrackingPreviewFrame({
  uri,
  clip,
  playerSelection,
  profile,
  mode,
  onTrackingReady,
  onChooseAgain,
}: TrackingPreviewFrameProps) {
  const firstReferenceMs = firstReferenceTimestampMs(playerSelection);
  const [phase, setPhase] = useState<PreviewPhase>('playing');
  const [tracking, setTracking] = useState<PlayerTrackingData>(() =>
    createInitialTrackingFromSelection(playerSelection, clip.durationMs)
  );
  const [refining, setRefining] = useState(true);
  const [containerSize, setContainerSize] = useState({ width: 0, height: 0 });
  const [videoSize, setVideoSize] = useState({ width: 0, height: 0 });
  const [timestampMs, setTimestampMs] = useState(0);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const hasStartedPlayback = useRef(false);
  const smoothRef = useRef({ headX: 0, headY: 0, ready: false });
  const lostPauseTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const lostPauseTriggered = useRef(false);

  const player = useVideoPlayer(uri, (p) => {
    p.loop = false;
    p.muted = true;
    p.timeUpdateEventInterval = 0.08;
  });

  useEffect(() => {
    let cancelled = false;

    (async () => {
      try {
        const refined = await fetchPlayerTrackingPreview({
          clip,
          mode,
          profile,
          playerSelection,
        });
        if (cancelled) return;
        setTracking((prev) => mergeRefinedTracking(prev, refined));
      } catch (error) {
        console.warn('[TrackingPreview] Refinement failed — keeping local tracking', {
          message: error instanceof Error ? error.message : String(error),
        });
      } finally {
        if (!cancelled) setRefining(false);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [clip, mode, playerSelection, profile]);

  useEffect(() => {
    const sourceSub = player.addListener('sourceLoad', ({ availableVideoTracks }) => {
      const track = availableVideoTracks[0];
      if (track?.size?.width && track.size.height) {
        setVideoSize({ width: track.size.width, height: track.size.height });
      }
    });

    const timeSub = player.addListener('timeUpdate', ({ currentTime }) => {
      setTimestampMs(Math.round(currentTime * 1000));
    });

    return () => {
      sourceSub.remove();
      timeSub.remove();
    };
  }, [player]);

  useEffect(() => {
    if (hasStartedPlayback.current) return;
    hasStartedPlayback.current = true;
    player.currentTime = 0;
    player.play();
  }, [player]);

  const skipAfterMs = tracking.skipTrackingAfterMs;

  const sourceWidth =
    videoSize.width > 0
      ? videoSize.width
      : playerSelection.videoWidth ?? Math.round(DEFAULT_ASPECT * 100);
  const sourceHeight =
    videoSize.height > 0 ? videoSize.height : playerSelection.videoHeight ?? 100;

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

  const trackingActive =
    timestampMs >= firstReferenceMs &&
    (skipAfterMs == null || timestampMs <= skipAfterMs);

  const trackingSample = useMemo(() => {
    if (!tracking || !trackingActive) return null;
    return interpolateTrackingAt(tracking.keyframes, timestampMs);
  }, [tracking, timestampMs, trackingActive]);

  const isLost = trackingActive
    ? isTrackingLostAt(timestampMs, tracking) ||
      trackingSample == null ||
      trackingSample.state === 'LOST'
    : false;

  const rawMapped = useMemo(() => {
    if (!trackingSample || isLost || !trackingActive) return null;
    return mapBoxHeadToScreen(trackingSample.box, videoLayout);
  }, [trackingSample, isLost, trackingActive, videoLayout]);

  const displayMapped = useMemo(() => {
    if (!rawMapped || !trackingSample) {
      smoothRef.current.ready = false;
      return null;
    }

    if (!smoothRef.current.ready || trackingSample.snapPosition) {
      smoothRef.current = { headX: rawMapped.headX, headY: rawMapped.headY, ready: true };
      return rawMapped;
    }

    const headX =
      smoothRef.current.headX + (rawMapped.headX - smoothRef.current.headX) * SMOOTHING_ALPHA;
    const headY =
      smoothRef.current.headY + (rawMapped.headY - smoothRef.current.headY) * SMOOTHING_ALPHA;
    smoothRef.current = { headX, headY, ready: true };

    return { ...rawMapped, headX, headY };
  }, [rawMapped, trackingSample, timestampMs]);

  useEffect(() => {
    if (isLost) {
      smoothRef.current.ready = false;
    }
  }, [isLost]);

  useEffect(() => {
    if (lostPauseTimer.current) {
      clearTimeout(lostPauseTimer.current);
      lostPauseTimer.current = null;
    }

    if (phase !== 'playing' || !trackingActive) {
      lostPauseTriggered.current = false;
      return;
    }

    if (isLost && !lostPauseTriggered.current) {
      lostPauseTimer.current = setTimeout(() => {
        lostPauseTriggered.current = true;
        player.pause();
        setPhase('lost');
      }, LOST_PAUSE_DEBOUNCE_MS);
    }

    if (!isLost) {
      lostPauseTriggered.current = false;
    }

    return () => {
      if (lostPauseTimer.current) {
        clearTimeout(lostPauseTimer.current);
        lostPauseTimer.current = null;
      }
    };
  }, [isLost, phase, trackingActive, player]);

  const handleLayout = (event: LayoutChangeEvent) => {
    const { width, height } = event.nativeEvent.layout;
    setContainerSize({ width, height });
  };

  const handleVideoPress = () => {
    if (phase === 'playing') {
      player.pause();
      setPhase('paused');
    } else if (phase === 'paused' || phase === 'lost') {
      player.play();
      setPhase('playing');
      lostPauseTriggered.current = false;
    }
  };

  const handleCorrectionTap = (event: GestureResponderEvent) => {
    if ((phase !== 'paused' && phase !== 'lost') || !tracking) return;
    const mapped = tapToNormalized(
      event.nativeEvent.locationX,
      event.nativeEvent.locationY,
      videoLayout.contentRect
    );
    if (!mapped) return;

    smoothRef.current.ready = false;
    const updated = applyTrackingCorrection(
      tracking,
      timestampMs,
      mapped.normalizedX,
      mapped.normalizedY
    );
    setTracking(updated);
    lostPauseTriggered.current = false;
    setPhase('paused');
    console.log('[TrackingPreview] User correction saved', {
      timestampMs,
      box: estimateBoxFromTap(mapped.normalizedX, mapped.normalizedY),
    });
  };

  const handleSkipRemaining = () => {
    const updated = skipTrackingFromTimestamp(tracking, timestampMs);
    setTracking(updated);
    lostPauseTriggered.current = false;
    setPhase('paused');
    player.pause();
  };

  const handleConfirm = useCallback(() => {
    if (!tracking) return;
    player.pause();
    onTrackingReady({ ...tracking, previewAccepted: true });
  }, [tracking, onTrackingReady, player]);

  if (phase === 'error') {
    return (
      <Card variant="outlined" className="items-center py-10 px-6 gap-4">
        <Text className="text-text-primary font-semibold text-center">Tracking preview unavailable</Text>
        <Text className="text-text-secondary text-sm text-center">{errorMessage}</Text>
        <Button label="Choose player again" onPress={onChooseAgain} fullWidth />
      </Card>
    );
  }

  const showArrow = Boolean(displayMapped && trackingSample && !isLost && trackingActive);

  return (
    <View className="gap-4">
      <View
        className="w-full rounded-2xl overflow-hidden bg-surface border border-border relative"
        style={{ aspectRatio: DEFAULT_ASPECT }}
        onLayout={handleLayout}
      >
        <VideoView player={player} style={{ width: '100%', height: '100%' }} contentFit="contain" nativeControls={false} />

        <Pressable
          onPress={phase === 'paused' || phase === 'lost' ? handleCorrectionTap : handleVideoPress}
          style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0 }}
        >
          {showArrow && displayMapped && trackingSample ? (
            <TrackingArrowMarker mapped={displayMapped} state={trackingSample.state} />
          ) : null}

          <TrackingDebugOverlay
            layout={videoLayout}
            mapped={rawMapped}
            state={trackingSample?.state ?? null}
          />

          {refining ? (
            <View className="absolute top-3 right-3 bg-background/80 rounded-full px-3 py-1 flex-row items-center gap-2">
              <ActivityIndicator size="small" color="#00C853" />
              <Text className="text-text-muted text-[10px]">Refining track…</Text>
            </View>
          ) : null}

          {!trackingActive && timestampMs < firstReferenceMs ? (
            <View className="absolute bottom-3 left-0 right-0 items-center px-4">
              <View className="bg-background/85 rounded-full px-4 py-2">
                <Text className="text-text-secondary text-xs">Tracking starts at your first reference moment</Text>
              </View>
            </View>
          ) : null}

          {phase === 'lost' ? (
            <View className="absolute inset-0 items-center justify-center bg-background/75 px-6">
              <Card variant="outlined" className="w-full gap-3 items-center py-5 px-4">
                <Text className="text-text-primary font-semibold text-center text-base">
                  We&apos;ve temporarily lost you.
                </Text>
                <Text className="text-text-secondary text-sm text-center leading-5">
                  Tap yourself on the paused frame to reconnect tracking, or skip the rest of the clip.
                </Text>
                <Button
                  label="Resume after correction"
                  onPress={() => setPhase('paused')}
                  fullWidth
                />
                <Button label="Choose player again" variant="secondary" onPress={onChooseAgain} fullWidth />
                <Button label="Skip remaining tracking" variant="secondary" onPress={handleSkipRemaining} fullWidth />
              </Card>
            </View>
          ) : null}

          {phase === 'paused' ? (
            <View className="absolute bottom-3 left-0 right-0 items-center px-4">
              <View className="bg-background/85 rounded-full px-4 py-2">
                <Text className="text-text-secondary text-xs">
                  Tap the player to correct tracking · Resume to continue
                </Text>
              </View>
            </View>
          ) : null}
        </Pressable>
      </View>

      <Card variant="outlined" className="gap-2">
        <Text className="text-text-primary text-sm font-semibold">Tracking preview</Text>
        <Text className="text-text-secondary text-sm leading-5">
          Watch the arrow follow you through the clip. Tracking begins at your confirmed reference
          moments. Tap to pause and correct if it drifts.
        </Text>
        {playerSelection.identityProfile?.identityConfidence === 'LOW' ? (
          <Text className="text-amber-200/90 text-xs leading-5">
            Reduced identity confidence — later actions may be analysed with lower certainty.
          </Text>
        ) : null}
      </Card>

      <View className="gap-3">
        <Button label="Tracking looks correct" onPress={handleConfirm} fullWidth size="lg" />
        <View className="flex-row gap-3">
          <Button
            label={phase === 'playing' ? 'Pause preview' : 'Resume preview'}
            variant="secondary"
            onPress={handleVideoPress}
            className="flex-1"
          />
          <Button label="Choose player again" variant="secondary" onPress={onChooseAgain} className="flex-1" />
        </View>
      </View>
    </View>
  );
}
