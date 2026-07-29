import { View } from 'react-native';

interface PlayerSelectionMarkerProps {
  x: number;
  y: number;
}

/** Corner bracket + dot — marker offset so kit/body stays visible. */
export function PlayerSelectionMarker({ x, y }: PlayerSelectionMarkerProps) {
  const bracket = 16;
  const stroke = 3;
  const dot = 5;
  const bracketLeft = x + 10;
  const bracketTop = y - 36;

  return (
    <View pointerEvents="none" style={{ position: 'absolute', left: 0, top: 0, right: 0, bottom: 0 }}>
      <View
        style={{
          position: 'absolute',
          left: bracketLeft,
          top: bracketTop,
          width: bracket,
          height: bracket,
          borderTopWidth: stroke,
          borderLeftWidth: stroke,
          borderColor: '#00C853',
        }}
      />
      <View
        style={{
          position: 'absolute',
          left: bracketLeft + bracket - stroke,
          top: bracketTop + bracket - stroke / 2,
          width: Math.max(12, x - (bracketLeft + bracket) + stroke),
          height: stroke,
          backgroundColor: '#00C853',
          transform: [{ rotate: '32deg' }],
        }}
      />
      <View
        style={{
          position: 'absolute',
          left: x - dot,
          top: y - dot,
          width: dot * 2,
          height: dot * 2,
          borderRadius: dot,
          backgroundColor: '#00C853',
          borderWidth: 2,
          borderColor: '#FFFFFF',
        }}
      />
    </View>
  );
}
