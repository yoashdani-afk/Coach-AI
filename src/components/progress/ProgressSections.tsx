import { View, Text, Pressable } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Card } from '@/components/ui';
import { formatReportDateShort } from '@/lib/format';
import {
  accentForMode,
  MODE_ICON,
  scoreBandColor,
  shortLabelForMode,
} from '@/lib/modeAccents';
import type { AnalysisMode, CoachingReport } from '@/types/analysis';

const PRIMARY_GREEN = '#00C853';

export function ProgressClipsStatCard({ count }: { count: number }) {
  return (
    <Card
      variant="elevated"
      className="flex-1 gap-2 overflow-hidden py-4"
      style={{ borderLeftWidth: 2, borderLeftColor: `${PRIMARY_GREEN}66` }}
    >
      <View
        className="w-10 h-10 rounded-xl items-center justify-center"
        style={{ backgroundColor: `${PRIMARY_GREEN}33` }}
      >
        <Ionicons name="videocam" size={20} color={PRIMARY_GREEN} />
      </View>
      <Text className="text-text-muted text-xs uppercase tracking-wider">Clips analysed</Text>
      <Text className="text-text-primary text-3xl font-bold">{count}</Text>
      <Text className="text-text-muted text-xs leading-4">Saved coaching reports</Text>
    </Card>
  );
}

export function ProgressLatestStatCard({
  report,
  onPress,
}: {
  report: CoachingReport;
  onPress: () => void;
}) {
  const accent = accentForMode(report.mode);
  const showScore = report.mode !== 'COACH_ME';

  return (
    <Pressable onPress={onPress} className="flex-1 active:opacity-80" accessibilityRole="button">
      <Card
        variant="elevated"
        className="gap-2 overflow-hidden py-4 h-full"
        style={{ borderLeftWidth: 2, borderLeftColor: `${accent}66` }}
      >
        <View
          className="w-10 h-10 rounded-xl items-center justify-center"
          style={{ backgroundColor: `${accent}33` }}
        >
          <Ionicons name={MODE_ICON[report.mode]} size={20} color={accent} />
        </View>
        <Text className="text-text-muted text-xs uppercase tracking-wider">Latest report</Text>
        <Text className="text-text-primary text-sm font-semibold" numberOfLines={2}>
          {report.title}
        </Text>
        <View className="flex-row items-center flex-wrap gap-1.5">
          <View className="px-2 py-0.5 rounded-full" style={{ backgroundColor: `${accent}33` }}>
            <Text className="text-[10px] font-semibold" style={{ color: accent }}>
              {shortLabelForMode(report.mode)}
            </Text>
          </View>
          {showScore ? (
            <Text className="text-xs font-semibold" style={{ color: scoreBandColor(report.overallScore) }}>
              {report.overallScore.toFixed(1)}
            </Text>
          ) : null}
        </View>
        <Text className="text-text-muted text-xs">{formatReportDateShort(report.createdAt)}</Text>
      </Card>
    </Pressable>
  );
}

export function ProgressModesCard({
  modeCounts,
  total,
}: {
  modeCounts: { mode: AnalysisMode; count: number }[];
  total: number;
}) {
  if (modeCounts.length === 0 || total <= 0) return null;

  return (
    <Card variant="outlined" className="gap-4 overflow-hidden">
      <View className="gap-1">
        <Text className="text-text-primary font-semibold text-base">Coaching modes</Text>
        <Text className="text-text-secondary text-sm leading-5">
          How your reports break down by mode
        </Text>
      </View>

      <View className="h-2 rounded-full overflow-hidden flex-row bg-border">
        {modeCounts.map((item, index) => (
          <View
            key={item.mode}
            style={{
              flex: item.count,
              backgroundColor: accentForMode(item.mode),
              marginLeft: index === 0 ? 0 : 1,
            }}
          />
        ))}
      </View>

      <View className="gap-2.5">
        {modeCounts.map((item) => {
          const accent = accentForMode(item.mode);
          const pct = Math.round((item.count / total) * 100);
          return (
            <View key={item.mode} className="flex-row items-center gap-3">
              <View
                className="w-8 h-8 rounded-lg items-center justify-center"
                style={{ backgroundColor: `${accent}33` }}
              >
                <Ionicons name={MODE_ICON[item.mode]} size={16} color={accent} />
              </View>
              <Text className="text-text-secondary text-sm flex-1">
                {shortLabelForMode(item.mode)}
              </Text>
              <Text className="text-text-muted text-xs">{pct}%</Text>
              <Text className="font-semibold text-sm" style={{ color: accent }}>
                {item.count}
              </Text>
            </View>
          );
        })}
      </View>
    </Card>
  );
}

export function ProgressRecentReportRow({
  report,
  onPress,
}: {
  report: CoachingReport;
  onPress: () => void;
}) {
  const accent = accentForMode(report.mode);
  const showScore = report.mode !== 'COACH_ME';
  const scoreColor = showScore ? scoreBandColor(report.overallScore) : accent;

  return (
    <Pressable onPress={onPress} className="active:opacity-80" accessibilityRole="button">
      <Card
        variant="outlined"
        className="flex-row items-start gap-3 overflow-hidden"
        style={{ borderLeftWidth: 2, borderLeftColor: `${accent}99` }}
      >
        {showScore ? (
          <View
            className="w-11 h-11 rounded-xl items-center justify-center"
            style={{
              backgroundColor: `${scoreColor}22`,
              borderWidth: 1.5,
              borderColor: `${scoreColor}66`,
            }}
          >
            <Text className="text-base font-bold" style={{ color: scoreColor }}>
              {report.overallScore.toFixed(1)}
            </Text>
          </View>
        ) : (
          <View
            className="w-11 h-11 rounded-xl items-center justify-center"
            style={{ backgroundColor: `${accent}33` }}
          >
            <Ionicons name="chatbubbles" size={20} color={accent} />
          </View>
        )}

        <View className="flex-1 gap-1">
          <Text className="text-text-primary font-medium" numberOfLines={2}>
            {report.title}
          </Text>
          <View className="flex-row items-center flex-wrap gap-2">
            <View className="px-2 py-0.5 rounded-full" style={{ backgroundColor: `${accent}33` }}>
              <Text className="text-[10px] font-semibold" style={{ color: accent }}>
                {shortLabelForMode(report.mode)}
              </Text>
            </View>
            <Text className="text-text-muted text-xs">{formatReportDateShort(report.createdAt)}</Text>
          </View>
          <Text className="text-text-secondary text-sm leading-5" numberOfLines={2}>
            {report.summary}
          </Text>
        </View>

        <Ionicons name="chevron-forward" size={16} color={accent} style={{ marginTop: 4 }} />
      </Card>
    </Pressable>
  );
}

export function ProgressEmptyState() {
  return (
    <Card variant="outlined" className="items-center py-12 mt-4 gap-4">
      <View className="w-16 h-16 rounded-2xl bg-surface-elevated items-center justify-center">
        <Ionicons name="analytics-outline" size={32} color="#6B6B73" />
      </View>
      <Text className="text-text-primary text-lg font-semibold text-center">No reports yet</Text>
      <Text className="text-text-secondary text-sm text-center leading-6 px-4">
        Upload a clip from Home to get your first coaching report. Scores and mode breakdowns will
        show up here.
      </Text>
    </Card>
  );
}
