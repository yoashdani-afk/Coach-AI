import { View, Text } from 'react-native';
import { Button } from '@/components/ui';

interface EmptyStateProps {
  title: string;
  description: string;
  actionLabel?: string;
  onAction?: () => void;
  icon?: string;
}

export function EmptyState({
  title,
  description,
  actionLabel,
  onAction,
  icon = '⚽',
}: EmptyStateProps) {
  return (
    <View className="flex-1 items-center justify-center px-8 py-12">
      <Text className="text-5xl mb-4">{icon}</Text>
      <Text className="text-text-primary text-xl font-semibold text-center mb-2">{title}</Text>
      <Text className="text-text-secondary text-base text-center mb-8 leading-6">{description}</Text>
      {actionLabel && onAction ? <Button label={actionLabel} onPress={onAction} fullWidth /> : null}
    </View>
  );
}
