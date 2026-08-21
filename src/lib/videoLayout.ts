/**
 * Re-exports the shared viewport mapping utilities.
 * All tap, dot, arrow, and bounding-box placement must use videoViewportMapping.
 */
export {
  computeContentRect,
  computeVideoViewportLayout,
  isFrameTimestampSynced,
  layoutToContentRect,
  mapPlayerMarkerToViewport,
  mapVideoBoxToViewport,
  mapVideoPointToViewport,
  mapViewportPointToVideo,
  PLAYER_MARKER_ARROW_SHAFT_PX,
  type ContentRect,
  type MappedPlayerMarker,
  type NormalizedVideoPoint,
  type VideoRotation,
  type VideoViewportLayout,
  type ViewportBoundingBox,
  type ViewportPoint,
} from '@/lib/videoViewportMapping';

import {
  computeVideoViewportLayout,
  type ContentRect,
  type VideoViewportLayout,
} from '@/lib/videoViewportMapping';

function clamp01(value: number): number {
  return Math.min(1, Math.max(0, value));
}

/** Map a tap within the container to normalised video coordinates. Returns null if outside video area. */
export function tapToNormalized(
  tapX: number,
  tapY: number,
  contentRect: ContentRect
): { normalizedX: number; normalizedY: number } | null {
  const { x, y, width, height } = contentRect;
  if (width <= 0 || height <= 0) return null;

  const localX = tapX - x;
  const localY = tapY - y;

  if (localX < 0 || localY < 0 || localX > width || localY > height) {
    return null;
  }

  return {
    normalizedX: clamp01(localX / width),
    normalizedY: clamp01(localY / height),
  };
}

/** Map normalised coordinates back to container space for marker placement. */
export function normalizedToContainer(
  normalizedX: number,
  normalizedY: number,
  contentRect: ContentRect
): { x: number; y: number } {
  return {
    x: contentRect.x + clamp01(normalizedX) * contentRect.width,
    y: contentRect.y + clamp01(normalizedY) * contentRect.height,
  };
}

export function buildViewportLayout(
  containerWidth: number,
  containerHeight: number,
  sourceWidth: number,
  sourceHeight: number,
  rotation: 0 | 90 | 180 | 270 = 0
): VideoViewportLayout {
  return computeVideoViewportLayout({
    sourceWidth,
    sourceHeight,
    viewportWidth: containerWidth,
    viewportHeight: containerHeight,
    rotation,
    resizeMode: 'contain',
  });
}

export function initialSeekSeconds(durationSeconds: number): number {
  if (durationSeconds <= 0) return 0;
  return Math.min(1, durationSeconds * 0.08);
}

/** Heuristic: player likely small, distant, or hard to track in this frame. */
export function assessTrackingQuality(
  normalizedX: number,
  normalizedY: number,
  contentRect: ContentRect
): boolean {
  if (contentRect.width <= 0 || contentRect.height <= 0) return false;

  const minDim = Math.min(contentRect.width, contentRect.height);
  const cropPx = minDim * 0.28;
  const nearEdge =
    normalizedX < 0.06 ||
    normalizedX > 0.94 ||
    normalizedY < 0.06 ||
    normalizedY > 0.94;
  const distantInFrame = normalizedY < 0.38;
  const lowPreviewResolution = minDim < 260;
  const tinyCropRegion = cropPx < 56;

  return nearEdge || distantInFrame || lowPreviewResolution || tinyCropRegion;
}
