import { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, View, Text } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { ReportDetailView } from '@/components/analysis/ReportDetailView';
import { ScreenHeader } from '@/components/layout/ScreenHeader';
import { Button } from '@/components/ui';
import {
  fetchHallOfFamePublicReport,
  type FetchHallOfFamePublicReportResult,
} from '@/lib/hallOfFame/fetchPublicReport';
import type { GoalReport } from '@/types/analysis';

type LoadState =
  | { phase: 'loading' }
  | { phase: 'ready'; report: GoalReport; playTitle: string; playerName: string }
  | { phase: 'unavailable'; playTitle: string; playerName: string }
  | { phase: 'not_found' }
  | { phase: 'error'; message: string };

function toLoadState(result: FetchHallOfFamePublicReportResult): LoadState {
  switch (result.status) {
    case 'ok':
      return {
        phase: 'ready',
        report: result.report,
        playTitle: result.playTitle,
        playerName: result.playerName,
      };
    case 'unavailable':
      return {
        phase: 'unavailable',
        playTitle: result.playTitle,
        playerName: result.playerName,
      };
    case 'not_found':
      return { phase: 'not_found' };
    case 'error':
      return { phase: 'error', message: result.message };
  }
}

export default function HallOfFamePublicReportScreen() {
  const { entryId } = useLocalSearchParams<{ entryId: string }>();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const [state, setState] = useState<LoadState>({ phase: 'loading' });

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
    if (router.canGoBack()) {
      router.back();
      return;
    }
    router.replace('/(tabs)/hall-of-fame');
  };

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
          <Button label="Back to Hall of Fame" onPress={goBackToHallOfFame} fullWidth />
        </View>
      </View>
    );
  }

  const footer = (
    <View className="gap-3 mt-2">
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
          bottomPadding={insets.bottom + 120}
          footer={footer}
        />
      </View>
    </View>
  );
}
