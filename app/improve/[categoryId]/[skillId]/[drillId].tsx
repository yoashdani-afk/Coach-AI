import { ScrollView, View, Text, Pressable, Linking } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { ScreenHeader } from '@/components/layout/ScreenHeader';
import { ImproveSkillProgressBadge } from '@/components/improve/ImproveSkillProgressBadge';
import { Button, Card, Chip } from '@/components/ui';
import { getImproveCategory, getImproveDrill, getImproveSkill } from '@/lib/improveContent';
import { labelForPartnerRequirement, buildDrillVideoUrl } from '@/lib/improveDrillDisplay';
import { useImproveProgressStore } from '@/stores/improveProgressStore';

function openDrillVideo(videoUrl: string, videoTimestampSeconds?: number) {
  Linking.openURL(buildDrillVideoUrl(videoUrl, videoTimestampSeconds)).catch(() => {
    // User cancelled or URL could not be opened — no-op.
  });
}

export default function ImproveDrillDetailScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { categoryId, skillId, drillId } = useLocalSearchParams<{
    categoryId: string;
    skillId: string;
    drillId: string;
  }>();
  const markDrillDone = useImproveProgressStore((state) => state.markDrillDone);

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
        <ImproveSkillProgressBadge categoryId={category.id} skillId={skill.id} showBar />

        {drill.videoUrl ? (
          <View>
            <Text className="text-text-muted text-xs uppercase tracking-wider mb-2">Watch demo</Text>
            <Pressable
              onPress={() => openDrillVideo(drill.videoUrl!, drill.videoTimestampSeconds)}
              className="active:opacity-80"
            >
              <Card variant="outlined" className="flex-row items-center justify-between gap-3">
                <View className="flex-row items-center gap-3 flex-1">
                  <View className="w-10 h-10 rounded-xl bg-primary-muted items-center justify-center">
                    <Ionicons name="play" size={20} color="#00C853" />
                  </View>
                  <Text className="text-text-primary font-semibold text-base">Open video</Text>
                </View>
                {drill.videoTimestamp ? (
                  <Text className="text-text-muted text-sm">Skip to {drill.videoTimestamp}</Text>
                ) : null}
              </Card>
            </Pressable>
          </View>
        ) : null}

        <View>
          <Card variant="outlined" className="p-0 overflow-hidden">
            <View className="flex-row justify-between items-center px-4 py-3 border-b border-border">
              <Text className="text-text-muted text-sm">Duration</Text>
              <Text className="text-text-primary text-sm font-medium">{drill.duration}</Text>
            </View>
            <View className="flex-row justify-between items-center px-4 py-3">
              <Text className="text-text-muted text-sm">Players needed</Text>
              <Chip label={partnerLabel} selected />
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

        <Button
          label="Mark as done"
          variant="secondary"
          fullWidth
          onPress={() => markDrillDone(category.id, skill.id)}
        />
      </ScrollView>
    </View>
  );
}
