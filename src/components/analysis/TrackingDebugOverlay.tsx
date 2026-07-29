import { View, Text } from 'react-native';
import { SHOW_TRACKING_DEBUG } from '@/lib/trackingConfig';
import type { MappedTrackingMarker, VideoContentLayout } from '@/lib/trackingMarkerLayout';
import type { TrackingState } from '@/types/analysis';

interface TrackingDebugOverlayProps {
  layout: VideoContentLayout;
  mapped: MappedTrackingMarker | null;
  state: TrackingState | null;
}

export function TrackingDebugOverlay({ layout, mapped, state }: TrackingDebugOverlayProps) {
  if (!SHOW_TRACKING_DEBUG) return null;

  const { contentRect } = layout;

  return (
    <View pointerEvents="none" style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0 }}>
      <View
        style={{
          position: 'absolute',
          left: contentRect.x,
          top: contentRect.y,
          width: contentRect.width,
          height: contentRect.height,
          borderWidth: 1,
          borderColor: 'rgba(0, 200, 83, 0.55)',
          borderStyle: 'dashed',
        }}
      />

      {mapped ? (
        <View
          style={{
            position: 'absolute',
            left: layout.offsetX + mapped.box.x * layout.contentRect.width,
            top: layout.offsetY + mapped.box.y * layout.contentRect.height,
            width: mapped.box.width * layout.contentRect.width,
            height: mapped.box.height * layout.contentRect.height,
            borderWidth: 1,
            borderColor: '#FF5252',
          }}
        />
      ) : null}

      <View
        style={{
          position: 'absolute',
          left: 4,
          top: 4,
          backgroundColor: 'rgba(0,0,0,0.72)',
          borderRadius: 6,
          paddingHorizontal: 6,
          paddingVertical: 4,
        }}
      >
        <Text style={{ color: '#AAA', fontSize: 9, lineHeight: 12 }}>
          src {layout.sourceWidth}×{layout.sourceHeight} · render {Math.round(layout.containerWidth)}×
          {Math.round(layout.containerHeight)}
        </Text>
        <Text style={{ color: '#AAA', fontSize: 9, lineHeight: 12 }}>
          scale {layout.scale.toFixed(3)} · offset {layout.offsetX.toFixed(1)},{layout.offsetY.toFixed(1)}
        </Text>
        {mapped ? (
          <Text style={{ color: '#AAA', fontSize: 9, lineHeight: 12 }}>
            head {mapped.headX.toFixed(0)},{mapped.headY.toFixed(0)} · state {state ?? '—'}
          </Text>
        ) : null}
      </View>
    </View>
  );
}
