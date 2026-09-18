import { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, Alert, Platform, Pressable, Text, View } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { ReportDetailView } from '@/components/analysis/ReportDetailView';
import { ScreenHeader } from '@/components/layout/ScreenHeader';
import { Button } from '@/components/ui';
import {
  fetchHallOfFamePublicReport,
  type FetchHallOfFamePublicReportResult,
} from '@/lib/hallOfFame/fetchPublicReport';
import {
  blockUser,
  markEntryReported,
  submitUgcReport,
  type UgcReportReason,
} from '@/lib/ugcSafety';
import { useAuthStore } from '@/stores/authStore';
import { hallOfFameService } from '@/services/hallOfFame/hallOfFameService';
import type { GoalReport } from '@/types/analysis';

type LoadState =
  | {
      phase: 'loading';
    }
  | {
      phase: 'ready';
      report: GoalReport;
      playTitle: string;
      playerName: string;
      ownerUserId?: string;
    }
  | {
      phase: 'unavailable';
      playTitle: string;
      playerName: string;
      ownerUserId?: string;
    }
  | { phase: 'not_found' }
  | { phase: 'error'; message: string };

const REPORT_REASONS: UgcReportReason[] = [
  'Inappropriate content',
  'Harassment or bullying',
  'Spam or misleading',
  'Other',
];

function toLoadState(result: FetchHallOfFamePublicReportResult): LoadState {
  switch (result.status) {
    case 'ok':
      return {
        phase: 'ready',
        report: result.report,
        playTitle: result.playTitle,
        playerName: result.playerName,
        ownerUserId: result.ownerUserId,
      };
    case 'unavailable':
      return {
        phase: 'unavailable',
        playTitle: result.playTitle,
        playerName: result.playerName,
        ownerUserId: result.ownerUserId,
      };
    case 'not_found':
      return { phase: 'not_found' };
    case 'error':
      return { phase: 'error', message: result.message };
  }
}

function showNotice(title: string, message?: string) {
  if (Platform.OS === 'web') {
    if (typeof window !== 'undefined') {
      window.alert(message ? `${title}\n\n${message}` : title);
    }
    return;
  }
  Alert.alert(title, message);
}

export default function HallOfFamePublicReportScreen() {
  const { entryId } = useLocalSearchParams<{ entryId: string }>();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const [state, setState] = useState<LoadState>({ phase: 'loading' });
  const currentUserId = useAuthStore((s) => s.user?.id);

  const load = useCallback(async () => {
    if (!entryId || typeof entryId !== 'string') {
      setState({ phase: 'not_found' });
      return;
    }
    setState({ phase: 'loading' });
    const result = await fetchHallOfFamePublicReport(entryId);
    setState(toLoadState(result));
  }, [entryId]);

  useEffect(() => {
    void load();
  }, [load]);

  const goBackToHallOfFame = () => {
    requestAnimationFrame(() => {
      if (router.canGoBack()) {
        router.back();
        return;
      }
      router.replace('/(tabs)/hall-of-fame');
    });
  };

  const ownerUserId =
    state.phase === 'ready' || state.phase === 'unavailable' ? state.ownerUserId : undefined;
  const playerName =
    state.phase === 'ready' || state.phase === 'unavailable' ? state.playerName : '';
  const playTitle =
    state.phase === 'ready' || state.phase === 'unavailable' ? state.playTitle : '';
  const isOwnEntry = Boolean(ownerUserId && currentUserId && ownerUserId === currentUserId);
  const canModerate = Boolean(entryId) && !isOwnEntry;

  const submitReport = async (reason: UgcReportReason) => {
    if (!entryId || typeof entryId !== 'string') return;
    try {
      await submitUgcReport({
        entryId,
        playerName,
        playTitle,
        ownerUserId,
        reason,
      });
      await hallOfFameService.refresh();
      showNotice(
        'Report submitted',
        'Thanks — this content is hidden for you. Our team will review it in GoalX moderation.'
      );
      goBackToHallOfFame();
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Could not submit report.';
      showNotice('Report failed', message);
    }
  };

  const handleReport = () => {
    if (!canModerate) return;

    if (Platform.OS === 'web') {
      const reason = REPORT_REASONS[0];
      if (
        typeof window !== 'undefined' &&
        window.confirm(`Report this content as “${reason}”?`)
      ) {
        void submitReport(reason);
      }
      return;
    }

    Alert.alert(
      'Report content',
      'Why are you reporting this Hall of Fame entry?',
      [
        ...REPORT_REASONS.map((reason) => ({
          text: reason,
          onPress: () => void submitReport(reason),
        })),
        { text: 'Cancel', style: 'cancel' as const },
      ]
    );
  };

  const handleBlock = () => {
    if (!canModerate || !ownerUserId) {
      showNotice('Unable to block', 'This entry has no account to block.');
      return;
    }

    const confirmAndBlock = async () => {
      await blockUser(ownerUserId);
      if (entryId && typeof entryId === 'string') {
        await markEntryReported(entryId);
      }
      await hallOfFameService.refresh();
      showNotice('User blocked', 'Their Hall of Fame posts are hidden for you.');
      goBackToHallOfFame();
    };

    if (Platform.OS === 'web') {
      if (
        typeof window !== 'undefined' &&
        window.confirm('Block this user? Their Hall of Fame posts will be hidden for you.')
      ) {
        void confirmAndBlock();
      }
      return;
    }

    Alert.alert(
      'Block user?',
      'Their Hall of Fame posts will be hidden on this device. You can still report the content separately.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Block',
          style: 'destructive',
          onPress: () => void confirmAndBlock(),
        },
      ]
    );
  };

  const moderationBar = canModerate ? (
    <View
      className="mx-4 mb-3 flex-row rounded-2xl overflow-hidden"
      style={{
        borderWidth: 1,
        borderColor: 'rgba(255,255,255,0.1)',
        backgroundColor: 'rgba(255,255,255,0.04)',
      }}
    >
      <Pressable
        onPress={handleReport}
        className="flex-1 py-3.5 items-center active:opacity-70"
        accessibilityRole="button"
        accessibilityLabel="Report content"
      >
        <Text className="font-semibold text-sm" style={{ color: '#FFB300' }}>
          Report
        </Text>
      </Pressable>
      {ownerUserId ? (
        <>
          <View style={{ width: 1, backgroundColor: 'rgba(255,255,255,0.1)' }} />
          <Pressable
            onPress={handleBlock}
            className="flex-1 py-3.5 items-center active:opacity-70"
            accessibilityRole="button"
            accessibilityLabel="Block user"
          >
            <Text className="font-semibold text-sm" style={{ color: '#FF5252' }}>
              Block user
            </Text>
          </Pressable>
        </>
      ) : null}
    </View>
  ) : null;

  if (state.phase === 'loading') {
    return (
      <View className="flex-1 bg-background">
        <ScreenHeader title="Coaching report" showBack onBack={goBackToHallOfFame} />
        <View className="flex-1 items-center justify-center gap-3">
          <ActivityIndicator size="large" color="#00C853" />
          <Text className="text-text-secondary text-sm">Loading report…</Text>
        </View>
      </View>
    );
  }

  if (state.phase === 'not_found') {
    return (
      <View className="flex-1 bg-background">
        <ScreenHeader title="Coaching report" showBack onBack={goBackToHallOfFame} />
        <View className="flex-1 items-center justify-center px-8 gap-4">
          <Text className="text-text-secondary text-center">
            This Hall of Fame entry could not be found.
          </Text>
          <Button label="Back to Hall of Fame" onPress={goBackToHallOfFame} fullWidth />
        </View>
      </View>
    );
  }

  if (state.phase === 'error') {
    return (
      <View className="flex-1 bg-background">
        <ScreenHeader title="Coaching report" showBack onBack={goBackToHallOfFame} />
        <View className="flex-1 items-center justify-center px-8 gap-4">
          <Text className="text-text-secondary text-center">{state.message}</Text>
          <Button label="Try again" onPress={() => void load()} fullWidth />
          <Button
            label="Back to Hall of Fame"
            variant="secondary"
            onPress={goBackToHallOfFame}
            fullWidth
          />
        </View>
      </View>
    );
  }

  if (state.phase === 'unavailable') {
    return (
      <View className="flex-1 bg-background">
        <ScreenHeader
          title="Coaching report"
          subtitle={state.playTitle}
          showBack
          onBack={goBackToHallOfFame}
        />
        <View className="flex-1 items-center justify-center px-8 gap-4">
          <Text className="text-text-secondary text-center leading-5">
            Full report unavailable for this older entry.
          </Text>
          {state.playerName ? (
            <Text className="text-text-muted text-sm text-center">
              {state.playerName}
              {state.playTitle ? ` · ${state.playTitle}` : ''}
            </Text>
          ) : null}
          {moderationBar}
          <Button label="Back to Hall of Fame" onPress={goBackToHallOfFame} fullWidth />
        </View>
      </View>
    );
  }

  const footer = (
    <View className="gap-3 mt-2">
      {moderationBar}
      <Button label="Back to Hall of Fame" variant="secondary" onPress={goBackToHallOfFame} fullWidth />
    </View>
  );

  return (
    <View className="flex-1 bg-background">
      <ScreenHeader
        title="Coaching report"
        subtitle={`${state.playerName} · ${state.playTitle}`}
        showBack
        onBack={goBackToHallOfFame}
      />
      <View className="flex-1 px-4">
        <ReportDetailView
          report={state.report}
          bottomPadding={insets.bottom + 160}
          footer={footer}
        />
      </View>
    </View>
  );
}
