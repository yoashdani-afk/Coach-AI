import type { TrackingBoundingBox } from '@/types/analysis';
import {
  computeVideoViewportLayout,
  mapVideoBoxToViewport,
  type MappedPlayerMarker,
  type VideoViewportLayout,
} from '@/lib/videoViewportMapping';

export type { VideoViewportLayout as VideoContentLayout };

export function computeVideoContentLayout(
  containerWidth: number,
  containerHeight: number,
  sourceWidth: number,
  sourceHeight: number
): VideoViewportLayout {
  return computeVideoViewportLayout({
    sourceWidth,
    sourceHeight,
    viewportWidth: containerWidth,
    viewportHeight: containerHeight,
    rotation: 0,
    resizeMode: 'contain',
  });
}

export interface MappedTrackingMarker extends MappedPlayerMarker {
  markerGapPx: number;
  layout: VideoViewportLayout;
  box: TrackingBoundingBox;
}

/** Map normalized selected-player box → viewport marker tip at top-centre. */
export function mapBoxHeadToScreen(
  box: TrackingBoundingBox,
  layout: VideoViewportLayout
): MappedTrackingMarker {
  const mappedBox = mapVideoBoxToViewport(box, layout);

  return {
    dotX: mappedBox.tipX,
    dotY: mappedBox.tipY,
    arrowTipX: mappedBox.tipX,
    arrowTipY: mappedBox.tipY,
    normalizedX: box.x + box.width / 2,
    normalizedY: box.y,
    markerGapPx: mappedBox.markerGap,
    layout,
    box,
  };
}
