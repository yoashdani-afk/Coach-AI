import { Pressable, View, Text } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Card } from '@/components/ui';
import { labelForAnalysisMode } from '@/lib/constants';
import { formatReportDateShort } from '@/lib/format';
import type { CoachingReport } from '@/types/analysis';

interface ReportListCardProps {
  report: CoachingReport;
  onPress: () => void;
}

export function ReportListCard({ report, onPress }: ReportListCardProps) {
  const clipLabel = report.clip.fileName ?? 'Selected clip';
  const modeLabel = labelForAnalysisMode(report.mode);
  const scoreLabel =
    report.mode !== 'COACH_ME' ? `${report.overallScore.toFixed(1)}/10 · ` : '';

  return (
    <Pressable onPress={onPress} className="active:opacity-80">
      <Card variant="outlined" className="gap-3">
        <View className="flex-row items-start justify-between gap-3">
          <View className="flex-1">
            <View className="flex-row items-center gap-2 flex-wrap mb-1">
              <Text className="text-text-primary font-semibold text-base flex-1" numberOfLines={2}>
                {report.title}
              </Text>
              {report.isDemo ? (
                <View className="bg-surface-elevated px-2 py-0.5 rounded">
                  <Text className="text-text-muted text-[10px] uppercase">Demo</Text>
                </View>
              ) : null}
            </View>
            <Text className="text-text-muted text-xs uppercase tracking-wider mb-1">{modeLabel}</Text>
            <Text className="text-text-muted text-sm" numberOfLines={1}>
              {scoreLabel}
              {formatReportDateShort(report.createdAt)} · {clipLabel}
            </Text>
            <Text className="text-text-secondary text-sm mt-2 leading-5" numberOfLines={2}>
              {report.summary}
            </Text>
          </View>
        </View>
        <View className="flex-row items-center gap-1">
          <Text className="text-primary text-sm font-medium">View report</Text>
          <Ionicons name="chevron-forward" size={14} color="#00C853" />
        </View>
      </Card>
    </Pressable>
  );
}
