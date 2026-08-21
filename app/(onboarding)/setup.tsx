import { useState } from 'react';
import { View, Text } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { ProfileSetupShell } from '@/components/profile/ProfileSetupShell';
import { SelectCard, SelectGridItem } from '@/components/profile/SelectCard';
import {
  DateOfBirthInput,
  datePartsFromIso,
  isDateOfBirthValid,
  isoFromDateParts,
} from '@/components/profile/DateOfBirthInput';
import { Input, Chip } from '@/components/ui';
import {
  CLUB_LEVELS,
  FEEDBACK_AREAS,
  IMPROVEMENT_GOALS,
  PLAYING_LEVELS,
  PLAYING_STYLES,
  POSITIONS,
  PREFERRED_FEET,
} from '@/lib/constants';
import {
  calculateAge,
  isExpandedProfileComplete,
  parseHeightToCm,
  parseWeightToKg,
} from '@/lib/profileUtils';
import { useProfileStore } from '@/stores/profileStore';
import type {
  FeedbackArea,
  HeightDisplayUnit,
  ImprovementGoal,
  PlayerProfile,
  PlayingLevel,
  Position,
  PreferredFoot,
  WeightDisplayUnit,
} from '@/types/profile';

const TOTAL_STEPS = 7;

const OUTFIELD_POSITIONS = POSITIONS.filter((p) => p.value !== 'GOALKEEPER');

type Draft = {
  firstName: string;
  dobParts: { day: string; month: string; year: string };
  nationality: string;
  countryPlayingIn: string;
  club: string;
  clubLevel: string | null;
  yearsPlayingFootball: string;
  yearsInPrimaryPosition: string;
  isGoalkeeper: boolean;
  mainPosition: Position | null;
  secondaryPosition: Position | null;
  preferredFoot: PreferredFoot | null;
  playingLevel: PlayingLevel | null;
  heightInput: string;
  weightInput: string;
  heightDisplayUnit: HeightDisplayUnit;
  weightDisplayUnit: WeightDisplayUnit;
  playingStyle: string[];
  improvementGoals: ImprovementGoal[];
  feedbackAreas: FeedbackArea[];
};

function createDraftFromProfile(profile: PlayerProfile | null): Draft {
  return {
    firstName: profile?.firstName ?? '',
    dobParts: datePartsFromIso(profile?.dateOfBirth ?? ''),
    nationality: profile?.nationality ?? '',
    countryPlayingIn: profile?.countryPlayingIn ?? '',
    club: profile?.club ?? '',
    clubLevel: profile?.clubLevel ?? null,
    yearsPlayingFootball:
      profile?.yearsPlayingFootball != null && profile.yearsPlayingFootball >= 0
        ? String(profile.yearsPlayingFootball)
        : '',
    yearsInPrimaryPosition:
      profile?.yearsInPrimaryPosition != null && profile.yearsInPrimaryPosition >= 0
        ? String(profile.yearsInPrimaryPosition)
        : '',
    isGoalkeeper: profile?.isGoalkeeper ?? profile?.mainPosition === 'GOALKEEPER',
    mainPosition: profile?.mainPosition ?? null,
    secondaryPosition: profile?.secondaryPosition ?? null,
    preferredFoot: profile?.preferredFoot ?? null,
    playingLevel: profile?.playingLevel ?? null,
    heightInput: profile?.heightCm != null ? String(profile.heightCm) : '',
    weightInput: profile?.weightKg != null ? String(profile.weightKg) : '',
    heightDisplayUnit: profile?.heightDisplayUnit ?? 'cm',
    weightDisplayUnit: profile?.weightDisplayUnit ?? 'kg',
    playingStyle: profile?.playingStyle ?? [],
    improvementGoals: profile?.improvementGoals ?? [],
    feedbackAreas: profile?.feedbackAreas ?? [],
  };
}

function toggleItem<T>(list: T[], item: T): T[] {
  return list.includes(item) ? list.filter((i) => i !== item) : [...list, item];
}

function parseYears(value: string): number | null {
  if (!value.trim()) return null;
  const n = parseInt(value, 10);
  return Number.isNaN(n) ? null : n;
}

const STEP_TITLES = [
  'About you',
  'Where you play',
  'Your experience',
  'Your position',
  'Level & physique',
  'Your playing style',
  'Your goals',
] as const;

const STEP_SUBTITLES = [
  'Help your coach understand who you are on and off the pitch.',
  'Where are you playing football right now?',
  'How long have you been playing, and in your main role?',
  'Where do you play most often?',
  'This helps us pitch feedback at the right level.',
  'Select all styles that describe your game.',
  'What do you want to improve, and what should we focus on in your clips?',
] as const;

export default function ProfileSetupScreen() {
  const router = useRouter();
  const { edit } = useLocalSearchParams<{ edit?: string }>();
  const isEditMode = edit === '1';
  const existingProfile = useProfileStore((s) => s.profile);
  const setProfile = useProfileStore((s) => s.setProfile);
  const setHasSeenOnboarding = useProfileStore((s) => s.setHasSeenOnboarding);

  const [step, setStep] = useState(1);
  const [draft, setDraft] = useState<Draft>(() => createDraftFromProfile(existingProfile));

  const yearsPlaying = parseYears(draft.yearsPlayingFootball);
  const yearsInPosition = parseYears(draft.yearsInPrimaryPosition);

  const step1Valid =
    draft.firstName.trim().length >= 2 &&
    isDateOfBirthValid(draft.dobParts) &&
    draft.nationality.trim().length >= 2;

  const step2Valid = draft.countryPlayingIn.trim().length >= 2;

  const step3Valid =
    yearsPlaying !== null &&
    yearsPlaying >= 0 &&
    yearsInPosition !== null &&
    yearsInPosition >= 0 &&
    yearsInPosition <= yearsPlaying;

  const step4Valid =
    draft.mainPosition !== null &&
    draft.preferredFoot !== null &&
    (!draft.isGoalkeeper || draft.mainPosition === 'GOALKEEPER');

  const step5Valid = draft.playingLevel !== null;

  const step6Valid = draft.playingStyle.length >= 1;

  const step7Valid = draft.improvementGoals.length >= 1 && draft.feedbackAreas.length >= 1;

  const canContinue =
    (step === 1 && step1Valid) ||
    (step === 2 && step2Valid) ||
    (step === 3 && step3Valid) ||
    (step === 4 && step4Valid) ||
    (step === 5 && step5Valid) ||
    (step === 6 && step6Valid) ||
    (step === 7 && step7Valid);

  const finishSetup = () => {
    if (
      !step7Valid ||
      !draft.mainPosition ||
      !draft.preferredFoot ||
      !draft.playingLevel ||
      yearsPlaying === null ||
      yearsInPosition === null
    ) {
      return;
    }

    const dateOfBirth = isoFromDateParts(draft.dobParts);
    const age = calculateAge(dateOfBirth);

    const profile: PlayerProfile = {
      firstName: draft.firstName.trim(),
      dateOfBirth,
      age,
      nationality: draft.nationality.trim(),
      countryPlayingIn: draft.countryPlayingIn.trim(),
      yearsPlayingFootball: yearsPlaying,
      yearsInPrimaryPosition: yearsInPosition,
      isGoalkeeper: draft.isGoalkeeper,
      mainPosition: draft.mainPosition,
      secondaryPosition: draft.secondaryPosition,
      preferredFoot: draft.preferredFoot,
      playingLevel: draft.playingLevel,
      club: draft.club.trim() || null,
      clubLevel: draft.clubLevel,
      heightCm: parseHeightToCm(draft.heightInput, draft.heightDisplayUnit),
      weightKg: parseWeightToKg(draft.weightInput, draft.weightDisplayUnit),
      heightDisplayUnit: draft.heightDisplayUnit,
      weightDisplayUnit: draft.weightDisplayUnit,
      playingStyle: draft.playingStyle,
      improvementGoals: draft.improvementGoals,
      feedbackAreas: draft.feedbackAreas,
      isComplete: false,
      analysesUsedThisMonth: existingProfile?.analysesUsedThisMonth ?? 0,
      updatedAt: new Date().toISOString(),
    };

    profile.isComplete = isExpandedProfileComplete(profile);

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
    router.back();
  };

  const setGoalkeeper = (isGoalkeeper: boolean) => {
    setDraft((d) => ({
      ...d,
      isGoalkeeper,
      mainPosition: isGoalkeeper ? 'GOALKEEPER' : d.mainPosition === 'GOALKEEPER' ? null : d.mainPosition,
      secondaryPosition:
        isGoalkeeper && d.secondaryPosition === 'GOALKEEPER' ? null : d.secondaryPosition,
    }));
  };

  return (
    <ProfileSetupShell
      step={step}
      totalSteps={TOTAL_STEPS}
      title={STEP_TITLES[step - 1]}
      subtitle={STEP_SUBTITLES[step - 1]}
      onBack={handleBack}
      onContinue={handleContinue}
      continueDisabled={!canContinue}
      continueLabel={step === TOTAL_STEPS ? (isEditMode ? 'Save profile' : 'Finish setup') : 'Continue'}
    >
      {step === 1 ? (
        <View className="gap-4">
          <Input
            label="First name *"
            placeholder="Daniel"
            value={draft.firstName}
            onChangeText={(firstName) => setDraft((d) => ({ ...d, firstName }))}
            autoCapitalize="words"
          />
          <DateOfBirthInput
            value={draft.dobParts}
            onChange={(dobParts) => setDraft((d) => ({ ...d, dobParts }))}
          />
          <Input
            label="Nationality *"
            placeholder="English"
            value={draft.nationality}
            onChangeText={(nationality) => setDraft((d) => ({ ...d, nationality }))}
            autoCapitalize="words"
          />
        </View>
      ) : null}

      {step === 2 ? (
        <View className="gap-4">
          <Input
            label="Country you play in *"
            placeholder="England"
            value={draft.countryPlayingIn}
            onChangeText={(countryPlayingIn) => setDraft((d) => ({ ...d, countryPlayingIn }))}
            autoCapitalize="words"
          />
          <Input
            label="Current club or team (optional)"
            placeholder="City FC U18"
            value={draft.club}
            onChangeText={(club) => setDraft((d) => ({ ...d, club }))}
          />
          <View>
            <Text className="text-text-secondary text-sm font-medium mb-1">Club level (optional)</Text>
            <Text className="text-text-muted text-xs mb-3">
              Which age group or team at your club?
            </Text>
            <View className="flex-row flex-wrap gap-2">
              <Chip
                label="Not specified"
                selected={draft.clubLevel === null}
                onPress={() => setDraft((d) => ({ ...d, clubLevel: null }))}
              />
              {CLUB_LEVELS.map((level) => (
                <Chip
                  key={level.value}
                  label={level.label}
                  selected={draft.clubLevel === level.value}
                  onPress={() =>
                    setDraft((d) => ({
                      ...d,
                      clubLevel: d.clubLevel === level.value ? null : level.value,
                    }))
                  }
                />
              ))}
            </View>
          </View>
        </View>
      ) : null}

      {step === 3 ? (
        <View className="gap-4">
          <Input
            label="Years playing football *"
            placeholder="8"
            value={draft.yearsPlayingFootball}
            onChangeText={(yearsPlayingFootball) =>
              setDraft((d) => ({ ...d, yearsPlayingFootball: yearsPlayingFootball.replace(/[^0-9]/g, '') }))
            }
            keyboardType="number-pad"
            maxLength={2}
          />
          <Input
            label="Years in your main position *"
            placeholder="3"
            value={draft.yearsInPrimaryPosition}
            onChangeText={(yearsInPrimaryPosition) =>
              setDraft((d) => ({
                ...d,
                yearsInPrimaryPosition: yearsInPrimaryPosition.replace(/[^0-9]/g, ''),
              }))
            }
            keyboardType="number-pad"
            maxLength={2}
          />
          {yearsPlaying !== null &&
          yearsInPosition !== null &&
          yearsInPosition > yearsPlaying ? (
            <Text className="text-danger text-xs">
              Years in position cannot exceed total years playing.
            </Text>
          ) : null}
        </View>
      ) : null}

      {step === 4 ? (
        <View className="gap-6">
          <View>
            <Text className="text-text-secondary text-sm font-medium mb-3">Are you a goalkeeper? *</Text>
            <View className="flex-row gap-3">
              <View className="flex-1">
                <SelectCard
                  label="Yes"
                  selected={draft.isGoalkeeper}
                  onPress={() => setGoalkeeper(true)}
                  compact
                />
              </View>
              <View className="flex-1">
                <SelectCard
                  label="No"
                  selected={!draft.isGoalkeeper}
                  onPress={() => setGoalkeeper(false)}
                  compact
                />
              </View>
            </View>
          </View>

          {!draft.isGoalkeeper ? (
            <>
              <View>
                <Text className="text-text-secondary text-sm font-medium mb-3">Main position *</Text>
                <View className="flex-row flex-wrap gap-3">
                  {OUTFIELD_POSITIONS.map((pos) => (
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
                <Text className="text-text-secondary text-sm font-medium mb-3">
                  Secondary position (optional)
                </Text>
                <View className="flex-row flex-wrap gap-2">
                  {OUTFIELD_POSITIONS.filter((p) => p.value !== draft.mainPosition).map((pos) => (
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
            </>
          ) : (
            <View className="bg-surface-elevated border border-border rounded-2xl p-4">
              <Text className="text-text-primary font-medium">Main position</Text>
              <Text className="text-text-secondary text-sm mt-1">Goalkeeper</Text>
            </View>
          )}

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

      {step === 5 ? (
        <View className="gap-6">
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

          <View>
            <Text className="text-text-secondary text-sm font-medium mb-3">Height (optional)</Text>
            <View className="flex-row gap-2 mb-3">
              {(['cm', 'ft_in'] as HeightDisplayUnit[]).map((unit) => (
                <Chip
                  key={unit}
                  label={unit === 'cm' ? 'cm' : 'ft / in'}
                  selected={draft.heightDisplayUnit === unit}
                  onPress={() => setDraft((d) => ({ ...d, heightDisplayUnit: unit, heightInput: '' }))}
                />
              ))}
            </View>
            <Input
              placeholder={draft.heightDisplayUnit === 'cm' ? '175' : "5'10"}
              value={draft.heightInput}
              onChangeText={(heightInput) => setDraft((d) => ({ ...d, heightInput }))}
              keyboardType={draft.heightDisplayUnit === 'cm' ? 'number-pad' : 'default'}
            />
          </View>

          <View>
            <Text className="text-text-secondary text-sm font-medium mb-3">Weight (optional)</Text>
            <View className="flex-row gap-2 mb-3">
              {(['kg', 'lb'] as WeightDisplayUnit[]).map((unit) => (
                <Chip
                  key={unit}
                  label={unit}
                  selected={draft.weightDisplayUnit === unit}
                  onPress={() => setDraft((d) => ({ ...d, weightDisplayUnit: unit, weightInput: '' }))}
                />
              ))}
            </View>
            <Input
              placeholder={draft.weightDisplayUnit === 'kg' ? '70' : '154'}
              value={draft.weightInput}
              onChangeText={(weightInput) => setDraft((d) => ({ ...d, weightInput }))}
              keyboardType="number-pad"
            />
          </View>
        </View>
      ) : null}

      {step === 6 ? (
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

      {step === 7 ? (
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
