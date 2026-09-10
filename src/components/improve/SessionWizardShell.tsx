import { View, Text, ScrollView, Pressable } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { SetupProgress } from '@/components/profile/SelectCard';
import { Button } from '@/components/ui';

interface SessionWizardShellProps {
  step: number;
  totalSteps: number;
  title: string;
  subtitle?: string;
  headerTitle?: string;
  onBack?: () => void;
  onContinue: () => void;
  continueLabel?: string;
  continueDisabled?: boolean;
  children: React.ReactNode;
}

export function SessionWizardShell({
  step,
  totalSteps,
  title,
  subtitle,
  headerTitle = 'Build a session',
  onBack,
  onContinue,
  continueLabel = 'Continue',
  continueDisabled = false,
  children,
}: SessionWizardShellProps) {
  const insets = useSafeAreaInsets();

  return (
    <View className="flex-1 bg-background" style={{ paddingTop: insets.top }}>
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
        <Text className="text-text-primary text-lg font-semibold flex-1">{headerTitle}</Text>
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
        className="absolute bottom-0 left-0 right-0 px-5 pt-4 bg-background border-t border-border"
        style={{ paddingBottom: insets.bottom + 16 }}
      >
        <Button
          label={continueLabel}
          onPress={onContinue}
          disabled={continueDisabled}
          fullWidth
          size="lg"
        />
      </View>
    </View>
  );
}
