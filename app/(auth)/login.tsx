import { useState } from 'react';
import { View, Text, Pressable, KeyboardAvoidingView, Platform, ScrollView } from 'react-native';
import { Link, useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Button, Input } from '@/components/ui';
import { getSupabase, isDevPreviewMode, isSupabaseConfigured } from '@/lib/supabase';
import { useProfileStore, hasCompleteProfile } from '@/stores/profileStore';

export default function LoginScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const setSignedIn = useProfileStore((s) => s.setSignedIn);
  const profile = useProfileStore((s) => s.profile);

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  const handleSignIn = async () => {
    setFormError(null);

    const trimmedEmail = email.trim().toLowerCase();
    if (!trimmedEmail) {
      setFormError('Enter your email.');
      return;
    }
    if (!password) {
      setFormError('Enter your password.');
      return;
    }
    if (!isSupabaseConfigured) {
      setFormError('Supabase is not configured. Add credentials to .env.local and restart Expo.');
      return;
    }

    setLoading(true);
    try {
      const supabase = getSupabase();
      const { data, error } = await supabase.auth.signInWithPassword({
        email: trimmedEmail,
        password,
      });

      if (error) {
        setFormError(error.message);
        return;
      }

      if (!data.session) {
        setFormError('Sign in succeeded but no session was returned. Try again.');
        return;
      }

      // Session is also picked up by app/_layout.tsx via onAuthStateChange + SecureStore.
      setSignedIn(true);
      if (hasCompleteProfile(profile)) {
        router.replace('/(tabs)');
      } else {
        router.replace('/(onboarding)/setup');
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Something went wrong. Try again.';
      setFormError(message);
    } finally {
      setLoading(false);
    }
  };

  const topPadding = isDevPreviewMode ? 24 : insets.top + 24;

  return (
    <KeyboardAvoidingView
      className="flex-1 bg-background"
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <ScrollView
        className="flex-1"
        contentContainerStyle={{
          paddingTop: topPadding,
          paddingBottom: insets.bottom + 24,
          paddingHorizontal: 24,
          flexGrow: 1,
        }}
        keyboardShouldPersistTaps="handled"
      >
        <Pressable onPress={() => router.back()} className="mb-8">
          <Text className="text-primary text-base">← Back</Text>
        </Pressable>
        <Text className="text-text-primary text-3xl font-bold mb-2">Welcome back</Text>
        <Text className="text-text-secondary text-base mb-8">
          Sign in to continue your coaching journey.
        </Text>
        <View className="gap-4 mb-6">
          <Input
            label="Email"
            placeholder="you@example.com"
            keyboardType="email-address"
            autoCapitalize="none"
            autoCorrect={false}
            textContentType="emailAddress"
            value={email}
            onChangeText={setEmail}
            editable={!loading}
          />
          <Input
            label="Password"
            placeholder="••••••••"
            secureTextEntry
            textContentType="password"
            value={password}
            onChangeText={setPassword}
            editable={!loading}
          />
        </View>
        <Link href="/(auth)/forgot-password" asChild>
          <Pressable className="mb-6">
            <Text className="text-primary text-sm">Forgot password?</Text>
          </Pressable>
        </Link>
        {formError ? (
          <Text className="text-danger text-sm mb-4 leading-5">{formError}</Text>
        ) : null}
        <Button label="Sign In" onPress={handleSignIn} fullWidth size="lg" loading={loading} />
        <View className="flex-row justify-center mt-6 gap-1">
          <Text className="text-text-secondary">No account?</Text>
          <Link href="/(auth)/register" asChild>
            <Pressable>
              <Text className="text-primary font-semibold">Sign up</Text>
            </Pressable>
          </Link>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}
