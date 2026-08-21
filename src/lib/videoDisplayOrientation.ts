import {
  rotatedSourceDimensions,
  type VideoRotation,
} from '@/lib/videoViewportMapping';

export type VideoOrientationLabel = 'portrait' | 'landscape';

export interface VideoDisplayOrientation {
  encodedWidth: number;
  encodedHeight: number;
  rotation: VideoRotation;
  finalDisplayWidth: number;
  finalDisplayHeight: number;
  orientation: VideoOrientationLabel;
}

export function orientationLabel(width: number, height: number): VideoOrientationLabel {
  if (width <= 0 || height <= 0) return 'portrait';
  return width / height > 1.05 ? 'landscape' : 'portrait';
}

/** Compute display dimensions from encoded size + rotation metadata exactly once. */
export function resolveVideoDisplayOrientation(params: {
  encodedWidth: number;
  encodedHeight: number;
  rotation?: VideoRotation | null;
}): VideoDisplayOrientation {
  const { encodedWidth, encodedHeight } = params;
  const rotation = params.rotation ?? 0;

  const { width: finalDisplayWidth, height: finalDisplayHeight } = rotatedSourceDimensions(
    encodedWidth,
    encodedHeight,
    rotation
  );

  return {
    encodedWidth,
    encodedHeight,
    rotation,
    finalDisplayWidth,
    finalDisplayHeight,
    orientation: orientationLabel(finalDisplayWidth, finalDisplayHeight),
  };
}
