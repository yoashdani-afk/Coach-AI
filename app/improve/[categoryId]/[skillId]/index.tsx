import { ScrollView, View, Text } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { ScreenHeader } from '@/components/layout/ScreenHeader';
import { ImproveAgilityFocusGrid } from '@/components/improve/ImproveAgilityFocusGrid';
import { ImproveDifficultyTierGrid } from '@/components/improve/ImproveDifficultyTierGrid';
import { ImproveDrillList } from '@/components/improve/ImproveDrillList';
import { ImproveMuscleGroupGrid } from '@/components/improve/ImproveMuscleGroupGrid';
import { ImproveRecoveryFocusGrid } from '@/components/improve/ImproveRecoveryFocusGrid';
import { ImproveSpeedFocusGrid } from '@/components/improve/ImproveSpeedFocusGrid';
import { Button, Card } from '@/components/ui';
import {
  getImproveCategory,
  getImproveSkill,
  listAgilityFocusAreasForSkill,
  listDifficultyTiersForSkill,
  listMuscleGroupsForSkill,
  listRecoveryFocusAreasForSkill,
  listSpeedFocusAreasForSkill,
  skillHasAgilityFocus,
  skillHasMuscleGroups,
  skillHasRecoveryFocus,
  skillHasSpeedFocus,
  skillUsesDifficultyTiers,
} from '@/lib/improveContent';

export default function ImproveSkillDetailScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { categoryId, skillId } = useLocalSearchParams<{ categoryId: string; skillId: string }>();
  const category = categoryId ? getImproveCategory(categoryId) : undefined;
  const skill = categoryId && skillId ? getImproveSkill(categoryId, skillId) : undefined;
  const showRecoveryFocus = skill ? skillHasRecoveryFocus(skill) : false;
  const showMuscleGroups =
    skill && !showRecoveryFocus ? skillHasMuscleGroups(skill) : false;
  const showSpeedFocus =
    skill && !showRecoveryFocus && !showMuscleGroups ? skillHasSpeedFocus(skill) : false;
  const showAgilityFocus =
    skill && !showRecoveryFocus && !showMuscleGroups && !showSpeedFocus
      ? skillHasAgilityFocus(skill)
      : false;
  const showDifficultyTiers =
    skill &&
    !showRecoveryFocus &&
    !showMuscleGroups &&
    !showSpeedFocus &&
    !showAgilityFocus
      ? skillUsesDifficultyTiers(skill)
      : false;
  const muscleGroups = skill && showMuscleGroups ? listMuscleGroupsForSkill(skill) : [];
  const speedFocusAreas = skill && showSpeedFocus ? listSpeedFocusAreasForSkill(skill) : [];
  const agilityFocusAreas =
    skill && showAgilityFocus ? listAgilityFocusAreasForSkill(skill) : [];
  const recoveryFocusAreas =
    skill && showRecoveryFocus ? listRecoveryFocusAreasForSkill(skill) : [];
  const difficultyTiers =
    skill && showDifficultyTiers ? listDifficultyTiersForSkill(skill) : [];

  if (!category || !skill) {
    return (
      <View className="flex-1 bg-background">
        <ScreenHeader title="Not found" showBack onBack={() => router.back()} />
        <View className="flex-1 items-center justify-center px-8 gap-4">
          <Text className="text-text-secondary text-center leading-6">
            That skill could not be found.
          </Text>
          <Button label="Go back" variant="secondary" onPress={() => router.back()} />
        </View>
      </View>
    );
  }

  const sectionLabel = showMuscleGroups
    ? 'Choose a muscle group'
    : showSpeedFocus || showAgilityFocus || showRecoveryFocus
      ? 'Choose a focus'
      : showDifficultyTiers
        ? 'Choose a difficulty'
        : 'Drills to try';

  return (
    <View className="flex-1 bg-background">
      <ScreenHeader
        title={skill.title}
        subtitle={category.title}
        showBack
        onBack={() => router.back()}
      />
      <ScrollView
        className="flex-1 px-4"
        contentContainerStyle={{ paddingBottom: insets.bottom + 24, gap: 16 }}
        showsVerticalScrollIndicator={false}
      >
        {skill.summary ? (
          <Text className="text-text-secondary text-sm leading-6">{skill.summary}</Text>
        ) : null}

        <View>
          <Text className="text-text-muted text-xs uppercase tracking-wider mb-2">About this skill</Text>
          <Card variant="outlined">
            {skill.explanation ? (
              <Text className="text-text-secondary text-sm leading-6">{skill.explanation}</Text>
            ) : (
              <Text className="text-text-muted text-sm italic">Content coming soon.</Text>
            )}
          </Card>
        </View>

        <View>
          <Text className="text-text-muted text-xs uppercase tracking-wider mb-2">{sectionLabel}</Text>
          {showMuscleGroups ? (
            <ImproveMuscleGroupGrid
              categoryId={category.id}
              skillId={skill.id}
              muscleGroups={muscleGroups}
            />
          ) : showSpeedFocus ? (
            <ImproveSpeedFocusGrid
              categoryId={category.id}
              skillId={skill.id}
              focusAreas={speedFocusAreas}
            />
          ) : showAgilityFocus ? (
            <ImproveAgilityFocusGrid
              categoryId={category.id}
              skillId={skill.id}
              focusAreas={agilityFocusAreas}
            />
          ) : showRecoveryFocus ? (
            <ImproveRecoveryFocusGrid
              categoryId={category.id}
              skillId={skill.id}
              focusAreas={recoveryFocusAreas}
            />
          ) : showDifficultyTiers ? (
            <ImproveDifficultyTierGrid
              categoryId={category.id}
              skillId={skill.id}
              tiers={difficultyTiers}
            />
          ) : (
            <ImproveDrillList categoryId={category.id} skillId={skill.id} drills={skill.drills} />
          )}
        </View>
      </ScrollView>
    </View>
  );
}
