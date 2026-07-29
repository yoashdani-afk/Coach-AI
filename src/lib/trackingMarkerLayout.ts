import type { TrackingBoundingBox } from '@/types/analysis';
import type { ContentRect } from '@/lib/videoLayout';

export interface VideoContentLayout {
  sourceWidth: number;
  sourceHeight: number;
  containerWidth: number;
  containerHeight: number;
  scale: number;
  displayedContentWidth: number;
  displayedContentHeight: number;
  offsetX: number;
  offsetY: number;
  contentRect: ContentRect;
}

/** Letterboxed content layout for resizeMode="contain". */
export function computeVideoContentLayout(
  containerWidth: number,
  containerHeight: number,
  sourceWidth: number,
  sourceHeight: number
): VideoContentLayout {
  if (containerWidth <= 0 || containerHeight <= 0 || sourceWidth <= 0 || sourceHeight <= 0) {
    return {
      sourceWidth,
      sourceHeight,
      containerWidth,
      containerHeight,
      scale: 1,
      displayedContentWidth: containerWidth,
      displayedContentHeight: containerHeight,
      offsetX: 0,
      offsetY: 0,
      contentRect: { x: 0, y: 0, width: containerWidth, height: containerHeight },
    };
  }

  const scale = Math.min(containerWidth / sourceWidth, containerHeight / sourceHeight);
  const displayedContentWidth = sourceWidth * scale;
  const displayedContentHeight = sourceHeight * scale;
  const offsetX = (containerWidth - displayedContentWidth) / 2;
  const offsetY = (containerHeight - displayedContentHeight) / 2;

  return {
    sourceWidth,
    sourceHeight,
    containerWidth,
    containerHeight,
    scale,
    displayedContentWidth,
    displayedContentHeight,
    offsetX,
    offsetY,
    contentRect: {
      x: offsetX,
      y: offsetY,
      width: displayedContentWidth,
      height: displayedContentHeight,
    },
  };
}

function clampToContentRect(x: number, y: number, rect: ContentRect): { x: number; y: number } {
  return {
    x: Math.min(rect.x + rect.width, Math.max(rect.x, x)),
    y: Math.min(rect.y + rect.height, Math.max(rect.y, y)),
  };
}

export interface MappedTrackingMarker {
  /** Screen position of head anchor — arrow tip target. */
  headX: number;
  headY: number;
  arrowWidth: number;
  arrowHeight: number;
  headGapPx: number;
  layout: VideoContentLayout;
  box: TrackingBoundingBox;
}

/** Map normalised bounding box head anchor into rendered video coordinates. */
export function mapBoxHeadToScreen(
  box: TrackingBoundingBox,
  layout: VideoContentLayout
): MappedTrackingMarker {
  const sourceHeadX = (box.x + box.width / 2) * layout.sourceWidth;
  const sourceHeadY = (box.y + box.height * 0.08) * layout.sourceHeight;

  let headX = layout.offsetX + sourceHeadX * layout.scale;
  let headY = layout.offsetY + sourceHeadY * layout.scale;

  const clamped = clampToContentRect(headX, headY, layout.contentRect);
  headX = clamped.x;
  headY = clamped.y;

  const playerHeightPx = box.height * layout.contentRect.height;
  const arrowHeight = Math.min(18, Math.max(12, 12 + playerHeightPx * 0.04));
  const arrowWidth = Math.max(8, arrowHeight * 0.68);
  const headGapPx = 3;

  return {
    headX,
    headY,
    arrowWidth,
    arrowHeight,
    headGapPx,
    layout,
    box,
  };
}
