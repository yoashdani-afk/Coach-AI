import { View, Text, Pressable } from 'react-native';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Button, Input } from '@/components/ui';

export default function ForgotPasswordScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();

  return (
    <View className="flex-1 bg-background px-6" style={{ paddingTop: insets.top + 24, paddingBottom: insets.bottom + 24 }}>
      <Pressable onPress={() => router.back()} className="mb-8">
        <Text className="text-primary text-base">← Back</Text>
      </Pressable>
      <Text className="text-text-primary text-3xl font-bold mb-2">Reset password</Text>
      <Text className="text-text-secondary text-base mb-8">Enter your email and we&apos;ll send a reset link.</Text>
      <Input label="Email" placeholder="you@example.com" keyboardType="email-address" autoCapitalize="none" />
      <View className="mt-8">
        <Button label="Send Reset Link" onPress={() => router.back()} fullWidth size="lg" />
      </View>
    </View>
  );
}
