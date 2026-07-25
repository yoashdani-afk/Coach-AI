import { useState } from 'react';
import { View, Text, Alert } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Button } from '@/components/ui';
import { ReportDetailView } from '@/components/analysis/ReportDetailView';
import { ScreenHeader } from '@/components/layout/ScreenHeader';
import { determineGoalAward } from '@/lib/hallOfFame/goalAward';
import { useHallOfFame } from '@/services/hallOfFame/hallOfFameService';
import { useAnalysisStore } from '@/stores/analysisStore';
import { useProfileStore } from '@/stores/profileStore';
import { useUploadStore } from '@/stores/uploadStore';
import type { GoalReport } from '@/types/analysis';

export default function ReportScreen() {
  const { id, preview } = useLocalSearchParams<{ id: string; preview?: string }>();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const savedReport = useAnalysisStore((s) => s.reports.find((r) => r.id === id));
  const pendingReport = useUploadStore((s) => s.pendingReport);
  const addReport = useAnalysisStore((s) => s.addReport);
  const profile = useProfileStore((s) => s.profile);
  const incrementAnalysesUsed = useProfileStore((s) => s.incrementAnalysesUsed);
  const clearDraft = useUploadStore((s) => s.clearDraft);
  const { isReportSubmitted, submitFromReport } = useHallOfFame();
  const [submitted, setSubmitted] = useState(false);

  const isPreview = preview === '1';
  const report = savedReport ?? (isPreview && pendingReport?.id === id ? pendingReport : null);
  const isGoalReport = report?.mode === 'GOAL';
  const goalReport = isGoalReport ? (report as GoalReport) : null;
  const alreadySubmitted = goalReport ? isReportSubmitted(goalReport.id) || submitted : false;
  const goalAward = goalReport ? determineGoalAward(goalReport.categories) : null;

  const handleSave = () => {
    if (!report || savedReport) return;
    addReport(report);
    incrementAnalysesUsed();
    clearDraft();
    router.replace(`/report/${report.id}`);
  };

  const handleSubmitToHallOfFame = () => {
    if (!goalReport || !profile) return;

    const result = submitFromReport(goalReport, profile);
    if (!result.ok) {
      if (result.reason === 'duplicate') {
        Alert.alert(
          'Already submitted',
          'This clip is already in your local Hall of Fame.',
          [{ text: 'View Hall of Fame', onPress: () => router.push('/hall-of-fame') }]
        );
      }
      return;
    }

    setSubmitted(true);
    Alert.alert(
      'Submitted to Hall of Fame',
      `${goalAward?.emoji} ${goalAward?.label} — your goal is now in the local leaderboard.`,
      [
        { text: 'Stay here', style: 'cancel' },
        { text: 'View Hall of Fame', onPress: () => router.push('/hall-of-fame') },
      ]
    );
  };

  const handleAnalyzeAnother = () => {
    clearDraft();
    router.replace('/(upload)');
  };

  if (!report) {
    return (
      <View className="flex-1 bg-background">
        <ScreenHeader title="Report" showBack onBack={() => router.back()} />
        <View className="flex-1 items-center justify-center px-8 gap-4">
          <Text className="text-text-secondary text-center">This report could not be found.</Text>
          <Button label="Go home" onPress={() => router.replace('/(tabs)')} fullWidth />
        </View>
      </View>
    );
  }

  const showPreviewActions = isPreview && !savedReport;
  const showHallOfFameSubmit = isGoalReport && savedReport && !alreadySubmitted;
  const showHallOfFameBadge = isGoalReport && alreadySubmitted;

  const footer = showPreviewActions ? (
    <View className="gap-3 mt-2">
      <Button label="Save report" onPress={handleSave} fullWidth size="lg" />
      <Button
        label="Analyze another clip"
        variant="secondary"
        onPress={handleAnalyzeAnother}
        fullWidth
      />
    </View>
  ) : (
    <View className="gap-3 mt-2">
      {showHallOfFameSubmit ? (
        <Button
          label="Submit to Hall of Fame"
          onPress={handleSubmitToHallOfFame}
          fullWidth
          size="lg"
        />
      ) : null}
      {showHallOfFameBadge ? (
        <View className="bg-primary-muted border border-primary/30 rounded-xl px-4 py-3 items-center gap-1">
          <Text className="text-primary text-sm font-semibold">🏆 In Hall of Fame</Text>
          <Button
            label="View Hall of Fame"
            variant="ghost"
            onPress={() => router.push('/hall-of-fame')}
            fullWidth
          />
        </View>
      ) : null}
      <Button
        label="Analyze another clip"
        variant="secondary"
        onPress={handleAnalyzeAnother}
        fullWidth
      />
    </View>
  );

  return (
    <View className="flex-1 bg-background">
      <ScreenHeader
        title="Coaching report"
        subtitle={showPreviewActions ? 'Review before saving' : 'Your saved report'}
        showBack
        onBack={() => router.back()}
      />
      <View className="flex-1 px-4">
        <ReportDetailView
          report={report}
          bottomPadding={
            showPreviewActions || showHallOfFameSubmit
              ? insets.bottom + 160
              : insets.bottom + 24
          }
          footer={footer}
        />
      </View>
    </View>
  );
}
