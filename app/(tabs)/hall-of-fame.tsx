import { useCallback, useEffect } from 'react';
import { ActivityIndicator, Pressable, ScrollView, View, Text } from 'react-native';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { HallOfFameGoalCard } from '@/components/hallOfFame/HallOfFameGoalCard';
import { ScreenHeader } from '@/components/layout/ScreenHeader';
import { Button, Card } from '@/components/ui';
import { useHallOfFame } from '@/services/hallOfFame/hallOfFameService';
import { useAuthStore } from '@/stores/authStore';

function entryKey(id: string, suffix: string): string {
  return `${suffix}-${id}`;
}

export default function HallOfFameTabScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const session = useAuthStore((s) => s.session);
  const {
    userSubmissionCount,
    userEntriesChronological,
    pinnedUserEntries,
    highestRated,
    isLoading,
    hasHydrated,
    error,
    refresh,
    clearError,
    currentUserId,
  } = useHallOfFame();

  const load = useCallback(() => {
    void refresh();
  }, [refresh]);

  useEffect(() => {
    load();
  }, [load, session?.user?.id]);

  const pinnedIds = new Set(pinnedUserEntries.map((s) => s.id));

  const chronologicalEntries = userEntriesChronological.map((submission, index) => ({
    submission,
    rank: index + 1,
  }));

  const pinnedEntries = pinnedUserEntries.map((submission, index) => ({
    submission,
    rank: index + 1,
  }));

  const showInitialLoading = !hasHydrated || (isLoading && userSubmissionCount === 0 && highestRated.length === 0);

  return (
    <View className="flex-1 bg-background">
      <ScreenHeader title="Hall of Fame" subtitle="Your exceptional plays" />
      <ScrollView
        className="flex-1 px-4"
        contentContainerStyle={{ paddingBottom: insets.bottom + 24, gap: 28 }}
        showsVerticalScrollIndicator={false}
      >
        <Card
          variant="outlined"
          className="flex-row items-center gap-3 bg-primary-muted/20 border-primary/20"
        >
          <Text className="text-3xl">🏆</Text>
          <View className="flex-1">
            <Text className="text-text-primary font-semibold">Your Hall of Fame</Text>
            <Text className="text-text-secondary text-sm leading-5 mt-1">
              Your first successfully analysed Goal-mode clip is inducted automatically when you
              are signed in. Tap your own entries to open the coaching report.
            </Text>
          </View>
        </Card>

        {!session ? (
          <Card variant="outlined" className="py-6 px-4 gap-3">
            <Text className="text-text-primary font-semibold text-center">Sign in required</Text>
            <Text className="text-text-secondary text-sm text-center leading-5">
              Create an account or sign in to induct plays and appear on the global leaderboard.
            </Text>
            <Button
              label="Sign in"
              onPress={() => router.push('/(auth)/login')}
              fullWidth
            />
          </Card>
        ) : null}

        {error ? (
          <Card variant="outlined" className="py-5 px-4 gap-3 border-danger/40">
            <Text className="text-danger font-semibold text-center">Could not load Hall of Fame</Text>
            <Text className="text-text-secondary text-sm text-center leading-5">{error}</Text>
            <Button
              label="Try again"
              variant="secondary"
              onPress={() => {
                clearError();
                load();
              }}
              fullWidth
            />
          </Card>
        ) : null}

        {showInitialLoading ? (
          <View className="py-16 items-center gap-3">
            <ActivityIndicator size="large" color="#00C853" />
            <Text className="text-text-secondary text-sm">Loading Hall of Fame…</Text>
          </View>
        ) : (
          <>
            {session && userSubmissionCount === 0 && !error ? (
              <Card variant="outlined" className="py-8 px-4">
                <Text className="text-text-secondary text-sm text-center leading-5">
                  No inducted plays yet. Complete a Goal-mode analysis while signed in to claim
                  your Hall of Fame slot.
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
                      isOwn
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
                      isOwn
                      onPress={() => router.push(`/report/${entry.submission.reportId}`)}
                    />
                  ))}
                </View>
              </Section>
            ) : null}

            {highestRated.length > 0 ? (
              <Section title="Global Leaderboard" subtitle="Top 100 by score · all players">
                <View className="gap-3">
                  {highestRated.map((entry) => {
                    const isOwn =
                      currentUserId != null &&
                      entry.submission.ownerUserId === currentUserId;
                    return (
                      <HallOfFameGoalCard
                        key={entryKey(entry.submission.id, 'global')}
                        entry={entry}
                        compact
                        isOwn={isOwn}
                        onPress={
                          isOwn
                            ? () => router.push(`/report/${entry.submission.reportId}`)
                            : undefined
                        }
                      />
                    );
                  })}
                </View>
              </Section>
            ) : !showInitialLoading && !error && session ? (
              <Card variant="outlined" className="py-6 px-4">
                <Text className="text-text-secondary text-sm text-center leading-5">
                  The global leaderboard is empty. Be the first to induct a Goal-mode play.
                </Text>
              </Card>
            ) : null}

            {hasHydrated && !isLoading ? (
              <Pressable onPress={load} className="items-center py-2 active:opacity-70">
                <Text className="text-primary text-sm font-medium">Refresh</Text>
              </Pressable>
            ) : null}
          </>
        )}
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
