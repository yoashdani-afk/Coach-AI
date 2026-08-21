import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  View,
  Text,
  Pressable,
  LayoutChangeEvent,
  GestureResponderEvent,
  ActivityIndicator,
  StyleSheet,
} from 'react-native';
import { useIsFocused } from '@react-navigation/native';
import { useVideoPlayer, VideoView } from 'expo-video';
import { TrackingMarkerOverlay } from '@/components/analysis/TrackingMarkerOverlay';
import { TrackingDebugOverlay } from '@/components/analysis/TrackingDebugOverlay';
import { Button } from '@/components/ui';
import { rebuildTrackingFromCorrection } from '@/analysis/trackPlayerPreview';
import { applyTrackingCorrection } from '@/lib/identityProfile';
import { usePlaybackTimestamp } from '@/hooks/usePlaybackTimestamp';
import {
  auditSelectedPlayerTimeline,
  getSelectedPlayerTrailCenters,
  getTrackingSourceDimensions,
  lookupSelectedPlayerAt,
} from '@/lib/selectedPlayerTrack';
import { validateTrackingForApproval } from '@/lib/validateTrackingData';
import { computeVideoContentLayout, mapBoxHeadToScreen } from '@/lib/trackingMarkerLayout';
import { logTrackingOverlayUpdate } from '@/lib/trackingOverlayLog';
import {
  cancelTrackingJobRemote,
  createTrackingJob,
  formatTrackingSeconds,
  pollTrackingJob,
  submitTrackingJobConfirmation,
  type TrackingJobSnapshot,
} from '@/lib/trackingJobClient';
import { tapToNormalized } from '@/lib/videoLayout';
import { displayOrientedVideoSize } from '@/lib/displayOrientedVideoSize';
import { layoutToContentRect, mapVideoBoxToViewport } from '@/lib/videoViewportMapping';
import type {
  AnalysisMode,
  ClipMetadata,
  PlayerSelection,
  PlayerTrackingData,
  TrackingIdentityConfirmation,
} from '@/types/analysis';
import type { PlayerProfile } from '@/types/profile';

type Phase = 'building' | 'second_reference' | 'approving' | 'correcting' | 'error';

interface TrackingBuildViewProps {
  clip: ClipMetadata;
  uri: string;
  playerSelection: PlayerSelection;
  profile: PlayerProfile;
  mode: AnalysisMode;
  onApproved: (tracking: PlayerTrackingData) => void;
  onCancel: () => void;
  onRetapPlayer: () => void;
}

export function TrackingBuildView({
  clip,
  uri,
  playerSelection,
  profile,
  mode,
  onApproved,
  onCancel,
  onRetapPlayer,
}: TrackingBuildViewProps) {
  const isFocused = useIsFocused();
  const isFocusedRef = useRef(isFocused);
  isFocusedRef.current = isFocused;
  const [phase, setPhase] = useState<Phase>('building');
  const [containerSize, setContainerSize] = useState({ width: 0, height: 0 });
  const [processedMs, setProcessedMs] = useState(0);
  const [totalMs, setTotalMs] = useState(clip.durationMs);
  const [finalTracking, setFinalTracking] = useState<PlayerTrackingData | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [reconnecting, setReconnecting] = useState(false);
  const [rebuilding, setRebuilding] = useState(false);
  const [pendingConfirmation, setPendingConfirmation] = useState<TrackingIdentityConfirmation | null>(null);
  const [secondRefTapSurface, setSecondRefTapSurface] = useState({ width: 0, height: 0 });
  const [secondRefTapDot, setSecondRefTapDot] = useState<{ x: number; y: number } | null>(null);

  const jobIdRef = useRef<string | null>(null);
  const stopPollRef = useRef<(() => void) | null>(null);
  const abortRef = useRef<AbortController | null>(null);
  const handledConfirmationIdsRef = useRef<Set<string>>(new Set());
  const awaitingConfirmationRef = useRef(false);

  const player = useVideoPlayer(uri, (p) => {
    p.loop = false;
    p.muted = true;
    p.timeUpdateEventInterval = 0.05;
  });

  const playbackActive = phase === 'approving' || phase === 'correcting';
  const timestampMs = usePlaybackTimestamp(player, playbackActive);

  // During build / second reference: hold on relevant frame.
  useEffect(() => {
    if (phase === 'second_reference' && pendingConfirmation?.timestampMs != null) {
      player.pause();
      player.currentTime = pendingConfirmation.timestampMs / 1000;
      return;
    }
    if (phase !== 'building') return;
    player.pause();
    player.currentTime = playerSelection.timestampMs / 1000;
  }, [phase, player, playerSelection.timestampMs, pendingConfirmation?.timestampMs]);

  const handleConfirmationRequired = useCallback(
    (confirmation: TrackingIdentityConfirmation) => {
      if (handledConfirmationIdsRef.current.has(confirmation.checkpointId)) return;
      handledConfirmationIdsRef.current.add(confirmation.checkpointId);
      awaitingConfirmationRef.current = true;
      setReconnecting(false);
      setPendingConfirmation(confirmation);
      setPhase('second_reference');
      setSecondRefTapDot(null);
      setSecondRefTapSurface({ width: 0, height: 0 });
      if (confirmation.timestampMs != null) {
        player.pause();
        player.currentTime = confirmation.timestampMs / 1000;
      }
    },
    [player]
  );

  const handleSnapshot = useCallback((snapshot: TrackingJobSnapshot) => {
    if (!isFocusedRef.current) return;

    setProcessedMs(snapshot.processedDurationMs);
    setTotalMs(snapshot.totalDurationMs || clip.durationMs);

    if (snapshot.status === 'complete') {
      const tracking = snapshot.result;
      const validation = validateTrackingForApproval(tracking);

      if (__DEV__) {
        console.log('[TrackingBuild] Complete snapshot validation', {
          validation,
          audit: tracking ? auditSelectedPlayerTimeline(tracking) : null,
          rawSnapshot: {
            jobId: snapshot.jobId,
            partialKeyframesCount: snapshot.partialKeyframes.length,
            resultKeyframesCount: tracking?.keyframes.length ?? 0,
          },
        });
      }

      if (!validation.ok || !tracking) {
        console.warn('[TrackingBuild] Approval blocked — unusable tracking data', {
          validationReason: validation.reason,
          keyframeCount: tracking?.keyframes.length ?? 0,
          coverageRatio: tracking?.coverageRatio ?? null,
          jobId: snapshot.jobId,
        });
        setErrorMessage(
          tracking?.failureMessage ??
            "We couldn't build a player track for this clip. Try selecting yourself again on a clearer moment."
        );
        setPhase('error');
        return;
      }

      setFinalTracking(tracking);
      setProcessedMs(snapshot.totalDurationMs);
      setPhase('approving');
      player.currentTime = 0;
      player.play();
    }

    if (snapshot.status === 'failed') {
      setErrorMessage(snapshot.error ?? 'Tracking failed');
      setPhase('error');
    }
  }, [clip.durationMs, player]);

  useEffect(() => {
    if (!isFocused) return;

    abortRef.current = new AbortController();
    const signal = abortRef.current.signal;

    void (async () => {
      try {
        const jobId = await createTrackingJob(
          { clip, mode, profile, playerSelection },
          signal
        );
        jobIdRef.current = jobId;
        stopPollRef.current = pollTrackingJob(
          jobId,
          {
            onSnapshot: handleSnapshot,
            onStall: () => {
              if (!awaitingConfirmationRef.current) setReconnecting(true);
            },
            onReconnect: () => setReconnecting(false),
            onConfirmationRequired: handleConfirmationRequired,
            isAwaitingConfirmation: () => awaitingConfirmationRef.current,
          },
          signal
        );
      } catch (error) {
        if (signal.aborted) return;
        setErrorMessage(error instanceof Error ? error.message : 'Could not start tracking');
        setPhase('error');
      }
    })();

    return () => {
      abortRef.current?.abort();
      stopPollRef.current?.();
    };
  }, [isFocused, clip, mode, profile, playerSelection, handleSnapshot, handleConfirmationRequired]);

  const activeTracking = playbackActive && finalTracking ? finalTracking : null;

  const { sourceWidth, sourceHeight } = useMemo(() => {
    if (!activeTracking) {
      return getTrackingSourceDimensions(
        {
          keyframes: [],
          userCorrections: [],
          confirmedIntervals: [],
          uncertainIntervals: [],
          lostIntervals: [],
          previewAccepted: false,
          sourceWidth: playerSelection.videoWidth,
          sourceHeight: playerSelection.videoHeight,
        },
        playerSelection
      );
    }
    return getTrackingSourceDimensions(activeTracking, playerSelection);
  }, [activeTracking, playerSelection]);

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
    if (!layoutReady || !activeTracking) return null;
    return lookupSelectedPlayerAt(activeTracking, timestampMs);
  }, [activeTracking, timestampMs, layoutReady]);

  const displayMapped = useMemo(() => {
    if (!lookup || !layoutReady) return null;
    return mapBoxHeadToScreen(lookup.normalizedBox, videoLayout);
  }, [lookup, layoutReady, videoLayout]);

  const mappedBox = useMemo(() => {
    if (!lookup || !layoutReady) return null;
    return mapVideoBoxToViewport(lookup.normalizedBox, videoLayout);
  }, [lookup, layoutReady, videoLayout]);

  const debugTrail = useMemo(() => {
    if (!activeTracking) return [];
    return getSelectedPlayerTrailCenters(activeTracking, timestampMs, 8);
  }, [activeTracking, timestampMs]);

  const showMarker = Boolean(
    (phase === 'approving' || phase === 'correcting') && lookup && displayMapped
  );

  useEffect(() => {
    if (!playbackActive) return;
    const box = lookup?.normalizedBox ?? null;
    logTrackingOverlayUpdate({
      currentVideoTimeMs: timestampMs,
      lookupResult: lookup,
      normalizedBox: box,
      mappedBox,
      markerX: displayMapped?.arrowTipX ?? null,
      markerTipY: displayMapped?.arrowTipY ?? null,
      sourceBox: box,
      sourceAnchorX: box ? box.x + box.width / 2 : null,
      sourceAnchorY: box ? box.y : null,
      renderedVideoRect: layoutReady
        ? {
            offsetX: videoLayout.offsetX,
            offsetY: videoLayout.offsetY,
            width: videoLayout.renderedWidth,
            height: videoLayout.renderedHeight,
          }
        : null,
      screenMarkerX: displayMapped?.arrowTipX ?? null,
      screenMarkerTipY: displayMapped?.arrowTipY ?? null,
      videoViewport: layoutReady
        ? {
            offsetX: videoLayout.offsetX,
            offsetY: videoLayout.offsetY,
            renderedWidth: videoLayout.renderedWidth,
            renderedHeight: videoLayout.renderedHeight,
            sourceWidth: videoLayout.sourceWidth,
            sourceHeight: videoLayout.sourceHeight,
          }
        : null,
      trackingStatus: phase,
    });
  }, [
    playbackActive,
    timestampMs,
    lookup,
    mappedBox,
    displayMapped,
    videoLayout,
    layoutReady,
    phase,
  ]);

  const progressRatio = totalMs > 0 ? Math.min(1, processedMs / totalMs) : 0;
  const hasRealProgress = processedMs > 0;

  const statusLine =
    phase === 'second_reference'
      ? 'Tap yourself again on this frame'
      : hasRealProgress
        ? `Tracking ${formatTrackingSeconds(processedMs)} of ${formatTrackingSeconds(totalMs)}`
        : phase === 'building'
          ? 'Preparing tracking…'
          : 'Following you through the clip';

  const selectionContentRect = {
    x: 0,
    y: 0,
    width: playerSelection.displayWidth,
    height: playerSelection.displayHeight,
  };

  const orientedSelectionSize = useMemo(
    () =>
      displayOrientedVideoSize(
        playerSelection.videoWidth ?? 720,
        playerSelection.videoHeight ?? 1280,
        selectionContentRect
      ),
    [playerSelection.videoWidth, playerSelection.videoHeight, playerSelection.displayWidth, playerSelection.displayHeight]
  );

  const secondRefContentRect = useMemo(() => {
    if (containerSize.width <= 0 || containerSize.height <= 0) {
      return { x: 0, y: 0, width: 0, height: 0 };
    }
    const layout = computeVideoContentLayout(
      containerSize.width,
      containerSize.height,
      orientedSelectionSize.width,
      orientedSelectionSize.height
    );
    return layoutToContentRect(layout);
  }, [containerSize.width, containerSize.height, orientedSelectionSize.width, orientedSelectionSize.height]);

  const handleSecondReferenceTap = async (event: GestureResponderEvent) => {
    console.log('[SecondReference] TOUCH RECEIVED', {
      locationX: event.nativeEvent.locationX,
      locationY: event.nativeEvent.locationY,
      pageX: event.nativeEvent.pageX,
      pageY: event.nativeEvent.pageY,
    });

    if (phase !== 'second_reference' || !pendingConfirmation || !jobIdRef.current) return;

    const { locationX, locationY } = event.nativeEvent;
    const { width: measuredWidth, height: measuredHeight } = secondRefTapSurface;
    if (measuredWidth <= 0 || measuredHeight <= 0) return;

    setSecondRefTapDot({ x: locationX, y: locationY });

    const normalizedX = Math.min(1, Math.max(0, locationX / measuredWidth));
    const normalizedY = Math.min(1, Math.max(0, locationY / measuredHeight));

    console.log('[TrackingBuild] Second tap submitted', {
      jobId: jobIdRef.current,
      checkpointId: pendingConfirmation.checkpointId,
      normalizedX,
      normalizedY,
      tapSurfaceWidth: measuredWidth,
      tapSurfaceHeight: measuredHeight,
      timestampMs: pendingConfirmation.timestampMs ?? playerSelection.timestampMs,
    });

    try {
      await submitTrackingJobConfirmation(jobIdRef.current, pendingConfirmation.checkpointId, {
        action: 'confirm',
        confirmed: true,
        normalizedX,
        normalizedY,
      });
      awaitingConfirmationRef.current = false;
      setPendingConfirmation(null);
      setSecondRefTapDot(null);
      setPhase('building');
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : 'Could not send second tap');
      setPhase('error');
    }
  };

  const handleSecondReferenceHidden = async () => {
    if (!pendingConfirmation || !jobIdRef.current) return;
    try {
      await submitTrackingJobConfirmation(jobIdRef.current, pendingConfirmation.checkpointId, {
        action: 'skip_reference',
      });
      awaitingConfirmationRef.current = false;
      setPendingConfirmation(null);
      setPhase('building');
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : 'Could not skip reference');
      setPhase('error');
    }
  };

  const contentRect = layoutToContentRect(videoLayout);

  const handleCorrectionTap = async (event: GestureResponderEvent) => {
    if (phase !== 'correcting' || !finalTracking) return;
    const mapped = tapToNormalized(
      event.nativeEvent.locationX,
      event.nativeEvent.locationY,
      contentRect
    );
    if (!mapped) return;

    player.pause();
    setRebuilding(true);
    const corrected = applyTrackingCorrection(
      finalTracking,
      timestampMs,
      mapped.normalizedX,
      mapped.normalizedY
    );

    try {
      const rebuilt = await rebuildTrackingFromCorrection(
        { clip, mode, profile, playerSelection },
        corrected,
        timestampMs
      );
      setFinalTracking(rebuilt);
      setPhase('approving');
      player.play();
    } catch {
      setFinalTracking(corrected);
    } finally {
      setRebuilding(false);
    }
  };

  const handleApprove = () => {
    if (!finalTracking) return;
    player.pause();
    onApproved({ ...finalTracking, previewAccepted: true });
  };

  const handleCancel = () => {
    if (jobIdRef.current) void cancelTrackingJobRemote(jobIdRef.current);
    stopPollRef.current?.();
    onCancel();
  };

  const handleRetry = () => {
    setPhase('building');
    setErrorMessage(null);
    setFinalTracking(null);
    setProcessedMs(0);
    abortRef.current?.abort();
    stopPollRef.current?.();
    abortRef.current = new AbortController();
    void (async () => {
      try {
        const jobId = await createTrackingJob(
          { clip, mode, profile, playerSelection },
          abortRef.current!.signal
        );
        jobIdRef.current = jobId;
        stopPollRef.current = pollTrackingJob(
          jobId,
          {
            onSnapshot: handleSnapshot,
            onStall: () => {
              if (!awaitingConfirmationRef.current) setReconnecting(true);
            },
            onReconnect: () => setReconnecting(false),
            onConfirmationRequired: handleConfirmationRequired,
            isAwaitingConfirmation: () => awaitingConfirmationRef.current,
          },
          abortRef.current!.signal
        );
      } catch (error) {
        setErrorMessage(error instanceof Error ? error.message : 'Retry failed');
        setPhase('error');
      }
    })();
  };

  return (
    <View className="flex-1 bg-black">
      <View className="px-4 pt-2 pb-3">
        <Text className="text-white text-lg font-semibold">Following you</Text>
        <Text className="text-white/60 text-sm mt-0.5">Building your player track</Text>
      </View>

      <View
        className="flex-1 relative"
        onLayout={(e: LayoutChangeEvent) => {
          const { width, height } = e.nativeEvent.layout;
          setContainerSize({ width, height });
        }}
      >
        <VideoView
          player={player}
          style={StyleSheet.absoluteFill}
          contentFit="contain"
          nativeControls={false}
        />

        <View
          style={[StyleSheet.absoluteFill, { backgroundColor: 'rgba(0,0,0,0.25)' }]}
          pointerEvents="none"
        />

        {phase === 'correcting' ? (
          <Pressable style={StyleSheet.absoluteFill} onPress={handleCorrectionTap}>
            {showMarker && displayMapped && lookup ? (
              <TrackingMarkerOverlay
                marker={displayMapped}
                layout={videoLayout}
                state={lookup.identityState}
              />
            ) : null}
          </Pressable>
        ) : null}

        {phase === 'second_reference' && secondRefContentRect.width > 0 ? (
          <View
            pointerEvents="box-none"
            style={{
              position: 'absolute',
              left: secondRefContentRect.x,
              top: secondRefContentRect.y,
              width: secondRefContentRect.width,
              height: secondRefContentRect.height,
            }}
          >
            <Pressable
              style={StyleSheet.absoluteFill}
              onPress={handleSecondReferenceTap}
              onLayout={(e: LayoutChangeEvent) => {
                const { width, height } = e.nativeEvent.layout;
                setSecondRefTapSurface({ width, height });
                console.log('[SecondReference] Tap surface layout', { width, height });
              }}
            >
              {secondRefTapDot ? (
                <View
                  pointerEvents="none"
                  style={{
                    position: 'absolute',
                    left: secondRefTapDot.x - 8,
                    top: secondRefTapDot.y - 8,
                    width: 16,
                    height: 16,
                    borderRadius: 8,
                    backgroundColor: '#00E676',
                    borderWidth: 2,
                    borderColor: '#FFFFFF',
                  }}
                />
              ) : null}
            </Pressable>
          </View>
        ) : null}

        {phase !== 'correcting' && showMarker && displayMapped && lookup ? (
          <View pointerEvents="none" style={StyleSheet.absoluteFill}>
            <TrackingMarkerOverlay
              marker={displayMapped}
              layout={videoLayout}
              state={lookup.identityState}
            />
          </View>
        ) : null}

        {activeTracking ? (
          <View pointerEvents="none" style={StyleSheet.absoluteFill}>
            <TrackingDebugOverlay
              layout={videoLayout}
              mapped={displayMapped}
              normalizedBox={lookup?.normalizedBox ?? null}
              state={lookup?.identityState ?? null}
              currentVideoTimeMs={timestampMs}
              previousSampleTimeMs={lookup?.previousSampleTimeMs}
              nextSampleTimeMs={lookup?.nextSampleTimeMs}
              trackingTimestampMs={lookup?.sampleTimeMs}
              identityConfidence={lookup?.identityConfidence}
              trackId={lookup?.trackId ?? activeTracking.selectedTrackId}
              coordinateSource={lookup?.coordinateSource}
              debugTrail={debugTrail}
            />
          </View>
        ) : null}

        {phase === 'building' && (
          <View
            pointerEvents="none"
            className="absolute top-3 right-3 flex-row items-center gap-2 bg-black/50 rounded-full px-3 py-1.5"
          >
            <ActivityIndicator size="small" color="#00E676" />
            <Text className="text-white/90 text-xs font-medium">Processing</Text>
          </View>
        )}

        {phase === 'second_reference' && (
          <View pointerEvents="none" className="absolute inset-x-4 top-14">
            <View className="bg-black/80 rounded-xl px-4 py-3 border border-primary/40">
              <Text className="text-white font-semibold text-center text-base">
                Tap yourself again
              </Text>
              <Text className="text-white/70 text-sm text-center mt-1">
                We couldn&apos;t confirm which player you selected. Tap yourself on this frame.
              </Text>
            </View>
          </View>
        )}

        {reconnecting && phase === 'building' && (
          <View pointerEvents="none" className="absolute top-14 left-4 right-4">
            <View className="bg-black/70 rounded-xl px-4 py-2">
              <Text className="text-white/90 text-xs text-center">
                Tracking paused. Reconnecting…
              </Text>
            </View>
          </View>
        )}

        {rebuilding && (
          <View pointerEvents="none" className="absolute inset-0 items-center justify-center bg-black/50">
            <ActivityIndicator size="large" color="#00E676" />
            <Text className="text-white mt-3 text-sm">Updating track…</Text>
          </View>
        )}

        {phase === 'error' && (
          <View className="absolute inset-x-4 top-1/3 bg-black/85 rounded-2xl p-5 gap-3 border border-white/10">
            <Text className="text-white font-semibold text-center text-base">
              We couldn&apos;t finish the player track.
            </Text>
            {errorMessage ? (
              <Text className="text-white/70 text-sm text-center">{errorMessage}</Text>
            ) : null}
            <Button label="Try again" onPress={handleRetry} fullWidth />
            <Button label="Back" variant="secondary" onPress={onRetapPlayer} fullWidth />
          </View>
        )}

        <View pointerEvents="none" className="absolute bottom-0 left-0 right-0 px-4 pb-3 pt-6">
          <View className="h-1 bg-white/20 rounded-full overflow-hidden mb-2">
            <View
              className="h-full bg-primary rounded-full"
              style={{ width: `${Math.round(progressRatio * 100)}%` }}
            />
          </View>
          <Text className="text-white/80 text-xs text-center">{statusLine}</Text>
        </View>
      </View>

      <View className="px-4 py-4 gap-3 bg-background border-t border-border">
        {phase === 'second_reference' ? (
          <>
            <Button
              label="I'm hidden / behind another player"
              variant="secondary"
              onPress={handleSecondReferenceHidden}
              fullWidth
            />
            <Button label="Cancel" variant="secondary" onPress={handleCancel} fullWidth />
          </>
        ) : phase === 'approving' && finalTracking ? (
          <>
            <Button label="Tracking looks correct" onPress={handleApprove} fullWidth size="lg" />
            <Button
              label="Correct player"
              variant="secondary"
              onPress={() => {
                player.pause();
                setPhase('correcting');
              }}
              fullWidth
            />
          </>
        ) : (
          <Button label="Cancel" variant="secondary" onPress={handleCancel} fullWidth />
        )}
        {phase === 'correcting' ? (
          <Text className="text-text-muted text-xs text-center">
            Tap the correct player, then we&apos;ll rebuild from here.
          </Text>
        ) : null}
      </View>
    </View>
  );
}
