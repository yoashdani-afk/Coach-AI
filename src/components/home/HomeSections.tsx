import { View, Text, Pressable } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { Button, Card } from '@/components/ui';
import { labelForAnalysisMode } from '@/lib/constants';
import { formatReportDateShort } from '@/lib/format';
import { HOW_IT_WORKS } from '@/lib/mockData';
import { UsageAnalysesCard } from '@/components/usage/UsageAnalysesCard';
import type { CoachingReport } from '@/types/analysis';

const HOF_GOLD = '#F5C542';
const FOCUS_BLUE = '#5B8DEF';

export function HomeUploadHero({
  onPress,
  disabled,
}: {
  onPress: () => void;
  disabled: boolean;
}) {
  return (
    <Pressable
      onPress={onPress}
      disabled={disabled}
      accessibilityRole="button"
      accessibilityLabel="Upload a clip"
      className={`rounded-2xl overflow-hidden ${disabled ? 'opacity-50' : 'active:opacity-90'}`}
      style={{ borderWidth: 1, borderColor: 'rgba(0, 200, 83, 0.40)' }}
    >
      <LinearGradient
        colors={['rgba(0, 200, 83, 0.22)', 'rgba(26, 26, 30, 0.98)']}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={{ padding: 20, gap: 16 }}
      >
        <View pointerEvents="none" style={{ position: 'absolute', top: -8, right: -12 }}>
          <Ionicons name="videocam" size={108} color="#00C853" style={{ opacity: 0.1 }} />
        </View>

        <View className="flex-row items-start gap-3.5">
          <View
            className="items-center justify-center bg-primary-muted"
            style={{ width: 56, height: 56, borderRadius: 14 }}
          >
            <Ionicons name="cloud-upload" size={28} color="#00C853" />
          </View>
          <View className="flex-1 gap-1.5 pt-0.5">
            <Text className="text-text-primary text-xl font-bold">Get coached on your clip</Text>
            <Text className="text-text-secondary text-sm leading-5">
              Upload 10 seconds–5 minutes of training or match footage. AI breaks down your
              decisions, technique, and impact.
            </Text>
          </View>
        </View>

        <Button
          label="Upload a clip"
          variant="primary"
          fullWidth
          size="lg"
          disabled={disabled}
          onPress={onPress}
        />
      </LinearGradient>
    </Pressable>
  );
}

/** Home usage strip — fuller copy; Profile uses UsageAnalysesCard with density="profile". */
export function HomeUsageCard({
  remaining,
  unlimited,
}: {
  remaining: number;
  unlimited: boolean;
}) {
  return <UsageAnalysesCard remaining={remaining} unlimited={unlimited} density="home" />;
}

export function HomeHallOfFameCard({ onPress }: { onPress: () => void }) {
  return (
    <Pressable onPress={onPress} className="active:opacity-80" accessibilityRole="button">
      <Card
        variant="outlined"
        className="flex-row items-center gap-3 overflow-hidden"
        style={{ borderLeftWidth: 2, borderLeftColor: `${HOF_GOLD}66` }}
      >
        <View
          className="w-12 h-12 rounded-xl items-center justify-center"
          style={{ backgroundColor: `${HOF_GOLD}33` }}
        >
          <Ionicons name="trophy" size={24} color={HOF_GOLD} />
        </View>
        <View className="flex-1 gap-0.5">
          <Text className="text-text-primary font-bold text-lg">Hall of Fame</Text>
          <Text className="text-text-secondary text-sm leading-5">
            See the best Goal-mode finishes — and earn your own spot when a rated goal makes the
            cut.
          </Text>
        </View>
        <Ionicons name="chevron-forward" size={20} color={HOF_GOLD} />
      </Card>
    </Pressable>
  );
}

export function HomeHowItWorksCard() {
  return (
    <Card
      variant="outlined"
      className="gap-0 overflow-hidden"
      style={{ backgroundColor: 'rgba(0, 200, 83, 0.06)' }}
    >
      <Text className="text-text-primary font-semibold text-base mb-4">How it works</Text>
      <View className="gap-0">
        {HOW_IT_WORKS.map((item, index) => {
          const isLast = index === HOW_IT_WORKS.length - 1;
          return (
            <View key={item.step} className="flex-row gap-3">
              <View className="items-center" style={{ width: 32 }}>
                <View
                  className="w-8 h-8 rounded-full items-center justify-center"
                  style={{
                    backgroundColor: index === 0 ? '#00C853' : '#00C85333',
                  }}
                >
                  <Text
                    className="font-bold text-sm"
                    style={{ color: index === 0 ? '#0D0D0F' : '#00C853' }}
                  >
                    {item.step}
                  </Text>
                </View>
                {!isLast ? (
                  <View className="w-0.5 flex-1 my-1" style={{ backgroundColor: '#2E2E33', minHeight: 16 }} />
                ) : null}
              </View>
              <View className={`flex-1 ${isLast ? 'pb-0' : 'pb-4'}`}>
                <Text className="text-text-primary font-medium">{item.title}</Text>
                <Text className="text-text-secondary text-sm mt-0.5 leading-5">{item.body}</Text>
              </View>
            </View>
          );
        })}
      </View>
    </Card>
  );
}

export function HomeTrainingFocusCard({
  goalLabels,
  onEditGoals,
}: {
  goalLabels: string[];
  onEditGoals: () => void;
}) {
  if (goalLabels.length === 0) return null;

  const focusList =
    goalLabels.length === 1
      ? goalLabels[0]
      : `${goalLabels.slice(0, -1).join(', ')} and ${goalLabels[goalLabels.length - 1]}`;

  return (
    <Card
      variant="outlined"
      className="gap-3 overflow-hidden"
      style={{ borderLeftWidth: 2, borderLeftColor: FOCUS_BLUE }}
    >
      <View className="flex-row items-center gap-2">
        <View
          className="w-9 h-9 rounded-xl items-center justify-center"
          style={{ backgroundColor: `${FOCUS_BLUE}33` }}
        >
          <Ionicons name="flag-outline" size={18} color={FOCUS_BLUE} />
        </View>
        <Text className="text-text-primary font-semibold text-base">Your training focus</Text>
      </View>
      <Text className="text-text-secondary text-sm leading-5">
        From your profile goals, we’re prioritizing {focusList}. Use these in Personalized Session
        or your Weekly regimen so off-pitch work matches what you care about.
      </Text>
      <View className="flex-row flex-wrap gap-2">
        {goalLabels.map((label) => (
          <View
            key={label}
            className="px-2.5 py-1 rounded-full"
            style={{ backgroundColor: `${FOCUS_BLUE}33` }}
          >
            <Text className="text-xs font-medium" style={{ color: FOCUS_BLUE }}>
              {label}
            </Text>
          </View>
        ))}
      </View>
      <Pressable onPress={onEditGoals} className="active:opacity-70 self-start">
        <Text className="text-sm font-medium" style={{ color: FOCUS_BLUE }}>
          Edit goals in Profile
        </Text>
      </Pressable>
    </Card>
  );
}

function scoreBandColor(score: number): string {
  if (score >= 8) return '#00C853';
  if (score >= 6) return '#FFB300';
  return '#6B6B73';
}

/** Home-only featured report preview — does not modify shared ReportListCard. */
export function HomeLatestReportCard({
  report,
  onPress,
}: {
  report: CoachingReport;
  onPress: () => void;
}) {
  const modeLabel = labelForAnalysisMode(report.mode);
  const clipLabel = report.clip.fileName ?? 'Selected clip';
  const showScore = report.mode !== 'COACH_ME';
  const scoreColor = showScore ? scoreBandColor(report.overallScore) : '#00C853';

  return (
    <Pressable onPress={onPress} className="active:opacity-80">
      <Card variant="outlined" className="gap-3 overflow-hidden">
        <View className="flex-row items-start gap-3">
          {showScore ? (
            <View
              className="w-16 h-16 rounded-2xl items-center justify-center"
              style={{
                backgroundColor: `${scoreColor}22`,
                borderWidth: 2,
                borderColor: `${scoreColor}66`,
              }}
            >
              <Text className="text-2xl font-bold" style={{ color: scoreColor }}>
                {report.overallScore.toFixed(1)}
              </Text>
              <Text className="text-[10px] text-text-muted">/10</Text>
            </View>
          ) : (
            <View className="w-16 h-16 rounded-2xl bg-primary-muted items-center justify-center">
              <Ionicons name="chatbubbles" size={28} color="#00C853" />
            </View>
          )}

          <View className="flex-1 gap-1">
            <View className="flex-row items-center gap-2 flex-wrap">
              <Text className="text-text-primary font-semibold text-base flex-1" numberOfLines={2}>
                {report.title}
              </Text>
              {report.isDemo ? (
                <View className="bg-surface-elevated px-2 py-0.5 rounded">
                  <Text className="text-text-muted text-[10px] uppercase">Demo</Text>
                </View>
              ) : null}
            </View>
            <View className="self-start px-2 py-0.5 rounded-full bg-primary-muted">
              <Text className="text-primary text-[10px] font-semibold uppercase">{modeLabel}</Text>
            </View>
            <Text className="text-text-muted text-xs">
              {formatReportDateShort(report.createdAt)} · {clipLabel}
            </Text>
          </View>
        </View>

        <Text className="text-text-secondary text-sm leading-5" numberOfLines={2}>
          {report.summary}
        </Text>

        <View className="flex-row items-center gap-1">
          <Text className="text-primary text-sm font-medium">View report</Text>
          <Ionicons name="chevron-forward" size={14} color="#00C853" />
        </View>
      </Card>
    </Pressable>
  );
}
