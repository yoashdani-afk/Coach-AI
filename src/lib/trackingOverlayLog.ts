import type { VideoViewportLayout, ViewportBoundingBox } from '@/lib/videoViewportMapping';
import type { SelectedPlayerLookupResult } from '@/lib/selectedPlayerTrack';
import type { TrackingBoundingBox } from '@/types/analysis';

export interface TrackingOverlayLogPayload {
  currentVideoTimeMs: number;
  lookupResult: SelectedPlayerLookupResult | null;
  normalizedBox: TrackingBoundingBox | null;
  mappedBox: ViewportBoundingBox | null;
  markerX: number | null;
  markerTipY: number | null;
  sourceBox?: TrackingBoundingBox | null;
  sourceAnchorX?: number | null;
  sourceAnchorY?: number | null;
  renderedVideoRect?: {
    offsetX: number;
    offsetY: number;
    width: number;
    height: number;
  } | null;
  screenMarkerX?: number | null;
  screenMarkerTipY?: number | null;
  videoViewport: Pick<
    VideoViewportLayout,
    'offsetX' | 'offsetY' | 'renderedWidth' | 'renderedHeight' | 'sourceWidth' | 'sourceHeight'
  > | null;
  trackingStatus: string;
}

export function logTrackingOverlayUpdate(payload: TrackingOverlayLogPayload): void {
  if (!__DEV__) return;
  console.log('[TrackingOverlay]', payload);
}
