import { ScrollView, View, Text, Pressable } from 'react-native';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { ScreenHeader } from '@/components/layout/ScreenHeader';
import { Card } from '@/components/ui';
import { labelForAnalysisMode } from '@/lib/constants';
import { formatReportDateShort } from '@/lib/format';
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
        <ScreenHeader title="Progress" subtitle="Track your improvement" />
        <View className="flex-1 px-4" style={{ paddingBottom: insets.bottom + 24 }}>
          <Card variant="outlined" className="items-center py-12 mt-4 gap-4">
            <View className="w-16 h-16 rounded-2xl bg-surface-elevated items-center justify-center">
              <Ionicons name="analytics-outline" size={32} color="#6B6B73" />
            </View>
            <Text className="text-text-primary text-lg font-semibold text-center">No reports yet</Text>
            <Text className="text-text-secondary text-sm text-center leading-6 px-4">
              Your saved coaching reports will appear here after you analyse a clip.
            </Text>
          </Card>
        </View>
      </View>
    );
  }

  return (
    <View className="flex-1 bg-background">
      <ScreenHeader title="Progress" subtitle="Track your improvement" />
      <ScrollView
        className="px-4"
        contentContainerStyle={{ paddingBottom: insets.bottom + 24, gap: 16 }}
        showsVerticalScrollIndicator={false}
      >
        <View className="flex-row gap-3">
          <Card variant="elevated" className="flex-1 items-center py-4">
            <Text className="text-text-muted text-xs uppercase tracking-wider mb-1">Clips</Text>
            <Text className="text-text-primary text-3xl font-bold">{reports.length}</Text>
            <Text className="text-text-muted text-xs mt-1">analysed</Text>
          </Card>
          {latest ? (
            <Card variant="elevated" className="flex-1 items-center py-4 px-2">
              <Text className="text-text-muted text-xs uppercase tracking-wider mb-1">Latest</Text>
              <Text className="text-text-primary text-sm font-semibold text-center" numberOfLines={2}>
                {latest.title}
              </Text>
              <Text className="text-text-muted text-xs mt-1">{labelForAnalysisMode(latest.mode)}</Text>
            </Card>
          ) : null}
        </View>

        {modeCounts.length > 0 ? (
          <Card variant="outlined" className="gap-3">
            <Text className="text-text-primary font-semibold text-base">Analysis modes used</Text>
            {modeCounts.map((item) => (
              <View key={item.mode} className="flex-row items-center justify-between">
                <Text className="text-text-secondary text-sm flex-1 pr-3">
                  {labelForAnalysisMode(item.mode)}
                </Text>
                <Text className="text-primary font-semibold text-sm">{item.count}</Text>
              </View>
            ))}
          </Card>
        ) : null}

        <View>
          <View className="flex-row items-center justify-between mb-3">
            <Text className="text-text-primary font-semibold text-base">Report history</Text>
            <Pressable onPress={() => router.push('/reports/history')} className="active:opacity-70">
              <Text className="text-primary text-sm font-medium">View all</Text>
            </Pressable>
          </View>
          <View className="gap-3">
            {sorted.slice(0, 5).map((report) => (
              <Pressable
                key={report.id}
                onPress={() => router.push(`/report/${report.id}`)}
                className="active:opacity-80"
              >
                <Card variant="outlined" className="gap-2">
                  <Text className="text-text-muted text-xs uppercase tracking-wider">
                    {labelForAnalysisMode(report.mode)}
                  </Text>
                  <Text className="text-text-primary font-medium" numberOfLines={2}>
                    {report.title}
                  </Text>
                  <Text className="text-text-muted text-sm">
                    {formatReportDateShort(report.createdAt)}
                  </Text>
                  <Text className="text-text-secondary text-sm leading-5" numberOfLines={2}>
                    {report.summary}
                  </Text>
                </Card>
              </Pressable>
            ))}
          </View>
        </View>
      </ScrollView>
    </View>
  );
}
