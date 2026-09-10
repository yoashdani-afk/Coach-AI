import { Pressable, View, Text } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Card } from '@/components/ui';
import { scoreBandColor } from '@/lib/modeAccents';
import type { LeaderboardEntry } from '@/types/hallOfFame';

const HOF_GOLD = '#F5C542';
const MEDAL_SILVER = '#C0C7D1';
const MEDAL_BRONZE = '#CD7F32';
const PRIMARY_GREEN = '#00C853';

interface HallOfFameGoalCardProps {
  entry: LeaderboardEntry;
  onPress?: () => void;
  compact?: boolean;
  pinned?: boolean;
  /** When set, controls the "You" badge / openability instead of source === 'user'. */
  isOwn?: boolean;
}

function medalTone(rank: number): { fill: string; text: string; icon: boolean } {
  if (rank === 1) return { fill: HOF_GOLD, text: '#0D0D0F', icon: true };
  if (rank === 2) return { fill: MEDAL_SILVER, text: '#0D0D0F', icon: true };
  if (rank === 3) return { fill: MEDAL_BRONZE, text: '#FFFFFF', icon: true };
  return { fill: '#2E2E33', text: '#A0A0A8', icon: false };
}

function RankBadge({ rank }: { rank: number }) {
  const tone = medalTone(rank);
  const isPodium = rank <= 3;

  return (
    <View
      className="items-center justify-center"
      style={{
        width: isPodium ? 40 : 36,
        height: isPodium ? 40 : 36,
        borderRadius: isPodium ? 12 : 10,
        backgroundColor: isPodium ? tone.fill : `${HOF_GOLD}18`,
        borderWidth: isPodium ? 0 : 1,
        borderColor: isPodium ? undefined : `${HOF_GOLD}44`,
      }}
    >
      {tone.icon ? (
        <Ionicons name="medal" size={14} color={tone.text} style={{ marginBottom: 1 }} />
      ) : null}
      <Text
        className="font-bold"
        style={{
          color: isPodium ? tone.text : HOF_GOLD,
          fontSize: isPodium ? 11 : 12,
          lineHeight: isPodium ? 13 : 14,
        }}
      >
        #{rank}
      </Text>
    </View>
  );
}

function TagChip({ label, color }: { label: string; color: string }) {
  return (
    <View className="px-2 py-0.5 rounded-full" style={{ backgroundColor: `${color}33` }}>
      <Text className="text-[10px] font-semibold uppercase" style={{ color }}>
        {label}
      </Text>
    </View>
  );
}

export function HallOfFameGoalCard({
  entry,
  onPress,
  pinned = false,
  isOwn: isOwnProp,
}: HallOfFameGoalCardProps) {
  const { submission, rank } = entry;
  const isOwn = isOwnProp ?? false;
  const canOpen = Boolean(onPress && isOwn);
  const score = submission.score.overall;
  const scoreColor = scoreBandColor(score);

  const content = (
    <View className="flex-row items-center gap-3">
      <RankBadge rank={rank} />

      <View className="flex-1 gap-1.5">
        <View className="flex-row items-center gap-1.5 flex-wrap">
          <Text className="text-text-primary font-bold text-base flex-shrink" numberOfLines={1}>
            {submission.playerName}
          </Text>
          {pinned ? <TagChip label="Pinned" color={HOF_GOLD} /> : null}
          {isOwn ? <TagChip label="You" color={PRIMARY_GREEN} /> : null}
        </View>
        <View
          className="self-start px-2 py-0.5 rounded-full"
          style={{ backgroundColor: `${HOF_GOLD}22` }}
        >
          <Text className="text-[11px] font-medium" style={{ color: HOF_GOLD }} numberOfLines={1}>
            {submission.playTitle}
          </Text>
        </View>
      </View>

      <View
        className="items-center justify-center rounded-xl px-2.5 py-1.5 min-w-[52px]"
        style={{
          backgroundColor: `${scoreColor}22`,
          borderWidth: 1.5,
          borderColor: `${scoreColor}66`,
        }}
      >
        <Text className="text-xl font-bold" style={{ color: scoreColor }}>
          {score.toFixed(1)}
        </Text>
      </View>
    </View>
  );

  const card = (
    <Card
      variant="elevated"
      className="overflow-hidden"
      style={{
        borderLeftWidth: 2,
        borderLeftColor: `${HOF_GOLD}99`,
        borderWidth: 1,
        borderColor: isOwn ? `${HOF_GOLD}44` : '#2E2E33',
      }}
    >
      {content}
    </Card>
  );

  if (canOpen) {
    return (
      <Pressable onPress={onPress} className="active:opacity-85" accessibilityRole="button">
        {card}
      </Pressable>
    );
  }

  return card;
}
