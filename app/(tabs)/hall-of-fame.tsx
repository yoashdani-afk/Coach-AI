import { useCallback, useEffect, type ReactNode } from 'react';
import { ActivityIndicator, Pressable, ScrollView, View, Text } from 'react-native';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { HallOfFameGoalCard } from '@/components/hallOfFame/HallOfFameGoalCard';
import { ScreenHeader } from '@/components/layout/ScreenHeader';
import { Button } from '@/components/ui';
import { useHallOfFame } from '@/services/hallOfFame/hallOfFameService';
import { useAuthStore } from '@/stores/authStore';

const HOF_GOLD = '#F5C542';
const SURFACE = '#141416';
const BORDER = 'rgba(255,255,255,0.08)';
const RADIUS = 20;

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

  const showInitialLoading =
    !hasHydrated || (isLoading && userSubmissionCount === 0 && highestRated.length === 0);

  return (
    <View className="flex-1 bg-background">
      <ScreenHeader title="Hall of Fame" subtitle="Your exceptional plays" />
      <ScrollView
        className="flex-1 px-4"
        contentContainerStyle={{ paddingBottom: insets.bottom + 28, gap: 22, paddingTop: 4 }}
        showsVerticalScrollIndicator={false}
      >
        <IntroCard />

        {!session ? (
          <View
            style={{
              backgroundColor: SURFACE,
              borderWidth: 1,
              borderColor: BORDER,
              borderRadius: RADIUS,
              padding: 20,
              gap: 12,
            }}
          >
            <Text className="text-text-primary font-semibold text-center">Sign in required</Text>
            <Text className="text-text-secondary text-sm text-center leading-5">
              Create an account or sign in to induct plays and appear on the global leaderboard.
            </Text>
            <Button label="Sign in" onPress={() => router.push('/(auth)/login')} fullWidth />
          </View>
        ) : null}

        {error ? (
          <View
            style={{
              backgroundColor: 'rgba(255,61,87,0.08)',
              borderWidth: 1,
              borderColor: 'rgba(255,61,87,0.35)',
              borderRadius: RADIUS,
              padding: 18,
              gap: 12,
            }}
          >
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
          </View>
        ) : null}

        {showInitialLoading ? (
          <View className="py-16 items-center gap-3">
            <ActivityIndicator size="large" color="#00C853" />
            <Text className="text-text-secondary text-sm">Loading Hall of Fame…</Text>
          </View>
        ) : (
          <>
            {session && userSubmissionCount === 0 && !error ? (
              <View
                style={{
                  backgroundColor: SURFACE,
                  borderWidth: 1,
                  borderColor: BORDER,
                  borderStyle: 'dashed',
                  borderRadius: RADIUS,
                  padding: 24,
                }}
              >
                <Text className="text-text-secondary text-sm text-center leading-5">
                  No inducted plays yet. Complete a Goal-mode analysis while signed in to claim
                  your Hall of Fame slot.
                </Text>
              </View>
            ) : null}

            {pinnedEntries.length > 0 ? (
              <Section
                title="Highest Rated"
                subtitle="Pinned to the top"
                tone="personal"
                icon="ribbon"
              >
                <View className="gap-3">
                  {pinnedEntries.map((entry) => (
                    <HallOfFameGoalCard
                      key={entryKey(entry.submission.id, 'pinned')}
                      entry={entry}
                      pinned
                      isOwn
                      variant="personal"
                      onPress={() => router.push(`/hall-of-fame/${entry.submission.id}`)}
                    />
                  ))}
                </View>
              </Section>
            ) : null}

            {chronologicalEntries.length > 0 ? (
              <Section
                title="Your Inducted Plays"
                subtitle="Newest first · private to you"
                tone="personal"
                icon="person"
              >
                <View className="gap-3">
                  {chronologicalEntries.map((entry) => (
                    <HallOfFameGoalCard
                      key={entryKey(entry.submission.id, 'chrono')}
                      entry={entry}
                      pinned={pinnedIds.has(entry.submission.id)}
                      isOwn
                      variant="personal"
                      onPress={() => router.push(`/hall-of-fame/${entry.submission.id}`)}
                    />
                  ))}
                </View>
              </Section>
            ) : null}

            {highestRated.length > 0 ? (
              <Section
                title="Global Leaderboard"
                subtitle="Top 100 by score · all players"
                tone="global"
                icon="globe"
              >
                <View className="gap-2.5">
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
                        variant="global"
                        onPress={() => router.push(`/hall-of-fame/${entry.submission.id}`)}
                      />
                    );
                  })}
                </View>
              </Section>
            ) : !showInitialLoading && !error && session ? (
              <View
                style={{
                  backgroundColor: SURFACE,
                  borderWidth: 1,
                  borderColor: BORDER,
                  borderRadius: RADIUS,
                  padding: 20,
                }}
              >
                <Text className="text-text-secondary text-sm text-center leading-5">
                  The global leaderboard is empty. Be the first to induct a Goal-mode play.
                </Text>
              </View>
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

function IntroCard() {
  return (
    <View
      className="overflow-hidden"
      style={{
        borderRadius: RADIUS,
        borderWidth: 1,
        borderColor: 'rgba(245,197,66,0.32)',
      }}
    >
      <LinearGradient
        colors={['rgba(245,197,66,0.18)', 'rgba(20,16,8,0.96)']}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={{ padding: 16, minHeight: 108 }}
      >
        <Ionicons
          name="trophy"
          size={88}
          color={HOF_GOLD}
          style={{
            position: 'absolute',
            right: -8,
            bottom: -14,
            opacity: 0.1,
          }}
        />
        <View className="flex-row items-start gap-3.5 pr-10">
          <View
            className="items-center justify-center"
            style={{
              width: 48,
              height: 48,
              borderRadius: 14,
              backgroundColor: 'rgba(245,197,66,0.2)',
              borderWidth: 1,
              borderColor: 'rgba(245,197,66,0.4)',
            }}
          >
            <Ionicons name="trophy" size={24} color={HOF_GOLD} />
          </View>
          <View className="flex-1 gap-1.5">
            <Text className="text-text-primary font-bold text-[17px] tracking-tight">
              Your Hall of Fame
            </Text>
            <Text className="text-text-secondary text-[13px] leading-5">
              Your first successfully analysed Goal-mode clip is inducted automatically when you
              are signed in. Tap any entry to open the full coaching report.
            </Text>
          </View>
        </View>
      </LinearGradient>
    </View>
  );
}

function Section({
  title,
  subtitle,
  children,
  tone,
  icon,
}: {
  title: string;
  subtitle: string;
  children: ReactNode;
  tone: 'personal' | 'global';
  icon: 'ribbon' | 'person' | 'globe';
}) {
  const accent = tone === 'personal' ? HOF_GOLD : '#8A9BB5';
  const iconName =
    icon === 'ribbon' ? 'ribbon' : icon === 'person' ? 'person' : 'globe-outline';

  return (
    <View
      className="gap-3"
      style={
        tone === 'global'
          ? {
              backgroundColor: 'rgba(255,255,255,0.02)',
              borderWidth: 1,
              borderColor: 'rgba(255,255,255,0.06)',
              borderRadius: RADIUS,
              padding: 12,
              marginHorizontal: -2,
            }
          : undefined
      }
    >
      <View className="flex-row items-center gap-2.5 px-0.5">
        <View
          className="items-center justify-center"
          style={{
            width: 32,
            height: 32,
            borderRadius: 10,
            backgroundColor: `${accent}22`,
            borderWidth: 1,
            borderColor: `${accent}40`,
          }}
        >
          <Ionicons name={iconName} size={16} color={accent} />
        </View>
        <View className="flex-1">
          <Text className="text-text-primary text-[17px] font-bold tracking-tight">{title}</Text>
          <Text className="text-text-muted text-[12px] mt-0.5">{subtitle}</Text>
        </View>
      </View>
      {children}
    </View>
  );
}
