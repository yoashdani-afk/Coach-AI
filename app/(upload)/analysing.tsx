import { useEffect, useRef, useState } from 'react';
import { View, Text, Alert } from 'react-native';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { Card } from '@/components/ui';
import { buildAnalysisRequest } from '@/lib/analysisRequest';
import { ANALYSIS_STATUS_MESSAGES, COACHING_QUESTIONS, labelForAnalysisMode } from '@/lib/constants';
import { generateReport } from '@/lib/reports';
import { useAnalysisStore } from '@/stores/analysisStore';
import { useProfileStore } from '@/stores/profileStore';
import { useUploadStore } from '@/stores/uploadStore';

const ANALYSIS_DURATION_MS = 8_000;

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

  const [progress, setProgress] = useState(0);
  const [messageIndex, setMessageIndex] = useState(0);
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

    const request = buildAnalysisRequest({
      clip,
      mode: analysisMode,
      profile,
      playerSelection,
      questionType: analysisMode === 'COACH_ME' ? questionType! : undefined,
      question:
        analysisMode === 'COACH_ME'
          ? resolveQuestionLabel(questionType!, customQuestion)
          : undefined,
      context: analysisMode === 'COACH_ME' ? context.trim() || null : null,
    });

    const startTime = Date.now();
    const progressInterval = setInterval(() => {
      const elapsed = Date.now() - startTime;
      const pct = Math.min(100, Math.round((elapsed / ANALYSIS_DURATION_MS) * 100));
      setProgress(pct);
      setMessageIndex(
        Math.min(
          ANALYSIS_STATUS_MESSAGES.length - 1,
          Math.floor((elapsed / ANALYSIS_DURATION_MS) * ANALYSIS_STATUS_MESSAGES.length)
        )
      );
    }, 200);

    const timeout = setTimeout(() => {
      clearInterval(progressInterval);
      try {
        const report =
          request.mode === 'COACH_ME'
            ? generateReport({
                mode: 'COACH_ME',
                profile: request.profile,
                clip: request.clip,
                playerSelection: request.playerSelection,
                questionType: request.questionType!,
                question: request.question!,
                context: request.context ?? null,
              })
            : request.mode === 'PERFORMANCE'
              ? generateReport({
                  mode: 'PERFORMANCE',
                  profile: request.profile,
                  clip: request.clip,
                  playerSelection: request.playerSelection,
                })
              : generateReport({
                  mode: 'GOAL',
                  profile: request.profile,
                  clip: request.clip,
                  playerSelection: request.playerSelection,
                });

        setPendingReport(report);
        setIsAnalysing(false);
        router.replace(`/report/${report.id}?preview=1`);
      } catch (error) {
        console.error('[analysing] Failed to generate report:', error);
        setIsAnalysing(false);
        hasStarted.current = false;
        Alert.alert(
          'Something went wrong',
          'We could not build your demo report. Please try again.',
          [
            {
              text: 'OK',
              onPress: () =>
                router.replace(
                  analysisMode === 'COACH_ME' ? '/(upload)/question' : '/(upload)/identify'
                ),
            },
          ]
        );
      }
    }, ANALYSIS_DURATION_MS);

    return () => {
      clearInterval(progressInterval);
      clearTimeout(timeout);
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

          <View className="w-full h-2 bg-surface-elevated rounded-full overflow-hidden">
            <View className="h-full bg-primary rounded-full" style={{ width: `${progress}%` }} />
          </View>

          <Text className="text-text-muted text-sm text-center">About 8 seconds</Text>
        </View>

        <Card variant="outlined" className="w-full">
          <Text className="text-text-secondary text-sm text-center leading-5">
            Demo Report — generated locally from your profile and selected mode. The video has not
            been analysed by AI yet.
          </Text>
        </Card>
      </View>
    </View>
  );
}
