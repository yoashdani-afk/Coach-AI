import { useState } from 'react';
import { View, Text } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { ProfileSetupShell } from '@/components/profile/ProfileSetupShell';
import { SelectCard, SelectGridItem } from '@/components/profile/SelectCard';
import { Input, Chip } from '@/components/ui';
import {
  FEEDBACK_AREAS,
  IMPROVEMENT_GOALS,
  PLAYING_LEVELS,
  PLAYING_STYLES,
  POSITIONS,
  PREFERRED_FEET,
} from '@/lib/constants';
import { useProfileStore } from '@/stores/profileStore';
import type {
  FeedbackArea,
  ImprovementGoal,
  PlayerProfile,
  PlayingLevel,
  Position,
  PreferredFoot,
} from '@/types/profile';

const TOTAL_STEPS = 5;

type Draft = {
  firstName: string;
  age: string;
  country: string;
  mainPosition: Position | null;
  secondaryPosition: Position | null;
  preferredFoot: PreferredFoot | null;
  playingLevel: PlayingLevel | null;
  club: string;
  playingStyle: string[];
  improvementGoals: ImprovementGoal[];
  feedbackAreas: FeedbackArea[];
};

function createDraftFromProfile(profile: PlayerProfile | null): Draft {
  return {
    firstName: profile?.firstName ?? '',
    age: profile?.age ? String(profile.age) : '',
    country: profile?.country ?? '',
    mainPosition: profile?.mainPosition ?? null,
    secondaryPosition: profile?.secondaryPosition ?? null,
    preferredFoot: profile?.preferredFoot ?? null,
    playingLevel: profile?.playingLevel ?? null,
    club: profile?.club ?? '',
    playingStyle: profile?.playingStyle ?? [],
    improvementGoals: profile?.improvementGoals ?? [],
    feedbackAreas: profile?.feedbackAreas ?? [],
  };
}

function toggleItem<T>(list: T[], item: T): T[] {
  return list.includes(item) ? list.filter((i) => i !== item) : [...list, item];
}

export default function ProfileSetupScreen() {
  const router = useRouter();
  const { edit } = useLocalSearchParams<{ edit?: string }>();
  const isEditMode = edit === '1';
  const existingProfile = useProfileStore((s) => s.profile);
  const setProfile = useProfileStore((s) => s.setProfile);
  const setHasSeenOnboarding = useProfileStore((s) => s.setHasSeenOnboarding);

  const [step, setStep] = useState(1);
  const [draft, setDraft] = useState<Draft>(() => createDraftFromProfile(existingProfile));

  const ageNum = parseInt(draft.age, 10);
  const step1Valid =
    draft.firstName.trim().length >= 2 &&
    !Number.isNaN(ageNum) &&
    ageNum >= 10 &&
    ageNum <= 50 &&
    draft.country.trim().length >= 2;
  const step2Valid = draft.mainPosition !== null && draft.preferredFoot !== null;
  const step3Valid = draft.playingLevel !== null;
  const step4Valid = draft.playingStyle.length >= 1;
  const step5Valid = draft.improvementGoals.length >= 1 && draft.feedbackAreas.length >= 1;

  const canContinue =
    (step === 1 && step1Valid) ||
    (step === 2 && step2Valid) ||
    (step === 3 && step3Valid) ||
    (step === 4 && step4Valid) ||
    (step === 5 && step5Valid);

  const finishSetup = () => {
    if (!step5Valid || !draft.mainPosition || !draft.preferredFoot || !draft.playingLevel) {
      return;
    }

    const profile: PlayerProfile = {
      firstName: draft.firstName.trim(),
      age: ageNum,
      country: draft.country.trim(),
      mainPosition: draft.mainPosition,
      secondaryPosition: draft.secondaryPosition,
      preferredFoot: draft.preferredFoot,
      playingLevel: draft.playingLevel,
      club: draft.club.trim() || null,
      playingStyle: draft.playingStyle,
      improvementGoals: draft.improvementGoals,
      feedbackAreas: draft.feedbackAreas,
      isComplete: true,
      analysesUsedThisMonth: existingProfile?.analysesUsedThisMonth ?? 0,
      updatedAt: new Date().toISOString(),
    };

    setProfile(profile);
    setHasSeenOnboarding(true);
    router.replace('/(tabs)');
  };

  const handleContinue = () => {
    if (step < TOTAL_STEPS) {
      setStep(step + 1);
      return;
    }
    finishSetup();
  };

  const handleBack = () => {
    if (step > 1) {
      setStep(step - 1);
      return;
    }
    if (isEditMode) {
      router.back();
    } else {
      router.back();
    }
  };

  return (
    <ProfileSetupShell
      step={step}
      totalSteps={TOTAL_STEPS}
      title={
        step === 1
          ? 'About you'
          : step === 2
            ? 'Your position'
            : step === 3
              ? 'Your level'
              : step === 4
                ? 'Your playing style'
                : 'Your goals'
      }
      subtitle={
        step === 1
          ? 'Help your coach understand who you are on and off the pitch.'
          : step === 2
            ? 'Where do you play most often?'
            : step === 3
              ? 'This helps us pitch feedback at the right level.'
              : step === 4
                ? 'Select all styles that describe your game.'
                : 'What do you want to improve, and what should we focus on in your clips?'
      }
      onBack={handleBack}
      onContinue={handleContinue}
      continueDisabled={!canContinue}
      continueLabel={step === TOTAL_STEPS ? (isEditMode ? 'Save profile' : 'Finish setup') : 'Continue'}
    >
      {step === 1 ? (
        <View className="gap-4">
          <Input
            label="First name"
            placeholder="Daniel"
            value={draft.firstName}
            onChangeText={(firstName) => setDraft((d) => ({ ...d, firstName }))}
            autoCapitalize="words"
          />
          <Input
            label="Age"
            placeholder="17"
            value={draft.age}
            onChangeText={(age) => setDraft((d) => ({ ...d, age: age.replace(/[^0-9]/g, '') }))}
            keyboardType="number-pad"
            maxLength={2}
          />
          <Input
            label="Country"
            placeholder="England"
            value={draft.country}
            onChangeText={(country) => setDraft((d) => ({ ...d, country }))}
            autoCapitalize="words"
          />
        </View>
      ) : null}

      {step === 2 ? (
        <View className="gap-6">
          <View>
            <Text className="text-text-secondary text-sm font-medium mb-3">Main position *</Text>
            <View className="flex-row flex-wrap gap-3">
              {POSITIONS.map((pos) => (
                <SelectGridItem key={pos.value}>
                  <SelectCard
                    label={pos.label}
                    icon={pos.icon}
                    selected={draft.mainPosition === pos.value}
                    onPress={() =>
                      setDraft((d) => ({
                        ...d,
                        mainPosition: pos.value,
                        secondaryPosition:
                          d.secondaryPosition === pos.value ? null : d.secondaryPosition,
                      }))
                    }
                    compact
                  />
                </SelectGridItem>
              ))}
            </View>
          </View>

          <View>
            <Text className="text-text-secondary text-sm font-medium mb-3">Secondary position (optional)</Text>
            <View className="flex-row flex-wrap gap-2">
              {POSITIONS.filter((p) => p.value !== draft.mainPosition).map((pos) => (
                <Chip
                  key={pos.value}
                  label={pos.label}
                  selected={draft.secondaryPosition === pos.value}
                  onPress={() =>
                    setDraft((d) => ({
                      ...d,
                      secondaryPosition: d.secondaryPosition === pos.value ? null : pos.value,
                    }))
                  }
                />
              ))}
            </View>
          </View>

          <View>
            <Text className="text-text-secondary text-sm font-medium mb-3">Preferred foot *</Text>
            <View className="flex-row gap-3">
              {PREFERRED_FEET.map((foot) => (
                <View key={foot.value} className="flex-1">
                  <SelectCard
                    label={foot.label}
                    selected={draft.preferredFoot === foot.value}
                    onPress={() => setDraft((d) => ({ ...d, preferredFoot: foot.value }))}
                    compact
                  />
                </View>
              ))}
            </View>
          </View>
        </View>
      ) : null}

      {step === 3 ? (
        <View className="gap-4">
          <View className="gap-3">
            {PLAYING_LEVELS.map((level) => (
              <SelectCard
                key={level.value}
                label={level.label}
                description={level.description}
                selected={draft.playingLevel === level.value}
                onPress={() => setDraft((d) => ({ ...d, playingLevel: level.value }))}
              />
            ))}
          </View>
          <Input
            label="Current club or team (optional)"
            placeholder="City FC U18"
            value={draft.club}
            onChangeText={(club) => setDraft((d) => ({ ...d, club }))}
          />
        </View>
      ) : null}

      {step === 4 ? (
        <View className="flex-row flex-wrap gap-2">
          {PLAYING_STYLES.map((style) => (
            <Chip
              key={style}
              label={style}
              selected={draft.playingStyle.includes(style)}
              onPress={() =>
                setDraft((d) => ({
                  ...d,
                  playingStyle: toggleItem(d.playingStyle, style),
                }))
              }
            />
          ))}
        </View>
      ) : null}

      {step === 5 ? (
        <View className="gap-6">
          <View>
            <Text className="text-text-secondary text-sm font-medium mb-3">Main improvement goals *</Text>
            <View className="flex-row flex-wrap gap-2">
              {IMPROVEMENT_GOALS.map((goal) => (
                <Chip
                  key={goal.value}
                  label={goal.label}
                  selected={draft.improvementGoals.includes(goal.value)}
                  onPress={() =>
                    setDraft((d) => ({
                      ...d,
                      improvementGoals: toggleItem(d.improvementGoals, goal.value),
                    }))
                  }
                />
              ))}
            </View>
          </View>
          <View>
            <Text className="text-text-secondary text-sm font-medium mb-3">Areas you want feedback on *</Text>
            <View className="flex-row flex-wrap gap-2">
              {FEEDBACK_AREAS.map((area) => (
                <Chip
                  key={area.value}
                  label={area.label}
                  selected={draft.feedbackAreas.includes(area.value)}
                  onPress={() =>
                    setDraft((d) => ({
                      ...d,
                      feedbackAreas: toggleItem(d.feedbackAreas, area.value),
                    }))
                  }
                />
              ))}
            </View>
          </View>
        </View>
      ) : null}
    </ProfileSetupShell>
  );
}
