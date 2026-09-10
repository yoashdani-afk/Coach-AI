import { ScrollView, View, Text, Pressable } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { ScreenHeader } from '@/components/layout/ScreenHeader';
import { Button, Card } from '@/components/ui';
import { formatDrillListMetaLine, formatDrillListSubtitle } from '@/lib/improveDrillDisplay';
import { useImproveWeekDraftStore } from '@/stores/improveWeekDraftStore';
import { useProfileStore } from '@/stores/profileStore';
import {
  REHAB_DISCLAIMER,
  SESSION_DURATION_DRILL_COUNTS,
  SESSION_LOCATION_OPTIONS,
} from '@/types/improveSession';
import {
  WEEK_DAY_LABELS,
  WEEK_MATCH_CONTEXT_VISUAL,
  WEEK_ROLE_VISUAL,
  type WeekDayId,
} from '@/types/improveWeek';

export default function ImproveWeekDayDetailScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { dayId: dayIdParam } = useLocalSearchParams<{ dayId: string }>();
  const dayId = dayIdParam as WeekDayId;
  const profile = useProfileStore((s) => s.profile);
  const regimen = useImproveWeekDraftStore((s) => s.regimen);
  const regenerateDay = useImproveWeekDraftStore((s) => s.regenerateDay);

  const day = regimen?.days.find((d) => d.day === dayId);
  const session = day?.session ?? null;

  if (!regimen || !day) {
    return (
      <View className="flex-1 bg-background">
        <ScreenHeader title="Day" showBack onBack={() => router.back()} />
        <View className="flex-1 items-center justify-center px-8 gap-4">
          <Text className="text-text-secondary text-center leading-6">Day not found.</Text>
          <Button label="Back to week" onPress={() => router.replace('/improve/week/result')} />
        </View>
      </View>
    );
  }

  const visual = WEEK_ROLE_VISUAL[day.role];
  const matchVisual = day.matchContext
    ? WEEK_MATCH_CONTEXT_VISUAL[day.matchContext]
    : null;

  if (day.role === 'rest' || !session) {
    return (
      <View className="flex-1 bg-background">
        <ScreenHeader
          title={WEEK_DAY_LABELS[day.day]}
          subtitle={visual.label}
          showBack
          onBack={() => router.back()}
        />
        <View className="flex-1 items-center justify-center px-8 gap-3">
          <View
            className="w-14 h-14 rounded-2xl items-center justify-center"
            style={{ backgroundColor: `${visual.accent}33` }}
          >
            <Ionicons name={visual.icon} size={28} color={visual.accent} />
          </View>
          <Text className="text-text-secondary text-center leading-6">
            No individual session scheduled for this day.
          </Text>
        </View>
      </View>
    );
  }

  const locationLabel =
    session.inputs.location == null
      ? 'Flexible location'
      : (SESSION_LOCATION_OPTIONS.find((o) => o.id === session.inputs.location)?.label ??
        session.inputs.location);
  const expectedMainCount = SESSION_DURATION_DRILL_COUNTS[session.inputs.durationMinutes];
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
  const mainDrillCount = session.drills.length - (hasWarmUp ? 1 : 0) - trailingStretchCount;

  return (
    <View className="flex-1 bg-background">
      <ScreenHeader
        title={WEEK_DAY_LABELS[day.day]}
        subtitle={`${visual.label}${
          day.focusSkill ? ` · ${day.focusSkill.title}` : ''
        } · ~${session.inputs.durationMinutes} min`}
        showBack
        onBack={() => router.back()}
      />
      <ScrollView
        className="flex-1 px-4"
        contentContainerStyle={{ paddingBottom: insets.bottom + 24, gap: 16 }}
        showsVerticalScrollIndicator={false}
      >
        <Card
          variant="outlined"
          className="gap-2 overflow-hidden"
          style={{ borderLeftWidth: 2, borderLeftColor: visual.accent }}
        >
          <View className="flex-row items-center gap-3">
            <View
              className="w-11 h-11 rounded-xl items-center justify-center"
              style={{ backgroundColor: `${visual.accent}33` }}
            >
              <Ionicons name={visual.icon} size={22} color={visual.accent} />
            </View>
            <View className="flex-1 gap-1">
              <View className="flex-row items-center gap-2 flex-wrap">
                <Text className="text-text-primary font-semibold text-base">{visual.label}</Text>
                {matchVisual ? (
                  <View
                    className="px-2 py-0.5 rounded-full"
                    style={{ backgroundColor: `${matchVisual.accent}33` }}
                  >
                    <Text className="text-xs font-medium" style={{ color: matchVisual.accent }}>
                      {matchVisual.label}
                    </Text>
                  </View>
                ) : null}
              </View>
              <Text className="text-text-muted text-sm leading-5">
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
            </View>
          </View>
          <Text className="text-text-muted text-sm leading-5">
            {locationLabel}
            {' · '}
            {session.inputs.intensity.charAt(0).toUpperCase() + session.inputs.intensity.slice(1)}{' '}
            intensity
            {session.inputs.hasPartner ? ' · partner available' : ' · solo'}
            {session.inputs.situation === 'pre-match' ? ' · pre-match' : ''}
          </Text>
        </Card>

        {session.notes
          .filter((note) => note !== REHAB_DISCLAIMER)
          .map((note) => (
            <Card key={note} variant="outlined">
              <Text className="text-text-secondary text-sm leading-6">{note}</Text>
            </Card>
          ))}

        <View>
          <Text className="text-text-muted text-xs uppercase tracking-wider mb-2">Drills</Text>
          <View className="gap-3">
            {session.drills.map((item, index) => (
              <Pressable
                key={`${item.categoryId}-${item.skillId}-${item.drill.id}-${index}`}
                onPress={() =>
                  router.push(`/improve/${item.categoryId}/${item.skillId}/${item.drill.id}`)
                }
                className="active:opacity-80"
              >
                <Card variant="outlined" className="flex-row items-center gap-3">
                  <View
                    className="w-7 h-7 rounded-full items-center justify-center"
                    style={{ backgroundColor: `${visual.accent}33` }}
                  >
                    <Text className="text-xs font-semibold" style={{ color: visual.accent }}>
                      {index + 1}
                    </Text>
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
                  <Ionicons name="chevron-forward" size={18} color={visual.accent} />
                </Card>
              </Pressable>
            ))}
          </View>
        </View>

        <View className="gap-3 mt-2">
          <Button
            label="Regenerate this day"
            variant="secondary"
            fullWidth
            onPress={() => regenerateDay(day.day, profile)}
          />
          <Button
            label="Back to week"
            variant="ghost"
            fullWidth
            onPress={() => router.replace('/improve/week/result')}
          />
        </View>
      </ScrollView>
    </View>
  );
}
