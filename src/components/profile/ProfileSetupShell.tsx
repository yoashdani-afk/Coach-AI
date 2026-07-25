import { View, Text, ScrollView, Pressable } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { SetupProgress } from '@/components/profile/SelectCard';
import { Button } from '@/components/ui';
import { isDevPreviewMode } from '@/lib/supabase';

interface ProfileSetupShellProps {
  step: number;
  totalSteps: number;
  title: string;
  subtitle?: string;
  onBack?: () => void;
  onContinue: () => void;
  continueLabel?: string;
  continueDisabled?: boolean;
  showSkip?: boolean;
  onSkip?: () => void;
  children: React.ReactNode;
}

export function ProfileSetupShell({
  step,
  totalSteps,
  title,
  subtitle,
  onBack,
  onContinue,
  continueLabel = 'Continue',
  continueDisabled = false,
  showSkip = false,
  onSkip,
  children,
}: ProfileSetupShellProps) {
  const insets = useSafeAreaInsets();
  const topPadding = isDevPreviewMode ? 8 : insets.top;

  return (
    <View className="flex-1 bg-background" style={{ paddingTop: topPadding }}>
      <View className="px-5 pt-2 pb-4 flex-row items-center">
        {onBack ? (
          <Pressable
            onPress={onBack}
            className="w-10 h-10 items-center justify-center rounded-full bg-surface mr-2"
            accessibilityLabel="Go back"
          >
            <Ionicons name="chevron-back" size={22} color="#FFFFFF" />
          </Pressable>
        ) : (
          <View className="w-10 mr-2" />
        )}
        <Text className="text-text-primary text-lg font-semibold flex-1">Your profile</Text>
      </View>

      <ScrollView
        className="flex-1 px-5"
        contentContainerStyle={{ paddingBottom: insets.bottom + 100 }}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        <SetupProgress step={step} total={totalSteps} />
        <Text className="text-text-primary text-2xl font-bold mb-2">{title}</Text>
        {subtitle ? (
          <Text className="text-text-secondary text-base mb-6 leading-6">{subtitle}</Text>
        ) : (
          <View className="mb-6" />
        )}
        {children}
      </ScrollView>

      <View
        className="absolute bottom-0 left-0 right-0 px-5 pt-4 bg-background border-t border-border gap-3"
        style={{ paddingBottom: insets.bottom + 16 }}
      >
        <Button label={continueLabel} onPress={onContinue} disabled={continueDisabled} fullWidth size="lg" />
        {showSkip && onSkip ? (
          <Button label="Skip for now" variant="ghost" onPress={onSkip} fullWidth />
        ) : null}
      </View>
    </View>
  );
}
