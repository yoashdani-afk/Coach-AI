import { useEffect, useState } from 'react';
import type { VideoPlayer } from 'expo-video';

const POLL_MS = 33;

/** Reliable playback clock — timeUpdate alone is not always fired on every platform. */
export function usePlaybackTimestamp(player: VideoPlayer, enabled: boolean): number {
  const [timestampMs, setTimestampMs] = useState(0);

  useEffect(() => {
    if (!enabled) return;

    const sync = () => {
      try {
        const next = Math.round(player.currentTime * 1000);
        setTimestampMs((prev) => (prev !== next ? next : prev));
      } catch {
        // Player may be disposed during teardown.
      }
    };

    sync();
    const timeSub = player.addListener('timeUpdate', ({ currentTime }) => {
      setTimestampMs(Math.round(currentTime * 1000));
    });
    const interval = setInterval(sync, POLL_MS);

    return () => {
      timeSub.remove();
      clearInterval(interval);
    };
  }, [player, enabled]);

  return timestampMs;
}
