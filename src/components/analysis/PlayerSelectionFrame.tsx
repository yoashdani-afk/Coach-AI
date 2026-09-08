import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  View,
  Text,
  Pressable,
  ActivityIndicator,
  LayoutChangeEvent,
  GestureResponderEvent,
  Image,
  Platform,
  type ImageStyle,
} from 'react-native';
import { PlayerMarkerOverlay } from '@/components/analysis/PlayerSelectionMarker';
import { Button, Card } from '@/components/ui';
import { formatDuration } from '@/lib/format';
import {
  requestPlayerSelectionFrame,
  type SelectionFrameOrientation,
} from '@/lib/playerSelectionFrameClient';
import { ANALYSIS_API_URL } from '@/lib/analysisConfig';
import { assessTrackingQuality, initialSeekSeconds } from '@/lib/videoLayout';
import type { MappedPlayerMarker } from '@/lib/videoViewportMapping';
import type { PlayerSelection } from '@/types/analysis';

const LOAD_TIMEOUT_MS = 30_000;
const PORTRAIT_SHELL_ASPECT = 16 / 9;
const ZOOM_MAGNIFICATION = 2.8;
const FRAME_ERROR_MESSAGE = "Couldn't load this frame. Try another moment.";

type LoadState = 'loading' | 'ready' | 'error';

interface SelectionFrame {
  imageUri: string;
  width: number;
  height: number;
  orientation: SelectionFrameOrientation;
  timestampMs: number;
}

interface ThumbnailRect {
  x: number;
  y: number;
  width: number;
  height: number;
}

interface PlayerSelectionFrameProps {
  uri: string;
  fileName: string | null;
  clipDurationMs: number;
  initialSelection?: PlayerSelection | null;
  onSelectionChange: (selection: PlayerSelection | null) => void;
  onRetry: () => void;
  onChooseAnother: () => void;
}

function clamp01(value: number): number {
  return Math.min(1, Math.max(0, value));
}

function fitContain(
  containerWidth: number,
  containerHeight: number,
  imageWidth: number,
  imageHeight: number
): { width: number; height: number } {
  if (containerWidth <= 0 || containerHeight <= 0 || imageWidth <= 0 || imageHeight <= 0) {
    return { width: 0, height: 0 };
  }
  const scale = Math.min(containerWidth / imageWidth, containerHeight / imageHeight);
  return { width: imageWidth * scale, height: imageHeight * scale };
}

function computeFrameLayout(
  cardWidth: number,
  frame: SelectionFrame | null
): { containerHeight: number; thumbnailRect: ThumbnailRect } {
  if (!frame || cardWidth <= 0) {
    return { containerHeight: cardWidth / PORTRAIT_SHELL_ASPECT, thumbnailRect: { x: 0, y: 0, width: 0, height: 0 } };
  }

  if (frame.orientation === 'landscape') {
    const width = cardWidth;
    const height = width * (frame.height / frame.width);
    return {
      containerHeight: height,
      thumbnailRect: { x: 0, y: 0, width, height },
    };
  }

  const containerHeight = cardWidth / PORTRAIT_SHELL_ASPECT;
  const fitted = fitContain(cardWidth, containerHeight, frame.width, frame.height);
  return {
    containerHeight,
    thumbnailRect: {
      x: (cardWidth - fitted.width) / 2,
      y: (containerHeight - fitted.height) / 2,
      width: fitted.width,
      height: fitted.height,
    },
  };
}

function resolveInitialTimestampMs(
  clipDurationMs: number,
  initialSelection?: PlayerSelection | null
): number {
  if (initialSelection?.timestampMs != null && initialSelection.timestampMs > 0) {
    return initialSelection.timestampMs;
  }
  if (clipDurationMs > 0) {
    return Math.round(initialSeekSeconds(clipDurationMs / 1000) * 1000);
  }
  return 0;
}

export function PlayerSelectionFrame({
  uri,
  fileName,
  clipDurationMs,
  initialSelection,
  onSelectionChange,
  onRetry,
  onChooseAnother,
}: PlayerSelectionFrameProps) {
  const [loadState, setLoadState] = useState<LoadState>('loading');
  const [cardWidth, setCardWidth] = useState(0);
  const [selectionFrame, setSelectionFrame] = useState<SelectionFrame | null>(null);
  const [frameLoading, setFrameLoading] = useState(false);
  const [frameError, setFrameError] = useState<string | null>(null);
  const [frameRetryNonce, setFrameRetryNonce] = useState(0);
  const [selectionTimestampMs, setSelectionTimestampMs] = useState<number>(() =>
    resolveInitialTimestampMs(clipDurationMs, initialSelection)
  );
  const [markerTimestampMs, setMarkerTimestampMs] = useState<number | null>(
    initialSelection?.timestampMs ?? null
  );
  const [normalized, setNormalized] = useState<{ x: number; y: number } | null>(
    initialSelection
      ? { x: initialSelection.normalizedX, y: initialSelection.normalizedY }
      : null
  );
  const [showScrubber, setShowScrubber] = useState(false);
  const [scrubWidth, setScrubWidth] = useState(0);
  const [reducedTrackingConfidence, setReducedTrackingConfidence] = useState(
    initialSelection?.reducedTrackingConfidence ?? false
  );
  const loadTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const activeFrameRequest = useRef(0);
  const lastWebTapAtRef = useRef(0);

  const clearLoadTimeout = useCallback(() => {
    if (loadTimeoutRef.current) {
      clearTimeout(loadTimeoutRef.current);
      loadTimeoutRef.current = null;
    }
  }, []);

  useEffect(() => {
    console.log('[PlayerSelection] MOUNT', { uri });
    return () => {
      console.log('[PlayerSelection] UNMOUNT');
    };
  }, [uri]);

  useEffect(() => {
    loadTimeoutRef.current = setTimeout(() => {
      setLoadState((prev) => {
        if (prev !== 'loading') return prev;
        setFrameError((current) => current ?? FRAME_ERROR_MESSAGE);
        return 'error';
      });
    }, LOAD_TIMEOUT_MS);

    return clearLoadTimeout;
  }, [uri, clearLoadTimeout, selectionTimestampMs, frameRetryNonce]);

  useEffect(() => {
    setLoadState('loading');
    setSelectionFrame(null);
    setFrameLoading(false);
    setFrameError(null);
    setSelectionTimestampMs(resolveInitialTimestampMs(clipDurationMs, initialSelection));
    setNormalized(
      initialSelection
        ? { x: initialSelection.normalizedX, y: initialSelection.normalizedY }
        : null
    );
    setMarkerTimestampMs(initialSelection?.timestampMs ?? null);
    setReducedTrackingConfidence(initialSelection?.reducedTrackingConfidence ?? false);
  }, [uri, clipDurationMs, initialSelection]);

  useEffect(() => {
    const requestId = ++activeFrameRequest.current;
    const controller = new AbortController();
    let cancelled = false;

    setFrameLoading(true);
    setFrameError(null);
    setLoadState('loading');

    void (async () => {
      try {
        const frame = await requestPlayerSelectionFrame({
          videoUri: uri,
          fileName,
          clipDurationMs,
          timestampMs: selectionTimestampMs,
          signal: controller.signal,
        });

        if (cancelled || requestId !== activeFrameRequest.current) {
          return;
        }

        setSelectionFrame({
          imageUri: frame.imageUri,
          width: frame.width,
          height: frame.height,
          orientation: frame.orientation,
          timestampMs: frame.timestampMs,
        });
        setLoadState('ready');
      } catch (error) {
        if (cancelled || requestId !== activeFrameRequest.current) return;
        if (controller.signal.aborted) return;

        console.error('[PlayerSelection] FRAME ERROR', {
          name: error instanceof Error ? error.name : undefined,
          message: error instanceof Error ? error.message : String(error),
          stack: error instanceof Error ? error.stack : undefined,
          apiUrl: ANALYSIS_API_URL,
          videoUri: uri,
          timestampMs: selectionTimestampMs,
        });
        setSelectionFrame(null);
        setFrameError(FRAME_ERROR_MESSAGE);
        setLoadState('error');
      } finally {
        if (!cancelled && requestId === activeFrameRequest.current) {
          setFrameLoading(false);
        }
      }
    })();

    return () => {
      cancelled = true;
      controller.abort();
    };
  }, [uri, fileName, clipDurationMs, selectionTimestampMs, frameRetryNonce]);

  const { containerHeight, thumbnailRect } = useMemo(
    () => computeFrameLayout(cardWidth, selectionFrame),
    [cardWidth, selectionFrame]
  );

  const markerVisible =
    normalized != null &&
    markerTimestampMs != null &&
    selectionFrame != null &&
    markerTimestampMs === selectionFrame.timestampMs;

  const mappedMarker: MappedPlayerMarker | null = useMemo(() => {
    if (!markerVisible || thumbnailRect.width <= 0 || !normalized || !selectionFrame) return null;

    const dotX = normalized.x * thumbnailRect.width;
    const dotY = normalized.y * thumbnailRect.height;

    return {
      dotX,
      dotY,
      arrowTipX: dotX,
      arrowTipY: dotY - 20,
      normalizedX: normalized.x,
      normalizedY: normalized.y,
      layout: {
        sourceWidth: selectionFrame.width,
        sourceHeight: selectionFrame.height,
        viewportWidth: thumbnailRect.width,
        viewportHeight: thumbnailRect.height,
        rotation: 0,
        resizeMode: 'contain',
        rotatedSourceWidth: selectionFrame.width,
        rotatedSourceHeight: selectionFrame.height,
        scale: 1,
        renderedWidth: thumbnailRect.width,
        renderedHeight: thumbnailRect.height,
        offsetX: 0,
        offsetY: 0,
      },
      box: null,
    };
  }, [markerVisible, thumbnailRect, normalized, selectionFrame]);

  const trackingQualityWarning = useMemo(() => {
    if (!normalized || thumbnailRect.width <= 0) return false;
    return assessTrackingQuality(normalized.x, normalized.y, thumbnailRect);
  }, [normalized, thumbnailRect]);

  const zoomPreviewLayout = useMemo(() => {
    if (thumbnailRect.width <= 0 || thumbnailRect.height <= 0) {
      return { width: 112, height: 112 };
    }

    if (selectionFrame?.orientation === 'landscape') {
      const width = 240;
      return {
        width,
        height: Math.max(96, width * (thumbnailRect.height / thumbnailRect.width)),
      };
    }

    return { width: 112, height: 112 };
  }, [selectionFrame?.orientation, thumbnailRect.width, thumbnailRect.height]);

  const showFrameImage = selectionFrame != null && thumbnailRect.width > 0;

  const emitSelection = useCallback(
    (nextNormalized: { x: number; y: number }, nextTimestampMs: number, reduced = reducedTrackingConfidence) => {
      if (!selectionFrame || thumbnailRect.width <= 0) return;

      const warning = assessTrackingQuality(nextNormalized.x, nextNormalized.y, thumbnailRect);
      const selection: PlayerSelection = {
        normalizedX: nextNormalized.x,
        normalizedY: nextNormalized.y,
        timestampMs: nextTimestampMs,
        displayWidth: thumbnailRect.width,
        displayHeight: thumbnailRect.height,
        videoWidth: selectionFrame.width,
        videoHeight: selectionFrame.height,
        ...(warning ? { trackingQualityWarning: true } : {}),
        ...(reduced ? { reducedTrackingConfidence: true } : {}),
      };
      onSelectionChange(selection);
    },
    [onSelectionChange, reducedTrackingConfidence, selectionFrame, thumbnailRect.width, thumbnailRect.height]
  );

  useEffect(() => {
    if (normalized && selectionFrame && thumbnailRect.width > 0 && thumbnailRect.height > 0) {
      emitSelection(normalized, selectionFrame.timestampMs);
    }
  }, [normalized, selectionFrame, thumbnailRect.width, thumbnailRect.height, emitSelection]);

  const handleCardLayout = (event: LayoutChangeEvent) => {
    setCardWidth(event.nativeEvent.layout.width);
  };

  const applyTapAt = useCallback(
    (locationX: number, locationY: number) => {
      if (loadState !== 'ready' || frameLoading || !selectionFrame || thumbnailRect.width <= 0) {
        return;
      }

      // Web: onPress + onClick can both fire for one mouse click — keep a single apply.
      if (Platform.OS === 'web') {
        const now = Date.now();
        if (now - lastWebTapAtRef.current < 50) return;
        lastWebTapAtRef.current = now;
      }

      const next = {
        x: clamp01(locationX / thumbnailRect.width),
        y: clamp01(locationY / thumbnailRect.height),
      };

      setNormalized(next);
      setMarkerTimestampMs(selectionFrame.timestampMs);
      setReducedTrackingConfidence(false);
      emitSelection(next, selectionFrame.timestampMs, false);
    },
    [loadState, frameLoading, selectionFrame, thumbnailRect.width, thumbnailRect.height, emitSelection]
  );

  const resolveWebTapLocation = (
    event: { clientX?: number; clientY?: number; currentTarget?: unknown; nativeEvent?: { clientX?: number; clientY?: number } }
  ): { locationX: number; locationY: number } | null => {
    const clientX = event.clientX ?? event.nativeEvent?.clientX;
    const clientY = event.clientY ?? event.nativeEvent?.clientY;
    const target = event.currentTarget as { getBoundingClientRect?: () => DOMRect } | null | undefined;
    const rect = target?.getBoundingClientRect?.();
    if (rect == null || clientX == null || clientY == null) return null;
    return {
      locationX: clientX - rect.left,
      locationY: clientY - rect.top,
    };
  };

  const handleTap = (event: GestureResponderEvent) => {
    if (loadState !== 'ready' || frameLoading || !selectionFrame || thumbnailRect.width <= 0) {
      return;
    }

    if (Platform.OS === 'web') {
      const webLocation = resolveWebTapLocation({
        currentTarget: event.currentTarget,
        nativeEvent: event.nativeEvent as { clientX?: number; clientY?: number },
      });
      if (!webLocation) return;
      applyTapAt(webLocation.locationX, webLocation.locationY);
      return;
    }

    const { locationX, locationY } = event.nativeEvent;
    applyTapAt(locationX, locationY);
  };

  /** Web-only: DOM click is more reliable for re-taps than Pressable onPress alone. */
  const handleWebClick = (event: {
    clientX: number;
    clientY: number;
    currentTarget: EventTarget;
    preventDefault?: () => void;
  }) => {
    if (Platform.OS !== 'web') return;
    const webLocation = resolveWebTapLocation(event);
    if (!webLocation) return;
    applyTapAt(webLocation.locationX, webLocation.locationY);
  };

  const maxDurationMs = clipDurationMs > 0 ? clipDurationMs : 1;

  const seekToMs = (ms: number) => {
    const clamped = Math.max(0, Math.min(maxDurationMs, ms));
    setNormalized(null);
    setMarkerTimestampMs(null);
    onSelectionChange(null);
    setSelectionTimestampMs(clamped);
  };

  const handleScrubPress = (event: GestureResponderEvent) => {
    if (scrubWidth <= 0) return;
    const pct = clamp01(event.nativeEvent.locationX / scrubWidth);
    seekToMs(Math.round(pct * maxDurationMs));
  };

  const handleRetry = () => {
    onRetry();
    setLoadState('loading');
    setSelectionFrame(null);
    setFrameError(null);
    setSelectionTimestampMs(resolveInitialTimestampMs(clipDurationMs, initialSelection));
    setFrameRetryNonce((value) => value + 1);
  };

  const handleRetryFrame = () => {
    setFrameError(null);
    setLoadState('loading');
    setFrameRetryNonce((value) => value + 1);
  };

  if (loadState === 'error' && !selectionFrame) {
    return (
      <Card variant="outlined" className="items-center py-10 px-6 gap-4">
        <Text className="text-text-primary font-semibold text-center text-base">
          This clip could not be previewed.
        </Text>
        <Text className="text-text-secondary text-sm text-center leading-5">
          {frameError ?? FRAME_ERROR_MESSAGE}
        </Text>
        <View className="w-full gap-3 mt-2">
          <Button label="Retry" onPress={handleRetry} fullWidth />
          <Button label="Choose another clip" variant="secondary" onPress={onChooseAnother} fullWidth />
        </View>
      </Card>
    );
  }

  const scrubProgress = maxDurationMs > 0 ? selectionTimestampMs / maxDurationMs : 0;
  const showFrameOverlay = loadState === 'loading' || frameLoading;

  const frameHeight =
    containerHeight > 0 ? containerHeight : cardWidth > 0 ? cardWidth / PORTRAIT_SHELL_ASPECT : 200;

  return (
    <View className="gap-4">
      <View className="w-full" onLayout={handleCardLayout}>
        <View
          className="w-full rounded-2xl overflow-hidden bg-surface border border-border relative"
          style={{ width: '100%', height: frameHeight }}
        >
          {showFrameImage && selectionFrame ? (
            <Image
              source={{ uri: selectionFrame.imageUri }}
              style={{
                position: 'absolute',
                left: thumbnailRect.x,
                top: thumbnailRect.y,
                width: thumbnailRect.width,
                height: thumbnailRect.height,
              }}
              resizeMode="cover"
            />
          ) : null}

          {thumbnailRect.width > 0 ? (
            <Pressable
              onPress={handleTap}
              // @ts-expect-error web-only DOM click fallback for reliable re-taps
              onClick={Platform.OS === 'web' ? handleWebClick : undefined}
              pointerEvents={Platform.OS === 'web' ? 'box-only' : undefined}
              style={{
                position: 'absolute',
                left: thumbnailRect.x,
                top: thumbnailRect.y,
                width: thumbnailRect.width,
                height: thumbnailRect.height,
              }}
            >
              {mappedMarker ? (
                <PlayerMarkerOverlay marker={mappedMarker} state="MANUAL" showArrow={false} />
              ) : null}
            </Pressable>
          ) : null}

          {showFrameOverlay ? (
            <View className="absolute inset-0 items-center justify-center bg-background/70">
              <ActivityIndicator size="large" color="#00C853" />
              <Text className="text-text-muted text-sm mt-3">Loading frame…</Text>
            </View>
          ) : null}

          {frameError && !frameLoading ? (
            <View className="absolute inset-0 items-center justify-center bg-background/90 px-6 gap-3">
              <Text className="text-text-primary font-semibold text-center text-base">
                Could not load this frame
              </Text>
              <Text className="text-text-secondary text-sm text-center leading-5">{frameError}</Text>
              <Button label="Retry frame" onPress={handleRetryFrame} size="sm" />
            </View>
          ) : null}
        </View>
      </View>

      {!mappedMarker && loadState === 'ready' && selectionFrame && !frameLoading ? (
        <Text className="text-text-muted text-sm text-center px-2">
          Tap yourself in the frame above
        </Text>
      ) : null}

      {normalized && mappedMarker && showFrameImage && selectionFrame ? (
        <Card variant="outlined" className="gap-3">
          <Text className="text-text-primary text-sm font-semibold">Zoom preview</Text>
          <View className="items-center">
            <View
              className="rounded-xl overflow-hidden border-2 border-primary bg-black"
              style={{
                width: zoomPreviewLayout.width,
                height: zoomPreviewLayout.height,
              }}
            >
              <Image
                source={{ uri: selectionFrame.imageUri }}
                style={
                  {
                    width: thumbnailRect.width * ZOOM_MAGNIFICATION,
                    height: thumbnailRect.height * ZOOM_MAGNIFICATION,
                    transform: [
                      {
                        translateX:
                          zoomPreviewLayout.width / 2 -
                          normalized.x * thumbnailRect.width * ZOOM_MAGNIFICATION,
                      },
                      {
                        translateY:
                          zoomPreviewLayout.height / 2 -
                          normalized.y * thumbnailRect.height * ZOOM_MAGNIFICATION,
                      },
                    ],
                  } as ImageStyle
                }
                resizeMode="cover"
              />
              <View
                pointerEvents="none"
                style={{
                  position: 'absolute',
                  left: zoomPreviewLayout.width / 2 - 6,
                  top: zoomPreviewLayout.height / 2 - 6,
                  width: 12,
                  height: 12,
                  borderRadius: 6,
                  borderWidth: 2,
                  borderColor: '#00C853',
                }}
              />
            </View>
          </View>
          <Text className="text-text-muted text-xs text-center leading-5">
            Tap again on the main frame to adjust your selection, or scrub to a clearer moment.
          </Text>
        </Card>
      ) : null}

      {trackingQualityWarning ? (
        <Card variant="outlined" className="gap-3 border-amber-500/40 bg-amber-500/5">
          <Text className="text-amber-200 text-sm font-semibold leading-5">
            Player is difficult to identify in this frame. Choose a clearer moment for more accurate
            tracking.
          </Text>
          <Text className="text-text-secondary text-sm leading-5">
            You can pick a different moment, tap again to refine your selection, or continue with
            reduced tracking confidence.
          </Text>
          <View className="flex-row gap-2">
            <Button
              label="Choose clearer moment"
              variant="secondary"
              size="sm"
              className="flex-1"
              onPress={() => setShowScrubber(true)}
            />
            <Button
              label="Continue anyway"
              size="sm"
              className="flex-1"
              onPress={() => {
                setReducedTrackingConfidence(true);
                if (normalized && selectionFrame) {
                  emitSelection(normalized, selectionFrame.timestampMs, true);
                }
              }}
            />
          </View>
        </Card>
      ) : null}

      <Card variant="outlined" className="flex-row gap-3 items-start">
        <Text className="text-lg">👆</Text>
        <Text className="text-text-secondary text-sm leading-5 flex-1">
          Your selection helps the coach identify the correct player for analysis.
        </Text>
      </Card>

      {showScrubber ? (
        <View className="gap-3">
          <View className="flex-row items-center justify-between">
            <Text className="text-text-muted text-sm">Selected moment</Text>
            <Text className="text-text-primary text-sm font-medium">
              {formatDuration(selectionTimestampMs)}
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
              onPress={() => seekToMs(selectionTimestampMs - 3000)}
            />
            <Button
              label="−1s"
              variant="secondary"
              size="sm"
              className="flex-1"
              onPress={() => seekToMs(selectionTimestampMs - 1000)}
            />
            <Button
              label="+1s"
              variant="secondary"
              size="sm"
              className="flex-1"
              onPress={() => seekToMs(selectionTimestampMs + 1000)}
            />
            <Button
              label="+3s"
              variant="secondary"
              size="sm"
              className="flex-1"
              onPress={() => seekToMs(selectionTimestampMs + 3000)}
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
