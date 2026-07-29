/**
 * Computes the letterboxed video content rectangle for `contentFit="contain"`.
 */
export interface ContentRect {
  x: number;
  y: number;
  width: number;
  height: number;
}

export function computeContentRect(
  containerWidth: number,
  containerHeight: number,
  videoWidth: number,
  videoHeight: number
): ContentRect {
  if (containerWidth <= 0 || containerHeight <= 0 || videoWidth <= 0 || videoHeight <= 0) {
    return { x: 0, y: 0, width: containerWidth, height: containerHeight };
  }

  const containerAspect = containerWidth / containerHeight;
  const videoAspect = videoWidth / videoHeight;

  if (containerAspect > videoAspect) {
    const height = containerHeight;
    const width = height * videoAspect;
    return {
      x: (containerWidth - width) / 2,
      y: 0,
      width,
      height,
    };
  }

  const width = containerWidth;
  const height = width / videoAspect;
  return {
    x: 0,
    y: (containerHeight - height) / 2,
    width,
    height,
  };
}

/** Map a tap within the container to normalised video coordinates (0–1). Returns null if outside the video area. */
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

function clamp01(value: number): number {
  return Math.min(1, Math.max(0, value));
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
