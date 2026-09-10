import { ScrollView, View, Text } from 'react-native';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { Card } from '@/components/ui';
import {
  HomeHallOfFameCard,
  HomeHowItWorksCard,
  HomeLatestReportCard,
  HomeTrainingFocusCard,
  HomeUploadHero,
  HomeUsageCard,
} from '@/components/home/HomeSections';
import { getTimeGreeting } from '@/lib/format';
import { EXAMPLE_ANALYSIS } from '@/lib/mockData';
import {
  labelForGoal,
  labelForLevel,
  labelForPosition,
} from '@/lib/constants';
import { getLatestReport, useAnalysisStore } from '@/stores/analysisStore';
import { getRemainingAnalyses, useProfileStore } from '@/stores/profileStore';
import { isDevUnlimitedAnalyses } from '@/lib/analysisCredits';

export default function HomeScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const profile = useProfileStore((s) => s.profile);
  const reports = useAnalysisStore((s) => s.reports);
  const remaining = getRemainingAnalyses(profile);
  const latestReport = getLatestReport(reports);
  const hasRealAnalyses = reports.length > 0;
  const unlimited = isDevUnlimitedAnalyses();

  const firstName = profile?.firstName ?? 'Player';
  const positionLabel = profile ? labelForPosition(profile.mainPosition) : '';
  const levelLabel = profile ? labelForLevel(profile.playingLevel) : '';
  const trainingFocus = profile?.improvementGoals.slice(0, 2) ?? [];
  const trainingFocusLabels = trainingFocus.map((g) => labelForGoal(g));

  const handleUpload = () => {
    if (!unlimited && remaining <= 0) return;
    router.push('/(upload)');
  };

  return (
    <View className="flex-1 bg-background">
      <ScrollView
        contentContainerStyle={{ paddingTop: 16, paddingBottom: insets.bottom + 24 }}
        showsVerticalScrollIndicator={false}
      >
        <View className="px-4 gap-5">
          <View>
            <Text className="text-text-secondary text-base">{getTimeGreeting()},</Text>
            <Text className="text-text-primary text-3xl font-bold">{firstName}</Text>
            {profile ? (
              <Text className="text-text-muted text-sm mt-1">
                Playing as {positionLabel} · {levelLabel}
              </Text>
            ) : null}
          </View>

          <HomeUploadHero
            onPress={handleUpload}
            disabled={!unlimited && remaining <= 0}
          />

          {!unlimited && remaining <= 0 ? (
            <Text className="text-text-muted text-sm text-center -mt-2">
              No analyses left this month. Come back when your limit resets to upload again.
            </Text>
          ) : null}

          <HomeUsageCard remaining={remaining} unlimited={unlimited} />

          <HomeHallOfFameCard onPress={() => router.push('/(tabs)/hall-of-fame')} />

          <HomeHowItWorksCard />

          <HomeTrainingFocusCard
            goalLabels={trainingFocusLabels}
            onEditGoals={() => router.push('/(tabs)/profile')}
          />

          <View>
            <View className="flex-row items-center justify-between mb-3 px-1">
              <Text className="text-text-muted text-xs uppercase tracking-wider">
                {hasRealAnalyses ? 'Latest coaching report' : 'What your reports look like'}
              </Text>
              {hasRealAnalyses ? (
                <Text
                  onPress={() => router.push('/reports/history')}
                  className="text-primary text-xs font-medium"
                >
                  View all
                </Text>
              ) : null}
            </View>

            {latestReport ? (
              <HomeLatestReportCard
                report={latestReport}
                onPress={() => router.push(`/report/${latestReport.id}`)}
              />
            ) : (
              <>
                <Card variant="outlined" className="gap-3 mb-3">
                  <View className="flex-row items-center gap-2 flex-wrap">
                    <Text className="text-text-primary font-semibold">{EXAMPLE_ANALYSIS.title}</Text>
                    <View className="bg-surface-elevated px-2 py-0.5 rounded">
                      <Text className="text-text-muted text-[10px] uppercase">Example</Text>
                    </View>
                  </View>
                  <Text className="text-text-muted text-sm">{EXAMPLE_ANALYSIS.dateLabel}</Text>
                  <Text className="text-text-secondary text-sm leading-5">
                    {EXAMPLE_ANALYSIS.summary}
                  </Text>
                  <Text className="text-text-muted text-xs leading-5">
                    Example only — upload a clip to get your own.
                  </Text>
                </Card>

                <Card variant="default" className="items-center py-8 gap-2">
                  <Ionicons name="videocam-outline" size={32} color="#6B6B73" />
                  <Text className="text-text-primary font-medium text-center">No reports yet</Text>
                  <Text className="text-text-secondary text-sm text-center px-4 leading-5">
                    Upload a clip above to generate your first coaching report. It’ll show up here.
                  </Text>
                </Card>
              </>
            )}
          </View>
        </View>
      </ScrollView>
    </View>
  );
}
