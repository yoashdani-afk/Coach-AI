import { useEffect, useState, type ComponentProps, type ReactNode } from 'react';
import {
  View,
  Text,
  Pressable,
  Modal,
  ScrollView,
  Platform,
  StyleSheet,
  AccessibilityInfo,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Animated, {
  Easing,
  FadeInDown,
  runOnJS,
  useAnimatedStyle,
  useSharedValue,
  withDelay,
  withRepeat,
  withSequence,
  withTiming,
} from 'react-native-reanimated';
import { labelForAnalysisMode } from '@/lib/constants';
import { formatReportDate } from '@/lib/format';
import { HOW_IT_WORKS } from '@/lib/mockData';
import { FREE_TIER_ANALYSES_PER_MONTH } from '@/lib/constants';
import { analysesResetLabel } from '@/lib/analysisCredits';
import type { CoachingReport } from '@/types/analysis';

const PRIMARY = '#00C853';
const SURFACE = '#141416';
const SURFACE_ELEVATED = '#1A1A1E';
const BORDER = 'rgba(255,255,255,0.08)';
const RADIUS = 22;
const RADIUS_SM = 16;

type IonName = ComponentProps<typeof Ionicons>['name'];

const UPLOAD_HEADLINES = ['Get your game analyzed.', 'Get your goals rated.'] as const;

const ORB_SIZE = 280;
const ORB_CENTER = ORB_SIZE / 2;
const CORE_RADIUS = 52;
const CORE_DIAMETER = CORE_RADIUS * 2;
const PING_DURATION_MS = 2600;
const PING_STAGGER_MS = 860;

/**
 * One sonar ring: expands from the core and fades out, then loops.
 * Staggered delays create a continuous rhythmic ping.
 */
function SonarPingRing({
  animate,
  delayMs,
}: {
  animate: boolean;
  delayMs: number;
}) {
  const progress = useSharedValue(0);

  useEffect(() => {
    if (!animate) {
      progress.value = 0;
      return;
    }

    progress.value = withDelay(
      delayMs,
      withRepeat(
        withTiming(1, { duration: PING_DURATION_MS, easing: Easing.out(Easing.cubic) }),
        -1,
        false,
      ),
    );
  }, [animate, delayMs, progress]);

  const style = useAnimatedStyle(() => {
    // 1 = core size; expands to ~3× so rings clear the glow into dark space
    const scale = 1 + progress.value * 2.1;
    const opacity = (1 - progress.value) * 0.5;
    return {
      opacity,
      transform: [{ scale }],
    };
  });

  return (
    <Animated.View
      pointerEvents="none"
      style={[
        {
          position: 'absolute',
          width: CORE_DIAMETER,
          height: CORE_DIAMETER,
          borderRadius: CORE_RADIUS,
          top: ORB_CENTER - CORE_RADIUS,
          left: ORB_CENTER - CORE_RADIUS,
          borderWidth: 1.5,
          borderColor: PRIMARY,
          backgroundColor: 'transparent',
        },
        style,
      ]}
    />
  );
}

/**
 * Glowing core + staggered concentric sonar pings (no spike rays).
 */
function UploadEnergyOrb({ animate }: { animate: boolean }) {
  const pulse = useSharedValue(1);

  useEffect(() => {
    if (!animate) {
      pulse.value = 1;
      return;
    }

    pulse.value = withRepeat(
      withSequence(
        withTiming(1.08, { duration: 1500, easing: Easing.inOut(Easing.ease) }),
        withTiming(1, { duration: 1500, easing: Easing.inOut(Easing.ease) }),
      ),
      -1,
      false,
    );
  }, [animate, pulse]);

  const pulseStyle = useAnimatedStyle(() => ({
    transform: [{ scale: pulse.value }],
  }));

  return (
    <View
      pointerEvents="none"
      style={{
        position: 'absolute',
        width: ORB_SIZE,
        height: ORB_SIZE,
        top: -48,
        right: -52,
        overflow: 'visible',
      }}
    >
      <SonarPingRing animate={animate} delayMs={0} />
      <SonarPingRing animate={animate} delayMs={PING_STAGGER_MS} />
      <SonarPingRing animate={animate} delayMs={PING_STAGGER_MS * 2} />

      {/* Soft halo behind core */}
      <View
        style={{
          position: 'absolute',
          width: CORE_DIAMETER * 1.45,
          height: CORE_DIAMETER * 1.45,
          borderRadius: CORE_DIAMETER * 0.725,
          top: ORB_CENTER - CORE_DIAMETER * 0.725,
          left: ORB_CENTER - CORE_DIAMETER * 0.725,
          backgroundColor: 'rgba(0,200,83,0.16)',
        }}
      />

      {/* Solid pulsing green core */}
      <Animated.View
        style={[
          {
            position: 'absolute',
            width: CORE_DIAMETER,
            height: CORE_DIAMETER,
            borderRadius: CORE_RADIUS,
            top: ORB_CENTER - CORE_RADIUS,
            left: ORB_CENTER - CORE_RADIUS,
            backgroundColor: PRIMARY,
            shadowColor: PRIMARY,
            shadowOpacity: 0.65,
            shadowRadius: 18,
            shadowOffset: { width: 0, height: 0 },
            elevation: 8,
          },
          pulseStyle,
        ]}
      >
        <LinearGradient
          colors={['#6CFF9A', PRIMARY, '#00A844']}
          locations={[0, 0.45, 1]}
          start={{ x: 0.3, y: 0.2 }}
          end={{ x: 0.8, y: 1 }}
          style={{
            ...StyleSheet.absoluteFillObject,
            borderRadius: CORE_RADIUS,
          }}
        />
      </Animated.View>
    </View>
  );
}

const cardShell = {
  backgroundColor: SURFACE,
  borderWidth: 1,
  borderColor: BORDER,
  borderRadius: RADIUS,
} as const;

function useReducedMotion(): boolean {
  const [reduced, setReduced] = useState(false);
  useEffect(() => {
    let mounted = true;
    void AccessibilityInfo.isReduceMotionEnabled().then((value) => {
      if (mounted) setReduced(value);
    });
    const sub = AccessibilityInfo.addEventListener('reduceMotionChanged', setReduced);
    return () => {
      mounted = false;
      sub.remove();
    };
  }, []);
  return reduced;
}

function RotatingUploadHeadline() {
  const reducedMotion = useReducedMotion();
  const [index, setIndex] = useState(0);
  const progress = useSharedValue(1);

  useEffect(() => {
    if (reducedMotion) return;

    const bumpIndex = () => {
      setIndex((current) => (current + 1) % UPLOAD_HEADLINES.length);
    };

    const id = setInterval(() => {
      progress.value = withTiming(
        0,
        { duration: 280, easing: Easing.out(Easing.cubic) },
        (finished) => {
          if (!finished) return;
          runOnJS(bumpIndex)();
          progress.value = withTiming(1, {
            duration: 340,
            easing: Easing.out(Easing.cubic),
          });
        },
      );
    }, 3000);

    return () => clearInterval(id);
  }, [progress, reducedMotion]);

  const animatedStyle = useAnimatedStyle(() => ({
    opacity: progress.value,
    transform: [{ translateY: (1 - progress.value) * 10 }],
  }));

  const headlineStyle = {
    color: '#FFFFFF',
    fontSize: 30,
    fontWeight: '700' as const,
    fontStyle: 'italic' as const,
    letterSpacing: -0.5,
    lineHeight: 34,
  };

  if (reducedMotion) {
    return <Text style={headlineStyle}>{UPLOAD_HEADLINES[0]}</Text>;
  }

  return (
    <Animated.Text style={[headlineStyle, animatedStyle]}>
      {UPLOAD_HEADLINES[index]}
    </Animated.Text>
  );
}

export function HomeSectionEnter({
  index,
  children,
}: {
  index: number;
  children: ReactNode;
}) {
  return (
    <Animated.View entering={FadeInDown.delay(30 + index * 40).duration(360).springify().damping(20)}>
      {children}
    </Animated.View>
  );
}

function HowItWorksSheet({ open, onClose }: { open: boolean; onClose: () => void }) {
  const insets = useSafeAreaInsets();

  return (
    <Modal
      visible={open}
      animationType="slide"
      presentationStyle="pageSheet"
      onRequestClose={onClose}
    >
      <View
        className="flex-1 bg-background"
        style={{ paddingTop: Platform.OS === 'android' ? insets.top : 12 }}
      >
        <View className="px-5 pb-3 flex-row items-center border-b border-border">
          <Text className="text-text-primary text-lg font-semibold flex-1">How it works</Text>
          <Pressable
            onPress={onClose}
            className="w-10 h-10 items-center justify-center rounded-full bg-surface"
            accessibilityLabel="Close"
          >
            <Ionicons name="close" size={22} color="#FFFFFF" />
          </Pressable>
        </View>

        <ScrollView
          contentContainerStyle={{ padding: 20, paddingBottom: insets.bottom + 32 }}
          showsVerticalScrollIndicator={false}
        >
          <Text className="text-text-secondary text-sm leading-5 mb-5">
            From clip to coaching in four steps.
          </Text>
          {HOW_IT_WORKS.map((item, index) => {
            const isLast = index === HOW_IT_WORKS.length - 1;
            return (
              <View key={item.step} className="flex-row gap-3">
                <View className="items-center" style={{ width: 28 }}>
                  <View
                    className="w-7 h-7 rounded-full items-center justify-center"
                    style={{ backgroundColor: `${PRIMARY}22` }}
                  >
                    <Text style={{ color: PRIMARY }} className="font-semibold text-xs">
                      {item.step}
                    </Text>
                  </View>
                  {!isLast ? (
                    <View
                      className="w-px flex-1 my-1"
                      style={{ backgroundColor: BORDER, minHeight: 18 }}
                    />
                  ) : null}
                </View>
                <View className={`flex-1 ${isLast ? 'pb-0' : 'pb-5'}`}>
                  <Text className="text-text-primary font-semibold text-base">{item.title}</Text>
                  <Text className="text-text-secondary text-sm mt-1 leading-5">{item.body}</Text>
                </View>
              </View>
            );
          })}
        </ScrollView>
      </View>
    </Modal>
  );
}

/** Top brand lockup — matches mock: Coach AI + info control. */
export function HomeBrandBar({ onInfoPress }: { onInfoPress: () => void }) {
  return (
    <View className="flex-row items-center justify-between px-0.5 mb-1">
      <Text style={{ fontSize: 28, fontWeight: '800', letterSpacing: -0.6, color: '#FFFFFF' }}>
        Coach <Text style={{ color: PRIMARY }}>AI</Text>
      </Text>
      <Pressable
        onPress={onInfoPress}
        accessibilityRole="button"
        accessibilityLabel="How it works"
        hitSlop={8}
        className="w-10 h-10 items-center justify-center rounded-full active:opacity-70"
        style={{ backgroundColor: SURFACE, borderWidth: 1, borderColor: BORDER }}
      >
        <View>
          <Ionicons name="notifications-outline" size={20} color="#C8C8CE" />
          <View
            style={{
              position: 'absolute',
              top: 0,
              right: 1,
              width: 7,
              height: 7,
              borderRadius: 4,
              backgroundColor: PRIMARY,
              borderWidth: 1.5,
              borderColor: SURFACE,
            }}
          />
        </View>
      </Pressable>
    </View>
  );
}

/**
 * Split identity + usage card from the mock.
 * Left: avatar + greeting. Right: monthly analysis usage with segmented bar.
 */
export function HomeIdentityUsageCard({
  greeting,
  firstName,
  subtitle,
  remaining,
  unlimited,
  limit = FREE_TIER_ANALYSES_PER_MONTH,
  periodEnd = null,
}: {
  greeting: string;
  firstName: string;
  subtitle?: string;
  remaining: number;
  unlimited: boolean;
  limit?: number;
  periodEnd?: string | null;
}) {
  const initial = (firstName.trim().charAt(0) || 'P').toUpperCase();
  const used = Math.max(0, limit - remaining);
  const depleted = !unlimited && remaining <= 0;
  const resetHint = analysesResetLabel(periodEnd);
  const segments = Math.min(Math.max(limit, 1), 12);

  return (
    <View style={[cardShell, { padding: 16, flexDirection: 'row', gap: 14 }]}>
      <View className="flex-1 gap-3 pr-1" style={{ borderRightWidth: 1, borderRightColor: BORDER }}>
        <View className="flex-row items-center gap-3">
          <View
            className="items-center justify-center"
            style={{
              width: 44,
              height: 44,
              borderRadius: 22,
              backgroundColor: 'rgba(0,200,83,0.14)',
              borderWidth: 1,
              borderColor: 'rgba(0,200,83,0.28)',
            }}
          >
            <Text style={{ color: PRIMARY, fontSize: 18, fontWeight: '700' }}>{initial}</Text>
          </View>
          <View className="flex-1 gap-0.5">
            <Text className="text-text-muted text-[12px]" numberOfLines={1}>
              {greeting},
            </Text>
            <Text
              className="text-text-primary"
              style={{ fontSize: 17, fontWeight: '700', letterSpacing: -0.3 }}
              numberOfLines={1}
            >
              {firstName}
            </Text>
          </View>
        </View>
        <Text className="text-text-secondary text-[12px] leading-4" numberOfLines={2}>
          {subtitle ?? 'Keep building. Keep competing.'}
        </Text>
        <View
          className="h-1 rounded-full overflow-hidden"
          style={{ backgroundColor: 'rgba(255,255,255,0.08)', maxWidth: 120 }}
        >
          <View
            className="h-full rounded-full"
            style={{
              width: unlimited ? '100%' : `${Math.max(((used / Math.max(limit, 1)) * 100), depleted ? 100 : 4)}%`,
              backgroundColor: depleted ? '#FF8A95' : PRIMARY,
            }}
          />
        </View>
      </View>

      <View className="justify-between" style={{ width: 118 }}>
        <Text className="text-text-muted text-[11px] font-medium">Usage this month</Text>
        {unlimited ? (
          <View className="gap-1">
            <Text style={{ color: PRIMARY, fontSize: 22, fontWeight: '800' }}>∞</Text>
            <Text className="text-text-secondary text-[11px]">Dev unlimited</Text>
          </View>
        ) : (
          <View className="gap-1">
            <Text style={{ color: '#FFFFFF', fontSize: 22, fontWeight: '800', letterSpacing: -0.4 }}>
              {used} of {limit}
            </Text>
            <Text className="text-text-secondary text-[11px]">clips analyzed</Text>
          </View>
        )}
        {!unlimited ? (
          <View className="flex-row gap-0.5 mt-1">
            {Array.from({ length: segments }).map((_, i) => (
              <View
                key={i}
                style={{
                  flex: 1,
                  height: 4,
                  borderRadius: 2,
                  backgroundColor: i < used ? PRIMARY : 'rgba(255,255,255,0.12)',
                }}
              />
            ))}
          </View>
        ) : null}
        <Text className="text-text-muted text-[10px] mt-1" numberOfLines={1}>
          {unlimited ? 'No reset needed' : resetHint}
        </Text>
      </View>
    </View>
  );
}

/** Upload stage — large pulsing orb + rotating italic headline + circular CTA. */
export function HomeUploadHero({
  onPress,
  disabled = false,
  depleted = false,
}: {
  onPress: () => void;
  disabled?: boolean;
  depleted?: boolean;
}) {
  const muted = disabled && !depleted;
  const reducedMotion = useReducedMotion();
  const animateOrb = !muted && !depleted && !reducedMotion;

  return (
    <Pressable
      onPress={onPress}
      disabled={muted}
      accessibilityRole="button"
      accessibilityLabel={depleted ? 'Upgrade to Pro' : 'Upload a clip'}
      className={muted ? 'opacity-50' : 'active:opacity-95'}
    >
      <View
        className="overflow-hidden"
        style={{
          minHeight: 210,
          borderRadius: RADIUS,
          borderWidth: 1,
          borderColor: depleted ? 'rgba(0,200,83,0.55)' : 'rgba(0,200,83,0.28)',
        }}
      >
        <LinearGradient
          colors={['#0F2418', '#0B140F', '#0D0D0F']}
          locations={[0, 0.55, 1]}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={StyleSheet.absoluteFill}
        />

        <UploadEnergyOrb animate={animateOrb} />

        <View
          pointerEvents="none"
          style={{
            position: 'absolute',
            width: 140,
            height: 140,
            borderRadius: 70,
            backgroundColor: PRIMARY,
            bottom: -55,
            left: -45,
            opacity: 0.1,
          }}
        />

        <View className="justify-between p-5" style={{ minHeight: 210 }}>
          <View className="gap-2.5 pr-16">
            {depleted ? (
              <Text
                style={{
                  color: '#FFFFFF',
                  fontSize: 30,
                  fontWeight: '700',
                  fontStyle: 'italic',
                  letterSpacing: -0.5,
                  lineHeight: 34,
                }}
              >
                Upgrade to Pro
              </Text>
            ) : (
              <RotatingUploadHeadline />
            )}
            <Text className="text-text-secondary text-[14px] leading-5 max-w-[260px]">
              {depleted
                ? "You've used this month's analyses. Pro unlocks 12 clips / month and more."
                : 'Upload a clip and get AI coaching insights in minutes.'}
            </Text>
          </View>

          <View className="flex-row items-center gap-3 mt-6">
            <View
              className="items-center justify-center"
              style={{
                width: 48,
                height: 48,
                borderRadius: 24,
                backgroundColor: PRIMARY,
              }}
            >
              <Ionicons
                name={depleted ? 'lock-closed' : 'arrow-up'}
                size={22}
                color="#0D0D0F"
              />
            </View>
            <View className="gap-0.5">
              <Text style={{ color: PRIMARY, fontSize: 16, fontWeight: '700' }}>
                {depleted ? 'Upgrade to Pro' : 'Upload a clip'}
              </Text>
              <Text className="text-text-muted text-[11px]">
                {depleted ? 'Unlock more analyses' : 'MP4 · 10s–5m'}
              </Text>
            </View>
          </View>
        </View>
      </View>
    </Pressable>
  );
}

function ExploreTile({
  icon,
  title,
  body,
  actionIcon,
  actionLabel,
  onPress,
}: {
  icon: IonName;
  title: string;
  body: string;
  actionIcon: IonName;
  actionLabel: string;
  onPress: () => void;
}) {
  return (
    <Pressable
      onPress={onPress}
      className="active:opacity-90 flex-1"
      accessibilityRole="button"
      accessibilityLabel={title}
    >
      <View
        style={{
          ...cardShell,
          flex: 1,
          minHeight: 168,
          padding: 16,
          justifyContent: 'space-between',
          backgroundColor: SURFACE_ELEVATED,
        }}
      >
        <View
          className="items-center justify-center"
          style={{
            width: 40,
            height: 40,
            borderRadius: 12,
            backgroundColor: 'rgba(0,200,83,0.14)',
          }}
        >
          <Ionicons name={icon} size={20} color={PRIMARY} />
        </View>
        <View className="gap-1.5 mt-4">
          <Text className="text-text-primary font-bold text-[16px] tracking-tight">{title}</Text>
          <Text className="text-text-secondary text-[12px] leading-4" numberOfLines={3}>
            {body}
          </Text>
        </View>
        <View className="flex-row items-center gap-1.5 mt-4">
          <Ionicons name={actionIcon} size={14} color={PRIMARY} />
          <Text style={{ color: PRIMARY, fontSize: 13, fontWeight: '600' }}>{actionLabel}</Text>
        </View>
      </View>
    </Pressable>
  );
}

export function HomeHallOfFameCard({ onPress }: { onPress: () => void }) {
  return (
    <ExploreTile
      icon="trophy"
      title="Hall of Fame"
      body="Celebrate standout plays and personal bests."
      actionIcon="star"
      actionLabel="See greatness"
      onPress={onPress}
    />
  );
}

export function HomeTrainingFocusCard({
  goalLabels,
  onEditGoals,
}: {
  goalLabels: string[];
  onEditGoals: () => void;
}) {
  const body =
    goalLabels.length > 0
      ? goalLabels.join(' · ')
      : 'Drill down on key moments and decisions.';

  return (
    <ExploreTile
      icon="locate"
      title="Focus"
      body={body}
      actionIcon="eye"
      actionLabel="Stay sharp"
      onPress={onEditGoals}
    />
  );
}

export function HomeLatestReportCard({
  report,
  onPress,
}: {
  report: CoachingReport;
  onPress: () => void;
}) {
  const modeLabel = labelForAnalysisMode(report.mode);
  const showScore = report.mode !== 'COACH_ME';
  const overallScore = showScore ? report.overallScore : null;
  const scorePct =
    overallScore == null
      ? null
      : Math.round(Math.min(10, Math.max(0, overallScore)) * 10);

  return (
    <Pressable onPress={onPress} className="active:opacity-90" accessibilityRole="button">
      <View style={{ ...cardShell, padding: 14, gap: 12, backgroundColor: SURFACE_ELEVATED }}>
        <View className="flex-row items-center gap-3">
          <View
            className="items-center justify-center overflow-hidden"
            style={{
              width: 56,
              height: 56,
              borderRadius: RADIUS_SM,
              backgroundColor: '#0F2418',
              borderWidth: 1,
              borderColor: 'rgba(0,200,83,0.25)',
            }}
          >
            <LinearGradient
              colors={['rgba(0,200,83,0.35)', 'rgba(13,13,15,0.9)']}
              style={StyleSheet.absoluteFill}
            />
            <Ionicons name="football" size={26} color={PRIMARY} />
          </View>

          <View className="flex-1 gap-0.5">
            <Text className="text-text-muted text-[11px]">
              {formatReportDate(report.createdAt)}
              {report.isDemo ? ' · Demo' : ''}
            </Text>
            <Text className="text-text-primary font-semibold text-[15px]" numberOfLines={1}>
              {report.title}
            </Text>
            <Text className="text-text-secondary text-[12px]" numberOfLines={1}>
              {modeLabel}
              {overallScore != null ? ` · Score ${overallScore.toFixed(1)}/10` : ''}
            </Text>
          </View>

          <Ionicons name="chevron-forward" size={18} color={PRIMARY} />
        </View>

        {scorePct != null ? (
          <View
            className="flex-row items-center justify-between pt-2"
            style={{ borderTopWidth: 1, borderTopColor: BORDER }}
          >
            <View className="flex-row items-center gap-1.5 flex-1">
              <Ionicons name="analytics-outline" size={14} color={PRIMARY} />
              <Text className="text-text-secondary text-[11px]" numberOfLines={1}>
                {scorePct} Overall
              </Text>
            </View>
            <View className="flex-row items-center gap-1.5 flex-1 justify-center">
              <Ionicons name="locate-outline" size={14} color={PRIMARY} />
              <Text className="text-text-secondary text-[11px]" numberOfLines={1}>
                AI Analysis
              </Text>
            </View>
            <View className="flex-row items-center gap-1.5 flex-1 justify-end">
              <Ionicons name="shield-checkmark-outline" size={14} color={PRIMARY} />
              <Text className="text-text-secondary text-[11px]" numberOfLines={1}>
                Coaching ready
              </Text>
            </View>
          </View>
        ) : (
          <Text className="text-text-secondary text-[13px] leading-5" numberOfLines={2}>
            {report.summary}
          </Text>
        )}
      </View>
    </Pressable>
  );
}

export function HomeEmptyReports({ onUpload }: { onUpload: () => void }) {
  return (
    <View
      className="items-center py-8 px-5 gap-2.5"
      style={{
        ...cardShell,
        borderStyle: 'dashed',
        backgroundColor: SURFACE_ELEVATED,
      }}
    >
      <View
        className="items-center justify-center"
        style={{
          width: 48,
          height: 48,
          borderRadius: 24,
          backgroundColor: 'rgba(0,200,83,0.12)',
        }}
      >
        <Ionicons name="videocam-outline" size={22} color={PRIMARY} />
      </View>
      <Text className="text-text-primary font-semibold text-[15px] text-center mt-1">
        No reports yet
      </Text>
      <Text className="text-text-secondary text-[13px] text-center leading-5">
        Your first coaching report will appear here after you upload a clip.
      </Text>
      <Pressable onPress={onUpload} className="mt-2 active:opacity-70">
        <Text style={{ color: PRIMARY, fontSize: 14, fontWeight: '700' }}>Upload a clip</Text>
      </Pressable>
    </View>
  );
}

export function HomeHowItWorksController({
  open,
  onClose,
}: {
  open: boolean;
  onClose: () => void;
}) {
  return <HowItWorksSheet open={open} onClose={onClose} />;
}
