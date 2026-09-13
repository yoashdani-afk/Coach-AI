import { useEffect, useRef, useState } from 'react';
import {
  View,
  Text,
  Alert,
  AccessibilityInfo,
  StyleSheet,
  ScrollView,
} from 'react-native';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import Animated, {
  Easing,
  FadeInDown,
  useAnimatedStyle,
  useSharedValue,
  withRepeat,
  withSequence,
  withTiming,
} from 'react-native-reanimated';
import { AnalysisService } from '@/analysis/AnalysisService';
import { buildAnalysisRequest } from '@/analysis/models/AnalysisRequest';
import { createAnalysisAttemptId } from '@/lib/analysisCredits';
import { isPlayerGroundingFailure } from '@/lib/analysisErrors';
import { isAnalysisApiConfigured } from '@/lib/analysisConfig';
import { COACHING_QUESTIONS, labelForAnalysisMode } from '@/lib/constants';
import { hallOfFameService } from '@/services/hallOfFame/hallOfFameService';
import { useAnalysisStore } from '@/stores/analysisStore';
import { useProfileStore } from '@/stores/profileStore';
import { useUploadStore } from '@/stores/uploadStore';

const MIN_DISPLAY_MS = 2_000;
const PRIMARY = '#00C853';

/**
 * Presentational wait stages only — timings approximate typical pipeline duration.
 * They do NOT drive AnalysisService / server work.
 */
const WAIT_STAGES = [
  {
    id: 'upload',
    title: 'Uploading your clip',
    detail: 'Sending footage securely to the analysis engine',
    advanceAfterMs: 0,
  },
  {
    id: 'prepare',
    title: 'Preparing the footage',
    detail: 'Normalizing the clip and locking onto your player',
    advanceAfterMs: 8_000,
  },
  {
    id: 'analyze',
    title: 'Analyzing key moments',
    detail: 'Reading decisions, movement, and technique',
    advanceAfterMs: 20_000,
  },
  {
    id: 'report',
    title: 'Writing your coaching report',
    detail: 'Turning the breakdown into clear coaching notes',
    advanceAfterMs: 45_000,
  },
] as const;

const WAIT_TIPS = [
  'Keep this screen open — closing it can interrupt analysis.',
  'Clear, well-lit footage where you’re easy to spot gets the best coaching.',
  'Goal mode scores finishes; Performance mode breaks down the full sequence.',
  'Complex clips can take longer — retries mean the engine is still working.',
  'After this, you’ll get a report you can reopen anytime from Home.',
] as const;

const HOLDING_LONG_MS = 70_000;

function resolveQuestionLabel(
  questionType: NonNullable<ReturnType<typeof useUploadStore.getState>['questionType']>,
  customQuestion: string
): string {
  if (questionType === 'CUSTOM') return customQuestion.trim();
  return COACHING_QUESTIONS.find((q) => q.type === questionType)?.label ?? 'Your question';
}

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

function PulseCore({ animate }: { animate: boolean }) {
  const pulse = useSharedValue(1);

  useEffect(() => {
    if (!animate) {
      pulse.value = 1;
      return;
    }
    pulse.value = withRepeat(
      withSequence(
        withTiming(1.08, { duration: 1400, easing: Easing.inOut(Easing.ease) }),
        withTiming(1, { duration: 1400, easing: Easing.inOut(Easing.ease) }),
      ),
      -1,
      false,
    );
  }, [animate, pulse]);

  const style = useAnimatedStyle(() => ({
    transform: [{ scale: pulse.value }],
  }));

  return (
    <Animated.View style={[{ alignItems: 'center', justifyContent: 'center' }, style]}>
      <View
        style={{
          width: 88,
          height: 88,
          borderRadius: 28,
          backgroundColor: 'rgba(0,200,83,0.14)',
          borderWidth: 1,
          borderColor: 'rgba(0,200,83,0.35)',
          alignItems: 'center',
          justifyContent: 'center',
        }}
      >
        <LinearGradient
          colors={['rgba(0,200,83,0.35)', 'rgba(0,200,83,0.08)']}
          style={StyleSheet.absoluteFillObject}
          start={{ x: 0.2, y: 0 }}
          end={{ x: 0.9, y: 1 }}
        />
        <Ionicons name="analytics" size={36} color={PRIMARY} />
      </View>
    </Animated.View>
  );
}

function ActiveStepPulse({ animate }: { animate: boolean }) {
  const progress = useSharedValue(0.15);

  useEffect(() => {
    if (!animate) {
      progress.value = 0.35;
      return;
    }
    progress.value = withRepeat(
      withSequence(
        withTiming(0.85, { duration: 1100, easing: Easing.inOut(Easing.ease) }),
        withTiming(0.2, { duration: 1100, easing: Easing.inOut(Easing.ease) }),
      ),
      -1,
      false,
    );
  }, [animate, progress]);

  const barStyle = useAnimatedStyle(() => ({
    width: `${Math.max(12, progress.value * 100)}%`,
  }));

  return (
    <View
      style={{
        height: 3,
        borderRadius: 2,
        backgroundColor: 'rgba(0,200,83,0.15)',
        overflow: 'hidden',
        marginTop: 8,
      }}
    >
      <Animated.View
        style={[
          {
            height: '100%',
            borderRadius: 2,
            backgroundColor: PRIMARY,
          },
          barStyle,
        ]}
      />
    </View>
  );
}

function StageStepper({
  stageIndex,
  complete,
  holdingLong,
  reducedMotion,
}: {
  stageIndex: number;
  complete: boolean;
  holdingLong: boolean;
  reducedMotion: boolean;
}) {
  return (
    <View
      style={{
        width: '100%',
        backgroundColor: '#141416',
        borderRadius: 20,
        borderWidth: 1,
        borderColor: 'rgba(255,255,255,0.08)',
        padding: 16,
        gap: 14,
      }}
    >
      {WAIT_STAGES.map((stage, index) => {
        const done = complete || index < stageIndex;
        const active = !complete && index === stageIndex;
        const upcoming = !done && !active;

        return (
          <View key={stage.id} style={{ flexDirection: 'row', gap: 12 }}>
            <View style={{ alignItems: 'center', width: 28 }}>
              <View
                style={{
                  width: 28,
                  height: 28,
                  borderRadius: 10,
                  alignItems: 'center',
                  justifyContent: 'center',
                  backgroundColor: done
                    ? 'rgba(0,200,83,0.2)'
                    : active
                      ? 'rgba(0,200,83,0.14)'
                      : 'rgba(255,255,255,0.04)',
                  borderWidth: 1,
                  borderColor: done || active ? 'rgba(0,200,83,0.45)' : 'rgba(255,255,255,0.08)',
                }}
              >
                {done ? (
                  <Ionicons name="checkmark" size={16} color={PRIMARY} />
                ) : (
                  <Text
                    style={{
                      color: active ? PRIMARY : '#6B6B73',
                      fontSize: 12,
                      fontWeight: '700',
                    }}
                  >
                    {index + 1}
                  </Text>
                )}
              </View>
              {index < WAIT_STAGES.length - 1 ? (
                <View
                  style={{
                    width: 2,
                    flex: 1,
                    minHeight: 18,
                    marginTop: 4,
                    backgroundColor: done ? 'rgba(0,200,83,0.35)' : 'rgba(255,255,255,0.08)',
                  }}
                />
              ) : null}
            </View>

            <View style={{ flex: 1, paddingBottom: index < WAIT_STAGES.length - 1 ? 4 : 0 }}>
              <Text
                style={{
                  color: upcoming ? '#6B6B73' : '#FFFFFF',
                  fontSize: 15,
                  fontWeight: active || done ? '700' : '500',
                  letterSpacing: -0.2,
                }}
              >
                {stage.title}
              </Text>
              <Text
                style={{
                  color: active ? '#A0A0A8' : '#6B6B73',
                  fontSize: 12,
                  lineHeight: 17,
                  marginTop: 2,
                }}
              >
                {active && holdingLong && index === WAIT_STAGES.length - 1
                  ? 'Still working — complex clips take longer. Hang tight.'
                  : stage.detail}
              </Text>
              {active && !complete ? <ActiveStepPulse animate={!reducedMotion} /> : null}
            </View>
          </View>
        );
      })}
    </View>
  );
}

export default function AnalysingScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const reducedMotion = useReducedMotion();
  const profile = useProfileStore((s) => s.profile);
  const setIsAnalysing = useAnalysisStore((s) => s.setIsAnalysing);
  const clip = useUploadStore((s) => s.clip);
  const analysisMode = useUploadStore((s) => s.analysisMode);
  const playerSelection = useUploadStore((s) => s.playerSelection);
  const questionType = useUploadStore((s) => s.questionType);
  const customQuestion = useUploadStore((s) => s.customQuestion);
  const context = useUploadStore((s) => s.context);
  const setPendingReport = useUploadStore((s) => s.setPendingReport);
  const setPendingHallOfFameUnlock = useUploadStore((s) => s.setPendingHallOfFameUnlock);
  const setAnalysisAttemptId = useUploadStore((s) => s.setAnalysisAttemptId);
  const setPendingBillableAnalysis = useUploadStore((s) => s.setPendingBillableAnalysis);
  const clearDraft = useUploadStore((s) => s.clearDraft);
  const addReport = useAnalysisStore((s) => s.addReport);

  const [stageIndex, setStageIndex] = useState(0);
  const [holdingLong, setHoldingLong] = useState(false);
  const [uiComplete, setUiComplete] = useState(false);
  const [tipIndex, setTipIndex] = useState(0);
  const hasStarted = useRef(false);

  useEffect(() => {
    if (!clip || !analysisMode || !profile || !playerSelection) {
      router.replace('/(upload)');
      return;
    }

    if (analysisMode === 'COACH_ME') {
      if (!questionType) {
        router.replace('/(upload)/question');
        return;
      }
      if (questionType === 'CUSTOM' && customQuestion.trim().length < 8) {
        router.replace('/(upload)/question');
        return;
      }
    }

    if (hasStarted.current) return;
    hasStarted.current = true;
    setIsAnalysing(true);

    console.log('[Analysis] START WITHOUT TRACKING', {
      mode: analysisMode,
      hasPlayerSelection: Boolean(playerSelection),
    });

    const attemptId = createAnalysisAttemptId();
    setAnalysisAttemptId(attemptId);

    const request = buildAnalysisRequest({
      clip,
      mode: analysisMode,
      profile,
      playerSelection,
      playerTracking: undefined,
      questionType: analysisMode === 'COACH_ME' ? questionType! : undefined,
      question:
        analysisMode === 'COACH_ME'
          ? resolveQuestionLabel(questionType!, customQuestion)
          : undefined,
      context: analysisMode === 'COACH_ME' ? context.trim() || null : null,
    });

    const startTime = Date.now();
    let cancelled = false;

    // Presentational timers only — do not affect AnalysisService.run.
    const presentationTimers: Array<ReturnType<typeof setTimeout>> = [];
    WAIT_STAGES.forEach((stage, index) => {
      if (index === 0) return;
      presentationTimers.push(
        setTimeout(() => {
          if (!cancelled) setStageIndex(index);
        }, stage.advanceAfterMs)
      );
    });
    presentationTimers.push(
      setTimeout(() => {
        if (!cancelled) setHoldingLong(true);
      }, HOLDING_LONG_MS)
    );
    const tipTimer = setInterval(() => {
      if (!cancelled) {
        setTipIndex((i) => (i + 1) % WAIT_TIPS.length);
      }
    }, 7_000);

    void (async () => {
      try {
        const result = await AnalysisService.run(request);
        if (cancelled) return;

        const elapsed = Date.now() - startTime;
        if (elapsed < MIN_DISPLAY_MS) {
          await new Promise((resolve) => setTimeout(resolve, MIN_DISPLAY_MS - elapsed));
        }
        if (cancelled) return;

        presentationTimers.forEach(clearTimeout);
        clearInterval(tipTimer);
        setUiComplete(true);
        setStageIndex(WAIT_STAGES.length - 1);

        if (result.outcome === 'insufficient_evidence') {
          setIsAnalysing(false);
          router.replace({
            pathname: '/(upload)/analysis-failed',
            params: {
              title: 'Analysis unavailable',
              subtitle: 'The footage could not be understood confidently enough.',
              message: result.message,
              requestId: result.requestId ?? '',
            },
          });
          return;
        }

        if (result.outcome === 'failed') {
          setIsAnalysing(false);
          router.replace({
            pathname: '/(upload)/analysis-failed',
            params: {
              title: 'Analysis failed',
              subtitle: 'Please try again.',
              message: result.message,
            },
          });
          return;
        }

        const hallOfFameUnlock = hallOfFameService.evaluateForHallOfFame(result.report);

        setPendingBillableAnalysis({
          attemptId,
          reportId: result.report.id,
          source: 'gemini',
        });

        if (hallOfFameUnlock && profile) {
          addReport(result.report);
          const induct = await hallOfFameService.tryAutoInductFromReport(
            result.report,
            profile
          );
          if (induct.ok) {
            setPendingHallOfFameUnlock(hallOfFameUnlock);
            clearDraft();
            setIsAnalysing(false);
            router.replace(`/report/${result.report.id}?hof=1`);
            return;
          }
          console.warn('[HallOfFame] Auto-induct skipped', induct);
          if (induct.reason === 'entry_limit') {
            clearDraft();
            setIsAnalysing(false);
            router.replace(`/report/${result.report.id}?hof_limit=1`);
            return;
          }
          // Fall through to normal preview when unsigned / network error.
        }

        setPendingHallOfFameUnlock(null);
        setPendingReport(result.report);
        setIsAnalysing(false);
        router.replace(`/report/${result.report.id}?preview=1`);
      } catch (error) {
        if (cancelled) return;
        console.error('[analysing] Failed to generate report:', error);
        presentationTimers.forEach(clearTimeout);
        clearInterval(tipTimer);
        setIsAnalysing(false);
        hasStarted.current = false;

        const groundingMessage = isPlayerGroundingFailure(error) ? error.message : null;

        Alert.alert(
          groundingMessage ? 'Player not identified' : 'Something went wrong',
          groundingMessage ?? 'We could not build your report. Please try again.',
          [
            {
              text: 'OK',
              onPress: () =>
                router.replace(
                  groundingMessage
                    ? '/(upload)/identify'
                    : analysisMode === 'COACH_ME'
                      ? '/(upload)/question'
                      : '/(upload)/identify'
                ),
            },
          ]
        );
      }
    })();

    return () => {
      cancelled = true;
      presentationTimers.forEach(clearTimeout);
      clearInterval(tipTimer);
    };
  }, [
    clip,
    analysisMode,
    playerSelection,
    questionType,
    customQuestion,
    context,
    profile,
    setIsAnalysing,
    setPendingReport,
    setPendingHallOfFameUnlock,
    setAnalysisAttemptId,
    setPendingBillableAnalysis,
    clearDraft,
    addReport,
    router,
  ]);

  const modeLabel = analysisMode ? labelForAnalysisMode(analysisMode) : 'Your clip';
  const activeStage = WAIT_STAGES[Math.min(stageIndex, WAIT_STAGES.length - 1)]!;

  return (
    <View className="flex-1 bg-background">
      <LinearGradient
        pointerEvents="none"
        colors={['rgba(0,200,83,0.16)', 'rgba(0,200,83,0.04)', 'transparent']}
        locations={[0, 0.35, 1]}
        style={{ position: 'absolute', top: 0, left: 0, right: 0, height: 280 }}
      />

      <ScrollView
        contentContainerStyle={{
          flexGrow: 1,
          paddingTop: insets.top + 28,
          paddingBottom: insets.bottom + 28,
          paddingHorizontal: 20,
          justifyContent: 'center',
          gap: 22,
        }}
        showsVerticalScrollIndicator={false}
      >
        <Animated.View
          entering={reducedMotion ? undefined : FadeInDown.duration(420).springify().damping(18)}
          style={{ alignItems: 'center', gap: 14 }}
        >
          <PulseCore animate={!reducedMotion && !uiComplete} />
          <Text
            style={{
              color: '#6B6B73',
              fontSize: 12,
              fontWeight: '600',
              letterSpacing: 1.2,
              textTransform: 'uppercase',
            }}
          >
            {modeLabel}
          </Text>
          <Text
            style={{
              color: '#FFFFFF',
              fontSize: 26,
              fontWeight: '800',
              letterSpacing: -0.5,
              textAlign: 'center',
              lineHeight: 30,
            }}
          >
            {uiComplete ? 'Analysis complete' : activeStage.title}
          </Text>
          <Text
            style={{
              color: '#A0A0A8',
              fontSize: 14,
              lineHeight: 20,
              textAlign: 'center',
              maxWidth: 320,
            }}
          >
            {isAnalysisApiConfigured
              ? 'This usually takes under a minute — keep this screen open while AI analysis runs.'
              : 'Analysis server is not configured. Check EXPO_PUBLIC_ANALYSIS_API_URL.'}
          </Text>
        </Animated.View>

        <Animated.View
          entering={
            reducedMotion ? undefined : FadeInDown.delay(80).duration(420).springify().damping(18)
          }
        >
          <StageStepper
            stageIndex={stageIndex}
            complete={uiComplete}
            holdingLong={holdingLong}
            reducedMotion={reducedMotion}
          />
        </Animated.View>

        <Animated.View
          entering={
            reducedMotion ? undefined : FadeInDown.delay(140).duration(420).springify().damping(18)
          }
          style={{
            backgroundColor: 'rgba(255,255,255,0.03)',
            borderRadius: 16,
            borderWidth: 1,
            borderColor: 'rgba(255,255,255,0.07)',
            paddingHorizontal: 14,
            paddingVertical: 12,
            gap: 6,
          }}
        >
          <Text
            style={{
              color: '#6B6B73',
              fontSize: 10,
              fontWeight: '700',
              letterSpacing: 0.8,
              textTransform: 'uppercase',
            }}
          >
            Tip
          </Text>
          <Text style={{ color: '#A0A0A8', fontSize: 13, lineHeight: 19 }}>
            {WAIT_TIPS[tipIndex]}
          </Text>
        </Animated.View>
      </ScrollView>
    </View>
  );
}
