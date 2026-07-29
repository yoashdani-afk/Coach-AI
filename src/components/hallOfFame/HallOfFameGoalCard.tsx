import { Pressable, View, Text } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { GoalThumbnail } from '@/components/hallOfFame/GoalThumbnail';
import { Card } from '@/components/ui';
import { labelForAnalysisMode } from '@/lib/constants';
import type { LeaderboardEntry } from '@/types/hallOfFame';

interface HallOfFameGoalCardProps {
  entry: LeaderboardEntry;
  onPress?: () => void;
  compact?: boolean;
  pinned?: boolean;
}

export function HallOfFameGoalCard({
  entry,
  onPress,
  compact = false,
  pinned = false,
}: HallOfFameGoalCardProps) {
  const { submission, rank } = entry;
  const isOwn = submission.source === 'user';

  const content = (
    <View className={`flex-row items-center gap-3 ${compact ? 'min-h-[72px]' : 'min-h-[80px]'}`}>
      <GoalThumbnail
        uri={submission.clipUri}
        timestampMs={submission.thumbnailTimestampMs}
        focalNormalizedY={submission.thumbnailFocalY}
        compact={compact}
      />

      <View className="flex-1 p-3 gap-1.5 justify-center">
        <View className="flex-row items-start justify-between gap-2">
          <View className="flex-1">
            <View className="flex-row items-center gap-2 flex-wrap">
              <Text className="text-text-primary font-semibold text-base flex-1" numberOfLines={1}>
                {submission.playTitle}
              </Text>
              {pinned ? (
                <View className="bg-primary-muted px-2 py-0.5 rounded-full">
                  <Text className="text-primary text-[10px] font-semibold uppercase">Pinned</Text>
                </View>
              ) : null}
              {isOwn ? (
                <View className="bg-primary-muted px-2 py-0.5 rounded-full">
                  <Text className="text-primary text-[10px] font-semibold uppercase">You</Text>
                </View>
              ) : null}
            </View>
            <Text className="text-text-muted text-xs mt-0.5">
              {submission.playerName} · {submission.positionLabel}
            </Text>
            <Text className="text-text-muted text-[10px] mt-0.5">
              {labelForAnalysisMode(submission.analysisMode)}
            </Text>
          </View>
          <View className="items-end">
            <Text className="text-text-muted text-[10px] uppercase">#{rank}</Text>
            <Text className="text-primary text-lg font-bold">
              {submission.score.overall.toFixed(1)}
            </Text>
          </View>
        </View>

        {submission.summary ? (
          <Text className="text-text-secondary text-xs leading-4" numberOfLines={compact ? 2 : 3}>
            {submission.summary}
          </Text>
        ) : null}

        <View className="flex-row items-center gap-1.5">
          <Text className="text-base">{submission.award.emoji}</Text>
          <Text className="text-text-secondary text-xs font-medium flex-1" numberOfLines={1}>
            {submission.award.label}
          </Text>
        </View>

        {onPress && submission.source === 'user' ? (
          <View className="flex-row items-center gap-1 mt-1">
            <Text className="text-primary text-xs font-semibold">View full report</Text>
            <Ionicons name="chevron-forward" size={12} color="#00C853" />
          </View>
        ) : submission.source === 'demo' ? (
          <Text className="text-text-muted text-[10px] mt-1">Demo entry</Text>
        ) : null}
      </View>
    </View>
  );

  if (onPress && submission.source === 'user') {
    return (
      <Pressable onPress={onPress} className="active:opacity-85">
        <Card
          variant={isOwn ? 'elevated' : 'outlined'}
          className={`overflow-hidden p-0 ${isOwn ? 'border border-primary/40' : ''}`}
        >
          {content}
        </Card>
      </Pressable>
    );
  }

  return (
    <Card
      variant={isOwn ? 'elevated' : 'outlined'}
      className={`overflow-hidden p-0 ${isOwn ? 'border border-primary/40' : ''}`}
    >
      {content}
    </Card>
  );
}
