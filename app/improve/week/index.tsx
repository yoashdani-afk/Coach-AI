import { useMemo, useState } from 'react';
import { View, Text, Pressable } from 'react-native';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { SessionWizardShell } from '@/components/improve/SessionWizardShell';
import { SelectCard } from '@/components/profile/SelectCard';
import { Card, Chip, Input } from '@/components/ui';
import {
  listPrioritySkillOptions,
  previewWeekRoles,
} from '@/lib/improveWeekOrchestrator';
import { useImproveWeekDraftStore } from '@/stores/improveWeekDraftStore';
import { useProfileStore } from '@/stores/profileStore';
import {
  WEEK_DAY_LABELS,
  WEEK_DAY_ORDER,
  WEEK_DAY_SHORT_LABELS,
  WEEK_DURATION_OPTIONS,
  WEEK_FOCUS_PREFERENCE_OPTIONS,
  WEEK_MATCH_CONTEXT_VISUAL,
  WEEK_ROLE_VISUAL,
  WEEK_SITUATION_OPTIONS,
  type WeekDayId,
  type WeekDayRole,
  type WeekMatchContext,
} from '@/types/improveWeek';

const TOTAL_STEPS = 3;

function DayToggle({
  label,
  active,
  onPress,
  accent,
}: {
  label: string;
  active: boolean;
  onPress: () => void;
  accent?: string;
}) {
  return (
    <Pressable
      onPress={onPress}
      className={`px-2.5 py-1.5 rounded-lg border ${
        active ? 'border-transparent' : 'bg-surface border-border'
      }`}
      style={
        active
          ? {
              backgroundColor: `${accent ?? '#00C853'}33`,
              borderColor: accent ?? '#00C853',
            }
          : undefined
      }
    >
      <Text
        className={`text-xs font-medium ${active ? '' : 'text-text-secondary'}`}
        style={active ? { color: accent ?? '#00C853' } : undefined}
      >
        {label}
      </Text>
    </Pressable>
  );
}

function RolePreviewRow({
  dayId,
  role,
  matchContext,
  flags,
}: {
  dayId: WeekDayId;
  role: WeekDayRole;
  matchContext?: WeekMatchContext;
  flags: string;
}) {
  const visual = WEEK_ROLE_VISUAL[role];
  const matchVisual = matchContext ? WEEK_MATCH_CONTEXT_VISUAL[matchContext] : null;

  return (
    <Card
      variant="outlined"
      className="flex-row items-center gap-3 overflow-hidden"
      style={{ borderLeftWidth: 2, borderLeftColor: visual.accent }}
    >
      <View
        className="w-10 h-10 rounded-xl items-center justify-center"
        style={{ backgroundColor: `${visual.accent}33` }}
      >
        <Ionicons name={visual.icon} size={20} color={visual.accent} />
      </View>
      <View className="flex-1 gap-0.5">
        <View className="flex-row items-center gap-2 flex-wrap">
          <Text className="text-text-primary font-semibold text-base">
            {WEEK_DAY_SHORT_LABELS[dayId]}
          </Text>
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
        <Text className="text-text-secondary text-sm">{visual.label}</Text>
        <Text className="text-text-muted text-xs leading-5">{flags}</Text>
      </View>
    </Card>
  );
}

export default function ImproveWeekWizardScreen() {
  const router = useRouter();
  const profile = useProfileStore((s) => s.profile);

  const draft = useImproveWeekDraftStore((s) => s.draft);
  const setWeekSituation = useImproveWeekDraftStore((s) => s.setWeekSituation);
  const setAge = useImproveWeekDraftStore((s) => s.setAge);
  const setMatchDay = useImproveWeekDraftStore((s) => s.setMatchDay);
  const setFocusPreference = useImproveWeekDraftStore((s) => s.setFocusPreference);
  const togglePrioritySkill = useImproveWeekDraftStore((s) => s.togglePrioritySkill);
  const updateDay = useImproveWeekDraftStore((s) => s.updateDay);
  const generate = useImproveWeekDraftStore((s) => s.generate);

  const [step, setStep] = useState(1);
  const [ageText, setAgeText] = useState(String(draft.age ?? profile?.age ?? ''));

  const priorityOptions = useMemo(() => listPrioritySkillOptions(), []);

  const rolePreview = useMemo(() => {
    if (draft.weekSituation == null) return [];
    return previewWeekRoles(draft.weekSituation, draft.days, draft.matchDay);
  }, [draft.weekSituation, draft.days, draft.matchDay]);

  const roleByDay = useMemo(() => {
    const map = new Map<
      WeekDayId,
      { role: WeekDayRole; matchContext?: WeekMatchContext }
    >();
    for (const row of rolePreview) {
      map.set(row.day, { role: row.role, matchContext: row.matchContext });
    }
    return map;
  }, [rolePreview]);

  const canContinue = (() => {
    switch (step) {
      case 1: {
        const age = Number(ageText);
        return (
          draft.weekSituation != null &&
          draft.focusPreference != null &&
          Number.isFinite(age) &&
          age >= 8 &&
          age <= 60
        );
      }
      case 2:
        return draft.days.length === 7;
      case 3:
        return draft.weekSituation != null;
      default:
        return false;
    }
  })();

  const goBack = () => {
    if (step === 1) {
      router.back();
      return;
    }
    setStep((s) => s - 1);
  };

  const goNext = () => {
    if (step === 1) {
      setAge(Number(ageText));
    }

    if (step < TOTAL_STEPS) {
      setStep((s) => s + 1);
      return;
    }

    const age = Number(ageText);
    useImproveWeekDraftStore.setState((state) => ({
      draft: { ...state.draft, age },
    }));

    const regimen = generate(profile);
    if (!regimen) return;
    router.replace('/improve/week/result');
  };

  const stepCopy = (() => {
    switch (step) {
      case 1:
        return {
          title: 'Week context',
          subtitle:
            'Situation, match day, focus bias, and optional priority skills. Partner availability is set per day next.',
        };
      case 2:
        return {
          title: 'Your week',
          subtitle:
            'For each day: team training, gym, partner, and how long you can train alone — or mark unavailable.',
        };
      case 3:
        return {
          title: 'Review plan',
          subtitle: 'We’ll build sessions from this outline. You can regenerate individual days later.',
        };
      default:
        return { title: '', subtitle: '' };
    }
  })();

  return (
    <SessionWizardShell
      headerTitle="Weekly regimen"
      step={step}
      totalSteps={TOTAL_STEPS}
      title={stepCopy.title}
      subtitle={stepCopy.subtitle}
      onBack={goBack}
      onContinue={goNext}
      continueLabel={step === 3 ? 'Build my week' : 'Continue'}
      continueDisabled={!canContinue}
    >
      {step === 1 ? (
        <View className="gap-6">
          <View className="gap-2">
            <Text className="text-text-muted text-xs uppercase tracking-wider">Situation</Text>
            {WEEK_SITUATION_OPTIONS.map((option) => (
              <SelectCard
                key={option.id}
                label={option.label}
                description={option.description}
                selected={draft.weekSituation === option.id}
                onPress={() => setWeekSituation(option.id)}
              />
            ))}
          </View>

          <View className="gap-2">
            <Text className="text-text-muted text-xs uppercase tracking-wider">Age</Text>
            <Input
              value={ageText}
              onChangeText={setAgeText}
              keyboardType="number-pad"
              placeholder="Age"
            />
          </View>

          <View className="gap-2">
            <Text className="text-text-muted text-xs uppercase tracking-wider">
              Match this week?
            </Text>
            <View className="flex-row flex-wrap gap-2">
              <Chip
                label="None"
                selected={draft.matchDay == null}
                onPress={() => setMatchDay(null)}
              />
              {WEEK_DAY_ORDER.map((dayId) => (
                <Chip
                  key={dayId}
                  label={WEEK_DAY_SHORT_LABELS[dayId]}
                  selected={draft.matchDay === dayId}
                  onPress={() => setMatchDay(dayId)}
                />
              ))}
            </View>
          </View>

          <View className="gap-2">
            <Text className="text-text-muted text-xs uppercase tracking-wider">
              Focus preference
            </Text>
            {WEEK_FOCUS_PREFERENCE_OPTIONS.map((option) => (
              <SelectCard
                key={option.id}
                label={option.label}
                description={option.description}
                selected={draft.focusPreference === option.id}
                onPress={() => setFocusPreference(option.id)}
              />
            ))}
          </View>

          <View className="gap-2">
            <Text className="text-text-muted text-xs uppercase tracking-wider">
              Priority skills (optional, up to 2)
            </Text>
            <Text className="text-text-secondary text-sm leading-5 mb-1">
              Guaranteed in the week when filters allow. Partner-needed skills require a Partner day.
            </Text>
            <View className="flex-row flex-wrap gap-2">
              {priorityOptions.map((option) => {
                const selected = draft.prioritySkillIds.includes(option.skillId);
                return (
                  <Pressable
                    key={option.skillId}
                    onPress={() => togglePrioritySkill(option.skillId)}
                    className={`px-3 py-2 rounded-xl border ${
                      selected ? 'bg-primary/20 border-primary' : 'bg-surface border-border'
                    }`}
                  >
                    <Text
                      className={`text-xs font-medium ${
                        selected ? 'text-primary' : 'text-text-secondary'
                      }`}
                    >
                      {option.title}
                      {option.needsPartner ? ' · partner' : ''}
                    </Text>
                  </Pressable>
                );
              })}
            </View>
          </View>
        </View>
      ) : null}

      {step === 2 ? (
        <View className="gap-3">
          {WEEK_DAY_ORDER.map((dayId) => {
            const day = draft.days.find((d) => d.day === dayId)!;
            const unavailable = day.availableMinutes == null;
            const isMatch = draft.matchDay === dayId;
            return (
              <Card
                key={dayId}
                variant="outlined"
                className="gap-3 overflow-hidden"
                style={
                  isMatch
                    ? { borderLeftWidth: 2, borderLeftColor: '#FF6B8A' }
                    : undefined
                }
              >
                <View className="flex-row items-center justify-between">
                  <Text className="text-text-primary font-semibold text-base">
                    {WEEK_DAY_LABELS[dayId]}
                  </Text>
                  {isMatch ? (
                    <View
                      className="px-2 py-0.5 rounded-full"
                      style={{ backgroundColor: '#FF6B8A33' }}
                    >
                      <Text className="text-xs font-medium" style={{ color: '#FF6B8A' }}>
                        Match
                      </Text>
                    </View>
                  ) : null}
                </View>
                <View className="flex-row flex-wrap gap-2">
                  <DayToggle
                    label="Team"
                    active={day.teamTraining}
                    onPress={() => updateDay(dayId, { teamTraining: !day.teamTraining })}
                  />
                  <DayToggle
                    label="Gym"
                    active={day.gymSession}
                    onPress={() => updateDay(dayId, { gymSession: !day.gymSession })}
                  />
                  <DayToggle
                    label="Partner"
                    active={day.hasPartner}
                    accent="#FF6B8A"
                    onPress={() => updateDay(dayId, { hasPartner: !day.hasPartner })}
                  />
                </View>
                <View className="gap-2">
                  <Text className="text-text-muted text-xs uppercase tracking-wider">
                    Individual time
                  </Text>
                  <View className="flex-row flex-wrap gap-2">
                    <Chip
                      label="Unavailable"
                      selected={unavailable}
                      onPress={() => updateDay(dayId, { availableMinutes: null })}
                    />
                    {WEEK_DURATION_OPTIONS.map((minutes) => (
                      <Chip
                        key={minutes}
                        label={`${minutes}m`}
                        selected={day.availableMinutes === minutes}
                        onPress={() => updateDay(dayId, { availableMinutes: minutes })}
                      />
                    ))}
                  </View>
                </View>
              </Card>
            );
          })}
        </View>
      ) : null}

      {step === 3 ? (
        <View className="gap-3">
          <Card variant="outlined" className="gap-1.5">
            <Text className="text-text-primary font-semibold text-base">
              {WEEK_SITUATION_OPTIONS.find((o) => o.id === draft.weekSituation)?.label}
            </Text>
            <Text className="text-text-muted text-sm">
              Age {draft.age ?? ageText}
              {' · '}
              {WEEK_FOCUS_PREFERENCE_OPTIONS.find((o) => o.id === draft.focusPreference)?.label}
              {draft.matchDay
                ? ` · Match ${WEEK_DAY_SHORT_LABELS[draft.matchDay]}`
                : ' · No match'}
            </Text>
            {draft.prioritySkillIds.length > 0 ? (
              <Text className="text-text-secondary text-sm">
                Priority:{' '}
                {draft.prioritySkillIds
                  .map(
                    (id) => priorityOptions.find((o) => o.skillId === id)?.title ?? id
                  )
                  .join(', ')}
              </Text>
            ) : null}
          </Card>
          {WEEK_DAY_ORDER.map((dayId) => {
            const day = draft.days.find((d) => d.day === dayId)!;
            const preview = roleByDay.get(dayId);
            const flags = [
              day.teamTraining ? 'Team' : null,
              day.gymSession ? 'Gym' : null,
              day.hasPartner ? 'Partner' : null,
              day.availableMinutes != null ? `${day.availableMinutes}m` : 'Unavailable',
            ]
              .filter(Boolean)
              .join(' · ');
            return (
              <RolePreviewRow
                key={dayId}
                dayId={dayId}
                role={preview?.role ?? 'rest'}
                matchContext={preview?.matchContext}
                flags={flags}
              />
            );
          })}
        </View>
      ) : null}
    </SessionWizardShell>
  );
}
