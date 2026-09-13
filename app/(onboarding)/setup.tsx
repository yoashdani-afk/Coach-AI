import { useState } from 'react';
import { View, Text } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { ProfileSetupShell } from '@/components/profile/ProfileSetupShell';
import { SelectCard, SelectGridItem } from '@/components/profile/SelectCard';
import { CountryPicker } from '@/components/profile/CountryPicker';
import { WheelPicker, rangeWheelItems } from '@/components/profile/WheelPicker';
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

const TOTAL_STEPS = 18;
const SECONDARY_POSITION_STEP = 11;

const OUTFIELD_POSITIONS = POSITIONS.filter((p) => p.value !== 'GOALKEEPER');

const YEARS_ITEMS = rangeWheelItems(0, 40);
const HEIGHT_CM_ITEMS = [
  { value: '', label: 'Not specified' },
  ...rangeWheelItems(140, 220, (n) => `${n}`),
];
const HEIGHT_FT_ITEMS = [
  { value: '', label: 'Not specified' },
  ...rangeWheelItems(4, 7, (n) => `${n} ft`),
];
const HEIGHT_IN_ITEMS = rangeWheelItems(0, 11, (n) => `${n} in`);
const WEIGHT_KG_ITEMS = [
  { value: '', label: 'Not specified' },
  ...rangeWheelItems(40, 150, (n) => `${n}`),
];
const WEIGHT_LB_ITEMS = [
  { value: '', label: 'Not specified' },
  ...rangeWheelItems(90, 330, (n) => `${n}`),
];

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
  heightFeet: string;
  heightInches: string;
  playingStyle: string[];
  improvementGoals: ImprovementGoal[];
  feedbackAreas: FeedbackArea[];
};

function parseFtIn(heightInput: string): { feet: string; inches: string } {
  const match = heightInput.trim().match(/^(\d+)\s*[''′]?\s*(\d+)?/);
  if (!match) return { feet: '', inches: '0' };
  return { feet: match[1] ?? '', inches: match[2] ?? '0' };
}

function createDraftFromProfile(profile: PlayerProfile | null): Draft {
  const heightUnit = profile?.heightDisplayUnit ?? 'cm';
  const heightInput =
    profile?.heightCm != null
      ? heightUnit === 'cm'
        ? String(profile.heightCm)
        : ''
      : '';
  const ftIn =
    profile?.heightCm != null && heightUnit === 'ft_in'
      ? (() => {
          const totalInches = Math.round(profile.heightCm / 2.54);
          return {
            feet: String(Math.floor(totalInches / 12)),
            inches: String(totalInches % 12),
          };
        })()
      : parseFtIn(heightInput);

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
        : '5',
    yearsInPrimaryPosition:
      profile?.yearsInPrimaryPosition != null && profile.yearsInPrimaryPosition >= 0
        ? String(profile.yearsInPrimaryPosition)
        : '2',
    isGoalkeeper: profile?.isGoalkeeper ?? profile?.mainPosition === 'GOALKEEPER',
    mainPosition: profile?.mainPosition ?? null,
    secondaryPosition: profile?.secondaryPosition ?? null,
    preferredFoot: profile?.preferredFoot ?? null,
    playingLevel: profile?.playingLevel ?? null,
    heightInput,
    weightInput: profile?.weightKg != null ? String(Math.round(profile.weightKg)) : '',
    heightDisplayUnit: heightUnit,
    weightDisplayUnit: profile?.weightDisplayUnit ?? 'kg',
    heightFeet: ftIn.feet,
    heightInches: ftIn.inches,
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

const STEP_META: {
  title: string;
  subtitle?: string;
  footerHint?: string;
}[] = [
  { title: "What's your first name?" },
  { title: "What's your date of birth?", subtitle: 'We use this to keep coaching age-appropriate.' },
  { title: "What's your nationality?" },
  { title: 'Which country do you play in?' },
  {
    title: 'Current club or team?',
    subtitle: 'Optional — you can skip this.',
    footerHint: 'You can change this later in your profile',
  },
  {
    title: 'Club level?',
    subtitle: 'Optional — which age group or team?',
    footerHint: 'You can change this later in your profile',
  },
  { title: 'How many years have you been playing football?' },
  { title: 'How many years in your main position?' },
  { title: 'Are you a goalkeeper?' },
  { title: "What's your main position?" },
  {
    title: 'Secondary position?',
    subtitle: 'Optional — pick one if you cover another role.',
  },
  { title: "What's your preferred foot?" },
  { title: "What's your playing level?" },
  {
    title: "What's your height?",
    subtitle: 'Optional',
    footerHint: 'Used to personalise physical context in feedback',
  },
  {
    title: "What's your weight?",
    subtitle: 'Optional',
    footerHint: 'Used to personalise physical context in feedback',
  },
  {
    title: 'How would you describe your playing style?',
    subtitle: 'Select all that apply.',
  },
  {
    title: 'What do you want to improve?',
    subtitle: 'Select all that apply.',
  },
  {
    title: 'What should we focus on in your clips?',
    subtitle: 'Select all that apply.',
  },
];

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

  const weightWheelItems =
    draft.weightDisplayUnit === 'kg' ? WEIGHT_KG_ITEMS : WEIGHT_LB_ITEMS;

  const canContinueForStep = (s: number): boolean => {
    switch (s) {
      case 1:
        return draft.firstName.trim().length >= 2;
      case 2:
        return isDateOfBirthValid(draft.dobParts);
      case 3:
        return draft.nationality.trim().length >= 2;
      case 4:
        return draft.countryPlayingIn.trim().length >= 2;
      case 5:
      case 6:
        return true;
      case 7:
        return yearsPlaying !== null && yearsPlaying >= 0;
      case 8:
        return (
          yearsInPosition !== null &&
          yearsInPosition >= 0 &&
          yearsPlaying !== null &&
          yearsInPosition <= yearsPlaying
        );
      case 9:
        return true;
      case 10:
        return (
          draft.mainPosition !== null &&
          (!draft.isGoalkeeper || draft.mainPosition === 'GOALKEEPER')
        );
      case 11:
        return true;
      case 12:
        return draft.preferredFoot !== null;
      case 13:
        return draft.playingLevel !== null;
      case 14:
      case 15:
        return true;
      case 16:
        return draft.playingStyle.length >= 1;
      case 17:
        return draft.improvementGoals.length >= 1;
      case 18:
        return draft.feedbackAreas.length >= 1;
      default:
        return false;
    }
  };

  const canContinue = canContinueForStep(step);

  const nextStepFrom = (from: number) => {
    let next = from + 1;
    if (next === SECONDARY_POSITION_STEP && draft.isGoalkeeper) next += 1;
    return next;
  };

  const prevStepFrom = (from: number) => {
    let prev = from - 1;
    if (prev === SECONDARY_POSITION_STEP && draft.isGoalkeeper) prev -= 1;
    return prev;
  };

  const finishSetup = () => {
    if (
      !canContinueForStep(18) ||
      !canContinueForStep(17) ||
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
    const heightSource =
      draft.heightDisplayUnit === 'cm'
        ? draft.heightInput
        : draft.heightFeet
          ? `${draft.heightFeet}'${draft.heightInches || '0'}`
          : '';

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
      secondaryPosition: draft.isGoalkeeper ? null : draft.secondaryPosition,
      preferredFoot: draft.preferredFoot,
      playingLevel: draft.playingLevel,
      club: draft.club.trim() || null,
      clubLevel: draft.clubLevel,
      heightCm: parseHeightToCm(heightSource, draft.heightDisplayUnit),
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
      setStep(nextStepFrom(step));
      return;
    }
    finishSetup();
  };

  const handleBack = () => {
    if (step > 1) {
      setStep(prevStepFrom(step));
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

  const meta = STEP_META[step - 1];

  return (
    <ProfileSetupShell
      step={step}
      totalSteps={TOTAL_STEPS}
      title={meta.title}
      subtitle={meta.subtitle}
      footerHint={meta.footerHint}
      onBack={handleBack}
      onContinue={handleContinue}
      continueDisabled={!canContinue}
      continueLabel={step === TOTAL_STEPS ? (isEditMode ? 'Save profile' : 'Finish setup') : 'Continue'}
    >
      {step === 1 ? (
        <Input
          placeholder="Daniel"
          value={draft.firstName}
          onChangeText={(firstName) => setDraft((d) => ({ ...d, firstName }))}
          autoCapitalize="words"
          autoFocus
        />
      ) : null}

      {step === 2 ? (
        <DateOfBirthInput
          hideLabel
          value={draft.dobParts}
          onChange={(dobParts) => setDraft((d) => ({ ...d, dobParts }))}
        />
      ) : null}

      {step === 3 ? (
        <CountryPicker
          label=""
          placeholder="Select your nationality"
          value={draft.nationality}
          onChange={(nationality) => setDraft((d) => ({ ...d, nationality }))}
        />
      ) : null}

      {step === 4 ? (
        <CountryPicker
          label=""
          placeholder="Select a country"
          value={draft.countryPlayingIn}
          onChange={(countryPlayingIn) => setDraft((d) => ({ ...d, countryPlayingIn }))}
        />
      ) : null}

      {step === 5 ? (
        <Input
          placeholder="City FC U18"
          value={draft.club}
          onChangeText={(club) => setDraft((d) => ({ ...d, club }))}
          autoCapitalize="words"
        />
      ) : null}

      {step === 6 ? (
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
      ) : null}

      {step === 7 ? (
        <WheelPicker
          items={YEARS_ITEMS}
          value={draft.yearsPlayingFootball || '0'}
          onChange={(yearsPlayingFootball) => setDraft((d) => ({ ...d, yearsPlayingFootball }))}
          suffix="years"
        />
      ) : null}

      {step === 8 ? (
        <View className="gap-4">
          <WheelPicker
            items={YEARS_ITEMS}
            value={draft.yearsInPrimaryPosition || '0'}
            onChange={(yearsInPrimaryPosition) =>
              setDraft((d) => ({ ...d, yearsInPrimaryPosition }))
            }
            suffix="years"
          />
          {yearsPlaying !== null &&
          yearsInPosition !== null &&
          yearsInPosition > yearsPlaying ? (
            <Text className="text-danger text-sm text-center">
              Years in position cannot exceed total years playing.
            </Text>
          ) : null}
        </View>
      ) : null}

      {step === 9 ? (
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
      ) : null}

      {step === 10 ? (
        draft.isGoalkeeper ? (
          <View className="bg-surface-elevated border border-border rounded-2xl p-5">
            <Text className="text-text-primary text-lg font-semibold">Goalkeeper</Text>
            <Text className="text-text-secondary text-sm mt-2">
              Main position is set from your previous answer.
            </Text>
          </View>
        ) : (
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
        )
      ) : null}

      {step === 11 ? (
        <View className="flex-row flex-wrap gap-2">
          <Chip
            label="None"
            selected={draft.secondaryPosition === null}
            onPress={() => setDraft((d) => ({ ...d, secondaryPosition: null }))}
          />
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
      ) : null}

      {step === 12 ? (
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
      ) : null}

      {step === 13 ? (
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
      ) : null}

      {step === 14 ? (
        <View className="gap-6">
          <View className="flex-row gap-2 justify-center">
            {(['cm', 'ft_in'] as HeightDisplayUnit[]).map((unit) => (
              <Chip
                key={unit}
                label={unit === 'cm' ? 'cm' : 'ft / in'}
                selected={draft.heightDisplayUnit === unit}
                onPress={() =>
                  setDraft((d) => ({
                    ...d,
                    heightDisplayUnit: unit,
                    heightInput: unit === 'cm' ? d.heightInput : '',
                  }))
                }
              />
            ))}
          </View>
          {draft.heightDisplayUnit === 'cm' ? (
            <WheelPicker
              items={HEIGHT_CM_ITEMS}
              value={draft.heightInput}
              onChange={(heightInput) => setDraft((d) => ({ ...d, heightInput }))}
              suffix="cm"
            />
          ) : (
            <View className="flex-row gap-4">
              <View className="flex-1">
                <WheelPicker
                  items={HEIGHT_FT_ITEMS}
                  value={draft.heightFeet}
                  onChange={(heightFeet) =>
                    setDraft((d) => ({
                      ...d,
                      heightFeet,
                      heightInches: heightFeet ? d.heightInches || '0' : '0',
                      heightInput: heightFeet ? `${heightFeet}'${d.heightInches || '0'}` : '',
                    }))
                  }
                />
              </View>
              {draft.heightFeet ? (
                <View className="flex-1">
                  <WheelPicker
                    items={HEIGHT_IN_ITEMS}
                    value={draft.heightInches || '0'}
                    onChange={(heightInches) =>
                      setDraft((d) => ({
                        ...d,
                        heightInches,
                        heightInput: `${d.heightFeet}'${heightInches}`,
                      }))
                    }
                  />
                </View>
              ) : null}
            </View>
          )}
        </View>
      ) : null}

      {step === 15 ? (
        <View className="gap-6">
          <View className="flex-row gap-2 justify-center">
            {(['kg', 'lb'] as WeightDisplayUnit[]).map((unit) => (
              <Chip
                key={unit}
                label={unit}
                selected={draft.weightDisplayUnit === unit}
                onPress={() =>
                  setDraft((d) => ({ ...d, weightDisplayUnit: unit, weightInput: '' }))
                }
              />
            ))}
          </View>
          <WheelPicker
            items={weightWheelItems}
            value={draft.weightInput}
            onChange={(weightInput) => setDraft((d) => ({ ...d, weightInput }))}
            suffix={draft.weightDisplayUnit}
          />
        </View>
      ) : null}

      {step === 16 ? (
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

      {step === 17 ? (
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
      ) : null}

      {step === 18 ? (
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
      ) : null}
    </ProfileSetupShell>
  );
}
