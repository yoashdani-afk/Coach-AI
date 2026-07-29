import { ScrollView, View, Text } from 'react-native';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { HallOfFameGoalCard } from '@/components/hallOfFame/HallOfFameGoalCard';
import { ScreenHeader } from '@/components/layout/ScreenHeader';
import { Card } from '@/components/ui';
import { useHallOfFame } from '@/services/hallOfFame/hallOfFameService';

function entryKey(id: string, suffix: string): string {
  return `${suffix}-${id}`;
}

export default function HallOfFameTabScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const {
    userSubmissionCount,
    userEntriesChronological,
    pinnedUserEntries,
    highestRated,
  } = useHallOfFame();

  const pinnedIds = new Set(pinnedUserEntries.map((s) => s.id));

  const chronologicalEntries = userEntriesChronological.map((submission, index) => ({
    submission,
    rank: index + 1,
  }));

  const pinnedEntries = pinnedUserEntries.map((submission, index) => ({
    submission,
    rank: index + 1,
  }));

  return (
    <View className="flex-1 bg-background">
      <ScreenHeader
        title="Hall of Fame"
        subtitle="Your exceptional plays"
      />
      <ScrollView
        className="flex-1 px-4"
        contentContainerStyle={{ paddingBottom: insets.bottom + 24, gap: 28 }}
        showsVerticalScrollIndicator={false}
      >
        <Card variant="outlined" className="flex-row items-center gap-3 bg-primary-muted/20 border-primary/20">
          <Text className="text-3xl">🏆</Text>
          <View className="flex-1">
            <Text className="text-text-primary font-semibold">Your Hall of Fame</Text>
            <Text className="text-text-secondary text-sm leading-5 mt-1">
              Exceptional AI analyses are inducted automatically. Tap any entry to open the full
              coaching report.
            </Text>
          </View>
        </Card>

        {userSubmissionCount === 0 ? (
          <Card variant="outlined" className="py-8 px-4">
            <Text className="text-text-secondary text-sm text-center leading-5">
              No inducted plays yet. Score 9.5+ or produce an elite analysis to unlock your first
              Hall of Fame entry.
            </Text>
          </Card>
        ) : null}

        {pinnedEntries.length > 0 ? (
          <Section title="Highest Rated" subtitle="Pinned to the top">
            <View className="gap-3">
              {pinnedEntries.map((entry) => (
                <HallOfFameGoalCard
                  key={entryKey(entry.submission.id, 'pinned')}
                  entry={entry}
                  pinned
                  onPress={() => router.push(`/report/${entry.submission.reportId}`)}
                />
              ))}
            </View>
          </Section>
        ) : null}

        {chronologicalEntries.length > 0 ? (
          <Section title="Your Inducted Plays" subtitle="Newest first">
            <View className="gap-3">
              {chronologicalEntries.map((entry) => (
                <HallOfFameGoalCard
                  key={entryKey(entry.submission.id, 'chrono')}
                  entry={entry}
                  pinned={pinnedIds.has(entry.submission.id)}
                  onPress={() => router.push(`/report/${entry.submission.reportId}`)}
                />
              ))}
            </View>
          </Section>
        ) : null}

        {highestRated.length > 0 ? (
          <Section title="Global Leaderboard" subtitle="Including demo entries">
            <View className="gap-3">
              {highestRated.slice(0, 5).map((entry) => (
                <HallOfFameGoalCard
                  key={entryKey(entry.submission.id, 'global')}
                  entry={entry}
                  compact
                  onPress={
                    entry.submission.source === 'user'
                      ? () => router.push(`/report/${entry.submission.reportId}`)
                      : undefined
                  }
                />
              ))}
            </View>
          </Section>
        ) : null}
      </ScrollView>
    </View>
  );
}

function Section({
  title,
  subtitle,
  children,
}: {
  title: string;
  subtitle: string;
  children: React.ReactNode;
}) {
  return (
    <View className="gap-3">
      <View>
        <Text className="text-text-primary text-xl font-bold">{title}</Text>
        <Text className="text-text-muted text-sm mt-0.5">{subtitle}</Text>
      </View>
      {children}
    </View>
  );
}
