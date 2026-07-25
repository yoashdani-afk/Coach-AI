import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import * as SecureStore from 'expo-secure-store';
import { Platform } from 'react-native';

const supabaseUrl = process.env.EXPO_PUBLIC_SUPABASE_URL ?? '';
const supabaseAnonKey = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY ?? '';

const ExpoSecureStoreAdapter = {
  getItem: (key: string) => SecureStore.getItemAsync(key),
  setItem: (key: string, value: string) => SecureStore.setItemAsync(key, value),
  removeItem: (key: string) => SecureStore.deleteItemAsync(key),
};

/** True when both Supabase env vars are set. */
export const isSupabaseConfigured =
  supabaseUrl.length > 0 && supabaseAnonKey.length > 0;

/**
 * Dev-only preview mode: no Supabase credentials, auth disabled, free navigation.
 * Never active in production builds.
 */
export const isDevPreviewMode = __DEV__ && !isSupabaseConfigured;

let supabaseClient: SupabaseClient | null = null;

if (isSupabaseConfigured) {
  supabaseClient = createClient(supabaseUrl, supabaseAnonKey, {
    auth: {
      storage: Platform.OS === 'web' ? undefined : ExpoSecureStoreAdapter,
      autoRefreshToken: true,
      persistSession: true,
      detectSessionInUrl: false,
    },
  });
}

/** Nullable client — only non-null when credentials are configured. */
export const supabase = supabaseClient;

/** Use in Milestone 1+ when Supabase is required. Throws if not configured. */
export function getSupabase(): SupabaseClient {
  if (!supabaseClient) {
    throw new Error(
      'Supabase is not configured. Add EXPO_PUBLIC_SUPABASE_URL and EXPO_PUBLIC_SUPABASE_ANON_KEY to .env.local'
    );
  }
  return supabaseClient;
}
