import { useMemo } from 'react';
import { View, Text, Pressable, Platform, ScrollView, StyleSheet } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import type { ComponentProps } from 'react';
import { Button } from '@/components/ui';
import {
  FREE_HOF_ENTRY_LIMIT,
  PRO_ANALYSES_PER_MONTH,
  PRO_HOF_ENTRY_LIMIT,
  PRO_PRICE_LABEL,
} from '@/lib/entitlements';
import { FREE_TIER_ANALYSES_PER_MONTH } from '@/lib/constants';
import { useIsPro } from '@/stores/entitlementStore';
import { showComingSoon } from '@/lib/alerts';

type PaywallReason = 'analyses' | 'hof' | 'weekly' | 'default';

type Benefit = {
  icon: ComponentProps<typeof Ionicons>['name'];
  title: string;
  body: string;
  accent: string;
};

const BENEFITS: Benefit[] = [
  {
    icon: 'videocam',
    title: `${PRO_ANALYSES_PER_MONTH} analyses / month`,
    body: `Up from ${FREE_TIER_ANALYSES_PER_MONTH} on Free — more clips, more coaching.`,
    accent: '#00C853',
  },
  {
    icon: 'trophy',
    title: `${PRO_HOF_ENTRY_LIMIT} Hall of Fame slots`,
    body: `Induct up to ${PRO_HOF_ENTRY_LIMIT} elite finishes (Free gets ${FREE_HOF_ENTRY_LIMIT}).`,
    accent: '#F5C542',
  },
  {
    icon: 'calendar',
    title: 'Full Weekly Regimen',
    body: 'A balanced 7-day plan around matches, recovery, and free time.',
    accent: '#FF6B8A',
  },
];

function reasonCopy(reason: PaywallReason): { eyebrow: string; headline: string } {
  switch (reason) {
    case 'analyses':
      return {
        eyebrow: 'Monthly limit reached',
        headline: 'Keep analysing with Pro',
      };
    case 'hof':
      return {
        eyebrow: 'Hall of Fame full',
        headline: 'Unlock more elite slots',
      };
    case 'weekly':
      return {
        eyebrow: 'Weekly Regimen',
        headline: 'Build your week like a Pro',
      };
    default:
      return {
        eyebrow: 'Coach AI Pro',
        headline: 'Level up your coaching',
      };
  }
}

function parseReason(raw: string | string[] | undefined): PaywallReason {
  const value = Array.isArray(raw) ? raw[0] : raw;
  if (value === 'analyses' || value === 'hof' || value === 'weekly') return value;
  return 'default';
}

/**
 * Pro paywall / status screen.
 * Subscribe is Coming soon until RevenueCat store products are live
 * (presentProPaywall in revenueCat.ts is ready to wire when enrollment finishes).
 */
export default function ProScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { reason: reasonParam } = useLocalSearchParams<{ reason?: string }>();
  const reason = parseReason(reasonParam);
  const copy = useMemo(() => reasonCopy(reason), [reason]);
  const isPro = useIsPro();
  const isWeb = Platform.OS === 'web';

  const handleSubscribe = () => {
    showComingSoon('Pro subscriptions');
  };

  if (isPro) {
    return (
      <View className="flex-1 bg-background" style={{ paddingTop: insets.top }}>
        <View className="px-5 pt-2 pb-3 flex-row items-center">
          <Pressable
            onPress={() => router.back()}
            className="w-10 h-10 items-center justify-center -ml-2"
            accessibilityLabel="Go back"
          >
            <Ionicons name="chevron-back" size={24} color="#FFFFFF" />
          </Pressable>
          <Text className="text-text-primary text-lg font-semibold flex-1">Coach AI Pro</Text>
        </View>
        <View className="flex-1 px-5 justify-center gap-4" style={{ paddingBottom: insets.bottom + 24 }}>
          <View
            className="rounded-[28px] overflow-hidden p-6 gap-3"
            style={{ borderWidth: 1, borderColor: 'rgba(0,200,83,0.35)' }}
          >
            <LinearGradient
              colors={['rgba(0,200,83,0.22)', 'rgba(13,13,15,0.95)']}
              style={StyleSheet.absoluteFill}
            />
            <View className="w-14 h-14 rounded-2xl bg-primary-muted items-center justify-center">
              <Ionicons name="checkmark-circle" size={32} color="#00C853" />
            </View>
            <Text className="text-text-primary text-3xl font-bold tracking-tight">You’re on Pro</Text>
            <Text className="text-text-secondary text-base leading-6">
              {PRO_ANALYSES_PER_MONTH} analyses / month · {PRO_HOF_ENTRY_LIMIT} Hall of Fame slots ·
              Weekly Regimen unlocked.
            </Text>
          </View>
          <Button label="Back" variant="secondary" onPress={() => router.back()} fullWidth size="lg" />
        </View>
      </View>
    );
  }

  return (
    <View className="flex-1 bg-background">
      <LinearGradient
        pointerEvents="none"
        colors={['rgba(0,200,83,0.22)', 'rgba(0,200,83,0.05)', 'transparent']}
        locations={[0, 0.4, 1]}
        style={{ position: 'absolute', top: 0, left: 0, right: 0, height: 340 }}
      />

      <View style={{ paddingTop: insets.top }} className="flex-1">
        <View className="px-5 pt-2 pb-2 flex-row items-center">
          <Pressable
            onPress={() => router.back()}
            className="w-10 h-10 items-center justify-center -ml-2"
            accessibilityLabel="Go back"
          >
            <Ionicons name="chevron-back" size={24} color="#FFFFFF" />
          </Pressable>
          <Text className="text-text-muted text-sm font-medium flex-1">Upgrade</Text>
        </View>

        <ScrollView
          className="flex-1"
          contentContainerStyle={{ paddingHorizontal: 20, paddingBottom: 24 }}
          showsVerticalScrollIndicator={false}
        >
          <Text className="text-primary text-xs font-bold uppercase tracking-[1.5px] mb-2">
            {copy.eyebrow}
          </Text>
          <Text className="text-text-primary text-[40px] font-bold tracking-tight leading-[42px] mb-3">
            {copy.headline}
          </Text>
          <Text className="text-text-secondary text-[16px] leading-6 mb-7">
            One plan. More coaching every month — analyses, Hall of Fame, and a full weekly regimen.
          </Text>

          <View className="gap-3 mb-8">
            {BENEFITS.map((benefit) => (
              <View
                key={benefit.title}
                className="flex-row items-start gap-3.5 rounded-[22px] p-4"
                style={{
                  backgroundColor: 'rgba(255,255,255,0.04)',
                  borderWidth: 1,
                  borderColor: `${benefit.accent}33`,
                }}
              >
                <View
                  className="w-12 h-12 rounded-2xl items-center justify-center"
                  style={{ backgroundColor: `${benefit.accent}28` }}
                >
                  <Ionicons name={benefit.icon} size={22} color={benefit.accent} />
                </View>
                <View className="flex-1 gap-1">
                  <Text className="text-text-primary text-base font-bold">{benefit.title}</Text>
                  <Text className="text-text-secondary text-sm leading-5">{benefit.body}</Text>
                </View>
              </View>
            ))}
          </View>

          <View
            className="rounded-[24px] p-5 mb-4 overflow-hidden"
            style={{ borderWidth: 1, borderColor: 'rgba(0,200,83,0.35)' }}
          >
            <LinearGradient
              colors={['rgba(0,200,83,0.16)', 'rgba(13,13,15,0.4)']}
              style={StyleSheet.absoluteFill}
            />
            <Text className="text-text-muted text-xs font-semibold uppercase tracking-wider mb-1">
              Pro membership
            </Text>
            <View className="flex-row items-end gap-1.5 mb-1">
              <Text className="text-text-primary text-4xl font-bold tracking-tight">{PRO_PRICE_LABEL}</Text>
              <Text className="text-text-secondary text-base mb-1.5">/ month</Text>
            </View>
            <Text className="text-text-secondary text-sm leading-5">
              Cancel anytime. Same coaching quality — just more of it.
            </Text>
          </View>

          {isWeb ? (
            <Text className="text-text-muted text-sm leading-5 mb-3">
              Subscribe on iOS or Android with the same account — Pro syncs here automatically.
            </Text>
          ) : null}

        </ScrollView>

        <View
          className="px-5 pt-3 gap-3 border-t border-border bg-background"
          style={{ paddingBottom: insets.bottom + 16 }}
        >
          <Button
            label="Subscribe — Coming soon"
            onPress={handleSubscribe}
            fullWidth
            size="lg"
          />
          <Text className="text-text-muted text-xs text-center">
            Purchases go live after App Store / Play setup. Tap Subscribe for status.
          </Text>
          <Button label="Not now" variant="ghost" onPress={() => router.back()} fullWidth />
        </View>
      </View>
    </View>
  );
}
