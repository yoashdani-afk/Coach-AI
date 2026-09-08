import { useEffect, useRef, useState } from 'react';
import { View, Text, Alert } from 'react-native';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { Card } from '@/components/ui';
import { AnalysisService } from '@/analysis/AnalysisService';
import { buildAnalysisRequest } from '@/analysis/models/AnalysisRequest';
import { createAnalysisAttemptId } from '@/lib/analysisCredits';
import { isPlayerGroundingFailure } from '@/lib/analysisErrors';
import { isAnalysisApiConfigured } from '@/lib/analysisConfig';
import { ANALYSIS_STATUS_MESSAGES, COACHING_QUESTIONS, labelForAnalysisMode } from '@/lib/constants';
import { hallOfFameService } from '@/services/hallOfFame/hallOfFameService';
import { useAnalysisStore } from '@/stores/analysisStore';
import { useProfileStore } from '@/stores/profileStore';
import { useUploadStore } from '@/stores/uploadStore';

const MIN_DISPLAY_MS = 2_000;
const PROGRESS_TICK_MS = 500;

function resolveQuestionLabel(
  questionType: NonNullable<ReturnType<typeof useUploadStore.getState>['questionType']>,
  customQuestion: string
): string {
  if (questionType === 'CUSTOM') return customQuestion.trim();
  return COACHING_QUESTIONS.find((q) => q.type === questionType)?.label ?? 'Your question';
}

export default function AnalysingScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
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

  const [messageIndex, setMessageIndex] = useState(0);
  const [statusNote, setStatusNote] = useState<string | null>(null);
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

    const messageTimer = setInterval(() => {
      setMessageIndex((i) => Math.min(ANALYSIS_STATUS_MESSAGES.length - 1, i + 1));
    }, PROGRESS_TICK_MS * 8);

    void (async () => {
      try {
        const result = await AnalysisService.run(request);
        if (cancelled) return;

        const elapsed = Date.now() - startTime;
        if (elapsed < MIN_DISPLAY_MS) {
          await new Promise((resolve) => setTimeout(resolve, MIN_DISPLAY_MS - elapsed));
        }
        if (cancelled) return;

        clearInterval(messageTimer);

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

        setStatusNote('Analysis complete.');

        const hallOfFameUnlock = hallOfFameService.evaluateForHallOfFame(result.report);

        setPendingBillableAnalysis({
          attemptId,
          reportId: result.report.id,
          source: 'gemini',
        });

        if (hallOfFameUnlock && profile) {
          addReport(result.report);
          hallOfFameService.tryAutoInductFromReport(result.report, profile);
          setPendingHallOfFameUnlock(hallOfFameUnlock);
          clearDraft();
          setIsAnalysing(false);
          router.replace(`/report/${result.report.id}?hof=1`);
          return;
        }

        setPendingHallOfFameUnlock(null);
        setPendingReport(result.report);
        setIsAnalysing(false);
        router.replace(`/report/${result.report.id}?preview=1`);
      } catch (error) {
        if (cancelled) return;
        console.error('[analysing] Failed to generate report:', error);
        clearInterval(messageTimer);
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
      clearInterval(messageTimer);
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

  return (
    <View
      className="flex-1 bg-background px-4"
      style={{ paddingTop: insets.top + 24, paddingBottom: insets.bottom + 24 }}
    >
      <View className="flex-1 items-center justify-center gap-8">
        <View className="w-20 h-20 rounded-2xl bg-primary-muted items-center justify-center">
          <Ionicons name="analytics" size={36} color="#00C853" />
        </View>

        <View className="items-center gap-4 w-full">
          <Text className="text-text-muted text-sm uppercase tracking-wider">{modeLabel}</Text>
          <Text className="text-text-primary text-xl font-bold text-center">
            {ANALYSIS_STATUS_MESSAGES[messageIndex]}
          </Text>
          {statusNote ? (
            <Text className="text-text-secondary text-xs text-center">{statusNote}</Text>
          ) : null}
        </View>

        <Card variant="outlined" className="w-full">
          <Text className="text-text-secondary text-sm text-center leading-5">
            {isAnalysisApiConfigured
              ? 'Building your personalised football analysis.'
              : 'Analysis server is not configured. Check EXPO_PUBLIC_ANALYSIS_API_URL.'}
          </Text>
        </Card>
      </View>
    </View>
  );
}
