import { View } from 'react-native';
import type { MappedTrackingMarker } from '@/lib/trackingMarkerLayout';
import type { TrackingState } from '@/types/analysis';

interface TrackingArrowMarkerProps {
  mapped: MappedTrackingMarker;
  state: TrackingState;
}

/** @deprecated Use TrackingMarkerOverlay chevron instead. */
export function TrackingArrowMarker({ mapped, state }: TrackingArrowMarkerProps) {
  if (state === 'LOST' || state === 'SEARCHING') return null;

  const chevronW = 10;
  const chevronH = 6;
  const left = mapped.arrowTipX - chevronW / 2;
  const top = mapped.arrowTipY - chevronH;
  const color = state === 'CONFIRMED' ? '#00C853' : '#FFD54F';
  const opacity = state === 'PROBABLE' ? 0.55 : 1;

  return (
    <View
      pointerEvents="none"
      style={{
        position: 'absolute',
        left,
        top,
        width: 0,
        height: 0,
        borderLeftWidth: chevronW / 2,
        borderRightWidth: chevronW / 2,
        borderBottomWidth: chevronH,
        borderLeftColor: 'transparent',
        borderRightColor: 'transparent',
        borderBottomColor: color,
        opacity,
      }}
    />
  );
}
