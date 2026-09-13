import { Platform } from 'react-native';
import Purchases, {
  LOG_LEVEL,
  type CustomerInfo,
} from 'react-native-purchases';
import RevenueCatUI, { PAYWALL_RESULT } from 'react-native-purchases-ui';
import { getAnalysisLimit } from '@/lib/entitlements';
import { useEntitlementStore } from '@/stores/entitlementStore';
import { useProfileStore } from '@/stores/profileStore';

/** RevenueCat entitlement identifier — must match the dashboard. */
export const PRO_ENTITLEMENT_ID = 'pro';

let configured = false;

function isNativePurchasesPlatform(): boolean {
  return Platform.OS === 'ios' || Platform.OS === 'android';
}

function apiKeyForPlatform(): string | null {
  if (Platform.OS === 'ios') {
    return process.env.EXPO_PUBLIC_REVENUECAT_IOS_API_KEY?.trim() || null;
  }
  if (Platform.OS === 'android') {
    return process.env.EXPO_PUBLIC_REVENUECAT_ANDROID_API_KEY?.trim() || null;
  }
  return null;
}

function applyCustomerInfo(info: CustomerInfo): boolean {
  const active = typeof info.entitlements.active[PRO_ENTITLEMENT_ID] !== 'undefined';
  useEntitlementStore.getState().setHasProEntitlement(active);
  useEntitlementStore.getState().setLastError(null);
  void useProfileStore.getState().refreshAnalysisUsage(getAnalysisLimit(active));
  return active;
}

/** Configure RevenueCat once on native. No-op on web. */
export async function configureRevenueCat(): Promise<void> {
  if (!isNativePurchasesPlatform() || configured) return;

  const apiKey = apiKeyForPlatform();
  if (!apiKey) {
    console.warn(
      '[RevenueCat] Missing EXPO_PUBLIC_REVENUECAT_IOS_API_KEY / ANDROID key — Pro purchases disabled until configured.'
    );
    return;
  }

  if (__DEV__) {
    Purchases.setLogLevel(LOG_LEVEL.VERBOSE);
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
    const message = err instanceof Error ? err.message : 'Failed to fetch CustomerInfo';
    console.warn('[RevenueCat] Initial CustomerInfo failed', message);
    useEntitlementStore.getState().setLastError(message);
  }
}

/** Tie purchases to the Supabase user id (cross-device entitlement). */
export async function identifyRevenueCatUser(userId: string): Promise<void> {
  if (!isNativePurchasesPlatform() || !configured) return;
  try {
    const { customerInfo } = await Purchases.logIn(userId);
    applyCustomerInfo(customerInfo);
  } catch (err) {
    const message = err instanceof Error ? err.message : 'RevenueCat logIn failed';
    console.warn('[RevenueCat] logIn failed', message);
    useEntitlementStore.getState().setLastError(message);
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
  if (!isNativePurchasesPlatform() || !configured) {
    return useEntitlementStore.getState().hasProEntitlement;
  }
  try {
    const info = await Purchases.getCustomerInfo();
    return applyCustomerInfo(info);
  } catch (err) {
    const message = err instanceof Error ? err.message : 'CustomerInfo refresh failed';
    useEntitlementStore.getState().setLastError(message);
    return false;
  }
}

/**
 * Present RevenueCat paywall on native.
 * Returns true if the user ended with an active Pro entitlement.
 */
export async function presentProPaywall(): Promise<boolean> {
  if (!isNativePurchasesPlatform()) {
    return false;
  }
  if (!configured) {
    await configureRevenueCat();
  }
  if (!configured) {
    useEntitlementStore.getState().setLastError(
      'RevenueCat is not configured. Add API keys and rebuild the development client.'
    );
    return false;
  }

  try {
    const result = await RevenueCatUI.presentPaywall({
      displayCloseButton: true,
    });
    await refreshRevenueCatCustomerInfo();
    if (
      result === PAYWALL_RESULT.PURCHASED ||
      result === PAYWALL_RESULT.RESTORED ||
      useEntitlementStore.getState().hasProEntitlement
    ) {
      return true;
    }
    return useEntitlementStore.getState().hasProEntitlement;
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Paywall failed';
    console.warn('[RevenueCat] presentPaywall failed', message);
    useEntitlementStore.getState().setLastError(message);
    return false;
  }
}

export function canPurchaseProOnThisPlatform(): boolean {
  return isNativePurchasesPlatform() && Boolean(apiKeyForPlatform());
}
