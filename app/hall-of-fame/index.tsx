import { ScrollView, View, Text } from 'react-native';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { HallOfFameGoalCard } from '@/components/hallOfFame/HallOfFameGoalCard';
import { ScreenHeader } from '@/components/layout/ScreenHeader';
import { Card } from '@/components/ui';
import { useHallOfFame } from '@/services/hallOfFame/hallOfFameService';

export default function HallOfFameScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { highestRated, trending, challenges, userSubmissionCount } = useHallOfFame();

  return (
    <View className="flex-1 bg-background">
      <ScreenHeader
        title="Hall of Fame"
        subtitle="Discover the highest-rated goals"
        showBack
        onBack={() => router.back()}
      />
      <ScrollView
        className="flex-1 px-4"
        contentContainerStyle={{ paddingBottom: insets.bottom + 24, gap: 28 }}
        showsVerticalScrollIndicator={false}
      >
        <Card variant="outlined" className="flex-row items-center gap-3 bg-primary-muted/20 border-primary/20">
          <Text className="text-3xl">🏆</Text>
          <View className="flex-1">
            <Text className="text-text-primary font-semibold">Local Hall of Fame</Text>
            <Text className="text-text-secondary text-sm leading-5 mt-1">
              Demo leaderboard — your submissions are saved on this device. A real online leaderboard
              will replace this later.
            </Text>
          </View>
        </Card>

        <Section title="Highest Rated" subtitle="The best overall goals">
          <View className="gap-3">
            {highestRated.length === 0 ? (
              <EmptySection message="No goals yet. Rate a goal and submit it to appear here." />
            ) : (
              highestRated.map((entry) => (
                <HallOfFameGoalCard
                  key={entry.submission.id}
                  entry={entry}
                  onViewReport={
                    entry.submission.source === 'user'
                      ? () => router.push(`/report/${entry.submission.reportId}`)
                      : undefined
                  }
                />
              ))
            )}
          </View>
        </Section>

        <Section title="Trending" subtitle="Popular goals right now (local demo)">
          <View className="gap-3">
            {trending.map((entry) => (
              <HallOfFameGoalCard
                key={`trending-${entry.submission.id}`}
                entry={entry}
                compact
                onViewReport={
                  entry.submission.source === 'user'
                    ? () => router.push(`/report/${entry.submission.reportId}`)
                    : undefined
                }
              />
            ))}
          </View>
        </Section>

        <Section title="Challenges" subtitle="Upcoming competitions">
          <View className="gap-3">
            {challenges.map((challenge) => (
              <Card key={challenge.id} variant="outlined" className="gap-2">
                <View className="flex-row items-center gap-3">
                  <View className="w-12 h-12 rounded-xl bg-surface-elevated items-center justify-center">
                    <Text className="text-2xl">{challenge.emoji}</Text>
                  </View>
                  <View className="flex-1">
                    <View className="flex-row items-center gap-2">
                      <Text className="text-text-primary font-semibold text-base flex-1">
                        {challenge.title}
                      </Text>
                      <View className="bg-surface-elevated px-2 py-0.5 rounded-full">
                        <Text className="text-text-muted text-[10px] uppercase">Soon</Text>
                      </View>
                    </View>
                    <Text className="text-text-secondary text-sm leading-5 mt-1">
                      {challenge.description}
                    </Text>
                  </View>
                </View>
              </Card>
            ))}
          </View>
        </Section>

        {userSubmissionCount > 0 ? (
          <Text className="text-text-muted text-xs text-center">
            You have {userSubmissionCount} goal{userSubmissionCount === 1 ? '' : 's'} in the Hall of Fame.
          </Text>
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

function EmptySection({ message }: { message: string }) {
  return (
    <Card variant="outlined" className="py-8 px-4">
      <Text className="text-text-secondary text-sm text-center leading-5">{message}</Text>
    </Card>
  );
}
