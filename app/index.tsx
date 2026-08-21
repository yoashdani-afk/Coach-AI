import { View, ActivityIndicator } from 'react-native';
import { Redirect } from 'expo-router';
import { useProfileStore, hasCompleteProfile } from '@/stores/profileStore';

export default function Index() {
  const hasHydrated = useProfileStore((s) => s.hasHydrated);
  const profile = useProfileStore((s) => s.profile);
  const hasSeenOnboarding = useProfileStore((s) => s.hasSeenOnboarding);
  const isSignedIn = useProfileStore((s) => s.isSignedIn);

  if (!hasHydrated) {
    return (
      <View className="flex-1 bg-background items-center justify-center">
        <ActivityIndicator size="large" color="#00C853" />
      </View>
    );
  }

  if (hasCompleteProfile(profile)) {
    return <Redirect href="/(tabs)" />;
  }

  if (profile && hasSeenOnboarding) {
    return <Redirect href="/(onboarding)/setup?edit=1" />;
  }

  if (!hasSeenOnboarding) {
    return <Redirect href="/(onboarding)/welcome" />;
  }

  if (isSignedIn) {
    return <Redirect href="/(onboarding)/setup" />;
  }

  return <Redirect href="/(auth)/register" />;
}
