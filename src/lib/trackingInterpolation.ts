/**
 * @deprecated Import from selectedPlayerTrack.ts — preview and analysis share one timeline.
 */
export {
  mergeTrackingCorrections,
  isTrackingLostAt,
  isMarkerVisibleState,
  interpolateTrackingAt,
  MAX_INTERPOLATION_GAP_MS,
} from '@/lib/selectedPlayerTrack';

export const TRACKING_FRAME_TOLERANCE_MS = 350;

export function isTrackingFrameSynced(
  currentFrameTimestampMs: number,
  trackingTimestampMs: number,
  toleranceMs = TRACKING_FRAME_TOLERANCE_MS
): boolean {
  return Math.abs(currentFrameTimestampMs - trackingTimestampMs) <= toleranceMs;
}
