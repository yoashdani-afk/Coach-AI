import { ScrollView, View, Text, Pressable } from 'react-native';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { ScreenHeader } from '@/components/layout/ScreenHeader';
import {
  ProgressClipsStatCard,
  ProgressEmptyState,
  ProgressLatestStatCard,
  ProgressModesCard,
  ProgressRecentReportRow,
} from '@/components/progress/ProgressSections';
import { getLatestReport, getModeCounts, useAnalysisStore } from '@/stores/analysisStore';

export default function ProgressScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const reports = useAnalysisStore((s) => s.reports);

  const sorted = [...reports].sort(
    (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
  );
  const latest = getLatestReport(reports);
  const modeCounts = getModeCounts(reports);

  if (reports.length === 0) {
    return (
      <View className="flex-1 bg-background">
        <ScreenHeader title="Progress" subtitle="Your coaching reports and activity" />
        <View className="flex-1 px-4" style={{ paddingBottom: insets.bottom + 24 }}>
          <ProgressEmptyState />
        </View>
      </View>
    );
  }

  return (
    <View className="flex-1 bg-background">
      <ScreenHeader title="Progress" subtitle="Your coaching reports and activity" />
      <ScrollView
        className="px-4"
        contentContainerStyle={{ paddingBottom: insets.bottom + 24, gap: 16 }}
        showsVerticalScrollIndicator={false}
      >
        <View className="flex-row items-center gap-2.5 px-0.5 pt-1">
          <View className="w-8 h-8 rounded-lg bg-primary-muted items-center justify-center">
            <Ionicons name="analytics" size={16} color="#00C853" />
          </View>
          <Text className="text-text-secondary text-sm flex-1 leading-5">
            You’ve saved {reports.length} coaching {reports.length === 1 ? 'report' : 'reports'}
          </Text>
        </View>

        <View className="flex-row gap-3 items-stretch">
          <ProgressClipsStatCard count={reports.length} />
          {latest ? (
            <ProgressLatestStatCard
              report={latest}
              onPress={() => router.push(`/report/${latest.id}`)}
            />
          ) : null}
        </View>

        <ProgressModesCard modeCounts={modeCounts} total={reports.length} />

        <View>
          <View className="flex-row items-center justify-between mb-3">
            <Text className="text-text-primary font-semibold text-base">Recent reports</Text>
            <Pressable onPress={() => router.push('/reports/history')} className="active:opacity-70">
              <Text className="text-primary text-sm font-medium">See all reports</Text>
            </Pressable>
          </View>
          <View className="gap-3">
            {sorted.slice(0, 5).map((report) => (
              <ProgressRecentReportRow
                key={report.id}
                report={report}
                onPress={() => router.push(`/report/${report.id}`)}
              />
            ))}
          </View>
        </View>
      </ScrollView>
    </View>
  );
}
