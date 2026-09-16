import { useEffect, useState, type ComponentProps } from 'react';
import { View, Text, AccessibilityInfo, StyleSheet } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import Animated, {
  Easing,
  FadeIn,
  FadeInDown,
  FadeInRight,
  FadeInUp,
  interpolate,
  useAnimatedStyle,
  useSharedValue,
  withDelay,
  withRepeat,
  withSequence,
  withSpring,
  withTiming,
  ZoomIn,
} from 'react-native-reanimated';

type IoniconName = ComponentProps<typeof Ionicons>['name'];

export const WELCOME_GREEN = '#00C853';
export const WELCOME_GOLD = '#F5C542';
export const WELCOME_BLUE = '#5B8DEF';
export const WELCOME_CORAL = '#FF6B8A';
export const WELCOME_VIOLET = '#A78BFA';
export const WELCOME_ORANGE = '#FF8A3D';

export const WELCOME_DISPLAY_FONT = 'BarlowCondensed_700Bold';
export const WELCOME_DISPLAY_FONT_SEMIBOLD = 'BarlowCondensed_600SemiBold';

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
    accentWash: 'rgba(245, 197, 66, 0.38)',
    title: 'Rate your goals.\nAnalyze your game.',
    description:
      'Two focused modes — Rate This Goal scores your best finishes, Analyze My Performance breaks down your decisions, positioning, and movement.',
  },
  {
    id: 'training',
    accent: WELCOME_GREEN,
    accentWash: 'rgba(0, 200, 83, 0.32)',
    title: 'Every weakness,\nmatched to real drills',
    description:
      'Physical, Technical, Tactical, Mental, Recovery — five training categories with hundreds of drills pulled straight from your report.',
  },
  {
    id: 'sessions',
    accent: WELCOME_CORAL,
    accentWash: 'rgba(255, 107, 138, 0.34)',
    title: 'Personalized sessions.\nA weekly regimen.',
    description:
      'Answer a few questions, get a tailored session for today — or build a full week around school, team training, and match days.',
  },
];

const CATEGORY_SCORES = [
  { label: 'Finish', score: 9.2 },
  { label: 'Technique', score: 8.6 },
  { label: 'Creativity', score: 8.1 },
] as const;

const TRAINING_TILES: { label: string; icon: IoniconName; color: string; span?: 'hero' | 'wide' }[] = [
  { label: 'Technical', icon: 'football-outline', color: WELCOME_GREEN, span: 'hero' },
  { label: 'Physical', icon: 'flash-outline', color: WELCOME_ORANGE },
  { label: 'Tactical', icon: 'grid-outline', color: WELCOME_BLUE },
  { label: 'Mental', icon: 'bulb-outline', color: WELCOME_VIOLET },
  { label: 'Recovery', icon: 'leaf-outline', color: WELCOME_CORAL, span: 'wide' },
];

const WEEK = [
  { day: 'MON', title: 'Speed & Finish', meta: '42 min · Pitch', active: true },
  { day: 'TUE', title: 'Team training', meta: 'Club · Evening', active: false },
  { day: 'WED', title: 'Rest / Recovery', meta: 'Mobility', active: false },
  { day: 'THU', title: '1v1 Decisions', meta: '28 min · Cage', active: false },
] as const;

function barColor(score: number): string {
  if (score >= 8) return WELCOME_GREEN;
  if (score >= 6.5) return '#69F0AE';
  return '#FFB300';
}

export function useWelcomeReducedMotion(): boolean {
  const [reduced, setReduced] = useState(false);
  useEffect(() => {
    let mounted = true;
    void AccessibilityInfo.isReduceMotionEnabled().then((v) => {
      if (mounted) setReduced(v);
    });
    const sub = AccessibilityInfo.addEventListener('reduceMotionChanged', setReduced);
    return () => {
      mounted = false;
      sub.remove();
    };
  }, []);
  return reduced;
}

function d(ms: number, reduced: boolean) {
  return reduced ? 0 : ms;
}

function PitchGrid() {
  return (
    <View pointerEvents="none" style={StyleSheet.absoluteFill}>
      {[0.18, 0.36, 0.54, 0.72].map((top) => (
        <View
          key={`h-${top}`}
          style={{
            position: 'absolute',
            left: '6%',
            right: '6%',
            top: `${top * 100}%`,
            height: 1,
            backgroundColor: 'rgba(0,200,83,0.12)',
          }}
        />
      ))}
      {[0.25, 0.5, 0.75].map((left) => (
        <View
          key={`v-${left}`}
          style={{
            position: 'absolute',
            top: '12%',
            bottom: '12%',
            left: `${left * 100}%`,
            width: 1,
            backgroundColor: 'rgba(0,200,83,0.1)',
          }}
        />
      ))}
      <View
        style={{
          position: 'absolute',
          left: '18%',
          right: '18%',
          top: '16%',
          height: '42%',
          borderWidth: 1.5,
          borderColor: 'rgba(0,200,83,0.35)',
          borderRadius: 16,
        }}
      />
      <View
        style={{
          position: 'absolute',
          width: 72,
          height: 72,
          borderRadius: 36,
          borderWidth: 1.5,
          borderColor: 'rgba(0,200,83,0.4)',
          top: '28%',
          left: '50%',
          marginLeft: -36,
        }}
      />
    </View>
  );
}

function AmbientOrbs({ accent, active, reducedMotion }: { accent: string; active: boolean; reducedMotion: boolean }) {
  const a = useSharedValue(0);
  const b = useSharedValue(0);

  useEffect(() => {
    if (!active) {
      a.value = 0;
      b.value = 0;
      return;
    }
    if (reducedMotion) {
      a.value = 0.55;
      b.value = 0.4;
      return;
    }
    a.value = withRepeat(
      withSequence(
        withTiming(1, { duration: 2800, easing: Easing.inOut(Easing.ease) }),
        withTiming(0.35, { duration: 2800, easing: Easing.inOut(Easing.ease) }),
      ),
      -1,
      false,
    );
    b.value = withRepeat(
      withSequence(
        withTiming(0.3, { duration: 3200, easing: Easing.inOut(Easing.ease) }),
        withTiming(1, { duration: 3200, easing: Easing.inOut(Easing.ease) }),
      ),
      -1,
      false,
    );
  }, [a, active, b, reducedMotion]);

  const orbA = useAnimatedStyle(() => ({
    opacity: interpolate(a.value, [0, 1], [0.15, 0.45]),
    transform: [{ scale: interpolate(a.value, [0, 1], [0.9, 1.15]) }],
  }));
  const orbB = useAnimatedStyle(() => ({
    opacity: interpolate(b.value, [0, 1], [0.1, 0.35]),
    transform: [{ scale: interpolate(b.value, [0, 1], [1.1, 0.85]) }],
  }));

  return (
    <>
      <Animated.View
        pointerEvents="none"
        style={[
          {
            position: 'absolute',
            width: 280,
            height: 280,
            borderRadius: 140,
            backgroundColor: accent,
            top: -60,
            right: -80,
          },
          orbA,
        ]}
      />
      <Animated.View
        pointerEvents="none"
        style={[
          {
            position: 'absolute',
            width: 220,
            height: 220,
            borderRadius: 110,
            backgroundColor: accent,
            bottom: -40,
            left: -70,
          },
          orbB,
        ]}
      />
    </>
  );
}

function ScoreReveal({ active, reducedMotion }: { active: boolean; reducedMotion: boolean }) {
  const progress = useSharedValue(0);
  const pulse = useSharedValue(0);

  useEffect(() => {
    if (!active) {
      progress.value = 0;
      pulse.value = 0;
      return;
    }
    progress.value = reducedMotion
      ? withTiming(1, { duration: 0 })
      : withSpring(1, { damping: 11, stiffness: 90 });

    if (reducedMotion) {
      pulse.value = 0.5;
      return;
    }
    pulse.value = withDelay(
      400,
      withRepeat(
        withSequence(
          withTiming(1, { duration: 1200, easing: Easing.inOut(Easing.ease) }),
          withTiming(0, { duration: 1200, easing: Easing.inOut(Easing.ease) }),
        ),
        -1,
        false,
      ),
    );
  }, [active, progress, pulse, reducedMotion]);

  const scoreStyle = useAnimatedStyle(() => ({
    opacity: progress.value,
    transform: [
      { scale: interpolate(progress.value, [0, 1], [0.55, 1]) },
      { translateY: interpolate(progress.value, [0, 1], [24, 0]) },
    ],
  }));

  const glowStyle = useAnimatedStyle(() => ({
    opacity: interpolate(pulse.value, [0, 1], [0.2, 0.55]) * progress.value,
    transform: [{ scale: interpolate(pulse.value, [0, 1], [0.95, 1.18]) }],
  }));

  return (
    <View style={{ alignItems: 'center', justifyContent: 'center' }}>
      <Animated.View
        style={[
          {
            position: 'absolute',
            width: 160,
            height: 160,
            borderRadius: 80,
            backgroundColor: WELCOME_GREEN,
          },
          glowStyle,
        ]}
      />
      <Animated.Text
        style={[
          {
            fontFamily: WELCOME_DISPLAY_FONT,
            fontSize: 96,
            lineHeight: 100,
            color: WELCOME_GREEN,
            letterSpacing: -2,
            textShadowColor: WELCOME_GREEN,
            textShadowRadius: 24,
            textShadowOffset: { width: 0, height: 0 },
          },
          scoreStyle,
        ]}
      >
        8.7
      </Animated.Text>
      <Animated.Text
        entering={reducedMotion ? undefined : FadeIn.delay(d(280, reducedMotion)).duration(400)}
        style={{
          fontFamily: WELCOME_DISPLAY_FONT_SEMIBOLD,
          fontSize: 13,
          letterSpacing: 2,
          color: WELCOME_GOLD,
          textTransform: 'uppercase',
          marginTop: -4,
        }}
      >
        Rate This Goal
      </Animated.Text>
    </View>
  );
}

function CategoryBars({ active, reducedMotion }: { active: boolean; reducedMotion: boolean }) {
  return (
    <View style={{ gap: 10, width: '100%' }}>
      {CATEGORY_SCORES.map((row, i) => (
        <BarRow
          key={row.label}
          label={row.label}
          score={row.score}
          active={active}
          reducedMotion={reducedMotion}
          delay={d(320 + i * 100, reducedMotion)}
        />
      ))}
    </View>
  );
}

function BarRow({
  label,
  score,
  active,
  reducedMotion,
  delay,
}: {
  label: string;
  score: number;
  active: boolean;
  reducedMotion: boolean;
  delay: number;
}) {
  const progress = useSharedValue(0);
  const pct = Math.min(100, (score / 10) * 100);
  const color = barColor(score);

  useEffect(() => {
    if (!active) {
      progress.value = 0;
      return;
    }
    progress.value = reducedMotion
      ? withTiming(pct, { duration: 0 })
      : withDelay(delay, withTiming(pct, { duration: 750, easing: Easing.out(Easing.cubic) }));
  }, [active, delay, pct, progress, reducedMotion]);

  const fill = useAnimatedStyle(() => ({ width: `${progress.value}%` }));

  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
      <Text style={{ color: '#A0A0A8', fontSize: 13, width: 78, fontWeight: '600' }}>{label}</Text>
      <View
        style={{
          flex: 1,
          height: 8,
          borderRadius: 999,
          backgroundColor: 'rgba(255,255,255,0.08)',
          overflow: 'hidden',
        }}
      >
        <Animated.View style={[{ height: '100%', borderRadius: 999, backgroundColor: color }, fill]} />
      </View>
      <Text style={{ color, fontSize: 14, fontFamily: WELCOME_DISPLAY_FONT, width: 32, textAlign: 'right' }}>
        {score.toFixed(1)}
      </Text>
    </View>
  );
}

function AnalysisStage({ active, reducedMotion }: { active: boolean; reducedMotion: boolean }) {
  return (
    <View style={{ flex: 1 }}>
      <LinearGradient
        colors={['#163821', '#0F1A12', '#0D0D0F']}
        locations={[0, 0.55, 1]}
        style={StyleSheet.absoluteFill}
      />
      <AmbientOrbs accent={WELCOME_GOLD} active={active} reducedMotion={reducedMotion} />
      <PitchGrid />

      <View
        style={{
          flex: 1,
          paddingHorizontal: 22,
          paddingTop: 28,
          paddingBottom: 18,
          justifyContent: 'space-between',
        }}
      >
        <Animated.View
          entering={reducedMotion ? undefined : FadeInDown.delay(d(40, reducedMotion)).duration(420)}
          style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}
        >
          <View
            style={{
              paddingHorizontal: 12,
              paddingVertical: 6,
              borderRadius: 999,
              backgroundColor: `${WELCOME_GREEN}28`,
              borderWidth: 1,
              borderColor: `${WELCOME_GREEN}55`,
            }}
          >
            <Text
              style={{
                color: WELCOME_GREEN,
                fontFamily: WELCOME_DISPLAY_FONT_SEMIBOLD,
                fontSize: 12,
                letterSpacing: 1.4,
                textTransform: 'uppercase',
              }}
            >
              GoalX
            </Text>
          </View>
          <View
            style={{
              paddingHorizontal: 12,
              paddingVertical: 6,
              borderRadius: 999,
              backgroundColor: `${WELCOME_GOLD}22`,
            }}
          >
            <Text style={{ color: WELCOME_GOLD, fontFamily: WELCOME_DISPLAY_FONT_SEMIBOLD, fontSize: 13 }}>
              Bicycle Kick
            </Text>
          </View>
        </Animated.View>

        <View style={{ alignItems: 'center', paddingVertical: 12 }}>
          <ScoreReveal active={active} reducedMotion={reducedMotion} />
          <Animated.Text
            entering={reducedMotion ? undefined : FadeIn.delay(d(220, reducedMotion)).duration(400)}
            style={{ color: '#A0A0A8', marginTop: 10, fontSize: 14 }}
          >
            Alex · Striker · Ice Cold Finish
          </Animated.Text>
        </View>

        <Animated.View
          entering={reducedMotion ? undefined : FadeInUp.delay(d(260, reducedMotion)).duration(420)}
          style={{
            borderRadius: 22,
            padding: 16,
            backgroundColor: 'rgba(13,13,15,0.72)',
            borderWidth: 1,
            borderColor: 'rgba(245,197,66,0.28)',
          }}
        >
          <CategoryBars active={active} reducedMotion={reducedMotion} />
        </Animated.View>
      </View>
    </View>
  );
}

function TrainingStage({ active, reducedMotion }: { active: boolean; reducedMotion: boolean }) {
  const hero = TRAINING_TILES.find((t) => t.span === 'hero')!;
  const wide = TRAINING_TILES.find((t) => t.span === 'wide')!;
  const mids = TRAINING_TILES.filter((t) => !t.span);

  return (
    <View style={{ flex: 1 }}>
      <LinearGradient
        colors={['#0F2A1A', '#0D1410', '#0D0D0F']}
        locations={[0, 0.5, 1]}
        style={StyleSheet.absoluteFill}
      />
      <AmbientOrbs accent={WELCOME_GREEN} active={active} reducedMotion={reducedMotion} />

      <View style={{ flex: 1, paddingHorizontal: 18, paddingTop: 24, paddingBottom: 16, gap: 12 }}>
        <Animated.View
          entering={
            active && !reducedMotion ? ZoomIn.springify().damping(13) : undefined
          }
          style={{
            flex: 1.35,
            borderRadius: 28,
            overflow: 'hidden',
            borderWidth: 1.5,
            borderColor: `${hero.color}66`,
            backgroundColor: `${hero.color}18`,
            opacity: active ? 1 : 0.55,
          }}
        >
          <LinearGradient
            colors={[`${hero.color}33`, 'rgba(13,13,15,0.2)']}
            style={{ flex: 1, alignItems: 'center', justifyContent: 'center', gap: 12 }}
          >
            <Ionicons name={hero.icon} size={72} color={hero.color} />
            <Text
              style={{
                fontFamily: WELCOME_DISPLAY_FONT,
                fontSize: 34,
                color: '#FFFFFF',
                letterSpacing: 0.5,
              }}
            >
              {hero.label}
            </Text>
            <Text style={{ color: '#A0A0A8', fontSize: 14 }}>Matched to your report gaps</Text>
          </LinearGradient>
        </Animated.View>

        <View style={{ flexDirection: 'row', gap: 12, flex: 0.85 }}>
          {mids.map((tile, i) => (
            <Animated.View
              key={tile.label}
              entering={
                active && !reducedMotion
                  ? FadeInUp.delay(d(100 + i * 90, reducedMotion)).springify().damping(15)
                  : undefined
              }
              style={{
                flex: 1,
                borderRadius: 22,
                borderWidth: 1,
                borderColor: `${tile.color}55`,
                backgroundColor: `${tile.color}16`,
                alignItems: 'center',
                justifyContent: 'center',
                gap: 8,
                padding: 10,
                opacity: active ? 1 : 0.55,
              }}
            >
              <Ionicons name={tile.icon} size={30} color={tile.color} />
              <Text
                style={{
                  fontFamily: WELCOME_DISPLAY_FONT_SEMIBOLD,
                  fontSize: 16,
                  color: '#FFFFFF',
                }}
              >
                {tile.label}
              </Text>
            </Animated.View>
          ))}
        </View>

        <Animated.View
          entering={
            active && !reducedMotion
              ? FadeInUp.delay(d(280, reducedMotion)).springify().damping(15)
              : undefined
          }
          style={{
            flexDirection: 'row',
            alignItems: 'center',
            gap: 14,
            borderRadius: 22,
            borderWidth: 1,
            borderColor: `${wide.color}55`,
            backgroundColor: `${wide.color}16`,
            paddingHorizontal: 18,
            paddingVertical: 16,
            opacity: active ? 1 : 0.55,
          }}
        >
          <View
            style={{
              width: 48,
              height: 48,
              borderRadius: 16,
              backgroundColor: `${wide.color}28`,
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            <Ionicons name={wide.icon} size={26} color={wide.color} />
          </View>
          <View style={{ flex: 1 }}>
            <Text style={{ fontFamily: WELCOME_DISPLAY_FONT, fontSize: 22, color: '#FFFFFF' }}>
              {wide.label}
            </Text>
            <Text style={{ color: '#A0A0A8', fontSize: 13, marginTop: 2 }}>
              Hundreds of drills across every category
            </Text>
          </View>
        </Animated.View>
      </View>
    </View>
  );
}

function SessionsStage({ active, reducedMotion }: { active: boolean; reducedMotion: boolean }) {
  return (
    <View style={{ flex: 1 }}>
      <LinearGradient
        colors={['#2A1420', '#140E12', '#0D0D0F']}
        locations={[0, 0.5, 1]}
        style={StyleSheet.absoluteFill}
      />
      <AmbientOrbs accent={WELCOME_CORAL} active={active} reducedMotion={reducedMotion} />

      <View style={{ flex: 1, paddingHorizontal: 18, paddingTop: 24, paddingBottom: 16, gap: 14 }}>
        <Animated.View
          entering={
            active && !reducedMotion ? FadeInDown.duration(420).springify().damping(15) : undefined
          }
          style={{
            flexDirection: 'row',
            alignItems: 'center',
            justifyContent: 'space-between',
            opacity: active ? 1 : 0.55,
          }}
        >
          <Text style={{ fontFamily: WELCOME_DISPLAY_FONT, fontSize: 28, color: '#FFFFFF' }}>
            This week
          </Text>
          <View
            style={{
              paddingHorizontal: 12,
              paddingVertical: 6,
              borderRadius: 999,
              backgroundColor: `${WELCOME_CORAL}24`,
              borderWidth: 1,
              borderColor: `${WELCOME_CORAL}55`,
            }}
          >
            <Text
              style={{
                color: WELCOME_CORAL,
                fontFamily: WELCOME_DISPLAY_FONT_SEMIBOLD,
                fontSize: 12,
                letterSpacing: 1.2,
                textTransform: 'uppercase',
              }}
            >
              Weekly Regimen
            </Text>
          </View>
        </Animated.View>

        <View style={{ flex: 1, gap: 10 }}>
          {WEEK.map((item, i) => (
            <Animated.View
              key={item.day}
              entering={
                active && !reducedMotion
                  ? FadeInRight.delay(d(80 + i * 90, reducedMotion)).springify().damping(16)
                  : undefined
              }
              style={{
                flex: 1,
                flexDirection: 'row',
                alignItems: 'center',
                gap: 14,
                borderRadius: 20,
                paddingHorizontal: 16,
                borderWidth: 1,
                borderColor: item.active ? `${WELCOME_CORAL}66` : 'rgba(255,255,255,0.08)',
                backgroundColor: item.active ? `${WELCOME_CORAL}22` : 'rgba(255,255,255,0.04)',
                opacity: active ? 1 : 0.55,
              }}
            >
              <View
                style={{
                  width: 52,
                  height: 52,
                  borderRadius: 16,
                  alignItems: 'center',
                  justifyContent: 'center',
                  backgroundColor: item.active ? `${WELCOME_CORAL}33` : 'rgba(255,255,255,0.06)',
                }}
              >
                <Text
                  style={{
                    fontFamily: WELCOME_DISPLAY_FONT,
                    fontSize: 14,
                    color: item.active ? WELCOME_CORAL : '#6B6B73',
                    letterSpacing: 0.5,
                  }}
                >
                  {item.day}
                </Text>
              </View>
              <View style={{ flex: 1 }}>
                <Text
                  style={{
                    fontFamily: WELCOME_DISPLAY_FONT_SEMIBOLD,
                    fontSize: 18,
                    color: item.active ? '#FFFFFF' : '#C8C8CE',
                  }}
                >
                  {item.title}
                </Text>
                <Text style={{ color: '#8A8A92', fontSize: 13, marginTop: 2 }}>{item.meta}</Text>
              </View>
              {item.active ? (
                <Ionicons name="play-circle" size={28} color={WELCOME_CORAL} />
              ) : (
                <Ionicons name="ellipse-outline" size={18} color="#3A3A40" />
              )}
            </Animated.View>
          ))}
        </View>
      </View>
    </View>
  );
}

export function WelcomeSlideStage({
  slideId,
  active,
  reducedMotion,
}: {
  slideId: WelcomeSlideId;
  active: boolean;
  reducedMotion: boolean;
}) {
  switch (slideId) {
    case 'analysis':
      return <AnalysisStage active={active} reducedMotion={reducedMotion} />;
    case 'training':
      return <TrainingStage active={active} reducedMotion={reducedMotion} />;
    case 'sessions':
      return <SessionsStage active={active} reducedMotion={reducedMotion} />;
  }
}

export function WelcomeSlideCopy({
  title,
  description,
  active,
  reducedMotion,
}: {
  title: string;
  description: string;
  active: boolean;
  reducedMotion: boolean;
}) {
  return (
    <View style={{ paddingHorizontal: 24, paddingTop: 18, paddingBottom: 8 }}>
      {active ? (
        <>
          <Animated.Text
            key={`t-${title}`}
            entering={
              reducedMotion
                ? undefined
                : FadeInDown.delay(d(60, reducedMotion)).duration(450).springify().damping(16)
            }
            style={{
              fontFamily: WELCOME_DISPLAY_FONT,
              fontSize: 38,
              lineHeight: 40,
              color: '#FFFFFF',
              letterSpacing: -0.5,
              marginBottom: 10,
            }}
          >
            {title}
          </Animated.Text>
          <Animated.Text
            key={`d-${title}`}
            entering={reducedMotion ? undefined : FadeInUp.delay(d(140, reducedMotion)).duration(400)}
            style={{ color: '#A0A0A8', fontSize: 16, lineHeight: 24 }}
          >
            {description}
          </Animated.Text>
        </>
      ) : (
        <>
          <Text
            style={{
              fontFamily: WELCOME_DISPLAY_FONT,
              fontSize: 38,
              lineHeight: 40,
              color: '#FFFFFF',
              letterSpacing: -0.5,
              marginBottom: 10,
            }}
          >
            {title}
          </Text>
          <Text style={{ color: '#A0A0A8', fontSize: 16, lineHeight: 24 }}>{description}</Text>
        </>
      )}
    </View>
  );
}

export function WelcomePageDot({
  active,
  accent,
  reducedMotion,
}: {
  active: boolean;
  accent: string;
  reducedMotion: boolean;
}) {
  const width = useSharedValue(active ? 28 : 8);

  useEffect(() => {
    width.value = reducedMotion
      ? withTiming(active ? 28 : 8, { duration: 0 })
      : withSpring(active ? 28 : 8, { damping: 16, stiffness: 180 });
  }, [active, reducedMotion, width]);

  const style = useAnimatedStyle(() => ({
    width: width.value,
    backgroundColor: active ? accent : '#2E2E33',
  }));

  return <Animated.View style={[{ height: 8, borderRadius: 999 }, style]} />;
}
