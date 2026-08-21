import { View } from 'react-native';
import type { MappedPlayerMarker } from '@/lib/videoViewportMapping';
import { PLAYER_MARKER_ARROW_SHAFT_PX } from '@/lib/videoViewportMapping';
import type { TrackingState } from '@/types/analysis';

interface PlayerMarkerOverlayProps {
  marker: MappedPlayerMarker;
  state?: TrackingState | 'MANUAL';
  showArrow?: boolean;
}

function opacityForState(state: PlayerMarkerOverlayProps['state']): number {
  if (state === 'PROBABLE' || state === 'SEARCHING') return 0.72;
  if (state === 'LOST') return 0;
  return 1;
}

function colorForState(state: PlayerMarkerOverlayProps['state']): string {
  if (state === 'SEARCHING') return '#FFD54F';
  if (state === 'PROBABLE') return '#FFD54F';
  return '#00C853';
}

/**
 * Unified player marker — dot and arrow derive from the same mapped coordinates.
 * Manual reference screens use state="MANUAL".
 */
export function PlayerMarkerOverlay({
  marker,
  state = 'MANUAL',
  showArrow = true,
}: PlayerMarkerOverlayProps) {
  if (state === 'LOST') return null;

  const color = colorForState(state);
  const opacity = opacityForState(state);
  const dot = 5;
  const arrowHeight = PLAYER_MARKER_ARROW_SHAFT_PX;
  const arrowWidth = Math.max(10, arrowHeight * 0.65);

  const arrowLeft = marker.arrowTipX - arrowWidth / 2;
  const arrowTop = marker.arrowTipY - arrowHeight;

  return (
    <View pointerEvents="none" style={{ position: 'absolute', left: 0, top: 0, right: 0, bottom: 0 }}>
      {showArrow ? (
        <View
          style={{
            position: 'absolute',
            left: arrowLeft,
            top: arrowTop,
            width: arrowWidth,
            height: arrowHeight,
            alignItems: 'center',
            justifyContent: 'flex-end',
            opacity,
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
            }}
          />
        </View>
      ) : null}

      <View
        style={{
          position: 'absolute',
          left: marker.dotX - dot,
          top: marker.dotY - dot,
          width: dot * 2,
          height: dot * 2,
          borderRadius: dot,
          backgroundColor: color,
          borderWidth: 2,
          borderColor: '#FFFFFF',
          opacity,
        }}
      />
    </View>
  );
}

/** @deprecated Use PlayerMarkerOverlay — kept for import compatibility. */
export function PlayerSelectionMarker({ x, y }: { x: number; y: number }) {
  return (
    <PlayerMarkerOverlay
      marker={{
        dotX: x,
        dotY: y,
        arrowTipX: x,
        arrowTipY: y - 20,
        normalizedX: 0,
        normalizedY: 0,
        layout: {
          sourceWidth: 1,
          sourceHeight: 1,
          viewportWidth: 1,
          viewportHeight: 1,
          rotation: 0,
          resizeMode: 'contain',
          rotatedSourceWidth: 1,
          rotatedSourceHeight: 1,
          scale: 1,
          renderedWidth: 1,
          renderedHeight: 1,
          offsetX: 0,
          offsetY: 0,
        },
        box: null,
      }}
      state="MANUAL"
    />
  );
}
