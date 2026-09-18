import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  View,
  Text,
  Pressable,
  Platform,
  ScrollView,
  StyleSheet,
  Alert,
  ActivityIndicator,
} from 'react-native';
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
  PRO_MONTHLY_PRICE_LABEL,
  PRO_YEARLY_PRICE_LABEL,
} from '@/lib/entitlements';
import { FREE_TIER_ANALYSES_PER_MONTH } from '@/lib/constants';
import { useEntitlementStore, useIsPro } from '@/stores/entitlementStore';
import {
  canManageProOnThisPlatform,
  canPurchaseProOnThisPlatform,
  getProPlans,
  presentProCustomerCenter,
  purchaseProPlan,
  restoreProPurchases,
  type ProPlan,
  type ProPlanKind,
} from '@/lib/revenueCat';
import { openExternalUrl, PRIVACY_POLICY_URL, TERMS_OF_USE_URL } from '@/lib/ugcSafety';

type PaywallReason = 'analyses' | 'hof' | 'weekly' | 'default';

type Benefit = {
  icon: ComponentProps<typeof Ionicons>['name'];
  title: string;
  body: string;
  accent: string;
};

type DisplayPlan = {
  kind: ProPlanKind;
  title: string;
  subtitle: string;
  priceLabel: string;
  period: string;
  live: ProPlan | null;
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

const PLAN_META: Record<
  ProPlanKind,
  { title: string; subtitle: string; fallbackPrice: string; period: string }
> = {
  yearly: {
    title: 'Yearly',
    subtitle: 'Best value · billed annually',
    fallbackPrice: PRO_YEARLY_PRICE_LABEL,
    period: '/ year',
  },
  monthly: {
    title: 'Monthly',
    subtitle: 'Flexible · cancel anytime',
    fallbackPrice: PRO_MONTHLY_PRICE_LABEL,
    period: '/ month',
  },
};

const PLAN_KINDS: ProPlanKind[] = ['monthly', 'yearly'];

function reasonCopy(reason: PaywallReason): { eyebrow: string; headline: string } {
  switch (reason) {
    case 'analyses':
      return {
        eyebrow: 'Monthly limit reached',
        headline: 'Train like the pros',
      };
    case 'hof':
      return {
        eyebrow: 'Hall of Fame full',
        headline: 'Unlock more elite slots',
      };
    case 'weekly':
      return {
        eyebrow: 'Weekly Regimen',
        headline: 'Train like the pros',
      };
    default:
      return {
        eyebrow: 'GoalX Pro',
        headline: 'Train like the pros',
      };
  }
}

function parseReason(raw: string | string[] | undefined): PaywallReason {
  const value = Array.isArray(raw) ? raw[0] : raw;
  if (value === 'analyses' || value === 'hof' || value === 'weekly') return value;
  return 'default';
}

function showNotice(title: string, message: string) {
  if (Platform.OS === 'web') {
    if (typeof window !== 'undefined') window.alert(`${title}\n\n${message}`);
    return;
  }
  Alert.alert(title, message);
}

/**
 * Pro paywall / status screen.
 * Always shows Yearly + Monthly. Live store prices replace marketing fallbacks when available.
 */
export default function ProScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { reason: reasonParam, from: fromParam } = useLocalSearchParams<{
    reason?: string;
    from?: string;
  }>();
  const reason = parseReason(reasonParam);
  const fromOnboarding = (Array.isArray(fromParam) ? fromParam[0] : fromParam) === 'onboarding';
  const copy = useMemo(() => reasonCopy(reason), [reason]);
  const isPro = useIsPro();
  const lastError = useEntitlementStore((s) => s.lastError);
  const isWeb = Platform.OS === 'web';
  const canPurchase = canPurchaseProOnThisPlatform();
  const canManage = canManageProOnThisPlatform();

  const leavePaywall = useCallback(() => {
    if (fromOnboarding) {
      router.replace('/(tabs)');
      return;
    }
    if (router.canGoBack()) {
      router.back();
      return;
    }
    router.replace('/(tabs)');
  }, [fromOnboarding, router]);

  const [livePlans, setLivePlans] = useState<ProPlan[]>([]);
  const [plansLoading, setPlansLoading] = useState(canPurchase);
  const [selectedKind, setSelectedKind] = useState<ProPlanKind>('monthly');
  const [busyAction, setBusyAction] = useState<'subscribe' | 'manage' | 'restore' | null>(null);

  const loadPlans = useCallback(async () => {
    if (!canPurchase) {
      setLivePlans([]);
      setPlansLoading(false);
      return;
    }
    setPlansLoading(true);
    try {
      const next = await getProPlans();
      setLivePlans(next);
      setSelectedKind((current) => {
        if (next.some((plan) => plan.kind === current)) return current;
        return next.find((plan) => plan.kind === 'monthly')?.kind ?? next[0]?.kind ?? 'monthly';
      });
    } finally {
      setPlansLoading(false);
    }
  }, [canPurchase]);

  useEffect(() => {
    void loadPlans();
  }, [loadPlans]);

  const displayPlans: DisplayPlan[] = useMemo(
    () =>
      PLAN_KINDS.map((kind) => {
        const meta = PLAN_META[kind];
        const live = livePlans.find((plan) => plan.kind === kind) ?? null;
        return {
          kind,
          title: meta.title,
          subtitle: meta.subtitle,
          // Always show euro marketing prices. StoreKit may return a US Sandbox
          // storefront string ($3.99) even when checkout charges EUR.
          priceLabel: meta.fallbackPrice,
          period: meta.period,
          live,
        };
      }),
    [livePlans]
  );

  const selectedDisplay =
    displayPlans.find((plan) => plan.kind === selectedKind) ?? displayPlans[0];
  const selectedLive = selectedDisplay.live;

  const handleSubscribe = async () => {
    if (isWeb || !canPurchase) {
      showNotice(
        'Available on iOS and Android',
        'Subscribe in the iOS or Android app with the same account — Pro syncs here automatically.'
      );
      return;
    }

    if (!selectedLive) {
      showNotice(
        'Plans unavailable',
        'App Store plans have not loaded yet. Check your connection and try again in a moment.'
      );
      return;
    }

    setBusyAction('subscribe');
    try {
      const unlocked = await purchaseProPlan(selectedLive);
      if (unlocked) {
        showNotice('Welcome to Pro', 'Your Pro access is unlocked on this account.');
      }
    } finally {
      setBusyAction(null);
    }
  };

  const handleManage = async () => {
    if (!canManage) {
      showNotice(
        'Manage on mobile',
        'Open GoalX on iOS or Android to change or cancel your subscription.'
      );
      return;
    }
    setBusyAction('manage');
    try {
      await presentProCustomerCenter();
    } finally {
      setBusyAction(null);
    }
  };

  const handleRestore = async () => {
    if (isWeb) {
      showNotice(
        'Restore on mobile',
        'Open GoalX on iOS or Android to restore purchases for this Apple/Google account.'
      );
      return;
    }
    setBusyAction('restore');
    try {
      const result = await restoreProPurchases();
      if (result.restored) {
        showNotice('Purchases restored', 'Your Pro access is unlocked on this account.');
      } else {
        showNotice('Nothing to restore', result.message ?? 'No Pro subscription found.');
      }
    } finally {
      setBusyAction(null);
    }
  };

  const openLegal = (url: string) => {
    void openExternalUrl(url).catch(() => {
      showNotice('Could not open link', url);
    });
  };

  if (isPro) {
    return (
      <View className="flex-1 bg-background" style={{ paddingTop: insets.top }}>
        <View className="px-5 pt-2 pb-3 flex-row items-center">
          <Pressable
            onPress={leavePaywall}
            className="w-10 h-10 items-center justify-center -ml-2"
            accessibilityLabel="Go back"
          >
            <Ionicons name="chevron-back" size={24} color="#FFFFFF" />
          </Pressable>
          <Text className="text-text-primary text-lg font-semibold flex-1">GoalX Pro</Text>
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
          {lastError ? (
            <Text className="text-sm leading-5" style={{ color: '#FF6B8A' }}>
              {lastError}
            </Text>
          ) : null}
          {canManage ? (
            <Button
              label="Manage subscription"
              variant="secondary"
              onPress={() => void handleManage()}
              loading={busyAction === 'manage'}
              disabled={busyAction !== null}
              fullWidth
              size="lg"
            />
          ) : null}
          <Button label="Back" variant="secondary" onPress={leavePaywall} fullWidth size="lg" />
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
            onPress={leavePaywall}
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
              Choose your plan
            </Text>
            <View className="flex-row items-end gap-1.5 mb-1">
              <Text className="text-text-primary text-4xl font-bold tracking-tight">
                {selectedDisplay.priceLabel}
              </Text>
              <Text className="text-text-secondary text-base mb-1.5">{selectedDisplay.period}</Text>
            </View>
            <Text className="text-text-secondary text-sm leading-5 mb-4">
              Monthly or yearly App Store plans. Cancel anytime.
            </Text>

            {plansLoading ? (
              <View className="py-3 mb-2">
                <ActivityIndicator color="#00C853" />
              </View>
            ) : null}

            <View className="gap-2">
              {displayPlans.map((plan) => {
                const selected = plan.kind === selectedDisplay.kind;
                return (
                  <Pressable
                    key={plan.kind}
                    onPress={() => setSelectedKind(plan.kind)}
                    accessibilityRole="button"
                    accessibilityState={{ selected }}
                    className="flex-row items-center justify-between rounded-2xl px-4 py-3"
                    style={{
                      backgroundColor: selected
                        ? 'rgba(0,200,83,0.16)'
                        : 'rgba(255,255,255,0.04)',
                      borderWidth: 1,
                      borderColor: selected
                        ? 'rgba(0,200,83,0.55)'
                        : 'rgba(255,255,255,0.08)',
                    }}
                  >
                    <View className="flex-1 pr-3">
                      <Text className="text-text-primary font-semibold">{plan.title}</Text>
                      <Text className="text-text-muted text-xs mt-0.5">{plan.subtitle}</Text>
                    </View>
                    <Text className="text-text-primary font-bold">{plan.priceLabel}</Text>
                  </Pressable>
                );
              })}
            </View>
          </View>

          {isWeb ? (
            <Text className="text-text-muted text-sm leading-5 mb-3">
              Subscribe on iOS or Android with the same account — Pro syncs here automatically.
            </Text>
          ) : null}

          {lastError ? (
            <Text className="text-sm leading-5 mb-2" style={{ color: '#FF6B8A' }}>
              {lastError}
            </Text>
          ) : null}
        </ScrollView>

        <View
          className="px-5 pt-3 gap-3 border-t border-border bg-background"
          style={{ paddingBottom: insets.bottom + 16 }}
        >
          <Button
            label={`Subscribe — ${selectedDisplay.title}`}
            onPress={() => void handleSubscribe()}
            loading={busyAction === 'subscribe'}
            disabled={busyAction !== null}
            fullWidth
            size="lg"
          />
          <Button
            label="Restore purchases"
            variant="ghost"
            onPress={() => void handleRestore()}
            loading={busyAction === 'restore'}
            disabled={busyAction !== null}
            fullWidth
          />
          <Button label="Not now" variant="ghost" onPress={leavePaywall} fullWidth />
          <Text className="text-text-muted text-[11px] leading-4 text-center px-2">
            Payment is charged to your Apple ID. Subscription renews unless cancelled at least 24
            hours before the period ends. Manage in Settings → Apple ID → Subscriptions.
          </Text>
          <View className="flex-row items-center justify-center gap-3 flex-wrap">
            <Pressable onPress={() => openLegal(PRIVACY_POLICY_URL)} className="active:opacity-70">
              <Text className="text-primary text-xs font-semibold">Privacy Policy</Text>
            </Pressable>
            <Text className="text-text-muted text-xs">·</Text>
            <Pressable onPress={() => openLegal(TERMS_OF_USE_URL)} className="active:opacity-70">
              <Text className="text-primary text-xs font-semibold">Terms of Use</Text>
            </Pressable>
          </View>
        </View>
      </View>
    </View>
  );
}
