import { ScrollView, View, Text, Alert, Pressable } from 'react-native';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { ScreenHeader } from '@/components/layout/ScreenHeader';
import { Card, Chip, Button } from '@/components/ui';
import {
  labelForClubLevel,
  labelForFeedbackArea,
  labelForFoot,
  labelForGoal,
  labelForLevel,
  labelForPosition,
} from '@/lib/constants';
import {
  formatDateOfBirthForDisplay,
  formatHeightForDisplay,
  formatWeightForDisplay,
} from '@/lib/profileUtils';
import { useProfileStore, profileNeedsCompletion } from '@/stores/profileStore';
import { FREE_TIER_ANALYSES_PER_MONTH } from '@/lib/constants';
import { getRemainingAnalyses, isDevUnlimitedAnalyses } from '@/lib/analysisCredits';

function ProfileRow({ label, value }: { label: string; value: string }) {
  return (
    <View className="flex-row justify-between py-3 border-b border-border">
      <Text className="text-text-muted text-sm">{label}</Text>
      <Text className="text-text-primary text-sm font-medium text-right flex-1 ml-4">{value}</Text>
    </View>
  );
}

export default function ProfileScreen() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const profile = useProfileStore((s) => s.profile);
  const resetAll = useProfileStore((s) => s.resetAll);
  const resetFreeAnalyses = useProfileStore((s) => s.resetFreeAnalyses);
  const remaining = getRemainingAnalyses(profile);
  const needsCompletion = profileNeedsCompletion(profile);

  const handleResetFreeAnalyses = () => {
    Alert.alert(
      'Reset free analyses',
      `Restore your remaining free analyses to ${FREE_TIER_ANALYSES_PER_MONTH}. Development only.`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Reset',
          onPress: () => resetFreeAnalyses(),
        },
      ]
    );
  };

  const handleReset = () => {
    Alert.alert(
      'Reset profile',
      'This clears your local profile and restarts onboarding. Use this for testing.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Reset',
          style: 'destructive',
          onPress: () => {
            resetAll();
            router.replace('/(onboarding)/welcome');
          },
        },
      ]
    );
  };

  if (!profile) {
    return (
      <View className="flex-1 bg-background">
        <ScreenHeader title="Profile" subtitle="Your football profile" />
        <View className="flex-1 items-center justify-center px-8">
          <Text className="text-text-secondary text-center mb-6">
            Complete your player profile to personalise your coaching reports.
          </Text>
          <Button label="Set up profile" onPress={() => router.push('/(onboarding)/setup')} fullWidth />
        </View>
      </View>
    );
  }

  return (
    <View className="flex-1 bg-background">
      <ScreenHeader title="Profile" subtitle="Your football profile" />
      <ScrollView
        className="px-4"
        contentContainerStyle={{ paddingBottom: insets.bottom + 24, gap: 16 }}
        showsVerticalScrollIndicator={false}
      >
        {needsCompletion ? (
          <Card variant="outlined" className="border-warning/40 bg-warning/5">
            <View className="flex-row items-start gap-3">
              <Ionicons name="alert-circle-outline" size={22} color="#FFB020" />
              <View className="flex-1 gap-3">
                <View>
                  <Text className="text-text-primary font-semibold">Profile incomplete</Text>
                  <Text className="text-text-secondary text-sm mt-1">
                    We need a few more details — including your date of birth — to keep your coaching
                    personal and accurate.
                  </Text>
                </View>
                <Button
                  label="Complete profile"
                  variant="secondary"
                  fullWidth
                  onPress={() => router.push('/(onboarding)/setup?edit=1')}
                />
              </View>
            </View>
          </Card>
        ) : null}

        <Card variant="elevated" className="items-center py-6">
          <View className="w-20 h-20 rounded-full bg-primary-muted border border-primary/30 items-center justify-center mb-3">
            <Ionicons name="person" size={36} color="#00C853" />
          </View>
          <Text className="text-text-primary text-2xl font-bold">{profile.firstName}</Text>
          <Text className="text-text-secondary text-sm mt-1">
            {labelForPosition(profile.mainPosition)} · {labelForLevel(profile.playingLevel)}
          </Text>
        </Card>

        <Card variant="outlined">
          <Text className="text-text-muted text-xs uppercase tracking-wider mb-2">Usage</Text>
          {isDevUnlimitedAnalyses() ? (
            <Text className="text-text-secondary text-sm">Dev: unlimited analyses</Text>
          ) : (
            <Text className="text-text-secondary text-sm">
              {remaining} of {FREE_TIER_ANALYSES_PER_MONTH} free analyses remaining this month
            </Text>
          )}
        </Card>

        <Card variant="outlined">
          <Text className="text-text-muted text-xs uppercase tracking-wider mb-2">About</Text>
          <ProfileRow
            label="Date of birth"
            value={
              profile.dateOfBirth
                ? `${formatDateOfBirthForDisplay(profile.dateOfBirth)} (${profile.age})`
                : '—'
            }
          />
          <ProfileRow label="Nationality" value={profile.nationality || '—'} />
          <ProfileRow label="Country playing in" value={profile.countryPlayingIn || '—'} />
          <ProfileRow label="Club" value={profile.club ?? '—'} />
          <ProfileRow label="Club level" value={labelForClubLevel(profile.clubLevel)} />
        </Card>

        <Card variant="outlined">
          <Text className="text-text-muted text-xs uppercase tracking-wider mb-2">Experience</Text>
          <ProfileRow
            label="Years playing"
            value={profile.yearsPlayingFootball >= 0 ? String(profile.yearsPlayingFootball) : '—'}
          />
          <ProfileRow
            label="Years in main position"
            value={profile.yearsInPrimaryPosition >= 0 ? String(profile.yearsInPrimaryPosition) : '—'}
          />
        </Card>

        <Card variant="outlined">
          <Text className="text-text-muted text-xs uppercase tracking-wider mb-2">On the pitch</Text>
          <ProfileRow label="Goalkeeper" value={profile.isGoalkeeper ? 'Yes' : 'No'} />
          <ProfileRow label="Main position" value={labelForPosition(profile.mainPosition)} />
          <ProfileRow
            label="Secondary position"
            value={profile.secondaryPosition ? labelForPosition(profile.secondaryPosition) : '—'}
          />
          <ProfileRow label="Preferred foot" value={labelForFoot(profile.preferredFoot)} />
          <ProfileRow label="Level" value={labelForLevel(profile.playingLevel)} />
          <ProfileRow
            label="Height"
            value={formatHeightForDisplay(profile.heightCm, profile.heightDisplayUnit)}
          />
          <ProfileRow
            label="Weight"
            value={formatWeightForDisplay(profile.weightKg, profile.weightDisplayUnit)}
          />
        </Card>

        <Card variant="outlined">
          <Text className="text-text-muted text-xs uppercase tracking-wider mb-3">Playing style</Text>
          <View className="flex-row flex-wrap gap-2">
            {profile.playingStyle.map((style) => (
              <Chip key={style} label={style} selected />
            ))}
          </View>
        </Card>

        <Card variant="outlined">
          <Text className="text-text-muted text-xs uppercase tracking-wider mb-3">Improvement goals</Text>
          <View className="flex-row flex-wrap gap-2">
            {profile.improvementGoals.map((goal) => (
              <Chip key={goal} label={labelForGoal(goal)} selected />
            ))}
          </View>
        </Card>

        <Card variant="outlined">
          <Text className="text-text-muted text-xs uppercase tracking-wider mb-3">Feedback focus</Text>
          <View className="flex-row flex-wrap gap-2">
            {profile.feedbackAreas.map((area) => (
              <Chip key={area} label={labelForFeedbackArea(area)} selected />
            ))}
          </View>
        </Card>

        <View className="gap-3">
          <Button
            label="Edit profile"
            variant="secondary"
            fullWidth
            onPress={() => router.push('/(onboarding)/setup?edit=1')}
          />
          {__DEV__ ? (
            <>
              <Button
                label="Reset free analyses"
                variant="secondary"
                fullWidth
                onPress={handleResetFreeAnalyses}
              />
              <Button
                label="Marker preview (debug)"
                variant="secondary"
                fullWidth
                onPress={() => router.push('/debug/marker-preview')}
              />
            </>
          ) : null}
          <Button label="Reset profile (testing)" variant="ghost" fullWidth onPress={handleReset} />
        </View>

        <Card variant="default">
          <Pressable className="flex-row items-center justify-between py-1 active:opacity-70">
            <View className="flex-row items-center gap-3">
              <Ionicons name="settings-outline" size={20} color="#A0A0A8" />
              <Text className="text-text-primary font-medium">Settings</Text>
            </View>
            <Ionicons name="chevron-forward" size={18} color="#6B6B73" />
          </Pressable>
          <Text className="text-text-muted text-xs mt-2">Notifications, account, and preferences — coming soon.</Text>
        </Card>
      </ScrollView>
    </View>
  );
}
