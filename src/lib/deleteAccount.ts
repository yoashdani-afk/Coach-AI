import { getSupabase, isSupabaseConfigured } from '@/lib/supabase';
import { logOutRevenueCatUser } from '@/lib/revenueCat';
import { useAnalysisCreditsStore } from '@/stores/analysisCreditsStore';
import { useAnalysisStore } from '@/stores/analysisStore';
import { useAuthStore } from '@/stores/authStore';
import { useEntitlementStore } from '@/stores/entitlementStore';
import { useProfileStore } from '@/stores/profileStore';
import { useUploadStore } from '@/stores/uploadStore';

/**
 * Permanently deletes the signed-in Supabase user and clears local app state.
 * Requires public.delete_own_account() to be applied in Supabase.
 */
export async function deleteOwnAccount(): Promise<void> {
  if (!isSupabaseConfigured) {
    throw new Error('Account deletion is not available right now.');
  }

  const supabase = getSupabase();
  const { error } = await supabase.rpc('delete_own_account');
  if (error) {
    throw new Error(error.message || 'Could not delete account.');
  }

  // Session is invalid after auth.users delete; clear client quietly.
  await supabase.auth.signOut({ scope: 'local' }).catch(() => undefined);
  await logOutRevenueCatUser().catch(() => undefined);

  useEntitlementStore.getState().setHasProEntitlement(false);
  useAuthStore.getState().clear();
  useProfileStore.getState().clearProfile();
  useProfileStore.getState().setSignedIn(false);
  useAnalysisStore.setState({ reports: [] });
  useAnalysisCreditsStore.getState().resetConsumedAttempts();
  useUploadStore.getState().clearDraft();
  useUploadStore.getState().clearPendingBillableAnalysis();
  useUploadStore.getState().clearHallOfFameUnlock();
}
