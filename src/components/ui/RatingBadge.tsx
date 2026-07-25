import { Text, View } from 'react-native';

interface RatingBadgeProps {
  rating: number;
  size?: 'sm' | 'lg';
}

export function RatingBadge({ rating, size = 'lg' }: RatingBadgeProps) {
  const isLarge = size === 'lg';
  return (
    <View className={`items-center justify-center rounded-2xl bg-surface-elevated border border-border ${isLarge ? 'px-8 py-4' : 'px-4 py-2'}`}>
      <Text className={`font-bold text-primary ${isLarge ? 'text-5xl' : 'text-2xl'}`}>
        {rating.toFixed(1)}
      </Text>
      {isLarge ? <Text className="text-text-muted text-sm mt-1">out of 10</Text> : null}
    </View>
  );
}
