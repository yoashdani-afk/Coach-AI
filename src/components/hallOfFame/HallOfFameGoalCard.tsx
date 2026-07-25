import { Pressable, View, Text } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { GoalThumbnail } from '@/components/hallOfFame/GoalThumbnail';
import { Card } from '@/components/ui';
import type { LeaderboardEntry } from '@/types/hallOfFame';

interface HallOfFameGoalCardProps {
  entry: LeaderboardEntry;
  onViewReport?: () => void;
  compact?: boolean;
}

export function HallOfFameGoalCard({ entry, onViewReport, compact = false }: HallOfFameGoalCardProps) {
  const { submission, rank } = entry;
  const isOwn = submission.source === 'user';

  return (
    <Card
      variant={isOwn ? 'elevated' : 'outlined'}
      className={`overflow-hidden p-0 ${isOwn ? 'border border-primary/40' : ''}`}
    >
      <View className={`flex-row ${compact ? 'min-h-[100px]' : 'min-h-[120px]'}`}>
        <GoalThumbnail
          uri={submission.clipUri}
          timestampMs={submission.thumbnailTimestampMs}
          className={`${compact ? 'w-24' : 'w-28'} self-stretch`}
        />

        <View className="flex-1 p-3 gap-2 justify-center">
          <View className="flex-row items-start justify-between gap-2">
            <View className="flex-1">
              <View className="flex-row items-center gap-2 flex-wrap">
                <Text className="text-text-primary font-semibold text-base" numberOfLines={1}>
                  {submission.playerName}
                </Text>
                {isOwn ? (
                  <View className="bg-primary-muted px-2 py-0.5 rounded-full">
                    <Text className="text-primary text-[10px] font-semibold uppercase">You</Text>
                  </View>
                ) : null}
              </View>
              <Text className="text-text-muted text-xs mt-0.5">{submission.positionLabel}</Text>
            </View>
            <View className="items-end">
              <Text className="text-text-muted text-[10px] uppercase">#{rank}</Text>
              <Text className="text-primary text-lg font-bold">
                {submission.score.overall.toFixed(1)}
              </Text>
              <Text className="text-text-muted text-[10px]">Demo</Text>
            </View>
          </View>

          <View className="flex-row items-center gap-1.5">
            <Text className="text-base">{submission.award.emoji}</Text>
            <Text className="text-text-secondary text-xs font-medium flex-1" numberOfLines={1}>
              {submission.award.label}
            </Text>
          </View>

          {onViewReport && submission.source === 'user' ? (
            <Pressable onPress={onViewReport} className="flex-row items-center gap-1 active:opacity-70 mt-1">
              <Text className="text-primary text-xs font-semibold">View Report</Text>
              <Ionicons name="chevron-forward" size={12} color="#00C853" />
            </Pressable>
          ) : submission.source === 'demo' ? (
            <Text className="text-text-muted text-[10px] mt-1">Demo entry</Text>
          ) : null}
        </View>
      </View>
    </Card>
  );
}
