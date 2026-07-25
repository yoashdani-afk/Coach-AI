import { ScrollView, View, Text, Pressable } from 'react-native';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { Button, Card } from '@/components/ui';
import { ReportListCard } from '@/components/analysis/ReportListCard';
import { getTimeGreeting } from '@/lib/format';
import { EXAMPLE_ANALYSIS, HOW_IT_WORKS } from '@/lib/mockData';
import {
  FREE_TIER_ANALYSES_PER_MONTH,
  labelForGoal,
  labelForLevel,
  labelForPosition,
} from '@/lib/constants';
import { getLatestReport, useAnalysisStore } from '@/stores/analysisStore';
import { getRemainingAnalyses, useProfileStore } from '@/stores/profileStore';

export default function HomeScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const profile = useProfileStore((s) => s.profile);
  const reports = useAnalysisStore((s) => s.reports);
  const remaining = getRemainingAnalyses(profile);
  const latestReport = getLatestReport(reports);
  const hasRealAnalyses = reports.length > 0;

  const firstName = profile?.firstName ?? 'Player';
  const positionLabel = profile ? labelForPosition(profile.mainPosition) : '';
  const levelLabel = profile ? labelForLevel(profile.playingLevel) : '';
  const trainingFocus = profile?.improvementGoals.slice(0, 2) ?? [];

  const handleUpload = () => {
    if (remaining <= 0) return;
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
                {positionLabel} · {levelLabel}
              </Text>
            ) : null}
          </View>

          <Card variant="elevated" className="flex-row items-center justify-between">
            <View className="flex-1 pr-4">
              <Text className="text-text-primary font-semibold text-base mb-1">Analyses this month</Text>
              <Text className="text-text-secondary text-sm">
                {remaining} of {FREE_TIER_ANALYSES_PER_MONTH} remaining
              </Text>
            </View>
            <View className="bg-primary-muted px-3 py-1.5 rounded-full">
              <Text className="text-primary text-sm font-semibold">{remaining} left</Text>
            </View>
          </Card>

          <Button
            label="Upload a clip"
            onPress={handleUpload}
            disabled={remaining <= 0}
            fullWidth
            size="lg"
          />

          {remaining <= 0 ? (
            <Text className="text-text-muted text-sm text-center -mt-2">
              You have used all free analyses this month.
            </Text>
          ) : null}

          <Pressable
            onPress={() => router.push('/hall-of-fame')}
            className="active:opacity-80"
          >
            <Card variant="outlined" className="flex-row items-center gap-4 border-primary/20 bg-primary-muted/10">
              <View className="w-14 h-14 rounded-2xl bg-primary/15 items-center justify-center">
                <Text className="text-2xl">🏆</Text>
              </View>
              <View className="flex-1">
                <Text className="text-text-primary font-bold text-lg">Hall of Fame</Text>
                <Text className="text-text-secondary text-sm mt-0.5">
                  Discover the highest-rated goals.
                </Text>
              </View>
              <Ionicons name="chevron-forward" size={20} color="#00C853" />
            </Card>
          </Pressable>

          <Card variant="outlined" className="gap-4">
            <Text className="text-text-primary font-semibold text-base">How it works</Text>
            {HOW_IT_WORKS.map((item) => (
              <View key={item.step} className="flex-row gap-3">
                <View className="w-8 h-8 rounded-full bg-primary-muted items-center justify-center">
                  <Text className="text-primary font-bold text-sm">{item.step}</Text>
                </View>
                <View className="flex-1">
                  <Text className="text-text-primary font-medium">{item.title}</Text>
                  <Text className="text-text-secondary text-sm mt-0.5 leading-5">{item.body}</Text>
                </View>
              </View>
            ))}
          </Card>

          {trainingFocus.length > 0 ? (
            <Card variant="outlined" className="gap-3">
              <View className="flex-row items-center gap-2">
                <Ionicons name="fitness-outline" size={18} color="#00C853" />
                <Text className="text-text-primary font-semibold text-base">Your training focus</Text>
              </View>
              <Text className="text-text-secondary text-sm leading-5">
                Based on your goals, prioritise{' '}
                {trainingFocus.map((g) => labelForGoal(g).toLowerCase()).join(' and ')} in your next
                sessions.
              </Text>
            </Card>
          ) : null}

          <View>
            <View className="flex-row items-center justify-between mb-3 px-1">
              <Text className="text-text-muted text-xs uppercase tracking-wider">
                {hasRealAnalyses ? 'Latest coaching report' : 'Example coaching report'}
              </Text>
              {hasRealAnalyses ? (
                <Pressable onPress={() => router.push('/reports/history')} className="active:opacity-70">
                  <Text className="text-primary text-xs font-medium">View all</Text>
                </Pressable>
              ) : null}
            </View>

            {latestReport ? (
              <ReportListCard
                report={latestReport}
                onPress={() => router.push(`/report/${latestReport.id}`)}
              />
            ) : (
              <>
                <Card variant="outlined" className="gap-4 mb-3">
                  <View className="flex-row items-center gap-2 mb-1">
                    <Text className="text-text-primary font-semibold">{EXAMPLE_ANALYSIS.title}</Text>
                    <View className="bg-surface-elevated px-2 py-0.5 rounded">
                      <Text className="text-text-muted text-[10px] uppercase">Example</Text>
                    </View>
                  </View>
                  <Text className="text-text-muted text-sm mb-2">{EXAMPLE_ANALYSIS.dateLabel}</Text>
                  <Text className="text-text-secondary text-sm leading-5">
                    {EXAMPLE_ANALYSIS.summary}
                  </Text>
                </Card>

                <Card variant="default" className="items-center py-8 gap-2">
                  <Ionicons name="videocam-outline" size={32} color="#6B6B73" />
                  <Text className="text-text-primary font-medium text-center">No reports yet</Text>
                  <Text className="text-text-secondary text-sm text-center px-4 leading-5">
                    Select a clip, choose a coaching mode, and save your first report.
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
