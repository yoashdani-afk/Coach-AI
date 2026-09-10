import { useMemo, useState } from 'react';
import { View, Text, Pressable, ScrollView, KeyboardAvoidingView, Platform } from 'react-native';
import { Link, useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Button, Input } from '@/components/ui';
import {
  DateOfBirthInput,
  isoFromDateParts,
  isDateOfBirthValid,
  type DateOfBirthParts,
} from '@/components/profile/DateOfBirthInput';
import { calculateAge, isValidIsoDateString } from '@/lib/profileUtils';
import { getSupabase, isDevPreviewMode, isSupabaseConfigured } from '@/lib/supabase';
import { useProfileStore } from '@/stores/profileStore';

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const MIN_PASSWORD_LENGTH = 8;

function isValidEmail(value: string): boolean {
  return EMAIL_RE.test(value.trim());
}

export default function RegisterScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const setSignedIn = useProfileStore((s) => s.setSignedIn);

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [dobParts, setDobParts] = useState<DateOfBirthParts>({ day: '', month: '', year: '' });
  const [parentEmail, setParentEmail] = useState('');
  const [loading, setLoading] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  const dateOfBirth = isoFromDateParts(dobParts);
  const age =
    dateOfBirth && isValidIsoDateString(dateOfBirth) ? calculateAge(dateOfBirth) : null;
  const requiresParentEmail = age != null && Number.isFinite(age) && age < 13;

  const validationError = useMemo(() => {
    if (!email.trim()) return 'Enter your email.';
    if (!isValidEmail(email)) return 'Enter a valid email address.';
    if (password.length < MIN_PASSWORD_LENGTH) {
      return `Password must be at least ${MIN_PASSWORD_LENGTH} characters.`;
    }
    if (!isDateOfBirthValid(dobParts)) return 'Enter a valid date of birth.';
    if (requiresParentEmail) {
      if (!parentEmail.trim()) {
        return 'Parent/guardian email is required if you are under 13.';
      }
      if (!isValidEmail(parentEmail)) {
        return 'Enter a valid parent/guardian email address.';
      }
    }
    return null;
  }, [email, password, dobParts, parentEmail, requiresParentEmail]);

  const handleRegister = async () => {
    setFormError(null);

    if (validationError) {
      setFormError(validationError);
      return;
    }

    if (!isSupabaseConfigured) {
      setFormError('Supabase is not configured. Add credentials to .env.local and restart Expo.');
      return;
    }

    setLoading(true);
    try {
      const supabase = getSupabase();
      const trimmedEmail = email.trim().toLowerCase();
      const parentGuardianEmail = requiresParentEmail ? parentEmail.trim().toLowerCase() : null;

      const { data, error } = await supabase.auth.signUp({
        email: trimmedEmail,
        password,
        options: {
          data: {
            date_of_birth: dateOfBirth,
            parent_guardian_email: parentGuardianEmail,
          },
        },
      });

      if (error) {
        setFormError(error.message);
        return;
      }

      const userId = data.user?.id ?? data.session?.user?.id;
      if (!userId) {
        setFormError('Account created, but no user was returned. Try signing in.');
        return;
      }

      // Profile insert requires an authenticated session (RLS).
      if (!data.session) {
        setFormError(
          'Account created. Confirm your email (if required), then sign in to finish setup.'
        );
        return;
      }

      const { error: profileError } = await supabase.from('profiles').upsert(
        {
          id: userId,
          date_of_birth: dateOfBirth,
          parent_guardian_email: parentGuardianEmail,
          updated_at: new Date().toISOString(),
        },
        { onConflict: 'id' }
      );

      if (profileError) {
        setFormError(profileError.message);
        return;
      }

      setSignedIn(true);
      router.replace('/(onboarding)/setup');
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
        <Text className="text-text-primary text-3xl font-bold mb-2">Create account</Text>
        <Text className="text-text-secondary text-base mb-8">
          Set up your player profile and start getting coaching feedback on your clips.
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
            placeholder="Min. 8 characters"
            secureTextEntry
            textContentType="newPassword"
            value={password}
            onChangeText={setPassword}
            editable={!loading}
          />
          <DateOfBirthInput value={dobParts} onChange={setDobParts} />
          {requiresParentEmail ? (
            <View className="gap-1.5">
              <Input
                label="Parent / guardian email *"
                placeholder="parent@example.com"
                keyboardType="email-address"
                autoCapitalize="none"
                autoCorrect={false}
                textContentType="emailAddress"
                value={parentEmail}
                onChangeText={setParentEmail}
                editable={!loading}
              />
              <Text className="text-text-muted text-xs leading-4">
                Required for players under 13. We store this with your account — we do not send a
                verification email yet.
              </Text>
            </View>
          ) : null}
        </View>
        {formError ? (
          <Text className="text-danger text-sm mb-4 leading-5">{formError}</Text>
        ) : null}
        <Button
          label="Create Account"
          onPress={handleRegister}
          fullWidth
          size="lg"
          loading={loading}
        />
        <View className="flex-row justify-center mt-6 gap-1">
          <Text className="text-text-secondary">Already have an account?</Text>
          <Link href="/(auth)/login" asChild>
            <Pressable>
              <Text className="text-primary font-semibold">Sign in</Text>
            </Pressable>
          </Link>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}
