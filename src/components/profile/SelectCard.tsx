import { View, Text, Pressable } from 'react-native';
import type { ComponentProps } from 'react';
import { Ionicons } from '@expo/vector-icons';

type IoniconName = ComponentProps<typeof Ionicons>['name'];

interface SelectCardProps {
  label: string;
  description?: string;
  icon?: IoniconName;
  selected?: boolean;
  onPress: () => void;
  compact?: boolean;
}

export function SelectCard({
  label,
  description,
  icon,
  selected = false,
  onPress,
  compact = false,
}: SelectCardProps) {
  return (
    <Pressable
      onPress={onPress}
      className={`rounded-2xl border p-4 active:opacity-80 ${
        selected ? 'bg-primary-muted border-primary' : 'bg-surface border-border'
      } ${compact ? 'min-h-[72px]' : 'min-h-[88px]'}`}
    >
      {icon ? (
        <Ionicons
          name={icon}
          size={22}
          color={selected ? '#00C853' : '#A0A0A8'}
          style={{ marginBottom: 8 }}
        />
      ) : null}
      <Text className={`font-semibold ${selected ? 'text-primary' : 'text-text-primary'} ${compact ? 'text-sm' : 'text-base'}`}>
        {label}
      </Text>
      {description ? (
        <Text className="text-text-muted text-xs mt-1">{description}</Text>
      ) : null}
    </Pressable>
  );
}

interface SelectGridProps {
  children: React.ReactNode;
  columns?: 2 | 3;
}

export function SelectGrid({ children, columns = 2 }: SelectGridProps) {
  return (
    <View className={`flex-row flex-wrap gap-3 ${columns === 2 ? '' : ''}`}>
      {children}
    </View>
  );
}

export function SelectGridItem({ children }: { children: React.ReactNode }) {
  return <View className="w-[48%]">{children}</View>;
}

interface SetupProgressProps {
  step: number;
  total: number;
}

export function SetupProgress({ step, total }: SetupProgressProps) {
  const pct = Math.round((step / total) * 100);
  return (
    <View className="mb-6">
      <View className="flex-row justify-between mb-2">
        <Text className="text-text-muted text-sm">Step {step} of {total}</Text>
        <Text className="text-text-muted text-sm">{pct}%</Text>
      </View>
      <View className="h-1.5 bg-surface-elevated rounded-full overflow-hidden">
        <View className="h-full bg-primary rounded-full" style={{ width: `${pct}%` }} />
      </View>
    </View>
  );
}
