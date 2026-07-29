import { View } from 'react-native';
import type { MappedTrackingMarker } from '@/lib/trackingMarkerLayout';
import type { TrackingState } from '@/types/analysis';

interface TrackingArrowMarkerProps {
  mapped: MappedTrackingMarker;
  state: TrackingState;
}

/** Small arrow — tip points at the player's head. Hidden when LOST. */
export function TrackingArrowMarker({ mapped, state }: TrackingArrowMarkerProps) {
  if (state === 'LOST') return null;

  const { headX, headY, arrowWidth, arrowHeight, headGapPx } = mapped;
  const color = state === 'CONFIRMED' ? '#00C853' : '#FFD54F';
  const left = headX - arrowWidth / 2;
  const top = headY - arrowHeight - headGapPx;

  return (
    <View
      pointerEvents="none"
      style={{
        position: 'absolute',
        left,
        top,
        width: arrowWidth,
        height: arrowHeight,
        alignItems: 'center',
        justifyContent: 'flex-end',
      }}
    >
      <View
        style={{
          width: 0,
          height: 0,
          borderLeftWidth: arrowWidth / 2,
          borderRightWidth: arrowWidth / 2,
          borderTopWidth: arrowHeight,
          borderLeftColor: 'transparent',
          borderRightColor: 'transparent',
          borderTopColor: color,
          opacity: state === 'PROBABLE' ? 0.75 : 1,
        }}
      />
    </View>
  );
}
