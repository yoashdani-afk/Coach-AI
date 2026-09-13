import { create } from 'zustand';
import { isDevForcePro } from '@/lib/entitlements';

interface EntitlementState {
  /**
   * Active `pro` entitlement from RevenueCat CustomerInfo.
   * False until SDK reports otherwise (or DEV_FORCE_PRO).
   */
  hasProEntitlement: boolean;
  /** Last CustomerInfo sync error (if any). */
  lastError: string | null;
  setHasProEntitlement: (value: boolean) => void;
  setLastError: (message: string | null) => void;
}

export const useEntitlementStore = create<EntitlementState>((set) => ({
  hasProEntitlement: false,
  lastError: null,
  setHasProEntitlement: (hasProEntitlement) => set({ hasProEntitlement }),
  setLastError: (lastError) => set({ lastError }),
}));

/** Effective Pro access for UI/gates (RevenueCat + optional DEV force). */
export function useIsPro(): boolean {
  const hasPro = useEntitlementStore((s) => s.hasProEntitlement);
  return hasPro || isDevForcePro();
}
