import type { ContentRect } from '@/lib/videoViewportMapping';
import { rotatedSourceDimensions, type VideoRotation } from '@/lib/videoViewportMapping';

/**
 * Display-oriented video dimensions for coordinate mapping.
 * Prefer explicit rotation when known; fall back to legacy aspect heuristic only when needed.
 */
export function displayOrientedVideoSize(
  trackWidth: number,
  trackHeight: number,
  contentRect?: ContentRect,
  rotation: VideoRotation | null = null
): { width: number; height: number } {
  if (trackWidth <= 0 || trackHeight <= 0) {
    return {
      width: trackWidth > 0 ? trackWidth : 720,
      height: trackHeight > 0 ? trackHeight : 1280,
    };
  }

  if (rotation != null) {
    return rotatedSourceDimensions(trackWidth, trackHeight, rotation);
  }

  if (!contentRect || contentRect.width <= 0 || contentRect.height <= 0) {
    return { width: trackWidth, height: trackHeight };
  }

  const trackAspect = trackWidth / trackHeight;
  const contentAspect = contentRect.width / contentRect.height;
  const trackIsLandscape = trackAspect > 1.05;
  const contentIsLandscape = contentAspect > 1.05;

  if (trackIsLandscape !== contentIsLandscape) {
    return { width: trackHeight, height: trackWidth };
  }

  return { width: trackWidth, height: trackHeight };
}
