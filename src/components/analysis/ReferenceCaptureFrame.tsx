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
import { PlayerMarkerOverlay } from '@/components/analysis/PlayerSelectionMarker';
import { PredictionRingOverlay } from '@/components/analysis/TrackingMarkerOverlay';
import { Button, Card } from '@/components/ui';
import { formatDuration } from '@/lib/format';
import { interpolateReferenceAt } from '@/lib/identityProfile';
import { assessTrackingQuality, buildViewportLayout, tapToNormalized } from '@/lib/videoLayout';
import {
  isFrameTimestampSynced,
  layoutToContentRect,
  mapPlayerMarkerToViewport,
} from '@/lib/videoViewportMapping';
import type { IdentityReference, PlayerSelection } from '@/types/analysis';

const DEFAULT_ASPECT = 16 / 9;
const FRAME_TOLERANCE_MS = 120;

interface ReferenceCaptureFrameProps {
  uri: string;
  clipDurationMs: number;
  title: string;
  hint: string;
  initialTimestampMs: number;
  referenceLabel: IdentityReference['label'];
  /** Prior selection used to predict player position on this frame. */
  priorSelection?: PlayerSelection | null;
  onCapture: (reference: IdentityReference, selection: PlayerSelection) => void;
  onSkip?: () => void;
  skipLabel?: string;
  /** When true, never show "Is this you?" — user taps on the suggested frame. */
  tapOnly?: boolean;
}

type LoadState = 'loading' | 'ready' | 'error';
type CaptureMode = 'predict' | 'tap';

export function ReferenceCaptureFrame({
  uri,
  clipDurationMs,
  title,
  hint,
  initialTimestampMs,
  referenceLabel,
  priorSelection,
  onCapture,
  onSkip,
  skipLabel = 'Skip',
  tapOnly = false,
}: ReferenceCaptureFrameProps) {
  const [loadState, setLoadState] = useState<LoadState>('loading');
  const [containerSize, setContainerSize] = useState({ width: 0, height: 0 });
  const [videoSize, setVideoSize] = useState({ width: 0, height: 0 });
  const [currentFrameTimestampMs, setCurrentFrameTimestampMs] = useState(initialTimestampMs);
  const [markerTimestampMs, setMarkerTimestampMs] = useState<number | null>(null);
  const [normalized, setNormalized] = useState<{ x: number; y: number } | null>(null);
  const [frameSynced, setFrameSynced] = useState(true);
  const [captureMode, setCaptureMode] = useState<CaptureMode>(tapOnly ? 'tap' : 'predict');
  const [scrubWidth, setScrubWidth] = useState(0);
  const hasSeeked = useRef(false);
  const seekTargetRef = useRef<number | null>(null);

  const player = useVideoPlayer(uri, (p) => {
    p.loop = false;
    p.muted = true;
    p.timeUpdateEventInterval = 0.08;
  });

  useEffect(() => {
    hasSeeked.current = false;
    setLoadState('loading');
    setNormalized(null);
    setMarkerTimestampMs(null);
    setCurrentFrameTimestampMs(initialTimestampMs);
    setFrameSynced(true);
    setCaptureMode('predict');
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
        setCurrentFrameTimestampMs(Math.round(seekTo * 1000));
        setLoadState('ready');
      }
    });

    const timeSub = player.addListener('timeUpdate', ({ currentTime }) => {
      const ms = Math.round(currentTime * 1000);
      setCurrentFrameTimestampMs(ms);
      if (
        seekTargetRef.current != null &&
        isFrameTimestampSynced(ms, seekTargetRef.current, FRAME_TOLERANCE_MS)
      ) {
        seekTargetRef.current = null;
        setFrameSynced(true);
        setCaptureMode('predict');
      }
    });

    return () => {
      sourceSub.remove();
      timeSub.remove();
    };
  }, [player, initialTimestampMs]);

  const sourceWidth = videoSize.width > 0 ? videoSize.width : DEFAULT_ASPECT * 100;
  const sourceHeight = videoSize.height > 0 ? videoSize.height : 100;

  const viewportLayout = useMemo(
    () => buildViewportLayout(containerSize.width, containerSize.height, sourceWidth, sourceHeight),
    [containerSize.width, containerSize.height, sourceWidth, sourceHeight]
  );

  const contentRect = useMemo(() => layoutToContentRect(viewportLayout), [viewportLayout]);

  const prediction = useMemo(() => {
    if (!priorSelection || !frameSynced || containerSize.width <= 0) return null;
    const interpolated = interpolateReferenceAt(priorSelection, currentFrameTimestampMs);
    if (!interpolated) return null;
    const nx = interpolated.box.x + interpolated.box.width / 2;
    const ny = interpolated.box.y + interpolated.box.height * 0.55;
    return mapPlayerMarkerToViewport({
      normalizedX: nx,
      normalizedY: ny,
      layout: viewportLayout,
      box: interpolated.box,
    });
  }, [priorSelection, currentFrameTimestampMs, frameSynced, containerSize.width, viewportLayout]);

  const showPrediction = !tapOnly && captureMode === 'predict' && prediction != null && normalized == null;

  const markerVisible =
    normalized != null &&
    markerTimestampMs != null &&
    frameSynced &&
    isFrameTimestampSynced(currentFrameTimestampMs, markerTimestampMs, FRAME_TOLERANCE_MS);

  const mappedMarker = useMemo(() => {
    if (!normalized || !markerVisible) return null;
    return mapPlayerMarkerToViewport({
      normalizedX: normalized.x,
      normalizedY: normalized.y,
      layout: viewportLayout,
    });
  }, [normalized, markerVisible, viewportLayout]);

  const submitReference = useCallback(
    (nx: number, ny: number, ts: number) => {
      const reference: IdentityReference = {
        normalizedX: nx,
        normalizedY: ny,
        timestampMs: ts,
        label: referenceLabel,
      };
      const warning = assessTrackingQuality(nx, ny, contentRect);
      const selection: PlayerSelection = {
        normalizedX: nx,
        normalizedY: ny,
        timestampMs: ts,
        displayWidth: contentRect.width,
        displayHeight: contentRect.height,
        ...(videoSize.width > 0 && videoSize.height > 0
          ? { videoWidth: videoSize.width, videoHeight: videoSize.height }
          : {}),
        ...(warning ? { trackingQualityWarning: true } : {}),
      };
      onCapture(reference, selection);
    },
    [contentRect, referenceLabel, onCapture, videoSize.width, videoSize.height]
  );

  const handleTap = (event: GestureResponderEvent) => {
    if (loadState !== 'ready' || !frameSynced || captureMode === 'predict') return;
    const mapped = tapToNormalized(event.nativeEvent.locationX, event.nativeEvent.locationY, contentRect);
    if (!mapped) return;
    setNormalized({ x: mapped.normalizedX, y: mapped.normalizedY });
    setMarkerTimestampMs(currentFrameTimestampMs);
  };

  const handleConfirmPrediction = () => {
    if (!prediction || !priorSelection) return;
    const interpolated = interpolateReferenceAt(priorSelection, currentFrameTimestampMs);
    if (!interpolated) return;
    const nx = interpolated.box.x + interpolated.box.width / 2;
    const ny = interpolated.box.y + interpolated.box.height * 0.55;
    submitReference(nx, ny, currentFrameTimestampMs);
  };

  const handleRejectPrediction = () => {
    setCaptureMode('tap');
  };

  const seekToMs = (ms: number) => {
    const maxMs = clipDurationMs > 0 ? clipDurationMs : player.duration * 1000;
    const clamped = Math.max(0, Math.min(maxMs, ms));
    setFrameSynced(false);
    seekTargetRef.current = clamped;
    setNormalized(null);
    setMarkerTimestampMs(null);
    setCaptureMode('predict');
    player.currentTime = clamped / 1000;
    player.pause();
    setCurrentFrameTimestampMs(clamped);
  };

  const handleConfirm = useCallback(() => {
    if (!normalized || !markerTimestampMs || contentRect.width <= 0) return;
    if (!isFrameTimestampSynced(currentFrameTimestampMs, markerTimestampMs, FRAME_TOLERANCE_MS)) {
      return;
    }
    submitReference(normalized.x, normalized.y, markerTimestampMs);
  }, [normalized, markerTimestampMs, currentFrameTimestampMs, contentRect, submitReference]);

  const maxMs = clipDurationMs > 0 ? clipDurationMs : Math.max(player.duration * 1000, 1);
  const scrubProgress = maxMs > 0 ? currentFrameTimestampMs / maxMs : 0;

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
          {showPrediction && prediction ? (
            <PredictionRingOverlay marker={prediction} layout={viewportLayout} />
          ) : null}
          {mappedMarker ? <PlayerMarkerOverlay marker={mappedMarker} state="MANUAL" /> : null}
          {!mappedMarker && !showPrediction && loadState === 'ready' ? (
            <View className="absolute bottom-3 left-0 right-0 items-center px-4">
              <View className="bg-background/80 rounded-full px-4 py-2">
                <Text className="text-text-secondary text-xs">
                  {!frameSynced ? 'Loading frame…' : 'Tap yourself in this clear moment'}
                </Text>
              </View>
            </View>
          ) : null}
        </Pressable>
      </View>

      <View className="gap-3">
        <View className="flex-row items-center justify-between">
          <Text className="text-text-muted text-sm">Moment</Text>
          <Text className="text-text-primary text-sm font-medium">
            {formatDuration(currentFrameTimestampMs)}
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
        {showPrediction ? (
          <>
            <Text className="text-text-primary text-sm font-semibold text-center">Is this you?</Text>
            <Button label="Yes, that's me" onPress={handleConfirmPrediction} fullWidth size="lg" />
            <Button label="No, choose again" variant="secondary" onPress={handleRejectPrediction} fullWidth />
          </>
        ) : (
          <Button label="Confirm this moment" onPress={handleConfirm} disabled={!mappedMarker} fullWidth size="lg" />
        )}
        {onSkip ? (
          <Button label={skipLabel} variant="secondary" onPress={onSkip} fullWidth />
        ) : null}
      </View>
    </View>
  );
}
