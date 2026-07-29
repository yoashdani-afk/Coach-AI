import type { PlayerSelection } from './types.js';

/** Timestamp (seconds) when the user tapped to mark their player. */
export function getFocusTimestampSec(
  playerSelection: PlayerSelection,
  clipDurationMs: number
): number {
  const clipDurationSec = Math.max(0.1, clipDurationMs / 1000);
  return Math.min(clipDurationSec, Math.max(0, playerSelection.timestampMs / 1000));
}

export function getClipDurationSec(clipDurationMs: number): number {
  return Math.max(0.1, clipDurationMs / 1000);
}

export function describeMarkerRegion(normalizedX: number, normalizedY: number): string {
  const horizontal =
    normalizedX < 0.33
      ? 'left third of the frame'
      : normalizedX > 0.66
        ? 'right third of the frame'
        : 'central channel';
  const vertical =
    normalizedY < 0.33
      ? 'upper third of the frame'
      : normalizedY > 0.66
        ? 'lower third of the frame'
        : 'middle of the frame';
  return `${horizontal}, ${vertical}`;
}
