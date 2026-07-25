import { View, Text, Pressable } from 'react-native';
import { Link, useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Button, Input } from '@/components/ui';
import { isDevPreviewMode } from '@/lib/supabase';
import { useProfileStore, hasCompleteProfile } from '@/stores/profileStore';

export default function LoginScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const setSignedIn = useProfileStore((s) => s.setSignedIn);
  const profile = useProfileStore((s) => s.profile);

  const handleSignIn = () => {
    setSignedIn(true);
    if (hasCompleteProfile(profile)) {
      router.replace('/(tabs)');
    } else {
      router.replace('/(onboarding)/setup');
    }
  };

  const topPadding = isDevPreviewMode ? 24 : insets.top + 24;

  return (
    <View
      className="flex-1 bg-background px-6"
      style={{ paddingTop: topPadding, paddingBottom: insets.bottom + 24 }}
    >
      <Pressable onPress={() => router.back()} className="mb-8">
        <Text className="text-primary text-base">← Back</Text>
      </Pressable>
      <Text className="text-text-primary text-3xl font-bold mb-2">Welcome back</Text>
      <Text className="text-text-secondary text-base mb-8">
        Sign in to continue your coaching journey.
      </Text>
      <View className="gap-4 mb-6">
        <Input label="Email" placeholder="you@example.com" keyboardType="email-address" autoCapitalize="none" />
        <Input label="Password" placeholder="••••••••" secureTextEntry />
      </View>
      <Link href="/(auth)/forgot-password" asChild>
        <Pressable className="mb-6">
          <Text className="text-primary text-sm">Forgot password?</Text>
        </Pressable>
      </Link>
      <Button label="Sign In" onPress={handleSignIn} fullWidth size="lg" />
      <View className="flex-row justify-center mt-6 gap-1">
        <Text className="text-text-secondary">No account?</Text>
        <Link href="/(auth)/register" asChild>
          <Pressable>
            <Text className="text-primary font-semibold">Sign up</Text>
          </Pressable>
        </Link>
      </View>
    </View>
  );
}
