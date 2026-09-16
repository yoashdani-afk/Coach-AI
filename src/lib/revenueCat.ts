import { Platform } from 'react-native';
import Purchases, {
  LOG_LEVEL,
  PACKAGE_TYPE,
  PURCHASES_ERROR_CODE,
  type CustomerInfo,
  type PurchasesError,
  type PurchasesOffering,
  type PurchasesPackage,
  type PurchasesStoreProduct,
} from 'react-native-purchases';
import RevenueCatUI, { PAYWALL_RESULT } from 'react-native-purchases-ui';
import { getAnalysisLimit } from '@/lib/entitlements';
import { syncAnalysisPeriodAnchorRemote } from '@/lib/analysisUsageRemote';
import { useEntitlementStore } from '@/stores/entitlementStore';
import { useProfileStore } from '@/stores/profileStore';

/** Must match the entitlement identifier in the RevenueCat dashboard. */
export const PRO_ENTITLEMENT_ID = 'football_dani_app_pro';

/**
 * App Store product identifiers only (RevenueCat / App Store Connect).
 * Requires the Apple public SDK key (appl_…), not the Test Store key (test_…).
 */
export const PRO_PRODUCT_IDS = {
  yearly: ['ProYearly'] as const,
  monthly: ['ProMonthly'] as const,
} as const;

export type ProPlanKind = keyof typeof PRO_PRODUCT_IDS;

export type ProPlan = {
  kind: ProPlanKind;
  title: string;
  subtitle: string;
  priceLabel: string;
  /** Prefer package purchase when present (from current offering). */
  pkg: PurchasesPackage | null;
  /** Fallback when offerings are empty but store products resolve. */
  product: PurchasesStoreProduct | null;
};

const PLAN_COPY: Record<ProPlanKind, { title: string; subtitle: string }> = {
  yearly: { title: 'Yearly', subtitle: 'Billed annually' },
  monthly: { title: 'Monthly', subtitle: 'Cancel anytime' },
};

const PLAN_ORDER: ProPlanKind[] = ['yearly', 'monthly'];

const ALL_PRODUCT_IDS: string[] = [...PRO_PRODUCT_IDS.yearly, ...PRO_PRODUCT_IDS.monthly];

let configured = false;
let configuring: Promise<void> | null = null;

function isNativePurchasesPlatform(): boolean {
  return Platform.OS === 'ios' || Platform.OS === 'android';
}

function looksLikeTestStoreKey(key: string): boolean {
  return key.startsWith('test_');
}

/**
 * Use the App Store / Play public SDK keys only.
 * Do not fall back to the Test Store key — that only sees Test Store products.
 */
function apiKeyForPlatform(): string | null {
  if (Platform.OS === 'ios') {
    const iosKey = process.env.EXPO_PUBLIC_REVENUECAT_IOS_API_KEY?.trim() || null;
    if (!iosKey) {
      console.warn(
        '[RevenueCat] Missing EXPO_PUBLIC_REVENUECAT_IOS_API_KEY (appl_…). App Store products ProYearly/ProMonthly will not load.'
      );
      return null;
    }
    if (looksLikeTestStoreKey(iosKey)) {
      console.error(
        '[RevenueCat] EXPO_PUBLIC_REVENUECAT_IOS_API_KEY looks like a Test Store key. Use the Apple App Store key (appl_…) instead.'
      );
      return null;
    }
    return iosKey;
  }
  if (Platform.OS === 'android') {
    const androidKey = process.env.EXPO_PUBLIC_REVENUECAT_ANDROID_API_KEY?.trim() || null;
    if (!androidKey) {
      console.warn(
        '[RevenueCat] Missing EXPO_PUBLIC_REVENUECAT_ANDROID_API_KEY (goog_…).'
      );
      return null;
    }
    if (looksLikeTestStoreKey(androidKey)) {
      console.error(
        '[RevenueCat] EXPO_PUBLIC_REVENUECAT_ANDROID_API_KEY looks like a Test Store key. Use the Google Play key (goog_…) instead.'
      );
      return null;
    }
    return androidKey;
  }
  return null;
}

function isPurchasesError(err: unknown): err is PurchasesError {
  return typeof err === 'object' && err !== null && 'code' in err;
}

function isPurchaseCancelled(err: unknown): boolean {
  if (!isPurchasesError(err)) return false;
  return (
    err.userCancelled === true ||
    String(err.code) === PURCHASES_ERROR_CODE.PURCHASE_CANCELLED_ERROR
  );
}

function errorMessage(err: unknown, fallback: string): string {
  if (isPurchaseCancelled(err)) return '';
  if (isPurchasesError(err) && err.message) return err.message;
  if (err instanceof Error && err.message) return err.message;
  return fallback;
}

function matchesProductId(productId: string, kind: ProPlanKind): boolean {
  const id = productId.toLowerCase();
  return PRO_PRODUCT_IDS[kind].some((candidate) => candidate.toLowerCase() === id);
}

export function hasActiveProEntitlement(info: CustomerInfo): boolean {
  return typeof info.entitlements.active[PRO_ENTITLEMENT_ID] !== 'undefined';
}

function proPurchaseAnchorDate(info: CustomerInfo): string {
  const ent = info.entitlements.active[PRO_ENTITLEMENT_ID];
  const raw = ent?.latestPurchaseDate ?? ent?.originalPurchaseDate;
  if (typeof raw === 'string' && raw.length >= 10) {
    return raw.slice(0, 10);
  }
  return new Date().toISOString().slice(0, 10);
}

/** Last Pro purchase date we synced into Supabase (avoids resetting usage every refresh). */
let lastSyncedProPurchaseAnchor: string | null = null;

function applyCustomerInfo(info: CustomerInfo): boolean {
  const wasPro = useEntitlementStore.getState().hasProEntitlement;
  const active = hasActiveProEntitlement(info);
  useEntitlementStore.getState().setHasProEntitlement(active);
  useEntitlementStore.getState().setLastError(null);

  void (async () => {
    if (active) {
      const anchor = proPurchaseAnchorDate(info);
      const newlyPro = !wasPro;
      const purchaseChanged = lastSyncedProPurchaseAnchor !== anchor;
      if (newlyPro || purchaseChanged) {
        // New subscribe → reset. Renewal (purchase date advanced) → reset.
        // First sync after app update → re-anchor only (don't wipe usage).
        const resetUsed =
          newlyPro || (purchaseChanged && lastSyncedProPurchaseAnchor != null);
        await syncAnalysisPeriodAnchorRemote(anchor, resetUsed, getAnalysisLimit(true));
        lastSyncedProPurchaseAnchor = anchor;
      }
      await useProfileStore.getState().refreshAnalysisUsage(getAnalysisLimit(true));
      return;
    }

    lastSyncedProPurchaseAnchor = null;
    await useProfileStore.getState().refreshAnalysisUsage(getAnalysisLimit(false));
  })();

  return active;
}

function setEntitlementError(message: string): void {
  useEntitlementStore.getState().setLastError(message);
}

async function ensureConfigured(): Promise<boolean> {
  if (!isNativePurchasesPlatform()) return false;
  if (configured) return true;
  await configureRevenueCat();
  return configured;
}

/** Configure RevenueCat once on native. No-op on web. */
export async function configureRevenueCat(): Promise<void> {
  if (!isNativePurchasesPlatform() || configured) return;
  if (configuring) {
    await configuring;
    return;
  }

  configuring = (async () => {
    const apiKey = apiKeyForPlatform();
    if (!apiKey) {
      console.warn(
        '[RevenueCat] Missing API key — set EXPO_PUBLIC_REVENUECAT_TEST_API_KEY (dev) or the iOS/Android store keys. Pro purchases stay disabled.'
      );
      return;
    }

    if (__DEV__) {
      // WARN avoids flooding LogBox with expected empty-offering noise during dashboard setup.
      Purchases.setLogLevel(LOG_LEVEL.WARN);
    }

    Purchases.configure({ apiKey });
    configured = true;

    Purchases.addCustomerInfoUpdateListener((info) => {
      applyCustomerInfo(info);
    });

    try {
      const info = await Purchases.getCustomerInfo();
      applyCustomerInfo(info);
    } catch (err) {
      const message = errorMessage(err, 'Failed to fetch CustomerInfo');
      console.warn('[RevenueCat] Initial CustomerInfo failed', message);
      setEntitlementError(message);
    }
  })();

  try {
    await configuring;
  } finally {
    configuring = null;
  }
}

/** Tie purchases to the Supabase user id (cross-device entitlement). */
export async function identifyRevenueCatUser(userId: string): Promise<void> {
  if (!(await ensureConfigured())) return;
  try {
    const { customerInfo } = await Purchases.logIn(userId);
    applyCustomerInfo(customerInfo);
  } catch (err) {
    const message = errorMessage(err, 'RevenueCat logIn failed');
    console.warn('[RevenueCat] logIn failed', message);
    setEntitlementError(message);
  }
}

export async function logOutRevenueCatUser(): Promise<void> {
  if (!isNativePurchasesPlatform() || !configured) return;
  try {
    const info = await Purchases.logOut();
    applyCustomerInfo(info);
  } catch (err) {
    console.warn('[RevenueCat] logOut failed', err);
    useEntitlementStore.getState().setHasProEntitlement(false);
  }
}

export async function refreshRevenueCatCustomerInfo(): Promise<boolean> {
  if (!(await ensureConfigured())) {
    return useEntitlementStore.getState().hasProEntitlement;
  }
  try {
    const info = await Purchases.getCustomerInfo();
    return applyCustomerInfo(info);
  } catch (err) {
    const message = errorMessage(err, 'CustomerInfo refresh failed');
    setEntitlementError(message);
    return false;
  }
}

function planKindForPackage(pkg: PurchasesPackage): ProPlanKind | null {
  const identifier = pkg.identifier.toLowerCase();
  const productId = pkg.product.identifier.toLowerCase();

  if (
    pkg.packageType === PACKAGE_TYPE.ANNUAL ||
    identifier.includes('yearly') ||
    identifier.includes('annual') ||
    matchesProductId(productId, 'yearly') ||
    productId.includes('yearly') ||
    productId.includes('annual')
  ) {
    return 'yearly';
  }
  if (
    pkg.packageType === PACKAGE_TYPE.MONTHLY ||
    identifier.includes('monthly') ||
    matchesProductId(productId, 'monthly') ||
    productId.includes('monthly')
  ) {
    return 'monthly';
  }
  return null;
}

function planKindForProduct(product: PurchasesStoreProduct): ProPlanKind | null {
  const productId = product.identifier.toLowerCase();
  if (
    matchesProductId(productId, 'yearly') ||
    productId.includes('yearly') ||
    productId.includes('annual')
  ) {
    return 'yearly';
  }
  if (matchesProductId(productId, 'monthly') || productId.includes('monthly')) return 'monthly';
  return null;
}

function formatStorePrice(product: PurchasesStoreProduct): string {
  const amount = product.price;
  const code = product.currencyCode?.trim();
  if (typeof amount === 'number' && code) {
    try {
      return new Intl.NumberFormat(undefined, {
        style: 'currency',
        currency: code,
        minimumFractionDigits: 2,
        maximumFractionDigits: 2,
      }).format(amount);
    } catch {
      // fall through to Apple's string
    }
  }
  return product.priceString;
}

function toProPlanFromPackage(pkg: PurchasesPackage): ProPlan | null {
  const kind = planKindForPackage(pkg);
  if (!kind) return null;
  const copy = PLAN_COPY[kind];
  return {
    kind,
    title: copy.title,
    subtitle: copy.subtitle,
    priceLabel: formatStorePrice(pkg.product),
    pkg,
    product: pkg.product,
  };
}

function toProPlanFromProduct(product: PurchasesStoreProduct): ProPlan | null {
  const kind = planKindForProduct(product);
  if (!kind) return null;
  const copy = PLAN_COPY[kind];
  return {
    kind,
    title: copy.title,
    subtitle: copy.subtitle,
    priceLabel: formatStorePrice(product),
    pkg: null,
    product,
  };
}

export async function getCurrentOffering(): Promise<PurchasesOffering | null> {
  if (!(await ensureConfigured())) return null;
  try {
    const offerings = await Purchases.getOfferings();
    return offerings.current ?? null;
  } catch (err) {
    const message = errorMessage(err, 'Failed to load offerings');
    const hint =
      ' Confirm ProYearly and ProMonthly are in the current Offering, and EXPO_PUBLIC_REVENUECAT_IOS_API_KEY is your Apple key (appl_…).';
    console.warn('[RevenueCat] getOfferings failed', message + hint);
    setEntitlementError(message + hint);
    return null;
  }
}

/**
 * Resolve Lifetime / Yearly / Monthly for the UI.
 * Prefers packages from the current offering; falls back to store products by ID.
 */
export async function getProPlans(): Promise<ProPlan[]> {
  if (!(await ensureConfigured())) return [];

  const byKind = new Map<ProPlanKind, ProPlan>();

  try {
    const offering = await getCurrentOffering();
    if (offering) {
      for (const pkg of offering.availablePackages) {
        const plan = toProPlanFromPackage(pkg);
        if (plan && !byKind.has(plan.kind)) {
          byKind.set(plan.kind, plan);
        }
      }
    }
  } catch (err) {
    console.warn('[RevenueCat] offering packages failed', errorMessage(err, 'offerings'));
  }

  if (byKind.size < PLAN_ORDER.length) {
    try {
      const products = await Purchases.getProducts(ALL_PRODUCT_IDS);
      for (const product of products) {
        const plan = toProPlanFromProduct(product);
        if (plan && !byKind.has(plan.kind)) {
          byKind.set(plan.kind, plan);
        }
      }
    } catch (err) {
      const message = errorMessage(err, 'Failed to load products');
      console.warn('[RevenueCat] getProducts failed', message);
      if (byKind.size === 0) setEntitlementError(message);
    }
  }

  const plans = PLAN_ORDER.flatMap((kind) => {
    const plan = byKind.get(kind);
    return plan ? [plan] : [];
  });

  if (plans.length === 0) {
    setEntitlementError(
      'No Pro plans available. Add App Store ProYearly and ProMonthly to the current Offering, and set EXPO_PUBLIC_REVENUECAT_IOS_API_KEY (appl_…).'
    );
  }

  return plans;
}

function paywallUnlockedPro(result: PAYWALL_RESULT): boolean {
  if (result === PAYWALL_RESULT.PURCHASED || result === PAYWALL_RESULT.RESTORED) {
    return true;
  }
  return useEntitlementStore.getState().hasProEntitlement;
}

/**
 * Present the RevenueCat dashboard paywall for the current offering.
 * Returns true if the user ended with an active Pro entitlement.
 */
export async function presentProPaywall(options?: {
  /** Skip if the user already has Pro (default true for onboarding). */
  onlyIfNeeded?: boolean;
}): Promise<boolean> {
  const onlyIfNeeded = options?.onlyIfNeeded ?? false;

  if (!isNativePurchasesPlatform()) {
    setEntitlementError('Subscribe on iOS or Android with the same account.');
    return false;
  }
  if (!(await ensureConfigured())) {
    setEntitlementError(
      'RevenueCat is not configured. Add API keys and rebuild the development client.'
    );
    return false;
  }

  try {
    const offering = await getCurrentOffering();
    const paywallOptions = {
      displayCloseButton: true,
      ...(offering ? { offering } : {}),
    };

    const result = onlyIfNeeded
      ? await RevenueCatUI.presentPaywallIfNeeded({
          ...paywallOptions,
          requiredEntitlementIdentifier: PRO_ENTITLEMENT_ID,
        })
      : await RevenueCatUI.presentPaywall(paywallOptions);

    await refreshRevenueCatCustomerInfo();
    if (result === PAYWALL_RESULT.ERROR) {
      setEntitlementError(
        'Could not present the Paywall. Confirm a Paywall is attached to the current offering in RevenueCat.'
      );
      return useEntitlementStore.getState().hasProEntitlement;
    }
    if (result === PAYWALL_RESULT.NOT_PRESENTED) {
      return useEntitlementStore.getState().hasProEntitlement;
    }
    return paywallUnlockedPro(result);
  } catch (err) {
    if (isPurchaseCancelled(err)) {
      return useEntitlementStore.getState().hasProEntitlement;
    }
    const message = errorMessage(err, 'Paywall failed');
    console.warn('[RevenueCat] presentPaywall failed', message);
    setEntitlementError(message);
    return false;
  }
}

/** Soft paywall after first-time profile setup — skippable, skipped if already Pro. */
export async function presentOnboardingPaywall(): Promise<void> {
  if (!canPurchaseProOnThisPlatform()) return;
  try {
    await presentProPaywall({ onlyIfNeeded: true });
  } catch (err) {
    console.warn('[RevenueCat] onboarding paywall failed', errorMessage(err, 'paywall'));
  }
}

/** Purchase the selected Lifetime / Yearly / Monthly plan. */
export async function purchaseProPlan(plan: ProPlan): Promise<boolean> {
  if (!(await ensureConfigured())) {
    setEntitlementError(
      'RevenueCat is not configured. Add API keys and rebuild the development client.'
    );
    return false;
  }

  try {
    if (plan.pkg) {
      const { customerInfo } = await Purchases.purchasePackage(plan.pkg);
      return applyCustomerInfo(customerInfo);
    }
    if (plan.product) {
      const { customerInfo } = await Purchases.purchaseStoreProduct(plan.product);
      return applyCustomerInfo(customerInfo);
    }
    setEntitlementError('This plan is not available to purchase right now.');
    return false;
  } catch (err) {
    if (isPurchaseCancelled(err)) return false;
    const message = errorMessage(err, 'Purchase failed');
    console.warn('[RevenueCat] purchase failed', message);
    setEntitlementError(message);
    return false;
  }
}

export async function restoreProPurchases(): Promise<{ restored: boolean; message?: string }> {
  if (!isNativePurchasesPlatform()) {
    return { restored: false, message: 'Restore purchases on iOS or Android.' };
  }
  if (!(await ensureConfigured())) {
    return {
      restored: false,
      message: 'RevenueCat is not configured. Add API keys and rebuild the development client.',
    };
  }

  try {
    const info = await Purchases.restorePurchases();
    const restored = applyCustomerInfo(info);
    if (restored) return { restored: true };
    return {
      restored: false,
      message: 'No Pro subscription found for this App Store or Play account.',
    };
  } catch (err) {
    const message = errorMessage(err, 'Restore failed');
    setEntitlementError(message);
    return { restored: false, message };
  }
}

/**
 * Customer Center for managing, restoring, cancelling, and requesting refunds.
 * Configure the UI in the RevenueCat dashboard (Pro/Enterprise).
 */
export async function presentProCustomerCenter(): Promise<void> {
  if (!isNativePurchasesPlatform()) {
    setEntitlementError('Manage subscriptions on iOS or Android.');
    return;
  }
  if (!(await ensureConfigured())) {
    setEntitlementError(
      'RevenueCat is not configured. Add API keys and rebuild the development client.'
    );
    return;
  }

  try {
    await RevenueCatUI.presentCustomerCenter({
      callbacks: {
        onRestoreCompleted: ({ customerInfo }) => {
          applyCustomerInfo(customerInfo);
        },
        onRestoreFailed: ({ error }) => {
          setEntitlementError(error.message || 'Restore failed');
        },
        onPromotionalOfferSucceeded: ({ customerInfo }) => {
          applyCustomerInfo(customerInfo);
        },
      },
    });
    await refreshRevenueCatCustomerInfo();
  } catch (err) {
    const message = errorMessage(err, 'Could not open subscription management');
    console.warn('[RevenueCat] presentCustomerCenter failed', message);
    setEntitlementError(message);
  }
}

export function canPurchaseProOnThisPlatform(): boolean {
  return isNativePurchasesPlatform() && Boolean(apiKeyForPlatform());
}

export function canManageProOnThisPlatform(): boolean {
  return canPurchaseProOnThisPlatform();
}
