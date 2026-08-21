import { useCallback, useEffect, useRef, useState } from 'react';
import type { VideoPlayer } from 'expo-video';
import { isFrameTimestampSynced } from '@/lib/videoViewportMapping';

const DEFAULT_TOLERANCE_MS = 120;
const SEEK_SETTLE_MS = 150;

interface UseVideoFrameSyncOptions {
  toleranceMs?: number;
}

interface UseVideoFrameSyncResult {
  currentFrameTimestampMs: number;
  markerTimestampMs: number | null;
  setMarkerTimestampMs: (ms: number | null) => void;
  frameSynced: boolean;
  seekTargetMs: number | null;
  seekToMs: (ms: number) => void;
  bindPlayer: (player: VideoPlayer) => void;
}

/**
 * Keeps marker/tracking coordinates tied to the frame actually on screen.
 * Clears sync while seeking; restores when the player reports the target time.
 */
export function useVideoFrameSync(
  options: UseVideoFrameSyncOptions = {}
): UseVideoFrameSyncResult {
  const toleranceMs = options.toleranceMs ?? DEFAULT_TOLERANCE_MS;
  const [currentFrameTimestampMs, setCurrentFrameTimestampMs] = useState(0);
  const [markerTimestampMs, setMarkerTimestampMs] = useState<number | null>(null);
  const [seekTargetMs, setSeekTargetMs] = useState<number | null>(null);
  const [frameSynced, setFrameSynced] = useState(true);
  const playerRef = useRef<VideoPlayer | null>(null);
  const settleTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const bindPlayer = useCallback((player: VideoPlayer) => {
    playerRef.current = player;
  }, []);

  const seekToMs = useCallback((ms: number) => {
    const player = playerRef.current;
    if (!player) return;

    setFrameSynced(false);
    setSeekTargetMs(ms);
    player.currentTime = ms / 1000;
    player.pause();
    setCurrentFrameTimestampMs(ms);

    if (settleTimer.current) clearTimeout(settleTimer.current);
    settleTimer.current = setTimeout(() => {
      setFrameSynced(true);
      setSeekTargetMs(null);
    }, SEEK_SETTLE_MS);
  }, []);

  useEffect(() => {
    const player = playerRef.current;
    if (!player) return;

    const timeSub = player.addListener('timeUpdate', ({ currentTime }) => {
      const ms = Math.round(currentTime * 1000);
      setCurrentFrameTimestampMs(ms);

      if (seekTargetMs != null && isFrameTimestampSynced(ms, seekTargetMs, toleranceMs)) {
        setFrameSynced(true);
        setSeekTargetMs(null);
        if (settleTimer.current) {
          clearTimeout(settleTimer.current);
          settleTimer.current = null;
        }
      }
    });

    return () => {
      timeSub.remove();
      if (settleTimer.current) clearTimeout(settleTimer.current);
    };
  }, [seekTargetMs, toleranceMs]);

  return {
    currentFrameTimestampMs,
    markerTimestampMs,
    setMarkerTimestampMs,
    frameSynced,
    seekTargetMs,
    seekToMs,
    bindPlayer,
  };
}
