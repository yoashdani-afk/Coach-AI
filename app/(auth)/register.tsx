import { View, Text, Pressable } from 'react-native';
import { Link, useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Button, Input } from '@/components/ui';
import { isDevPreviewMode } from '@/lib/supabase';
import { useProfileStore } from '@/stores/profileStore';

export default function RegisterScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const setSignedIn = useProfileStore((s) => s.setSignedIn);

  const handleRegister = () => {
    setSignedIn(true);
    router.replace('/(onboarding)/setup');
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
      <Text className="text-text-primary text-3xl font-bold mb-2">Create account</Text>
      <Text className="text-text-secondary text-base mb-8">
        Set up your player profile and start getting coaching feedback on your clips.
      </Text>
      <View className="gap-4 mb-8">
        <Input label="Email" placeholder="you@example.com" keyboardType="email-address" autoCapitalize="none" />
        <Input label="Password" placeholder="Min. 8 characters" secureTextEntry />
      </View>
      <Button label="Create Account" onPress={handleRegister} fullWidth size="lg" />
      <View className="flex-row justify-center mt-6 gap-1">
        <Text className="text-text-secondary">Already have an account?</Text>
        <Link href="/(auth)/login" asChild>
          <Pressable>
            <Text className="text-primary font-semibold">Sign in</Text>
          </Pressable>
        </Link>
      </View>
    </View>
  );
}
