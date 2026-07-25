import { ScrollView, View, Text } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { CategoryScoreList } from '@/components/analysis/CategoryScoreList';
import { Card } from '@/components/ui';
import { labelForAnalysisMode } from '@/lib/constants';
import { formatReportDate } from '@/lib/format';
import type { CoachingReport } from '@/types/analysis';

interface ReportDetailViewProps {
  report: CoachingReport;
  bottomPadding?: number;
  footer?: React.ReactNode;
}

export function ReportDetailView({ report, bottomPadding = 24, footer }: ReportDetailViewProps) {
  const clipLabel = report.clip.fileName ?? 'Selected clip';

  return (
    <ScrollView
      contentContainerStyle={{ paddingBottom: bottomPadding, gap: 16 }}
      showsVerticalScrollIndicator={false}
    >
      <View className="bg-primary-muted border border-primary/30 rounded-xl px-4 py-3 flex-row items-center gap-2">
        <Ionicons name="information-circle-outline" size={18} color="#00C853" />
        <Text className="text-text-secondary text-sm flex-1 leading-5">Demo Report</Text>
      </View>

      <Card variant="elevated" className="gap-3">
        <Text className="text-text-muted text-xs uppercase tracking-wider">
          {labelForAnalysisMode(report.mode)}
        </Text>
        <Text className="text-text-primary text-lg font-semibold leading-6">{report.title}</Text>
        <Text className="text-text-muted text-sm">
          {formatReportDate(report.createdAt)} · {clipLabel}
        </Text>
        {report.mode === 'COACH_ME' && report.context ? (
          <View className="bg-surface rounded-xl p-3 mt-1">
            <Text className="text-text-muted text-xs uppercase tracking-wider mb-1">Your context</Text>
            <Text className="text-text-secondary text-sm leading-5">{report.context}</Text>
          </View>
        ) : null}
      </Card>

      {report.mode === 'COACH_ME' ? <CoachMeSections report={report} /> : null}
      {report.mode === 'PERFORMANCE' ? <PerformanceSections report={report} /> : null}
      {report.mode === 'GOAL' ? <GoalSections report={report} /> : null}

      {footer}
    </ScrollView>
  );
}

function CoachMeSections({ report }: { report: Extract<CoachingReport, { mode: 'COACH_ME' }> }) {
  return (
    <>
      <ReportSection title="Verdict">
        <Card variant="outlined" className="bg-primary-muted/20 border-primary/20">
          <Text className="text-text-primary text-base leading-6 font-medium">{report.verdict}</Text>
        </Card>
      </ReportSection>

      <ReportSection title="What you did well">
        {report.didWell.map((item, i) => (
          <BulletItem key={i} text={item} variant="positive" />
        ))}
      </ReportSection>

      <ReportSection title="What could improve">
        {report.couldImprove.map((item, i) => (
          <BulletItem key={i} text={item} variant="negative" />
        ))}
      </ReportSection>

      <ReportSection title="Better option">
        <Text className="text-text-secondary text-base leading-6">{report.betterOption}</Text>
      </ReportSection>

      <ReportSection title="Training takeaway">
        <Card variant="outlined" className="bg-surface-elevated/50">
          <Text className="text-text-primary text-base leading-6">{report.trainingTakeaway}</Text>
        </Card>
      </ReportSection>
    </>
  );
}

function PerformanceSections({
  report,
}: {
  report: Extract<CoachingReport, { mode: 'PERFORMANCE' }>;
}) {
  return (
    <>
      <ReportSection title="Category scores">
        <CategoryScoreList
          categories={report.categories}
          showOverall
          overallScore={report.overallScore}
        />
      </ReportSection>

      <ReportSection title="Top strength">
        <Card variant="outlined" className="bg-primary-muted/20 border-primary/20">
          <Text className="text-text-primary text-base leading-6">{report.topStrength}</Text>
        </Card>
      </ReportSection>

      <ReportSection title="Biggest improvement area">
        <Card variant="outlined">
          <Text className="text-text-secondary text-base leading-6">{report.biggestImprovement}</Text>
        </Card>
      </ReportSection>

      <ReportSection title="Coach's summary">
        <Text className="text-text-secondary text-base leading-6">{report.coachSummary}</Text>
      </ReportSection>

      <ReportSection title="Training recommendation">
        <Card variant="outlined" className="bg-surface-elevated/50">
          <Text className="text-text-primary text-base leading-6">
            {report.trainingRecommendation}
          </Text>
        </Card>
      </ReportSection>
    </>
  );
}

function GoalSections({ report }: { report: Extract<CoachingReport, { mode: 'GOAL' }> }) {
  return (
    <>
      <ReportSection title="Ratings">
        <CategoryScoreList
          categories={report.categories}
          showOverall
          overallScore={report.overallScore}
          overallLabel="Demo Score"
        />
      </ReportSection>

      <ReportSection title="Why it scored this way">
        <Text className="text-text-secondary text-base leading-6">{report.whyScoredThisWay}</Text>
      </ReportSection>

      <ReportSection title="One thing that made it excellent">
        <Card variant="outlined" className="bg-primary-muted/20 border-primary/20">
          <Text className="text-text-primary text-base leading-6">{report.excellentPoint}</Text>
        </Card>
      </ReportSection>

      <ReportSection title="One thing that could make it even better">
        <Card variant="outlined">
          <Text className="text-text-secondary text-base leading-6">{report.couldBeBetter}</Text>
        </Card>
      </ReportSection>
    </>
  );
}

function ReportSection({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <View className="gap-3">
      <Text className="text-text-primary text-lg font-bold">{title}</Text>
      {children}
    </View>
  );
}

function BulletItem({ text, variant }: { text: string; variant: 'positive' | 'negative' }) {
  const color = variant === 'positive' ? '#00C853' : '#FFB300';
  const icon = variant === 'positive' ? 'checkmark-circle' : 'alert-circle';
  return (
    <View className="flex-row gap-3 mb-2">
      <Ionicons name={icon} size={18} color={color} style={{ marginTop: 2 }} />
      <Text className="text-text-secondary text-sm leading-5 flex-1">{text}</Text>
    </View>
  );
}
