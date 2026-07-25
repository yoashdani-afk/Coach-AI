import { ScrollView, View, Text } from 'react-native';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { ReportListCard } from '@/components/analysis/ReportListCard';
import { ScreenHeader } from '@/components/layout/ScreenHeader';
import { useAnalysisStore } from '@/stores/analysisStore';

export default function ReportHistoryScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const reports = useAnalysisStore((s) => s.reports);

  const sorted = [...reports].sort(
    (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
  );

  return (
    <View className="flex-1 bg-background">
      <ScreenHeader
        title="Report history"
        subtitle={`${reports.length} ${reports.length === 1 ? 'report' : 'reports'}`}
        showBack
        onBack={() => router.back()}
      />
      <ScrollView
        className="flex-1 px-4"
        contentContainerStyle={{ paddingBottom: insets.bottom + 24, gap: 12 }}
        showsVerticalScrollIndicator={false}
      >
        {sorted.length === 0 ? (
          <View className="items-center py-16 px-6">
            <Text className="text-text-secondary text-center leading-6">
              No reports yet. Select a clip and ask the coach a question to create your first report.
            </Text>
          </View>
        ) : (
          sorted.map((report) => (
            <ReportListCard
              key={report.id}
              report={report}
              onPress={() => router.push(`/report/${report.id}`)}
            />
          ))
        )}
      </ScrollView>
    </View>
  );
}
