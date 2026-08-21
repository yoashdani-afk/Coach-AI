import type { TrackingBoundingBox } from '@/types/analysis';

export type VideoResizeMode = 'contain' | 'cover';
export type VideoRotation = 0 | 90 | 180 | 270;

export interface VideoViewportLayout {
  sourceWidth: number;
  sourceHeight: number;
  viewportWidth: number;
  viewportHeight: number;
  rotation: VideoRotation;
  resizeMode: VideoResizeMode;
  rotatedSourceWidth: number;
  rotatedSourceHeight: number;
  scale: number;
  renderedWidth: number;
  renderedHeight: number;
  offsetX: number;
  offsetY: number;
}

export interface ViewportPoint {
  screenX: number;
  screenY: number;
}

export interface NormalizedVideoPoint {
  normalizedX: number;
  normalizedY: number;
}

export interface MappedPlayerMarker {
  dotX: number;
  dotY: number;
  arrowTipX: number;
  arrowTipY: number;
  normalizedX: number;
  normalizedY: number;
  layout: VideoViewportLayout;
  box: TrackingBoundingBox | null;
}

const ARROW_SHAFT_PX = 38;
const ARROW_TIP_ABOVE_DOT_PX = 20;

export function computeMarkerGap(renderedBoxHeight: number): number {
  return Math.min(10, Math.max(3, renderedBoxHeight * 0.08));
}

function clamp01(value: number): number {
  return Math.min(1, Math.max(0, value));
}

export function rotatedSourceDimensions(
  sourceWidth: number,
  sourceHeight: number,
  rotation: VideoRotation
): { width: number; height: number } {
  if (rotation === 90 || rotation === 270) {
    return { width: sourceHeight, height: sourceWidth };
  }
  return { width: sourceWidth, height: sourceHeight };
}

export function displayNormalizedToSourceNormalized(
  normalizedX: number,
  normalizedY: number,
  rotation: VideoRotation
): NormalizedVideoPoint {
  const nx = clamp01(normalizedX);
  const ny = clamp01(normalizedY);

  switch (rotation) {
    case 90:
      return { normalizedX: clamp01(1 - ny), normalizedY: clamp01(nx) };
    case 180:
      return { normalizedX: clamp01(1 - nx), normalizedY: clamp01(1 - ny) };
    case 270:
      return { normalizedX: clamp01(ny), normalizedY: clamp01(1 - nx) };
    default:
      return { normalizedX: nx, normalizedY: ny };
  }
}

export function sourceNormalizedToDisplayNormalized(
  normalizedX: number,
  normalizedY: number,
  rotation: VideoRotation
): NormalizedVideoPoint {
  const nx = clamp01(normalizedX);
  const ny = clamp01(normalizedY);

  switch (rotation) {
    case 90:
      return { normalizedX: clamp01(ny), normalizedY: clamp01(1 - nx) };
    case 180:
      return { normalizedX: clamp01(1 - nx), normalizedY: clamp01(1 - ny) };
    case 270:
      return { normalizedX: clamp01(1 - ny), normalizedY: clamp01(nx) };
    default:
      return { normalizedX: nx, normalizedY: ny };
  }
}

export function computeVideoViewportLayout(params: {
  sourceWidth: number;
  sourceHeight: number;
  viewportWidth: number;
  viewportHeight: number;
  rotation?: VideoRotation;
  resizeMode?: VideoResizeMode;
}): VideoViewportLayout {
  const {
    sourceWidth,
    sourceHeight,
    viewportWidth,
    viewportHeight,
    rotation = 0,
    resizeMode = 'contain',
  } = params;

  const { width: rotatedSourceWidth, height: rotatedSourceHeight } = rotatedSourceDimensions(
    sourceWidth,
    sourceHeight,
    rotation
  );

  if (
    viewportWidth <= 0 ||
    viewportHeight <= 0 ||
    rotatedSourceWidth <= 0 ||
    rotatedSourceHeight <= 0
  ) {
    return {
      sourceWidth,
      sourceHeight,
      viewportWidth,
      viewportHeight,
      rotation,
      resizeMode,
      rotatedSourceWidth,
      rotatedSourceHeight,
      scale: 1,
      renderedWidth: viewportWidth,
      renderedHeight: viewportHeight,
      offsetX: 0,
      offsetY: 0,
    };
  }

  const scaleX = viewportWidth / rotatedSourceWidth;
  const scaleY = viewportHeight / rotatedSourceHeight;
  const scale =
    resizeMode === 'contain' ? Math.min(scaleX, scaleY) : Math.max(scaleX, scaleY);

  const renderedWidth = rotatedSourceWidth * scale;
  const renderedHeight = rotatedSourceHeight * scale;
  const offsetX = (viewportWidth - renderedWidth) / 2;
  const offsetY = (viewportHeight - renderedHeight) / 2;

  return {
    sourceWidth,
    sourceHeight,
    viewportWidth,
    viewportHeight,
    rotation,
    resizeMode,
    rotatedSourceWidth,
    rotatedSourceHeight,
    scale,
    renderedWidth,
    renderedHeight,
    offsetX,
    offsetY,
  };
}

export function mapVideoPointToViewport(params: {
  normalizedX: number;
  normalizedY: number;
  layout: VideoViewportLayout;
}): ViewportPoint {
  const { normalizedX, normalizedY, layout } = params;
  return {
    screenX: layout.offsetX + clamp01(normalizedX) * layout.renderedWidth,
    screenY: layout.offsetY + clamp01(normalizedY) * layout.renderedHeight,
  };
}

export function mapViewportPointToVideo(params: {
  screenX: number;
  screenY: number;
  layout: VideoViewportLayout;
}): NormalizedVideoPoint | null {
  const { screenX, screenY, layout } = params;
  const { offsetX, offsetY, renderedWidth, renderedHeight } = layout;

  if (renderedWidth <= 0 || renderedHeight <= 0) return null;

  const localX = screenX - offsetX;
  const localY = screenY - offsetY;

  if (localX < 0 || localY < 0 || localX > renderedWidth || localY > renderedHeight) {
    return null;
  }

  return {
    normalizedX: clamp01(localX / renderedWidth),
    normalizedY: clamp01(localY / renderedHeight),
  };
}

export interface ViewportBoundingBox {
  x: number;
  y: number;
  width: number;
  height: number;
  tipX: number;
  tipY: number;
  markerGap: number;
  centerX: number;
  centerY: number;
}

export function mapVideoBoxToViewport(
  box: TrackingBoundingBox,
  layout: VideoViewportLayout
): ViewportBoundingBox {
  const x = layout.offsetX + box.x * layout.renderedWidth;
  const y = layout.offsetY + box.y * layout.renderedHeight;
  const width = box.width * layout.renderedWidth;
  const height = box.height * layout.renderedHeight;
  const markerGap = computeMarkerGap(height);

  return {
    x,
    y,
    width,
    height,
    tipX: x + width / 2,
    tipY: y - markerGap,
    markerGap,
    centerX: x + width / 2,
    centerY: y + height / 2,
  };
}

export function mapPlayerMarkerToViewport(params: {
  normalizedX: number;
  normalizedY: number;
  layout: VideoViewportLayout;
  box?: TrackingBoundingBox | null;
}): MappedPlayerMarker {
  const { normalizedX, normalizedY, layout, box } = params;
  const dot = mapVideoPointToViewport({ normalizedX, normalizedY, layout });

  if (box && box.width > 0 && box.height > 0) {
    const mappedBox = mapVideoBoxToViewport(box, layout);
    return {
      dotX: mappedBox.centerX,
      dotY: mappedBox.centerY,
      arrowTipX: mappedBox.tipX,
      arrowTipY: mappedBox.tipY,
      normalizedX,
      normalizedY,
      layout,
      box,
    };
  }

  return {
    dotX: dot.screenX,
    dotY: dot.screenY,
    arrowTipX: dot.screenX,
    arrowTipY: dot.screenY - ARROW_TIP_ABOVE_DOT_PX,
    normalizedX,
    normalizedY,
    layout,
    box: null,
  };
}

export const PLAYER_MARKER_ARROW_SHAFT_PX = ARROW_SHAFT_PX;

export function isFrameTimestampSynced(
  currentFrameTimestampMs: number,
  markerTimestampMs: number,
  toleranceMs = 120
): boolean {
  return Math.abs(currentFrameTimestampMs - markerTimestampMs) <= toleranceMs;
}

export interface ContentRect {
  x: number;
  y: number;
  width: number;
  height: number;
}

export function layoutToContentRect(layout: VideoViewportLayout): ContentRect {
  return {
    x: layout.offsetX,
    y: layout.offsetY,
    width: layout.renderedWidth,
    height: layout.renderedHeight,
  };
}

export function computeContentRect(
  containerWidth: number,
  containerHeight: number,
  videoWidth: number,
  videoHeight: number
): ContentRect {
  const layout = computeVideoViewportLayout({
    sourceWidth: videoWidth,
    sourceHeight: videoHeight,
    viewportWidth: containerWidth,
    viewportHeight: containerHeight,
    rotation: 0,
    resizeMode: 'contain',
  });
  return layoutToContentRect(layout);
}
