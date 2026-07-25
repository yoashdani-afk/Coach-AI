import { Pressable, Text } from 'react-native';

interface ChipProps {
  label: string;
  selected?: boolean;
  onPress?: () => void;
}

export function Chip({ label, selected = false, onPress }: ChipProps) {
  return (
    <Pressable
      onPress={onPress}
      disabled={!onPress}
      className={`px-4 py-2.5 rounded-full border ${selected ? 'bg-primary-muted border-primary' : 'bg-surface border-border'} active:opacity-80`}
    >
      <Text className={`text-sm font-medium ${selected ? 'text-primary' : 'text-text-secondary'}`}>
        {label}
      </Text>
    </Pressable>
  );
}
