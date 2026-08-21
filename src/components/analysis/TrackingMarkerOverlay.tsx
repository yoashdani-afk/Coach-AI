import { View, Text } from 'react-native';
import { mapVideoBoxToViewport, type MappedPlayerMarker } from '@/lib/videoViewportMapping';
import type { VideoViewportLayout } from '@/lib/videoViewportMapping';
import type { TrackingBoundingBox, TrackingState } from '@/types/analysis';

const GREEN = '#00E676';

interface TrackingMarkerOverlayProps {
  marker: MappedPlayerMarker;
  layout: VideoViewportLayout;
  state: TrackingState | 'MANUAL';
  showLabel?: boolean;
}

function opacityForState(state: TrackingState | 'MANUAL'): number {
  if (state === 'LOST' || state === 'SEARCHING') return 0;
  if (state === 'CONFIRMED' || state === 'MANUAL') return 1;
  if (state === 'PROBABLE') return 0.55;
  return 0;
}

/** Small chevron + "You" pill anchored at mapped box top-centre. */
export function TrackingMarkerOverlay({
  marker,
  layout,
  state,
  showLabel = true,
}: TrackingMarkerOverlayProps) {
  if (state === 'LOST' || state === 'SEARCHING') return null;

  const bbox: TrackingBoundingBox | null = marker.box;
  if (!bbox) return null;

  const opacity = opacityForState(state);
  const tipX = marker.arrowTipX;
  const tipY = marker.arrowTipY;
  const chevronW = 10;
  const chevronH = 6;
  const chevronLeft = tipX - chevronW / 2;
  const chevronTop = tipY - chevronH;

  return (
    <View pointerEvents="none" style={{ position: 'absolute', left: 0, top: 0, right: 0, bottom: 0 }}>
      <View
        style={{
          position: 'absolute',
          left: chevronLeft,
          top: chevronTop,
          width: 0,
          height: 0,
          borderLeftWidth: chevronW / 2,
          borderRightWidth: chevronW / 2,
          borderBottomWidth: chevronH,
          borderLeftColor: 'transparent',
          borderRightColor: 'transparent',
          borderBottomColor: GREEN,
          opacity,
        }}
      />

      {showLabel ? (
        <View
          style={{
            position: 'absolute',
            left: tipX - 16,
            top: chevronTop - 14,
            backgroundColor: 'rgba(0,0,0,0.65)',
            borderRadius: 6,
            paddingHorizontal: 5,
            paddingVertical: 1,
            opacity,
          }}
        >
          <Text style={{ color: GREEN, fontSize: 9, fontWeight: '700' }}>You</Text>
        </View>
      ) : null}
    </View>
  );
}

export function ReferenceTapMarker({
  layout,
  normalizedX,
  normalizedY,
}: {
  layout: VideoViewportLayout;
  normalizedX: number;
  normalizedY: number;
}) {
  const x = layout.offsetX + normalizedX * layout.renderedWidth;
  const y = layout.offsetY + normalizedY * layout.renderedHeight;
  return (
    <View pointerEvents="none" style={{ position: 'absolute', left: x - 8, top: y - 8 }}>
      <View
        style={{
          width: 16,
          height: 16,
          borderRadius: 8,
          backgroundColor: GREEN,
          borderWidth: 2,
          borderColor: '#fff',
        }}
      />
    </View>
  );
}

const GREEN_DIM = 'rgba(0, 230, 118, 0.55)';

export function PredictionRingOverlay({
  marker,
  layout,
}: {
  marker: MappedPlayerMarker;
  layout: VideoViewportLayout;
}) {
  const bbox = marker.box;
  const mappedBox = bbox ? mapVideoBoxToViewport(bbox, layout) : null;
  if (!mappedBox) return null;

  return (
    <View pointerEvents="none" style={{ position: 'absolute', left: 0, top: 0, right: 0, bottom: 0 }}>
      <View
        style={{
          position: 'absolute',
          left: mappedBox.x,
          top: mappedBox.y,
          width: mappedBox.width,
          height: mappedBox.height,
          borderWidth: 2,
          borderColor: GREEN_DIM,
          borderRadius: 4,
        }}
      />
    </View>
  );
}
