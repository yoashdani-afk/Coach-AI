import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { createAppJSONStorage } from '@/lib/appStorage';
import { isDevForcePro } from '@/lib/entitlements';

interface EntitlementState {
  /**
   * Active `football_dani_app_pro` entitlement from RevenueCat CustomerInfo.
   * Persisted so cold start does not look like a brand-new Pro subscribe
   * (which used to reset analyses_used_this_month to 0).
   */
  hasProEntitlement: boolean;
  /**
   * Last RevenueCat purchase date (YYYY-MM-DD) synced to Supabase anniversary period.
   * Persisted so relaunch with the same purchase does not re-anchor/reset usage.
   */
  lastSyncedProPurchaseAnchor: string | null;
  /** Last CustomerInfo sync error (if any). */
  lastError: string | null;
  hasHydrated: boolean;
  setHasProEntitlement: (value: boolean) => void;
  setLastSyncedProPurchaseAnchor: (value: string | null) => void;
  setLastError: (message: string | null) => void;
  setHasHydrated: (value: boolean) => void;
}

export const useEntitlementStore = create<EntitlementState>()(
  persist(
    (set) => ({
      hasProEntitlement: false,
      lastSyncedProPurchaseAnchor: null,
      lastError: null,
      hasHydrated: false,
      setHasProEntitlement: (hasProEntitlement) => set({ hasProEntitlement }),
      setLastSyncedProPurchaseAnchor: (lastSyncedProPurchaseAnchor) =>
        set({ lastSyncedProPurchaseAnchor }),
      setLastError: (lastError) => set({ lastError }),
      setHasHydrated: (hasHydrated) => set({ hasHydrated }),
    }),
    {
      name: 'coach-ai-entitlements',
      storage: createAppJSONStorage(),
      partialize: (state) => ({
        hasProEntitlement: state.hasProEntitlement,
        lastSyncedProPurchaseAnchor: state.lastSyncedProPurchaseAnchor,
      }),
      onRehydrateStorage: () => (_state, error) => {
        if (error) {
          console.warn('[entitlementStore] rehydration failed', error);
        }
        useEntitlementStore.setState({ hasHydrated: true });
      },
    }
  )
);

/** Effective Pro access for UI/gates (RevenueCat + optional DEV force). */
export function useIsPro(): boolean {
  const hasPro = useEntitlementStore((s) => s.hasProEntitlement);
  return hasPro || isDevForcePro();
}

/** Resolves once persisted Pro/anchor state is ready (or after a short fallback). */
export function waitForEntitlementHydration(): Promise<void> {
  if (useEntitlementStore.getState().hasHydrated) {
    return Promise.resolve();
  }

  return new Promise((resolve) => {
    const unsub = useEntitlementStore.subscribe((state) => {
      if (!state.hasHydrated) return;
      unsub();
      resolve();
    });

    setTimeout(() => {
      if (!useEntitlementStore.getState().hasHydrated) {
        useEntitlementStore.setState({ hasHydrated: true });
      }
      unsub();
      resolve();
    }, 800);
  });
}
