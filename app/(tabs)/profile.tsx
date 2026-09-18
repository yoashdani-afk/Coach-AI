import { useState } from 'react';
import { ScrollView, View, Text, Alert, Pressable, Platform, Linking } from 'react-native';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import type { ComponentProps } from 'react';
import { ScreenHeader } from '@/components/layout/ScreenHeader';
import { Card, Chip, Button } from '@/components/ui';
import { UsageAnalysesCard } from '@/components/usage/UsageAnalysesCard';
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
import { getSupabase, isSupabaseConfigured } from '@/lib/supabase';
import { deleteOwnAccount } from '@/lib/deleteAccount';
import {
  openExternalUrl,
  PRIVACY_POLICY_URL,
  TERMS_OF_USE_URL,
} from '@/lib/ugcSafety';
import {
  canManageProOnThisPlatform,
  logOutRevenueCatUser,
  presentProCustomerCenter,
} from '@/lib/revenueCat';
import { useAuthStore } from '@/stores/authStore';
import { useEntitlementStore, useIsPro } from '@/stores/entitlementStore';
import { useProfileStore, profileNeedsCompletion } from '@/stores/profileStore';
import { getRemainingAnalyses, isDevUnlimitedAnalyses } from '@/lib/analysisCredits';
import { getAnalysisLimit, proPaywallHref } from '@/lib/entitlements';

const PRIMARY_GREEN = '#00C853';
const FOCUS_BLUE = '#5B8DEF';
const EXPERIENCE_TEAL = '#2DD4BF';
const STYLE_VIOLET = '#A78BFA';
const WARNING_AMBER = '#FFB300';
const SUPPORT_EMAIL = 'dan@blsl.net';

type IoniconName = ComponentProps<typeof Ionicons>['name'];

/** Web: window.alert — native Alert.alert is unreliable on react-native-web. */
function showAlert(title: string, message?: string) {
  if (Platform.OS === 'web') {
    const text = message ? `${title}\n\n${message}` : title;
    if (typeof window !== 'undefined') window.alert(text);
    return;
  }
  Alert.alert(title, message);
}

/** Web: window.confirm — multi-button Alert.alert does not render on web. */
function confirmAction(title: string, message: string): boolean {
  if (Platform.OS === 'web') {
    if (typeof window === 'undefined') return false;
    return window.confirm(`${title}\n\n${message}`);
  }
  // Native path never uses this return value — callers branch on Platform.OS.
  return false;
}

function ProfileRow({
  label,
  value,
  isLast = false,
}: {
  label: string;
  value: string;
  isLast?: boolean;
}) {
  return (
    <View
      className={`flex-row justify-between py-3 ${isLast ? '' : 'border-b border-border'}`}
    >
      <Text className="text-text-muted text-sm">{label}</Text>
      <Text className="text-text-primary text-sm font-semibold text-right flex-1 ml-4">
        {value}
      </Text>
    </View>
  );
}

function SectionHeader({
  title,
  icon,
  accent,
}: {
  title: string;
  icon: IoniconName;
  accent: string;
}) {
  return (
    <View className="flex-row items-center gap-2.5 mb-2">
      <View
        className="w-8 h-8 rounded-lg items-center justify-center"
        style={{ backgroundColor: `${accent}33` }}
      >
        <Ionicons name={icon} size={16} color={accent} />
      </View>
      <Text className="text-text-primary font-semibold text-base">{title}</Text>
    </View>
  );
}

function ProfileSectionCard({
  title,
  icon,
  accent,
  children,
}: {
  title: string;
  icon: IoniconName;
  accent: string;
  children: React.ReactNode;
}) {
  return (
    <Card
      variant="outlined"
      className="overflow-hidden"
      style={{ borderLeftWidth: 2, borderLeftColor: accent }}
    >
      <SectionHeader title={title} icon={icon} accent={accent} />
      {children}
    </Card>
  );
}

function IdentityChip({ label, color }: { label: string; color: string }) {
  return (
    <View className="px-2.5 py-1 rounded-full" style={{ backgroundColor: `${color}33` }}>
      <Text className="text-xs font-semibold" style={{ color }}>
        {label}
      </Text>
    </View>
  );
}

export default function ProfileScreen() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const profile = useProfileStore((s) => s.profile);
  const clearProfile = useProfileStore((s) => s.clearProfile);
  const setSignedIn = useProfileStore((s) => s.setSignedIn);
  const analysesMonthlyLimit = useProfileStore((s) => s.analysesMonthlyLimit);
  const isPro = useIsPro();
  const effectiveLimit = Math.max(analysesMonthlyLimit, getAnalysisLimit(isPro));
  const clearAuth = useAuthStore((s) => s.clear);
  const remaining = getRemainingAnalyses(profile, effectiveLimit);
  const unlimited = isDevUnlimitedAnalyses();
  const needsCompletion = profileNeedsCompletion(profile);
  const canManagePro = canManageProOnThisPlatform();
  const [managingSubscription, setManagingSubscription] = useState(false);
  const [deletingAccount, setDeletingAccount] = useState(false);

  const handleManageSubscription = async () => {
    setManagingSubscription(true);
    try {
      await presentProCustomerCenter();
    } finally {
      setManagingSubscription(false);
    }
  };

  const handleContactUs = () => {
    void Linking.openURL(`mailto:${SUPPORT_EMAIL}`).catch(() => {
      showAlert('Contact us', SUPPORT_EMAIL);
    });
  };

  const performSignOut = async () => {
    try {
      if (isSupabaseConfigured) {
        const { error } = await getSupabase().auth.signOut();
        if (error) {
          showAlert('Sign out failed', error.message);
          return;
        }
      }
      await logOutRevenueCatUser();
      useEntitlementStore.getState().setHasProEntitlement(false);
      clearAuth();
      clearProfile();
      setSignedIn(false);
      router.replace('/(onboarding)/welcome');
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Something went wrong.';
      showAlert('Sign out failed', message);
    }
  };

  const handleSignOut = () => {
    if (Platform.OS === 'web') {
      if (confirmAction('Sign out', 'End your session on this device?')) {
        void performSignOut();
      }
      return;
    }

    Alert.alert('Sign out', 'End your session on this device?', [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Sign out', style: 'destructive', onPress: () => void performSignOut() },
    ]);
  };

  const DELETE_ACCOUNT_MESSAGE =
    'This permanently deletes your GoalX account, profile, analysis history, and Hall of Fame uploads. This cannot be undone.\n\nIf you have an App Store subscription, cancel it in Settings → Apple ID → Subscriptions — deleting your account does not cancel billing.';

  const performDeleteAccount = async () => {
    setDeletingAccount(true);
    try {
      await deleteOwnAccount();
      router.replace('/(onboarding)/welcome');
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Something went wrong.';
      showAlert('Could not delete account', message);
    } finally {
      setDeletingAccount(false);
    }
  };

  const handleDeleteAccount = () => {
    if (Platform.OS === 'web') {
      if (
        confirmAction('Delete account?', DELETE_ACCOUNT_MESSAGE) &&
        confirmAction(
          'Confirm deletion',
          'Type OK to permanently delete your account and all associated data.'
        )
      ) {
        void performDeleteAccount();
      }
      return;
    }

    Alert.alert('Delete account?', DELETE_ACCOUNT_MESSAGE, [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Continue',
        style: 'destructive',
        onPress: () => {
          Alert.alert(
            'Delete permanently?',
            'Your account and data will be removed immediately.',
            [
              { text: 'Cancel', style: 'cancel' },
              {
                text: 'Delete account',
                style: 'destructive',
                onPress: () => void performDeleteAccount(),
              },
            ]
          );
        },
      },
    ]);
  };

  if (!profile) {
    return (
      <View className="flex-1 bg-background">
        <ScreenHeader title="Profile" subtitle="Your player details" />
        <View className="flex-1 px-4" style={{ paddingBottom: insets.bottom + 24 }}>
          <Card variant="outlined" className="items-center py-12 mt-4 gap-4">
            <View className="w-16 h-16 rounded-2xl bg-surface-elevated items-center justify-center">
              <Ionicons name="person-outline" size={32} color="#6B6B73" />
            </View>
            <Text className="text-text-primary text-lg font-semibold text-center">
              No profile yet
            </Text>
            <Text className="text-text-secondary text-sm text-center leading-6 px-4">
              Set up your player details so coaching reports can match your position, level, and
              goals.
            </Text>
            <Button
              label="Set up profile"
              onPress={() => router.push('/(onboarding)/setup')}
              fullWidth
            />
            <Button label="Sign out" variant="ghost" fullWidth onPress={handleSignOut} />
            <Button
              label="Delete account"
              variant="ghost"
              fullWidth
              loading={deletingAccount}
              disabled={deletingAccount}
              onPress={handleDeleteAccount}
            />
          </Card>
        </View>
      </View>
    );
  }

  return (
    <View className="flex-1 bg-background">
      <ScreenHeader title="Profile" subtitle="Your player details" />
      <ScrollView
        className="px-4"
        contentContainerStyle={{ paddingBottom: insets.bottom + 24, gap: 16 }}
        showsVerticalScrollIndicator={false}
      >
        {needsCompletion ? (
          <Card
            variant="outlined"
            className="overflow-hidden"
            style={{
              borderLeftWidth: 2,
              borderLeftColor: WARNING_AMBER,
              borderColor: 'rgba(255, 179, 0, 0.35)',
              backgroundColor: 'rgba(255, 179, 0, 0.06)',
            }}
          >
            <View className="flex-row items-start gap-3">
              <View
                className="w-10 h-10 rounded-xl items-center justify-center"
                style={{ backgroundColor: `${WARNING_AMBER}33` }}
              >
                <Ionicons name="alert-circle" size={22} color={WARNING_AMBER} />
              </View>
              <View className="flex-1 gap-3">
                <View>
                  <Text className="text-text-primary font-semibold">Profile incomplete</Text>
                  <Text className="text-text-secondary text-sm mt-1 leading-5">
                    Add a few missing details — including your date of birth — so coaching stays
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

        <Card variant="elevated" className="items-center py-7 overflow-hidden">
          <View pointerEvents="none" style={{ position: 'absolute', top: -20, right: -16 }}>
            <Ionicons name="person" size={120} color={PRIMARY_GREEN} style={{ opacity: 0.06 }} />
          </View>
          <View
            className="items-center justify-center mb-4"
            style={{
              width: 88,
              height: 88,
              borderRadius: 44,
              backgroundColor: `${PRIMARY_GREEN}22`,
              borderWidth: 2,
              borderColor: `${PRIMARY_GREEN}66`,
            }}
          >
            <Ionicons name="person" size={40} color={PRIMARY_GREEN} />
          </View>
          <Text className="text-text-primary text-2xl font-bold">{profile.firstName}</Text>
          <View className="flex-row items-center gap-2 mt-3 flex-wrap justify-center">
            <IdentityChip
              label={labelForPosition(profile.mainPosition)}
              color={PRIMARY_GREEN}
            />
            <IdentityChip label={labelForLevel(profile.playingLevel)} color={FOCUS_BLUE} />
          </View>
        </Card>

        <UsageAnalysesCard
          remaining={remaining}
          unlimited={unlimited}
          limit={effectiveLimit}
          periodEnd={profile?.analysesPeriodEnd}
          density="profile"
        />

        <Card
          variant="outlined"
          className="overflow-hidden"
          style={{
            borderLeftWidth: 2,
            borderLeftColor: PRIMARY_GREEN,
            borderColor: isPro ? 'rgba(0, 200, 83, 0.35)' : 'rgba(255,255,255,0.08)',
          }}
        >
          <View className="flex-row items-start gap-3">
            <View
              className="w-10 h-10 rounded-xl items-center justify-center"
              style={{ backgroundColor: `${PRIMARY_GREEN}33` }}
            >
              <Ionicons name={isPro ? 'checkmark-circle' : 'star'} size={22} color={PRIMARY_GREEN} />
            </View>
            <View className="flex-1 gap-3">
              <View>
                <Text className="text-text-primary font-semibold">
                  {isPro ? 'GoalX Pro' : 'Unlock Pro'}
                </Text>
                <Text className="text-text-secondary text-sm mt-1 leading-5">
                  {isPro
                    ? 'Manage billing or change plans.'
                    : 'More analyses, Hall of Fame slots, and the full weekly regimen.'}
                </Text>
              </View>
              {isPro && canManagePro ? (
                <Button
                  label="Manage subscription"
                  variant="secondary"
                  fullWidth
                  loading={managingSubscription}
                  disabled={managingSubscription}
                  onPress={() => void handleManageSubscription()}
                />
              ) : (
                <Button
                  label={isPro ? 'Pro details' : 'Upgrade to Pro'}
                  variant={isPro ? 'secondary' : 'primary'}
                  fullWidth
                  onPress={() => router.push(proPaywallHref())}
                />
              )}
            </View>
          </View>
        </Card>

        <ProfileSectionCard title="About" icon="globe-outline" accent={FOCUS_BLUE}>
          <ProfileRow
            label="Date of birth"
            value={
              profile.dateOfBirth
                ? `${formatDateOfBirthForDisplay(profile.dateOfBirth)} (${profile.age})`
                : '—'
            }
          />
          <ProfileRow label="Nationality" value={profile.nationality || '—'} />
          <ProfileRow label="Playing country" value={profile.countryPlayingIn || '—'} />
          <ProfileRow label="Club" value={profile.club ?? '—'} />
          <ProfileRow
            label="Club level"
            value={labelForClubLevel(profile.clubLevel)}
            isLast
          />
        </ProfileSectionCard>

        <ProfileSectionCard title="Experience" icon="time-outline" accent={EXPERIENCE_TEAL}>
          <ProfileRow
            label="Years in football"
            value={
              profile.yearsPlayingFootball >= 0 ? String(profile.yearsPlayingFootball) : '—'
            }
          />
          <ProfileRow
            label="Years in this position"
            value={
              profile.yearsInPrimaryPosition >= 0
                ? String(profile.yearsInPrimaryPosition)
                : '—'
            }
            isLast
          />
        </ProfileSectionCard>

        <ProfileSectionCard title="On the pitch" icon="football-outline" accent={PRIMARY_GREEN}>
          <ProfileRow label="Goalkeeper" value={profile.isGoalkeeper ? 'Yes' : 'No'} />
          <ProfileRow label="Main position" value={labelForPosition(profile.mainPosition)} />
          <ProfileRow
            label="Secondary position"
            value={
              profile.secondaryPosition ? labelForPosition(profile.secondaryPosition) : '—'
            }
          />
          <ProfileRow label="Preferred foot" value={labelForFoot(profile.preferredFoot)} />
          <ProfileRow
            label="Height"
            value={formatHeightForDisplay(profile.heightCm, profile.heightDisplayUnit)}
          />
          <ProfileRow
            label="Weight"
            value={formatWeightForDisplay(profile.weightKg, profile.weightDisplayUnit)}
            isLast
          />
        </ProfileSectionCard>

        <ProfileSectionCard title="Playing style" icon="color-palette-outline" accent={STYLE_VIOLET}>
          {profile.playingStyle.length > 0 ? (
            <View className="flex-row flex-wrap gap-2 mt-1">
              {profile.playingStyle.map((style) => (
                <Chip key={style} label={style} selected />
              ))}
            </View>
          ) : (
            <Text className="text-text-muted text-sm mt-1">No playing styles selected yet.</Text>
          )}
        </ProfileSectionCard>

        <ProfileSectionCard
          title="What you want to improve"
          icon="flag-outline"
          accent={FOCUS_BLUE}
        >
          {profile.improvementGoals.length > 0 ? (
            <View className="flex-row flex-wrap gap-2 mt-1">
              {profile.improvementGoals.map((goal) => (
                <Chip key={goal} label={labelForGoal(goal)} selected />
              ))}
            </View>
          ) : (
            <Text className="text-text-muted text-sm mt-1">No improvement goals selected yet.</Text>
          )}
        </ProfileSectionCard>

        <ProfileSectionCard
          title="What coaching should focus on"
          icon="chatbubbles-outline"
          accent={PRIMARY_GREEN}
        >
          {profile.feedbackAreas.length > 0 ? (
            <View className="flex-row flex-wrap gap-2 mt-1">
              {profile.feedbackAreas.map((area) => (
                <Chip key={area} label={labelForFeedbackArea(area)} selected />
              ))}
            </View>
          ) : (
            <Text className="text-text-muted text-sm mt-1">No feedback focus selected yet.</Text>
          )}
        </ProfileSectionCard>

        <View className="gap-3">
          <Button
            label="Edit profile"
            variant="secondary"
            fullWidth
            onPress={() => router.push('/(onboarding)/setup?edit=1')}
          />
          <Button
            label="Contact us"
            variant="secondary"
            fullWidth
            onPress={handleContactUs}
          />
          <Button label="Sign out" variant="ghost" fullWidth onPress={handleSignOut} />
          <Pressable
            accessibilityRole="button"
            disabled={deletingAccount}
            onPress={handleDeleteAccount}
            className="py-3.5 items-center active:opacity-70"
          >
            <Text className="font-semibold" style={{ color: '#FF5252' }}>
              {deletingAccount ? 'Deleting account…' : 'Delete account'}
            </Text>
          </Pressable>
          <View className="flex-row items-center justify-center gap-3 flex-wrap pt-1">
            <Pressable
              onPress={() =>
                void openExternalUrl(PRIVACY_POLICY_URL).catch(() =>
                  showAlert('Privacy Policy', PRIVACY_POLICY_URL)
                )
              }
              className="active:opacity-70"
            >
              <Text className="text-primary text-xs font-semibold">Privacy Policy</Text>
            </Pressable>
            <Text className="text-text-muted text-xs">·</Text>
            <Pressable
              onPress={() =>
                void openExternalUrl(TERMS_OF_USE_URL).catch(() =>
                  showAlert('Terms of Use', TERMS_OF_USE_URL)
                )
              }
              className="active:opacity-70"
            >
              <Text className="text-primary text-xs font-semibold">Terms of Use</Text>
            </Pressable>
          </View>
        </View>
      </ScrollView>
    </View>
  );
}
