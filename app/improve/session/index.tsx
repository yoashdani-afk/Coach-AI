import { useMemo, useState } from 'react';
import { View, Text } from 'react-native';
import { useRouter } from 'expo-router';
import { SessionWizardShell } from '@/components/improve/SessionWizardShell';
import { SelectCard } from '@/components/profile/SelectCard';
import { Card, Chip, Input } from '@/components/ui';
import { getAllImproveCategories } from '@/lib/improveContent';
import { useImproveSessionDraftStore } from '@/stores/improveSessionDraftStore';
import { useProfileStore } from '@/stores/profileStore';
import {
  SESSION_DURATION_OPTIONS,
  SESSION_INTENSITY_OPTIONS,
  SESSION_SITUATION_OPTIONS,
  type SessionTarget,
} from '@/types/improveSession';

const TOTAL_STEPS = 6;

export default function ImproveSessionWizardScreen() {
  const router = useRouter();
  const profile = useProfileStore((s) => s.profile);
  const categories = getAllImproveCategories();

  const inputs = useImproveSessionDraftStore((s) => s.inputs);
  const setTarget = useImproveSessionDraftStore((s) => s.setTarget);
  const setSituation = useImproveSessionDraftStore((s) => s.setSituation);
  const setIntensity = useImproveSessionDraftStore((s) => s.setIntensity);
  const setAge = useImproveSessionDraftStore((s) => s.setAge);
  const setDurationMinutes = useImproveSessionDraftStore((s) => s.setDurationMinutes);
  const setHasPartner = useImproveSessionDraftStore((s) => s.setHasPartner);
  const generate = useImproveSessionDraftStore((s) => s.generate);
  const resetDraft = useImproveSessionDraftStore((s) => s.resetDraft);

  const [step, setStep] = useState(1);
  const [ageText, setAgeText] = useState(String(inputs.age ?? profile?.age ?? ''));

  const recoveryOverridesTarget =
    inputs.situation === 'recovery-day' || inputs.situation === 'rehab';

  const skillsByCategory = useMemo(
    () =>
      categories.map((category) => ({
        categoryId: category.id,
        categoryTitle: category.title,
        skills: category.skills.filter((s) => s.id !== 'warm-up'),
      })),
    [categories]
  );

  const canContinue = (() => {
    switch (step) {
      case 1:
        return inputs.target != null;
      case 2:
        return inputs.situation != null;
      case 3:
        return typeof inputs.hasPartner === 'boolean';
      case 4:
        return inputs.intensity != null;
      case 5: {
        const age = Number(ageText);
        return Number.isFinite(age) && age >= 8 && age <= 60;
      }
      case 6:
        return inputs.durationMinutes != null;
      default:
        return false;
    }
  })();

  const applyTarget = (target: SessionTarget) => {
    setTarget(target);
  };

  const goBack = () => {
    if (step === 1) {
      router.back();
      return;
    }
    setStep((s) => s - 1);
  };

  const goNext = () => {
    if (step === 5) {
      setAge(Number(ageText));
    }

    if (step < TOTAL_STEPS) {
      setStep((s) => s + 1);
      return;
    }

    const age = Number(ageText);
    useImproveSessionDraftStore.setState((state) => ({
      inputs: { ...state.inputs, age },
    }));

    const session = generate(profile);
    if (!session) return;
    router.replace('/improve/session/result');
  };

  const stepCopy = (() => {
    switch (step) {
      case 1:
        return {
          title: 'What are you training?',
          subtitle: recoveryOverridesTarget
            ? 'You picked Recovery day or Rehab — target will be ignored. You can still set a preference for later sessions.'
            : 'Use your profile goals, or pick one specific skill.',
        };
      case 2:
        return {
          title: 'What’s the situation?',
          subtitle: 'This shapes which drills are safe and useful today.',
        };
      case 3:
        return {
          title: 'Training partner?',
          subtitle: 'If you don’t have a partner, we’ll skip partner-only drills.',
        };
      case 4:
        return {
          title: 'How hard should it feel?',
          subtitle: recoveryOverridesTarget
            ? 'Intensity still helps sort Recovery drills, but Recovery day / Rehab keep the pool limited.'
            : 'We’ll match this to drill difficulty, adjusted for your playing level.',
        };
      case 5:
        return {
          title: 'How old are you?',
          subtitle: 'Used to keep Strength work age-appropriate (bodyweight-only under 14).',
        };
      case 6:
        return {
          title: 'How long do you have?',
          subtitle: 'We’ll build a session with about this many drills — not a literal minute sum.',
        };
      default:
        return { title: '', subtitle: undefined };
    }
  })();

  return (
    <SessionWizardShell
      step={step}
      totalSteps={TOTAL_STEPS}
      title={stepCopy.title}
      subtitle={stepCopy.subtitle}
      onBack={goBack}
      onContinue={goNext}
      continueLabel={step === TOTAL_STEPS ? 'Generate session' : 'Continue'}
      continueDisabled={!canContinue}
    >
      {step === 1 ? (
        <View className="gap-4">
          <SelectCard
            label="Based on my profile"
            description={
              profile?.improvementGoals?.length
                ? 'We’ll pick one skill from your improvement goals'
                : 'Uses a sensible default skill if goals aren’t set yet'
            }
            icon="person-outline"
            selected={inputs.target?.kind === 'profile'}
            onPress={() => applyTarget({ kind: 'profile' })}
          />

          <Text className="text-text-muted text-xs uppercase tracking-wider mt-2">
            Or pick a specific skill
          </Text>
          {skillsByCategory.map((group) => (
            <View key={group.categoryId} className="gap-2">
              <Text className="text-text-secondary text-sm font-medium">
                {group.categoryTitle}
              </Text>
              <View className="flex-row flex-wrap gap-2">
                {group.skills.map((skill) => (
                  <Chip
                    key={skill.id}
                    label={skill.title}
                    selected={
                      inputs.target?.kind === 'skill' &&
                      inputs.target.categoryId === group.categoryId &&
                      inputs.target.skillId === skill.id
                    }
                    onPress={() =>
                      applyTarget({
                        kind: 'skill',
                        categoryId: group.categoryId,
                        skillId: skill.id,
                      })
                    }
                  />
                ))}
              </View>
            </View>
          ))}
        </View>
      ) : null}

      {step === 2 ? (
        <View className="gap-3">
          {SESSION_SITUATION_OPTIONS.map((option) => (
            <SelectCard
              key={option.id}
              label={option.label}
              description={option.description}
              selected={inputs.situation === option.id}
              onPress={() => setSituation(option.id)}
            />
          ))}
          {recoveryOverridesTarget ? (
            <Card variant="outlined" className="mt-2">
              <Text className="text-text-secondary text-sm leading-6">
                Recovery day and Rehab ignore your target and pull from Recovery & Mobility
                (with occasional light juggling). Location isn’t filtered for these sessions.
              </Text>
            </Card>
          ) : null}
        </View>
      ) : null}

      {step === 3 ? (
        <View className="gap-3">
          <SelectCard
            label="Yes — I have a partner"
            description="Partner drills can be included"
            icon="people-outline"
            selected={inputs.hasPartner === true}
            onPress={() => setHasPartner(true)}
          />
          <SelectCard
            label="No — solo today"
            description="We’ll exclude partner-only drills"
            icon="person-outline"
            selected={inputs.hasPartner === false}
            onPress={() => setHasPartner(false)}
          />
        </View>
      ) : null}

      {step === 4 ? (
        <View className="gap-3">
          {SESSION_INTENSITY_OPTIONS.map((option) => (
            <SelectCard
              key={option.id}
              label={option.label}
              description={option.description}
              selected={inputs.intensity === option.id}
              onPress={() => setIntensity(option.id)}
            />
          ))}
        </View>
      ) : null}

      {step === 5 ? (
        <View className="gap-3">
          <Input
            label="Age"
            value={ageText}
            onChangeText={setAgeText}
            keyboardType="number-pad"
            placeholder={profile?.age ? String(profile.age) : 'e.g. 16'}
          />
          {profile?.age ? (
            <Chip
              label={`Use profile age (${profile.age})`}
              selected={ageText === String(profile.age)}
              onPress={() => setAgeText(String(profile.age))}
            />
          ) : null}
        </View>
      ) : null}

      {step === 6 ? (
        <View className="flex-row flex-wrap gap-2">
          {SESSION_DURATION_OPTIONS.map((minutes) => (
            <Chip
              key={minutes}
              label={`${minutes} min`}
              selected={inputs.durationMinutes === minutes}
              onPress={() => setDurationMinutes(minutes)}
            />
          ))}
          <Text className="text-text-muted text-sm leading-5 mt-3 w-full">
            About{' '}
            {inputs.durationMinutes === 15
              ? '3'
              : inputs.durationMinutes === 30
                ? '5'
                : inputs.durationMinutes === 45
                  ? '7'
                  : inputs.durationMinutes === 60
                    ? '9'
                    : '—'}{' '}
            main drills, plus warm-up and closing stretches when applicable. Training location is
            chosen automatically from the drills that fit.
          </Text>
          <Chip
            label="Start over"
            onPress={() => {
              resetDraft();
              setStep(1);
              setAgeText(String(profile?.age ?? ''));
            }}
          />
        </View>
      ) : null}
    </SessionWizardShell>
  );
}
