import { useEffect, useRef, type ComponentProps, type ReactNode } from 'react';
import { View, Text, Animated } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';

type IoniconName = ComponentProps<typeof Ionicons>['name'];

export const WELCOME_GREEN = '#00C853';
export const WELCOME_GOLD = '#F5C542';
export const WELCOME_BLUE = '#5B8DEF';
export const WELCOME_CORAL = '#FF6B8A';
export const WELCOME_VIOLET = '#A78BFA';

export type WelcomeSlideId = 'analysis' | 'training' | 'sessions';

export interface WelcomeSlide {
  id: WelcomeSlideId;
  accent: string;
  accentWash: string;
  title: string;
  description: string;
}

export const WELCOME_SLIDES: WelcomeSlide[] = [
  {
    id: 'analysis',
    accent: WELCOME_GOLD,
    accentWash: 'rgba(245, 197, 66, 0.28)',
    title: 'Rate your goals. Analyze your game.',
    description:
      'Two focused modes — Rate This Goal scores your best finishes, Analyze My Performance breaks down your decisions, positioning, and movement.',
  },
  {
    id: 'training',
    accent: WELCOME_GREEN,
    accentWash: 'rgba(0, 200, 83, 0.20)',
    title: 'Every weakness, matched to real drills',
    description:
      'Physical, Technical, Tactical, Mental, Recovery — five real training categories, with hundreds of drills pulled straight from your report.',
  },
  {
    id: 'sessions',
    accent: WELCOME_CORAL,
    accentWash: 'rgba(255, 107, 138, 0.22)',
    title: 'Personalized Sessions. A Weekly Regimen.',
    description:
      'Answer a few questions, get a tailored session for today — or build a full week around your school, team training, and match days.',
  },
];

const MOCK_CATEGORY_SCORES = [
  { label: 'Finish', score: 9.2 },
  { label: 'Technique', score: 8.6 },
  { label: 'Creativity', score: 8.1 },
] as const;

function categoryBarColor(score: number): string {
  if (score >= 8) return WELCOME_GREEN;
  if (score >= 6.5) return '#69F0AE';
  return '#FFB300';
}

function SlideHeroShell({
  accentWash,
  children,
}: {
  accentWash: string;
  children: ReactNode;
}) {
  return (
    <View className="w-full mb-6" style={{ minHeight: 260 }} pointerEvents="box-none">
      <View className="rounded-[28px] overflow-hidden" pointerEvents="box-none">
        <LinearGradient
          colors={[accentWash, 'rgba(13, 13, 15, 0.95)', '#0D0D0F']}
          locations={[0, 0.55, 1]}
          start={{ x: 0.5, y: 0 }}
          end={{ x: 0.5, y: 1 }}
          pointerEvents="none"
          style={{
            position: 'absolute',
            top: 0,
            right: 0,
            bottom: 0,
            left: 0,
          }}
        />
        <View
          pointerEvents="box-none"
          style={{
            alignItems: 'center',
            justifyContent: 'center',
            paddingHorizontal: 16,
            paddingVertical: 20,
          }}
        >
          {children}
        </View>
      </View>
    </View>
  );
}

function MiniCategoryBars() {
  return (
    <View
      className="gap-1.5 mt-3 pt-3"
      style={{ borderTopWidth: 1, borderTopColor: 'rgba(255,255,255,0.08)' }}
    >
      {MOCK_CATEGORY_SCORES.map((row) => {
        const pct = Math.min(100, (row.score / 10) * 100);
        const color = categoryBarColor(row.score);
        return (
          <View key={row.label} className="flex-row items-center gap-2">
            <Text className="text-[10px] text-text-secondary w-14" numberOfLines={1}>
              {row.label}
            </Text>
            <View
              className="flex-1 h-1.5 rounded-full overflow-hidden"
              style={{ backgroundColor: 'rgba(255,255,255,0.08)' }}
            >
              <View
                className="h-full rounded-full"
                style={{ width: `${pct}%`, backgroundColor: color }}
              />
            </View>
            <Text className="text-[10px] font-bold w-6 text-right" style={{ color }}>
              {row.score.toFixed(1)}
            </Text>
          </View>
        );
      })}
    </View>
  );
}

/** Subtle pulse/glow on the score — RN Animated (no Reanimated usage elsewhere in app UI). */
function PulsingScore({ value }: { value: string }) {
  const pulse = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(pulse, {
          toValue: 1,
          duration: 1100,
          useNativeDriver: true,
        }),
        Animated.timing(pulse, {
          toValue: 0,
          duration: 1100,
          useNativeDriver: true,
        }),
      ])
    );
    loop.start();
    return () => loop.stop();
  }, [pulse]);

  const scale = pulse.interpolate({
    inputRange: [0, 1],
    outputRange: [1, 1.06],
  });
  const glowOpacity = pulse.interpolate({
    inputRange: [0, 1],
    outputRange: [0.25, 0.7],
  });

  return (
    <View className="items-center justify-center" style={{ minWidth: 72 }}>
      <Animated.View
        pointerEvents="none"
        style={{
          position: 'absolute',
          width: 56,
          height: 56,
          borderRadius: 28,
          backgroundColor: WELCOME_GREEN,
          opacity: glowOpacity,
          transform: [{ scale }],
        }}
      />
      <Animated.Text
        className="text-2xl font-bold"
        style={{
          color: WELCOME_GREEN,
          lineHeight: 28,
          transform: [{ scale }],
          textShadowColor: WELCOME_GREEN,
          textShadowRadius: 10,
          textShadowOffset: { width: 0, height: 0 },
        }}
      >
        {value}
      </Animated.Text>
    </View>
  );
}

function AnalysisHero() {
  return (
    <SlideHeroShell accentWash="rgba(245, 197, 66, 0.28)">
      <View className="w-full" style={{ maxWidth: 360 }} pointerEvents="none">
        <View
          className="self-start mb-3 px-2.5 py-1 rounded-full"
          style={{ backgroundColor: `${WELCOME_GREEN}33` }}
        >
          <Text
            className="text-[10px] font-bold uppercase tracking-wide"
            style={{ color: WELCOME_GREEN }}
          >
            AI Coach
          </Text>
        </View>

        <View
          className="rounded-2xl overflow-hidden border"
          style={{ borderColor: `${WELCOME_GOLD}44` }}
        >
          <LinearGradient
            colors={['#0F2A18', '#12241A', '#0D0D0F']}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            style={{ padding: 14 }}
          >
            <View
              pointerEvents="none"
              style={{
                position: 'absolute',
                top: 0,
                right: 0,
                bottom: 0,
                left: 0,
                opacity: 0.18,
              }}
            >
              <View
                style={{
                  position: 'absolute',
                  left: '12%',
                  right: '12%',
                  top: '12%',
                  height: '42%',
                  borderWidth: 1,
                  borderColor: WELCOME_GREEN,
                  borderRadius: 8,
                }}
              />
              <View
                style={{
                  position: 'absolute',
                  top: '22%',
                  width: 48,
                  height: 48,
                  borderRadius: 24,
                  borderWidth: 1,
                  borderColor: WELCOME_GREEN,
                  left: '50%',
                  marginLeft: -24,
                }}
              />
            </View>

            <View className="flex-row items-start justify-between mb-4">
              <View
                className="px-2.5 py-1 rounded-full"
                style={{ backgroundColor: `${WELCOME_GOLD}22` }}
              >
                <Text className="text-[11px] font-semibold" style={{ color: WELCOME_GOLD }}>
                  Bicycle Kick
                </Text>
              </View>
              <Ionicons name="football-outline" size={22} color={`${WELCOME_GOLD}99`} />
            </View>

            <View className="flex-row items-end justify-between">
              <View className="gap-1.5">
                <Text className="text-text-primary font-semibold text-sm">Alex · ST</Text>
                <View
                  className="self-start px-2 py-0.5 rounded-full"
                  style={{ backgroundColor: 'rgba(255,255,255,0.08)' }}
                >
                  <Text className="text-[10px] font-medium text-text-secondary">
                    🧊 Ice Cold Finish
                  </Text>
                </View>
              </View>

              <View
                className="items-center justify-center rounded-2xl px-3 py-2"
                style={{
                  backgroundColor: `${WELCOME_GREEN}22`,
                  borderWidth: 1,
                  borderColor: `${WELCOME_GREEN}66`,
                  minWidth: 76,
                }}
              >
                <View
                  className="px-1.5 py-0.5 rounded-full mb-1"
                  style={{ backgroundColor: `${WELCOME_GOLD}22` }}
                >
                  <Text
                    className="text-[8px] font-bold uppercase tracking-wide"
                    style={{ color: WELCOME_GOLD }}
                  >
                    Rate This Goal
                  </Text>
                </View>
                <PulsingScore value="8.7" />
              </View>
            </View>

            <MiniCategoryBars />
          </LinearGradient>
        </View>
      </View>
    </SlideHeroShell>
  );
}

function SatelliteTile({
  icon,
  label,
  color,
}: {
  icon: IoniconName;
  label: string;
  color: string;
}) {
  return (
    <View className="items-center gap-1.5" pointerEvents="none">
      <View
        className="w-14 h-14 rounded-2xl items-center justify-center border"
        style={{ backgroundColor: `${color}22`, borderColor: `${color}44` }}
      >
        <Ionicons name={icon} size={24} color={color} />
      </View>
      <Text className="text-[10px] font-medium text-text-secondary">{label}</Text>
    </View>
  );
}

function TrainingHero() {
  return (
    <SlideHeroShell accentWash="rgba(0, 200, 83, 0.20)">
      <View className="items-center" pointerEvents="none">
        <View className="flex-row items-end gap-4 mb-1">
          <SatelliteTile icon="grid-outline" label="Tactical" color={WELCOME_BLUE} />
          <View className="items-center gap-1.5 mb-2">
            <View
              className="w-[120px] h-[120px] rounded-3xl items-center justify-center border"
              style={{
                backgroundColor: `${WELCOME_GREEN}22`,
                borderColor: `${WELCOME_GREEN}55`,
              }}
            >
              <Ionicons name="football-outline" size={52} color={WELCOME_GREEN} />
            </View>
            <Text className="text-[10px] font-medium text-text-secondary">Technical</Text>
          </View>
          <SatelliteTile icon="bulb-outline" label="Mental" color={WELCOME_VIOLET} />
        </View>
      </View>
    </SlideHeroShell>
  );
}

const WEEK_DAYS = [
  { label: 'Mon', active: true },
  { label: 'Tue', active: false },
  { label: 'Wed', active: false },
  { label: 'Thu', active: false },
] as const;

function SessionsHero() {
  return (
    <SlideHeroShell accentWash="rgba(255, 107, 138, 0.22)">
      <View className="items-center w-full gap-4" pointerEvents="none">
        <View
          className="w-[120px] h-[120px] rounded-3xl items-center justify-center border"
          style={{
            backgroundColor: `${WELCOME_CORAL}22`,
            borderColor: `${WELCOME_CORAL}55`,
          }}
        >
          <Ionicons name="calendar-outline" size={52} color={WELCOME_CORAL} />
        </View>

        <View
          className="px-2.5 py-1 rounded-full"
          style={{ backgroundColor: `${WELCOME_CORAL}22`, borderWidth: 1, borderColor: `${WELCOME_CORAL}55` }}
        >
          <Text
            className="text-[10px] font-bold uppercase tracking-wide"
            style={{ color: WELCOME_CORAL }}
          >
            Weekly Regimen
          </Text>
        </View>

        <View className="flex-row gap-2">
          {WEEK_DAYS.map((day) => (
            <View
              key={day.label}
              className="px-3.5 py-2 rounded-full border"
              style={{
                backgroundColor: day.active ? `${WELCOME_CORAL}33` : 'rgba(255,255,255,0.04)',
                borderColor: day.active ? `${WELCOME_CORAL}66` : '#2E2E33',
              }}
            >
              <Text
                className="text-xs font-semibold"
                style={{ color: day.active ? WELCOME_CORAL : '#6B6B73' }}
              >
                {day.label}
              </Text>
            </View>
          ))}
        </View>
      </View>
    </SlideHeroShell>
  );
}

export function WelcomeSlideHero({ slideId }: { slideId: WelcomeSlideId }) {
  switch (slideId) {
    case 'analysis':
      return <AnalysisHero />;
    case 'training':
      return <TrainingHero />;
    case 'sessions':
      return <SessionsHero />;
  }
}
