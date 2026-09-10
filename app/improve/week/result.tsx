import { ScrollView, View, Text, Pressable } from 'react-native';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { ScreenHeader } from '@/components/layout/ScreenHeader';
import { Button, Card } from '@/components/ui';
import { useImproveWeekDraftStore } from '@/stores/improveWeekDraftStore';
import { useProfileStore } from '@/stores/profileStore';
import {
  WEEK_DAY_LABELS,
  WEEK_DAY_ORDER,
  WEEK_FOCUS_PREFERENCE_OPTIONS,
  WEEK_MATCH_CONTEXT_VISUAL,
  WEEK_ROLE_VISUAL,
  WEEK_SITUATION_OPTIONS,
} from '@/types/improveWeek';

export default function ImproveWeekResultScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const profile = useProfileStore((s) => s.profile);
  const regimen = useImproveWeekDraftStore((s) => s.regimen);
  const rebuildWeek = useImproveWeekDraftStore((s) => s.rebuildWeek);
  const resetDraft = useImproveWeekDraftStore((s) => s.resetDraft);

  if (!regimen) {
    return (
      <View className="flex-1 bg-background">
        <ScreenHeader title="Weekly regimen" showBack onBack={() => router.back()} />
        <View className="flex-1 items-center justify-center px-8 gap-4">
          <Text className="text-text-secondary text-center leading-6">
            No week generated yet.
          </Text>
          <Button label="Build a week" onPress={() => router.replace('/improve/week')} />
        </View>
      </View>
    );
  }

  const situationLabel =
    WEEK_SITUATION_OPTIONS.find((o) => o.id === regimen.weekSituation)?.label ??
    regimen.weekSituation;
  const focusLabel =
    WEEK_FOCUS_PREFERENCE_OPTIONS.find((o) => o.id === regimen.focusPreference)?.label ??
    regimen.focusPreference;

  const daysById = new Map(regimen.days.map((d) => [d.day, d]));

  return (
    <View className="flex-1 bg-background">
      <ScreenHeader
        title="Your week"
        subtitle={`${situationLabel} · ${focusLabel} · age ${regimen.age}`}
        showBack
        onBack={() => router.back()}
      />
      <ScrollView
        className="flex-1 px-4"
        contentContainerStyle={{ paddingBottom: insets.bottom + 24, gap: 12 }}
        showsVerticalScrollIndicator={false}
      >
        {regimen.notes.length > 0
          ? regimen.notes.map((note) => (
              <Card key={note} variant="outlined">
                <Text className="text-text-secondary text-sm leading-6">{note}</Text>
              </Card>
            ))
          : null}

        {WEEK_DAY_ORDER.map((dayId) => {
          const day = daysById.get(dayId);
          if (!day) return null;

          const visual = WEEK_ROLE_VISUAL[day.role];
          const matchVisual = day.matchContext
            ? WEEK_MATCH_CONTEXT_VISUAL[day.matchContext]
            : null;
          const isRest = day.role === 'rest';

          const subtitle = isRest
            ? 'No individual session'
            : [
                visual.label,
                day.focusSkill?.title,
                day.session ? `~${day.session.inputs.durationMinutes} min` : null,
                day.hasPartner ? 'Partner' : 'Solo',
              ]
                .filter(Boolean)
                .join(' · ');

          return (
            <Pressable
              key={dayId}
              disabled={isRest}
              onPress={() => {
                if (!isRest) router.push(`/improve/week/day/${dayId}`);
              }}
              className={isRest ? 'opacity-90' : 'active:opacity-80'}
            >
              <Card
                variant="outlined"
                className="flex-row items-center gap-3 overflow-hidden"
                style={{ borderLeftWidth: 2, borderLeftColor: visual.accent }}
              >
                <View
                  className="w-11 h-11 rounded-xl items-center justify-center"
                  style={{ backgroundColor: `${visual.accent}33` }}
                >
                  <Ionicons name={visual.icon} size={22} color={visual.accent} />
                </View>
                <View className="flex-1 gap-1">
                  <View className="flex-row items-center gap-2 flex-wrap">
                    <Text className="text-text-primary font-semibold text-base">
                      {WEEK_DAY_LABELS[dayId]}
                    </Text>
                    {matchVisual ? (
                      <View
                        className="px-2 py-0.5 rounded-full"
                        style={{ backgroundColor: `${matchVisual.accent}33` }}
                      >
                        <Text
                          className="text-xs font-medium"
                          style={{ color: matchVisual.accent }}
                        >
                          {matchVisual.label}
                        </Text>
                      </View>
                    ) : null}
                  </View>
                  <Text className="text-text-secondary text-sm leading-5">{subtitle}</Text>
                  {(day.teamTraining || day.gymSession) && (
                    <Text className="text-text-muted text-xs">
                      {[
                        day.teamTraining ? 'Team training' : null,
                        day.gymSession ? 'Gym' : null,
                      ]
                        .filter(Boolean)
                        .join(' · ')}
                    </Text>
                  )}
                </View>
                {!isRest ? (
                  <Ionicons name="chevron-forward" size={18} color={visual.accent} />
                ) : null}
              </Card>
            </Pressable>
          );
        })}

        <View className="gap-3 mt-4">
          <Button
            label="Rebuild whole week"
            variant="secondary"
            fullWidth
            onPress={() => rebuildWeek(profile)}
          />
          <Button
            label="Start over"
            variant="ghost"
            fullWidth
            onPress={() => {
              resetDraft();
              router.replace('/improve/week');
            }}
          />
        </View>
      </ScrollView>
    </View>
  );
}
