import { useState } from 'react';
import { View, Text, Alert, Platform } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Button } from '@/components/ui';
import { CoachChat } from '@/chat/CoachChat';
import { HallOfFameCelebration } from '@/components/hallOfFame/HallOfFameCelebration';
import { ReportDetailView } from '@/components/analysis/ReportDetailView';
import { ScreenHeader } from '@/components/layout/ScreenHeader';
import { useHallOfFame } from '@/services/hallOfFame/hallOfFameService';
import { useChargeAnalysisCreditOnReportOpen } from '@/hooks/useChargeAnalysisCreditOnReportOpen';
import { useAnalysisStore } from '@/stores/analysisStore';
import { useProfileStore } from '@/stores/profileStore';
import { useUploadStore } from '@/stores/uploadStore';

function showNotice(title: string, message: string) {
  if (Platform.OS === 'web' && typeof window !== 'undefined') {
    window.alert(`${title}\n\n${message}`);
    return;
  }
  Alert.alert(title, message);
}

export default function ReportScreen() {
  const { id, preview, hof } = useLocalSearchParams<{ id: string; preview?: string; hof?: string }>();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const savedReport = useAnalysisStore((s) => s.reports.find((r) => r.id === id));
  const pendingReport = useUploadStore((s) => s.pendingReport);
  const pendingHallOfFameUnlock = useUploadStore((s) => s.pendingHallOfFameUnlock);
  const addReport = useAnalysisStore((s) => s.addReport);
  const profile = useProfileStore((s) => s.profile);
  const clearDraft = useUploadStore((s) => s.clearDraft);
  const clearHallOfFameUnlock = useUploadStore((s) => s.clearHallOfFameUnlock);
  const { isReportSubmitted, tryAutoInductFromReport, isSubmitting } = useHallOfFame();
  const [inductedOnSave, setInductedOnSave] = useState(false);
  const [saving, setSaving] = useState(false);

  const isPreview = preview === '1';
  const report = savedReport ?? (isPreview && pendingReport?.id === id ? pendingReport : null);
  useChargeAnalysisCreditOnReportOpen(report);
  const inHallOfFame = report ? isReportSubmitted(report.id) || inductedOnSave : false;

  const showHallOfFameCelebration =
    (hof === '1' || pendingHallOfFameUnlock?.reportId === report?.id) && inHallOfFame;

  const celebrationTitle = pendingHallOfFameUnlock?.playTitle;

  const handleSave = async () => {
    if (!report || savedReport || saving) return;
    setSaving(true);
    addReport(report);

    let inducted = inductedOnSave;
    if (profile) {
      const result = await tryAutoInductFromReport(report, profile);
      if (result.ok) {
        setInductedOnSave(true);
        inducted = true;
      } else if (result.reason === 'not_signed_in') {
        showNotice(
          'Sign in required',
          result.message ?? 'Sign in to induct this play into the Hall of Fame.'
        );
      } else if (result.reason === 'network_error') {
        showNotice(
          'Hall of Fame unavailable',
          result.message ?? 'Could not upload your play. Your report was still saved locally.'
        );
      }
    }

    clearDraft();
    setSaving(false);
    router.replace(`/report/${report.id}${inducted ? '?hof=1' : ''}`);
  };

  const handleAnalyzeAnother = () => {
    clearDraft();
    clearHallOfFameUnlock();
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

  const footer = (
    <View className="gap-3 mt-2">
      {showHallOfFameCelebration ? (
        <HallOfFameCelebration playTitle={celebrationTitle} />
      ) : null}
      <CoachChat report={report} />
      {showPreviewActions ? (
        <>
          <Button
            label="Save report"
            onPress={() => void handleSave()}
            fullWidth
            size="lg"
            loading={saving || isSubmitting}
          />
          <Button
            label="Analyze another clip"
            variant="secondary"
            onPress={handleAnalyzeAnother}
            fullWidth
          />
        </>
      ) : (
        <>
          {inHallOfFame ? (
            <View className="bg-primary-muted border border-primary/30 rounded-xl px-4 py-3 items-center gap-1">
              <Text className="text-primary text-sm font-semibold">🏆 In Hall of Fame</Text>
              <Button
                label="View Hall of Fame"
                variant="ghost"
                onPress={() => router.push('/(tabs)/hall-of-fame')}
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
        </>
      )}
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
          bottomPadding={insets.bottom + (showPreviewActions ? 240 : 180)}
          footer={footer}
        />
      </View>
    </View>
  );
}
