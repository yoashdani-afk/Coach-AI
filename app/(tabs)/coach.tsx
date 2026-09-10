import { ScrollView, View, Text, Pressable } from 'react-native';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import type { ComponentProps } from 'react';
import { ScreenHeader } from '@/components/layout/ScreenHeader';
import { ImproveCategoryGrid } from '@/components/improve/ImproveCategoryGrid';
import { Button } from '@/components/ui';
import { getAllImproveCategories } from '@/lib/improveContent';

const WEEK_ACCENT = '#FF6B8A';

function CoachHeroCard({
  title,
  description,
  ctaLabel,
  icon,
  onPress,
}: {
  title: string;
  description: string;
  ctaLabel: string;
  icon: ComponentProps<typeof Ionicons>['name'];
  onPress: () => void;
}) {
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={ctaLabel}
      className="rounded-2xl overflow-hidden active:opacity-90"
      style={{ borderWidth: 1, borderColor: 'rgba(0, 200, 83, 0.35)' }}
    >
      <LinearGradient
        colors={['rgba(0, 200, 83, 0.20)', 'rgba(26, 26, 30, 0.98)']}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={{ padding: 20, gap: 16 }}
      >
        <View pointerEvents="none" style={{ position: 'absolute', top: -8, right: -12 }}>
          <Ionicons name={icon} size={108} color="#00C853" style={{ opacity: 0.1 }} />
        </View>

        <View className="flex-row items-start gap-3.5">
          <View
            className="items-center justify-center bg-primary-muted"
            style={{ width: 56, height: 56, borderRadius: 14 }}
          >
            <Ionicons name={icon} size={28} color="#00C853" />
          </View>
          <View className="flex-1 gap-1.5 pt-0.5">
            <Text className="text-text-primary text-xl font-bold">{title}</Text>
            <Text className="text-text-secondary text-sm leading-5">{description}</Text>
          </View>
        </View>

        <Button label={ctaLabel} variant="primary" fullWidth onPress={onPress} />
      </LinearGradient>
    </Pressable>
  );
}

function CoachSecondaryCard({
  title,
  description,
  icon,
  onPress,
}: {
  title: string;
  description: string;
  icon: ComponentProps<typeof Ionicons>['name'];
  onPress: () => void;
}) {
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={title}
      className="rounded-2xl bg-surface border border-border p-4 active:opacity-90"
      style={{ borderLeftWidth: 2, borderLeftColor: '#FF6B8A66' }}
    >
      <View className="flex-row items-center gap-3">
        <View
          className="items-center justify-center"
          style={{
            width: 40,
            height: 40,
            borderRadius: 12,
            backgroundColor: '#FF6B8A33',
          }}
        >
          <Ionicons name={icon} size={20} color={WEEK_ACCENT} />
        </View>
        <View className="flex-1 gap-0.5">
          <Text className="text-text-primary text-base font-semibold">{title}</Text>
          <Text className="text-text-secondary text-sm leading-5">{description}</Text>
        </View>
        <Ionicons name="chevron-forward" size={20} color={WEEK_ACCENT} />
      </View>
    </Pressable>
  );
}

export default function CoachScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const categories = getAllImproveCategories();

  return (
    <View className="flex-1 bg-background">
      <ScreenHeader title="AI Coach" subtitle="Your personal coach" />
      <ScrollView
        className="flex-1 px-4"
        contentContainerStyle={{ paddingBottom: insets.bottom + 24 }}
        showsVerticalScrollIndicator={false}
      >
        <View className="gap-4 mt-2">
          <CoachHeroCard
            title="Personalized session"
            description="Answer a few questions and get a tailored set of drills for today."
            ctaLabel="Build a session"
            icon="flash"
            onPress={() => router.push('/improve/session')}
          />

          <CoachSecondaryCard
            title="Weekly training regimen"
            description="Map your week — team, gym, partner, and free time — then get a balanced 7-day plan."
            icon="calendar-outline"
            onPress={() => router.push('/improve/week')}
          />

          <View className="mt-4">
            <Text className="text-text-muted text-xs uppercase tracking-wider mb-2">Improve</Text>
            <Text className="text-text-secondary text-sm leading-5 mb-4">
              Build specific skills off the pitch with guided explanations and drills.
            </Text>
            <ImproveCategoryGrid categories={categories} />
          </View>
        </View>
      </ScrollView>
    </View>
  );
}
