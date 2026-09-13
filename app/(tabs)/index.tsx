import { useState } from 'react';
import { ScrollView, View, Text, Pressable } from 'react-native';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import {
  HomeBrandBar,
  HomeEmptyReports,
  HomeHallOfFameCard,
  HomeHowItWorksController,
  HomeIdentityUsageCard,
  HomeLatestReportCard,
  HomeSectionEnter,
  HomeTrainingFocusCard,
  HomeUploadHero,
} from '@/components/home/HomeSections';
import { getTimeGreeting } from '@/lib/format';
import {
  labelForGoal,
  labelForLevel,
  labelForPosition,
} from '@/lib/constants';
import { getLatestReport, useAnalysisStore } from '@/stores/analysisStore';
import { getRemainingAnalyses, useProfileStore } from '@/stores/profileStore';
import { isDevUnlimitedAnalyses } from '@/lib/analysisCredits';
import { getAnalysisLimit, proPaywallHref } from '@/lib/entitlements';
import { useIsPro } from '@/stores/entitlementStore';

export default function HomeScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const [howItWorksOpen, setHowItWorksOpen] = useState(false);
  const profile = useProfileStore((s) => s.profile);
  const isPro = useIsPro();
  const analysesMonthlyLimit = useProfileStore((s) => s.analysesMonthlyLimit);
  const effectiveLimit = Math.max(analysesMonthlyLimit, getAnalysisLimit(isPro));
  const reports = useAnalysisStore((s) => s.reports);
  const remaining = getRemainingAnalyses(profile, effectiveLimit);
  const latestReport = getLatestReport(reports);
  const hasRealAnalyses = reports.length > 0;
  const unlimited = isDevUnlimitedAnalyses();
  const analysesDepleted = !unlimited && remaining <= 0;

  const firstName = profile?.firstName ?? 'Player';
  const positionLabel = profile ? labelForPosition(profile.mainPosition) : '';
  const levelLabel = profile ? labelForLevel(profile.playingLevel) : '';
  const trainingFocus = profile?.improvementGoals.slice(0, 2) ?? [];
  const trainingFocusLabels = trainingFocus.map((g) => labelForGoal(g));
  const identityLine = profile
    ? `${positionLabel} · ${levelLabel}`
    : 'Keep building. Keep competing.';

  const handleUpload = () => {
    if (analysesDepleted) {
      router.push(proPaywallHref('analyses'));
      return;
    }
    router.push('/(upload)');
  };

  let section = 0;
  const next = () => {
    const i = section;
    section += 1;
    return i;
  };

  return (
    <View className="flex-1 bg-background">
      <ScrollView
        contentContainerStyle={{
          paddingTop: 8,
          paddingBottom: insets.bottom + 28,
        }}
        showsVerticalScrollIndicator={false}
      >
        <View className="px-4 gap-3.5">
          <HomeSectionEnter index={next()}>
            <HomeBrandBar onInfoPress={() => setHowItWorksOpen(true)} />
          </HomeSectionEnter>

          <HomeSectionEnter index={next()}>
            <HomeIdentityUsageCard
              greeting={getTimeGreeting()}
              firstName={firstName}
              subtitle={identityLine}
              remaining={remaining}
              unlimited={unlimited}
              limit={effectiveLimit}
              periodEnd={profile?.analysesPeriodEnd}
            />
          </HomeSectionEnter>

          <HomeSectionEnter index={next()}>
            <HomeUploadHero onPress={handleUpload} depleted={analysesDepleted} />
          </HomeSectionEnter>

          <HomeSectionEnter index={next()}>
            <View className="gap-2.5">
              <View className="flex-row items-center justify-between px-0.5">
                <Text className="text-text-primary text-[17px] font-bold tracking-tight">
                  Explore insights
                </Text>
                <Pressable
                  onPress={() => router.push('/(tabs)/progress')}
                  hitSlop={8}
                  className="active:opacity-70"
                >
                  <Text style={{ color: '#00C853', fontSize: 13, fontWeight: '600' }}>
                    View all ›
                  </Text>
                </Pressable>
              </View>
              <View className="flex-row gap-3" style={{ minHeight: 168 }}>
                <HomeHallOfFameCard onPress={() => router.push('/(tabs)/hall-of-fame')} />
                <HomeTrainingFocusCard
                  goalLabels={trainingFocusLabels}
                  onEditGoals={() => router.push('/(tabs)/profile')}
                />
              </View>
            </View>
          </HomeSectionEnter>

          <HomeSectionEnter index={next()}>
            <View className="gap-2.5">
              <View className="flex-row items-center justify-between px-0.5">
                <Text className="text-text-primary text-[17px] font-bold tracking-tight">
                  Latest report
                </Text>
                {hasRealAnalyses ? (
                  <Pressable
                    onPress={() =>
                      latestReport
                        ? router.push(`/report/${latestReport.id}`)
                        : router.push('/reports/history')
                    }
                    hitSlop={8}
                    className="active:opacity-70"
                  >
                    <Text style={{ color: '#00C853', fontSize: 13, fontWeight: '600' }}>
                      View full report ›
                    </Text>
                  </Pressable>
                ) : null}
              </View>

              {latestReport ? (
                <HomeLatestReportCard
                  report={latestReport}
                  onPress={() => router.push(`/report/${latestReport.id}`)}
                />
              ) : (
                <HomeEmptyReports onUpload={handleUpload} />
              )}
            </View>
          </HomeSectionEnter>
        </View>
      </ScrollView>

      <HomeHowItWorksController
        open={howItWorksOpen}
        onClose={() => setHowItWorksOpen(false)}
      />
    </View>
  );
}
