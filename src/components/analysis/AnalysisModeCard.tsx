import { Pressable, View, Text } from 'react-native';
import type { ComponentProps } from 'react';
import { Ionicons } from '@expo/vector-icons';
import type { AnalysisMode } from '@/types/analysis';
import { ANALYSIS_MODES } from '@/lib/constants';

type IoniconName = ComponentProps<typeof Ionicons>['name'];

interface AnalysisModeCardProps {
  mode: AnalysisMode;
  onPress: () => void;
}

export function AnalysisModeCard({ mode, onPress }: AnalysisModeCardProps) {
  const config = ANALYSIS_MODES.find((m) => m.mode === mode);
  if (!config) return null;

  const isPrimary = config.primary === true;

  return (
    <Pressable
      onPress={onPress}
      className={`rounded-2xl border overflow-hidden active:opacity-90 ${
        isPrimary ? 'border-primary bg-primary-muted/30' : 'border-border bg-surface'
      }`}
    >
      {isPrimary ? (
        <View className="bg-primary/10 px-4 py-1.5 border-b border-primary/20">
          <Text className="text-primary text-xs font-semibold uppercase tracking-wider">
            Recommended
          </Text>
        </View>
      ) : null}

      <View className="p-5 gap-4">
        <View className="flex-row items-start gap-4">
          <View
            className={`w-14 h-14 rounded-2xl items-center justify-center ${
              isPrimary ? 'bg-primary/20' : 'bg-surface-elevated'
            }`}
          >
            <Text className="text-2xl">{config.emoji}</Text>
          </View>
          <View className="flex-1 gap-1">
            <View className="flex-row items-center gap-2">
              <Text className="text-text-primary text-xl font-bold">{config.label}</Text>
              <Ionicons
                name={config.icon as IoniconName}
                size={18}
                color={isPrimary ? '#00C853' : '#6B6B73'}
              />
            </View>
            <Text className="text-text-secondary text-sm leading-5">{config.description}</Text>
          </View>
          <Ionicons name="chevron-forward" size={20} color={isPrimary ? '#00C853' : '#6B6B73'} />
        </View>

        <View className="gap-2">
          {config.examples.map((example) => (
            <View key={example} className="flex-row items-center gap-2">
              <View className="w-1.5 h-1.5 rounded-full bg-text-muted" />
              <Text className="text-text-muted text-sm flex-1">{example}</Text>
            </View>
          ))}
        </View>
      </View>
    </Pressable>
  );
}
