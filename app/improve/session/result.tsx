import { ScrollView, View, Text, Pressable } from 'react-native';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { ScreenHeader } from '@/components/layout/ScreenHeader';
import { Button, Card } from '@/components/ui';
import { formatDrillListMetaLine, formatDrillListSubtitle } from '@/lib/improveDrillDisplay';
import { useImproveSessionDraftStore } from '@/stores/improveSessionDraftStore';
import { useProfileStore } from '@/stores/profileStore';
import {
  REHAB_DISCLAIMER,
  SESSION_DURATION_DRILL_COUNTS,
  SESSION_LOCATION_OPTIONS,
  SESSION_SITUATION_OPTIONS,
} from '@/types/improveSession';

export default function ImproveSessionResultScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const profile = useProfileStore((s) => s.profile);
  const session = useImproveSessionDraftStore((s) => s.session);
  const regenerate = useImproveSessionDraftStore((s) => s.regenerate);
  const resetDraft = useImproveSessionDraftStore((s) => s.resetDraft);

  if (!session) {
    return (
      <View className="flex-1 bg-background">
        <ScreenHeader title="Session" showBack onBack={() => router.back()} />
        <View className="flex-1 items-center justify-center px-8 gap-4">
          <Text className="text-text-secondary text-center leading-6">
            No session generated yet.
          </Text>
          <Button
            label="Build a session"
            onPress={() => router.replace('/improve/session')}
          />
        </View>
      </View>
    );
  }

  const situationLabel =
    SESSION_SITUATION_OPTIONS.find((o) => o.id === session.inputs.situation)?.label ??
    session.inputs.situation;
  const locationLabel =
    session.inputs.location == null
      ? 'Flexible location'
      : (SESSION_LOCATION_OPTIONS.find((o) => o.id === session.inputs.location)?.label ??
        session.inputs.location);
  const expectedMainCount = SESSION_DURATION_DRILL_COUNTS[session.inputs.durationMinutes];
  const isRehab = session.inputs.situation === 'rehab';
  const hasWarmUp = session.drills[0]?.skillId === 'warm-up';
  const isRecoverySession =
    session.inputs.situation === 'recovery-day' || session.inputs.situation === 'rehab';
  let trailingStretchCount = 0;
  if (!isRecoverySession) {
    for (let i = session.drills.length - 1; i >= 0; i -= 1) {
      const item = session.drills[i]!;
      if (item.drill.recoveryFocus === 'stretching' && item.skillId === 'recovery-mobility') {
        trailingStretchCount += 1;
      } else {
        break;
      }
    }
  }
  const mainDrillCount =
    session.drills.length - (hasWarmUp ? 1 : 0) - trailingStretchCount;

  return (
    <View className="flex-1 bg-background">
      <ScreenHeader
        title="Your session"
        subtitle={`${situationLabel} · ${locationLabel} · ~${session.inputs.durationMinutes} min`}
        showBack
        onBack={() => router.back()}
      />
      <ScrollView
        className="flex-1 px-4"
        contentContainerStyle={{ paddingBottom: insets.bottom + 24, gap: 16 }}
        showsVerticalScrollIndicator={false}
      >
        <Card variant="outlined" className="gap-1">
          <Text className="text-text-primary font-semibold text-base">
            {session.drills.length} drills
            {hasWarmUp || trailingStretchCount > 0
              ? ` (${[
                  hasWarmUp ? 'warm-up' : null,
                  trailingStretchCount > 0 ? `${trailingStretchCount} stretches` : null,
                ]
                  .filter(Boolean)
                  .join(' + ')})`
              : ''}
            {mainDrillCount !== expectedMainCount
              ? ` · aimed for ${expectedMainCount} main`
              : ''}
          </Text>
          <Text className="text-text-muted text-sm leading-5">
            {locationLabel}
            {' · '}
            {session.inputs.intensity.charAt(0).toUpperCase() +
              session.inputs.intensity.slice(1)}{' '}
            intensity
            {session.inputs.hasPartner ? ' · partner available' : ' · solo'}
            {` · age ${session.inputs.age}`}
          </Text>
          <Text className="text-text-muted text-xs leading-5 mt-1">
            Durations are approximate — drill times aren’t normalized across the library.
          </Text>
        </Card>

        {isRehab ? (
          <Card variant="outlined" className="border-amber-500/40 bg-amber-500/10">
            <Text className="text-text-primary text-sm leading-6 font-medium">
              Rehab disclaimer
            </Text>
            <Text className="text-text-secondary text-sm leading-6 mt-1">
              {REHAB_DISCLAIMER}
            </Text>
          </Card>
        ) : null}

        {session.notes
          .filter((note) => note !== REHAB_DISCLAIMER)
          .map((note) => (
            <Card key={note} variant="outlined">
              <Text className="text-text-secondary text-sm leading-6">{note}</Text>
            </Card>
          ))}

        <View>
          <Text className="text-text-muted text-xs uppercase tracking-wider mb-2">
            Drills
          </Text>
          <View className="gap-3">
            {session.drills.map((item, index) => (
              <Pressable
                key={`${item.categoryId}-${item.skillId}-${item.drill.id}-${index}`}
                onPress={() =>
                  router.push(
                    `/improve/${item.categoryId}/${item.skillId}/${item.drill.id}`
                  )
                }
                className="active:opacity-80"
              >
                <Card variant="outlined" className="flex-row items-center gap-3">
                  <View className="w-7 h-7 rounded-full bg-surface-elevated items-center justify-center">
                    <Text className="text-primary text-xs font-semibold">{index + 1}</Text>
                  </View>
                  <View className="flex-1 gap-1">
                    <Text className="text-text-primary font-semibold text-base">
                      {item.drill.title}
                    </Text>
                    <Text className="text-text-muted text-sm">
                      {formatDrillListSubtitle(item.drill)}
                    </Text>
                    <Text className="text-text-muted text-xs">
                      {formatDrillListMetaLine(item.drill)}
                    </Text>
                  </View>
                  <Ionicons name="chevron-forward" size={18} color="#00C853" />
                </Card>
              </Pressable>
            ))}
          </View>
        </View>

        <View className="gap-3 mt-2">
          <Button
            label="Regenerate"
            variant="secondary"
            fullWidth
            onPress={() => regenerate(profile)}
          />
          <Button
            label="Start over"
            variant="ghost"
            fullWidth
            onPress={() => {
              resetDraft();
              router.replace('/improve/session');
            }}
          />
        </View>
      </ScrollView>
    </View>
  );
}
