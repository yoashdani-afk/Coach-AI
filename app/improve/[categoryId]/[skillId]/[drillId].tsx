import { ScrollView, View, Text } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { ScreenHeader } from '@/components/layout/ScreenHeader';
import { ImproveDrillVideoPlayer } from '@/components/improve/ImproveDrillVideoPlayer';
import { Button, Card, Chip } from '@/components/ui';
import { getImproveCategory, getImproveDrill, getImproveSkill } from '@/lib/improveContent';
import { labelForPartnerRequirement, formatDrillDifficultyStars } from '@/lib/improveDrillDisplay';

export default function ImproveDrillDetailScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { categoryId, skillId, drillId } = useLocalSearchParams<{
    categoryId: string;
    skillId: string;
    drillId: string;
  }>();

  const category = categoryId ? getImproveCategory(categoryId) : undefined;
  const skill = categoryId && skillId ? getImproveSkill(categoryId, skillId) : undefined;
  const drill =
    categoryId && skillId && drillId ? getImproveDrill(categoryId, skillId, drillId) : undefined;

  if (!category || !skill || !drill) {
    return (
      <View className="flex-1 bg-background">
        <ScreenHeader title="Not found" showBack onBack={() => router.back()} />
        <View className="flex-1 items-center justify-center px-8 gap-4">
          <Text className="text-text-secondary text-center leading-6">
            That drill could not be found.
          </Text>
          <Button label="Go back" variant="secondary" onPress={() => router.back()} />
        </View>
      </View>
    );
  }

  const partnerLabel = labelForPartnerRequirement(drill.requiresPartner);

  return (
    <View className="flex-1 bg-background">
      <ScreenHeader
        title={drill.title}
        subtitle={skill.title}
        showBack
        onBack={() => router.back()}
      />
      <ScrollView
        className="flex-1 px-4"
        contentContainerStyle={{ paddingBottom: insets.bottom + 24, gap: 16 }}
        showsVerticalScrollIndicator={false}
      >
        {drill.videoUrl ? (
          <ImproveDrillVideoPlayer
            videoUrl={drill.videoUrl}
            videoTimestamp={drill.videoTimestamp}
            videoTimestampSeconds={drill.videoTimestampSeconds}
          />
        ) : null}

        <View>
          <Card variant="outlined" className="p-0 overflow-hidden">
            <View className="flex-row justify-between items-center px-4 py-3 border-b border-border">
              <Text className="text-text-muted text-sm">Duration</Text>
              <Text className="text-text-primary text-sm font-medium">{drill.duration}</Text>
            </View>
            <View className="flex-row justify-between items-center px-4 py-3 border-b border-border">
              <Text className="text-text-muted text-sm">Players needed</Text>
              <Chip label={partnerLabel} selected />
            </View>
            <View className="flex-row justify-between items-center px-4 py-3 border-b border-border">
              <Text className="text-text-muted text-sm">Difficulty</Text>
              <Text className="text-primary text-sm font-medium">
                {formatDrillDifficultyStars(drill.difficulty)}
              </Text>
            </View>
            <View className="flex-row justify-between items-center px-4 py-3">
              <Text className="text-text-muted text-sm">Creator</Text>
              <Text className="text-text-primary text-sm font-medium text-right flex-1 ml-4">
                {drill.creator}
              </Text>
            </View>
          </Card>
        </View>

        <View>
          <Text className="text-text-muted text-xs uppercase tracking-wider mb-2">Equipment</Text>
          <Card variant="outlined">
            {drill.equipment.length > 0 ? (
              drill.equipment.map((item) => (
                <Text key={item} className="text-text-secondary text-sm leading-6">
                  • {item}
                </Text>
              ))
            ) : (
              <Text className="text-text-muted text-sm italic">None required.</Text>
            )}
          </Card>
        </View>

        <View>
          <Text className="text-text-muted text-xs uppercase tracking-wider mb-2">Steps</Text>
          <Card variant="outlined" className="p-0 overflow-hidden">
            {drill.steps.map((step, index) => (
              <View
                key={`${index}-${step.slice(0, 24)}`}
                className={`flex-row gap-3 px-4 py-4 ${index < drill.steps.length - 1 ? 'border-b border-border' : ''}`}
              >
                <Text className="text-primary font-semibold text-sm w-5">{index + 1}</Text>
                <Text className="text-text-secondary text-sm leading-6 flex-1">{step}</Text>
              </View>
            ))}
          </Card>
        </View>

        {drill.coachingCues.length > 0 ? (
          <View>
            <Text className="text-text-muted text-xs uppercase tracking-wider mb-2">Coaching cues</Text>
            <Card variant="outlined" className="gap-3">
              {drill.coachingCues.map((cue) => (
                <View key={cue} className="flex-row gap-3">
                  <Ionicons name="checkmark-circle" size={18} color="#00C853" style={{ marginTop: 2 }} />
                  <Text className="text-text-secondary text-sm leading-6 flex-1">{cue}</Text>
                </View>
              ))}
            </Card>
          </View>
        ) : null}

        {drill.commonMistakes.length > 0 ? (
          <View>
            <Text className="text-text-muted text-xs uppercase tracking-wider mb-2">Common mistakes</Text>
            <Card variant="outlined" className="gap-3">
              {drill.commonMistakes.map((mistake) => (
                <View key={mistake} className="flex-row gap-3">
                  <Ionicons name="close-circle" size={18} color="#FFB020" style={{ marginTop: 2 }} />
                  <Text className="text-text-secondary text-sm leading-6 flex-1">{mistake}</Text>
                </View>
              ))}
            </Card>
          </View>
        ) : null}
      </ScrollView>
    </View>
  );
}
