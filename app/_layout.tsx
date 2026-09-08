import '../global.css';
import { useEffect } from 'react';
import { Stack, useRouter, useSegments } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { View, ActivityIndicator } from 'react-native';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { DevPreviewBanner } from '@/components/layout/DevPreviewBanner';
import { isDevPreviewMode, isSupabaseConfigured, supabase } from '@/lib/supabase';
import { useAuthStore } from '@/stores/authStore';
import { useProfileStore, hasCompleteProfile } from '@/stores/profileStore';
import { useAnalysisStore } from '@/stores/analysisStore';
import { useAnalysisCreditsStore } from '@/stores/analysisCreditsStore';

function useProtectedRoute() {
  const { session, isLoading } = useAuthStore();
  const segments = useSegments();
  const router = useRouter();
  const profile = useProfileStore((s) => s.profile);
  const hasHydrated = useProfileStore((s) => s.hasHydrated);

  useEffect(() => {
    if (!hasHydrated) return;

    if (isDevPreviewMode) {
      if (!hasCompleteProfile(profile) && segments[0] === '(tabs)') {
        router.replace('/(onboarding)/setup?edit=1');
      }
      return;
    }

    if (isLoading || !isSupabaseConfigured || !supabase) return;

    const inAuthGroup = segments[0] === '(auth)' || segments[0] === '(onboarding)';

    if (!session && !inAuthGroup) {
      router.replace('/(onboarding)/welcome');
    } else if (session && inAuthGroup && segments.at(1) !== 'setup') {
      router.replace(hasCompleteProfile(profile) ? '/(tabs)' : '/(onboarding)/setup?edit=1');
    }
  }, [session, isLoading, segments, router, profile, hasHydrated]);
}

export default function RootLayout() {
  const { setSession, setLoading, isLoading } = useAuthStore();
  const hasHydrated = useProfileStore((s) => s.hasHydrated);
  const creditsHydrated = useAnalysisCreditsStore((s) => s.hasHydrated);
  const devCreditsMigrationDone = useAnalysisCreditsStore((s) => s.devCreditsMigrationDone);
  useProtectedRoute();

  useEffect(() => {
    useAnalysisStore.getState().setIsAnalysing(false);
  }, []);

  useEffect(() => {
    if (!__DEV__ || !hasHydrated || !creditsHydrated || devCreditsMigrationDone) return;
    useProfileStore.getState().resetFreeAnalyses();
    useAnalysisCreditsStore.setState({ devCreditsMigrationDone: true });
  }, [hasHydrated, creditsHydrated, devCreditsMigrationDone]);

  useEffect(() => {
    if (isDevPreviewMode || !isSupabaseConfigured || !supabase) {
      setLoading(false);
      return;
    }

    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session);
    });

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      setSession(session);
    });

    return () => subscription.unsubscribe();
  }, [setSession, setLoading]);

  if (isLoading || !hasHydrated || !creditsHydrated) {
    return (
      <View className="flex-1 bg-background items-center justify-center">
        <ActivityIndicator size="large" color="#00C853" />
      </View>
    );
  }

  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <SafeAreaProvider>
        <StatusBar style="light" />
        <DevPreviewBanner />
        <Stack screenOptions={{ headerShown: false, contentStyle: { backgroundColor: '#0D0D0F' } }}>
          <Stack.Screen name="index" />
          <Stack.Screen name="(onboarding)" />
          <Stack.Screen name="(auth)" />
          <Stack.Screen name="(tabs)" />
          <Stack.Screen name="(upload)" />
          <Stack.Screen name="hall-of-fame/index" />
          <Stack.Screen name="report/[id]" />
          <Stack.Screen name="reports/history" />
          <Stack.Screen name="improve/session/index" />
          <Stack.Screen name="improve/session/result" />
          <Stack.Screen name="improve/[categoryId]/index" />
          <Stack.Screen name="improve/[categoryId]/[skillId]/index" />
          <Stack.Screen name="improve/[categoryId]/[skillId]/muscle/[muscleGroupId]" />
          <Stack.Screen name="improve/[categoryId]/[skillId]/focus/[speedFocusId]" />
          <Stack.Screen name="improve/[categoryId]/[skillId]/agility-focus/[agilityFocusId]" />
          <Stack.Screen name="improve/[categoryId]/[skillId]/recovery-focus/[recoveryFocusId]" />
          <Stack.Screen name="improve/[categoryId]/[skillId]/tier/[tierId]" />
          <Stack.Screen name="improve/[categoryId]/[skillId]/[drillId]" />
          <Stack.Screen name="debug" options={{ presentation: 'modal' }} />
          <Stack.Screen name="+not-found" />
        </Stack>
      </SafeAreaProvider>
    </GestureHandlerRootView>
  );
}
