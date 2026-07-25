import { View, Text } from 'react-native';

interface PlayerSelectionMarkerProps {
  x: number;
  y: number;
}

export function PlayerSelectionMarker({ x, y }: PlayerSelectionMarkerProps) {
  const size = 22;

  return (
    <View
      pointerEvents="none"
      style={{
        position: 'absolute',
        left: x - size,
        top: y - size,
        width: size * 2,
        height: size * 2 + 18,
        alignItems: 'center',
      }}
    >
      <View
        style={{
          width: size * 2,
          height: size * 2,
          borderRadius: size,
          borderWidth: 3,
          borderColor: '#00C853',
          backgroundColor: 'rgba(0, 200, 83, 0.25)',
          alignItems: 'center',
          justifyContent: 'center',
        }}
      >
        <View
          style={{
            width: size * 2 + 12,
            height: size * 2 + 12,
            borderRadius: size + 6,
            borderWidth: 2,
            borderColor: 'rgba(0, 200, 83, 0.45)',
            position: 'absolute',
          }}
        />
        <View
          style={{
            width: 8,
            height: 8,
            borderRadius: 4,
            backgroundColor: '#00C853',
          }}
        />
      </View>
      <Text
        className="text-primary text-xs font-bold mt-1"
        style={{ textShadowColor: '#000', textShadowRadius: 4, textShadowOffset: { width: 0, height: 1 } }}
      >
        You
      </Text>
    </View>
  );
}
