import type { PlayerSelection } from './types.js';
import type { VideoGeometry, VideoRotation } from './videoProbe.js';

export interface MarkerPixelPosition {
  /** Pixel X on the display-oriented extracted frame. */
  x: number;
  /** Pixel Y on the display-oriented extracted frame. */
  y: number;
  clampedNormalizedX: number;
  clampedNormalizedY: number;
}

function clamp01(value: number): number {
  return Math.min(1, Math.max(0, value));
}

/**
 * Maps display-normalised tap coordinates (0–1 within letterboxed video content,
 * matching the mobile `tapToNormalized` helper) to stored-frame normalised coords
 * when the extracted bitmap has NOT yet been rotation-corrected.
 */
export function displayNormalizedToStoredNormalized(
  normalizedX: number,
  normalizedY: number,
  rotation: VideoRotation,
  isMirrored: boolean
): { x: number; y: number } {
  const nx = clamp01(normalizedX);
  const ny = clamp01(normalizedY);

  let sx = nx;
  let sy = ny;

  switch (rotation) {
    case 90:
      sx = ny;
      sy = 1 - nx;
      break;
    case 180:
      sx = 1 - nx;
      sy = 1 - ny;
      break;
    case 270:
      sx = 1 - ny;
      sy = nx;
      break;
    default:
      break;
  }

  if (isMirrored) {
    sx = 1 - sx;
  }

  return { x: clamp01(sx), y: clamp01(sy) };
}

/**
 * Converts a normalised tap (display space, aspect-fit "contain") to pixel coordinates
 * on an extracted frame. When `frameIsDisplayOriented` is true the frame matches what
 * the user saw in the player (ffmpeg autorotate applied).
 */
export function mapTapToFramePixels(params: {
  playerSelection: PlayerSelection;
  frameWidth: number;
  frameHeight: number;
  geometry: VideoGeometry;
  frameIsDisplayOriented: boolean;
}): MarkerPixelPosition {
  const { playerSelection, frameWidth, frameHeight, geometry, frameIsDisplayOriented } = params;

  const clampedNormalizedX = clamp01(playerSelection.normalizedX);
  const clampedNormalizedY = clamp01(playerSelection.normalizedY);

  let normX = clampedNormalizedX;
  let normY = clampedNormalizedY;

  if (!frameIsDisplayOriented) {
    const stored = displayNormalizedToStoredNormalized(
      normX,
      normY,
      geometry.rotation,
      geometry.isMirrored
    );
    normX = stored.x;
    normY = stored.y;
  } else if (geometry.isMirrored) {
    normX = clamp01(1 - normX);
  }

  const x = Math.round(clamp01(normX) * Math.max(1, frameWidth - 1));
  const y = Math.round(clamp01(normY) * Math.max(1, frameHeight - 1));

  return {
    x: Math.min(frameWidth - 1, Math.max(0, x)),
    y: Math.min(frameHeight - 1, Math.max(0, y)),
    clampedNormalizedX,
    clampedNormalizedY,
  };
}

/** True when extracted frame dimensions match display-oriented geometry within tolerance. */
export function frameMatchesDisplayGeometry(
  frameWidth: number,
  frameHeight: number,
  geometry: VideoGeometry
): boolean {
  const aspectFrame = frameWidth / frameHeight;
  const aspectDisplay = geometry.displayWidth / geometry.displayHeight;
  const aspectClose = Math.abs(aspectFrame - aspectDisplay) < 0.02;
  const sizeClose =
    Math.abs(frameWidth - geometry.displayWidth) <= 2 &&
    Math.abs(frameHeight - geometry.displayHeight) <= 2;
  return aspectClose && (sizeClose || geometry.rotation === 0);
}
