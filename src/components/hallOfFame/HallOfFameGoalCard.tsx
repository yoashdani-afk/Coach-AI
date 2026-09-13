import { Pressable, View, Text, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { scoreBandColor } from '@/lib/modeAccents';
import type { LeaderboardEntry } from '@/types/hallOfFame';

const HOF_GOLD = '#F5C542';
const HOF_GOLD_LIGHT = '#FFE08A';
const HOF_GOLD_DEEP = '#C9A227';
const MEDAL_SILVER = '#C0C7D1';
const MEDAL_SILVER_LIGHT = '#E8EEF5';
const MEDAL_BRONZE = '#CD7F32';
const MEDAL_BRONZE_LIGHT = '#E8A85C';
const PRIMARY_GREEN = '#00C853';
const SURFACE = '#141416';
const RADIUS = 20;

export type HallOfFameCardVariant = 'personal' | 'global';

interface HallOfFameGoalCardProps {
  entry: LeaderboardEntry;
  onPress?: () => void;
  compact?: boolean;
  pinned?: boolean;
  /** When set, controls the "You" badge / openability instead of source === 'user'. */
  isOwn?: boolean;
  /** Personal shelf vs public leaderboard — different surface language. */
  variant?: HallOfFameCardVariant;
}

function podiumPalette(rank: number): {
  fill: [string, string, string];
  rim: string;
  icon: string;
  label: string;
  glow: string;
} | null {
  if (rank === 1) {
    return {
      fill: [HOF_GOLD_LIGHT, HOF_GOLD, HOF_GOLD_DEEP],
      rim: 'rgba(255,224,138,0.85)',
      icon: '#1A1408',
      label: '#1A1408',
      glow: 'rgba(245,197,66,0.45)',
    };
  }
  if (rank === 2) {
    return {
      fill: [MEDAL_SILVER_LIGHT, MEDAL_SILVER, '#8A939E'],
      rim: 'rgba(232,238,245,0.7)',
      icon: '#1A1C20',
      label: '#1A1C20',
      glow: 'rgba(192,199,209,0.28)',
    };
  }
  if (rank === 3) {
    return {
      fill: [MEDAL_BRONZE_LIGHT, MEDAL_BRONZE, '#8B5A2B'],
      rim: 'rgba(232,168,92,0.65)',
      icon: '#1A1208',
      label: '#FFF8F0',
      glow: 'rgba(205,127,50,0.3)',
    };
  }
  return null;
}

function RankBadge({ rank, featured }: { rank: number; featured: boolean }) {
  const podium = podiumPalette(rank);

  if (!podium) {
    return (
      <View
        className="items-center justify-center"
        style={{
          width: 40,
          height: 40,
          borderRadius: 12,
          backgroundColor: 'rgba(255,255,255,0.05)',
          borderWidth: 1,
          borderColor: 'rgba(255,255,255,0.1)',
        }}
      >
        <Text style={{ color: '#A0A0A8', fontSize: 12, fontWeight: '700' }}>#{rank}</Text>
      </View>
    );
  }

  return (
    <View
      style={{
        width: featured ? 52 : 46,
        height: featured ? 52 : 46,
        borderRadius: featured ? 16 : 14,
        shadowColor: podium.glow,
        shadowOpacity: featured ? 0.9 : 0.55,
        shadowRadius: featured ? 14 : 8,
        shadowOffset: { width: 0, height: 2 },
        elevation: featured ? 10 : 5,
      }}
    >
      <LinearGradient
        colors={podium.fill}
        locations={[0, 0.45, 1]}
        start={{ x: 0.15, y: 0 }}
        end={{ x: 0.9, y: 1 }}
        style={{
          flex: 1,
          borderRadius: featured ? 16 : 14,
          alignItems: 'center',
          justifyContent: 'center',
          borderWidth: 1.5,
          borderColor: podium.rim,
          overflow: 'hidden',
        }}
      >
        {/* Shine highlight */}
        <View
          pointerEvents="none"
          style={{
            position: 'absolute',
            top: 0,
            left: 0,
            right: 0,
            height: '42%',
            backgroundColor: 'rgba(255,255,255,0.28)',
            borderTopLeftRadius: featured ? 14 : 12,
            borderTopRightRadius: featured ? 14 : 12,
          }}
        />
        <Ionicons
          name={rank === 1 ? 'trophy' : 'medal'}
          size={featured ? 16 : 14}
          color={podium.icon}
          style={{ marginBottom: 1 }}
        />
        <Text
          style={{
            color: podium.label,
            fontSize: featured ? 11 : 10,
            fontWeight: '800',
            letterSpacing: 0.2,
          }}
        >
          #{rank}
        </Text>
      </LinearGradient>
    </View>
  );
}

function StatusChip({
  label,
  tone,
}: {
  label: string;
  tone: 'gold' | 'green';
}) {
  const color = tone === 'gold' ? HOF_GOLD : PRIMARY_GREEN;
  return (
    <View
      className="flex-row items-center gap-1 px-2 py-0.5 rounded-md"
      style={{
        backgroundColor: `${color}18`,
        borderWidth: 1,
        borderColor: `${color}40`,
      }}
    >
      <Ionicons
        name={tone === 'gold' ? 'pin' : 'person'}
        size={9}
        color={color}
      />
      <Text
        style={{
          color,
          fontSize: 9,
          fontWeight: '700',
          letterSpacing: 0.7,
          textTransform: 'uppercase',
        }}
      >
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
  variant = 'personal',
}: HallOfFameGoalCardProps) {
  const { submission, rank } = entry;
  const isOwn = isOwnProp ?? false;
  const canOpen = Boolean(onPress);
  const score = submission.score.overall;
  const scoreColor = scoreBandColor(score);
  const featured = rank === 1;
  const isGlobal = variant === 'global';

  const surfaceGradient: [string, string] = isGlobal
    ? featured
      ? ['rgba(245,197,66,0.14)', 'rgba(18,18,22,0.98)']
      : ['rgba(255,255,255,0.05)', SURFACE]
    : featured
      ? ['rgba(245,197,66,0.20)', 'rgba(26,20,8,0.95)']
      : ['rgba(245,197,66,0.08)', SURFACE];

  const borderColor = featured
    ? 'rgba(245,197,66,0.55)'
    : isOwn
      ? 'rgba(245,197,66,0.32)'
      : isGlobal
        ? 'rgba(255,255,255,0.08)'
        : 'rgba(245,197,66,0.18)';

  const content = (
    <View
      className="overflow-hidden"
      style={{
        borderRadius: RADIUS,
        borderWidth: featured ? 1.5 : 1,
        borderColor,
        shadowColor: featured ? HOF_GOLD : '#000',
        shadowOpacity: featured ? 0.35 : 0.2,
        shadowRadius: featured ? 16 : 6,
        shadowOffset: { width: 0, height: featured ? 4 : 2 },
        elevation: featured ? 8 : 2,
      }}
    >
      <LinearGradient
        colors={surfaceGradient}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={{ padding: 14, gap: 12 }}
      >
        {featured ? (
          <View
            pointerEvents="none"
            style={{
              ...StyleSheet.absoluteFillObject,
              borderRadius: RADIUS,
              borderWidth: 1,
              borderColor: 'rgba(245,197,66,0.22)',
            }}
          />
        ) : null}

        <View className="flex-row items-center gap-3">
          <RankBadge rank={rank} featured={featured} />

          <View className="flex-1 gap-1.5">
            <View className="flex-row items-center gap-1.5 flex-wrap">
              <Text
                className="text-text-primary font-bold flex-shrink"
                style={{ fontSize: featured ? 16 : 15, letterSpacing: -0.2 }}
                numberOfLines={1}
              >
                {submission.playerName}
              </Text>
              {pinned ? <StatusChip label="Pinned" tone="gold" /> : null}
              {isOwn ? <StatusChip label="You" tone="green" /> : null}
            </View>
            <Text
              className="text-[12px] font-medium"
              style={{ color: featured ? HOF_GOLD_LIGHT : HOF_GOLD }}
              numberOfLines={1}
            >
              {submission.playTitle}
            </Text>
            {!isGlobal && submission.summary ? (
              <Text className="text-text-muted text-[11px] leading-4" numberOfLines={2}>
                {submission.summary}
              </Text>
            ) : null}
          </View>
        </View>

        {/* Score integrated as a footer strip — not a floating pill */}
        <View
          className="flex-row items-center justify-between pt-2.5"
          style={{ borderTopWidth: 1, borderTopColor: 'rgba(255,255,255,0.07)' }}
        >
          <View className="flex-row items-center gap-1.5">
            <Ionicons
              name={isGlobal ? 'globe-outline' : 'ribbon-outline'}
              size={13}
              color={isGlobal ? '#8A8A94' : HOF_GOLD}
            />
            <Text className="text-text-muted text-[11px]">
              {isGlobal ? 'Global rank' : 'Your play'} · {submission.positionLabel}
            </Text>
          </View>
          <View className="flex-row items-baseline gap-1">
            <Text
              style={{
                color: scoreColor,
                fontSize: featured ? 22 : 18,
                fontWeight: '800',
                letterSpacing: -0.4,
              }}
            >
              {score.toFixed(1)}
            </Text>
            <Text className="text-text-muted text-[11px] font-medium">/10</Text>
          </View>
        </View>
      </LinearGradient>
    </View>
  );

  if (canOpen) {
    return (
      <Pressable onPress={onPress} className="active:opacity-90" accessibilityRole="button">
        {content}
      </Pressable>
    );
  }

  return content;
}
