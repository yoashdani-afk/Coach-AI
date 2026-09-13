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
  footerHint?: string;
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
  footerHint = 'This helps us tailor your coaching',
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
      <View className="px-6 pt-2 pb-2 flex-row items-center">
        {onBack ? (
          <Pressable
            onPress={onBack}
            className="w-10 h-10 items-center justify-center -ml-2"
            accessibilityLabel="Go back"
          >
            <Ionicons name="chevron-back" size={24} color="#FFFFFF" />
          </Pressable>
        ) : (
          <View className="w-10 -ml-2" />
        )}
        <View className="flex-1 px-2">
          <SetupProgress step={step} total={totalSteps} compact />
        </View>
      </View>

      <ScrollView
        className="flex-1 px-6"
        contentContainerStyle={{
          flexGrow: 1,
          paddingTop: 28,
          paddingBottom: insets.bottom + 140,
        }}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        <Text className="text-text-primary text-[34px] font-bold leading-10 mb-3">{title}</Text>
        {subtitle ? (
          <Text className="text-text-secondary text-base mb-10 leading-6">{subtitle}</Text>
        ) : (
          <View className="mb-10" />
        )}
        {children}
      </ScrollView>

      <View
        className="absolute bottom-0 left-0 right-0 px-6 pt-3 bg-background"
        style={{ paddingBottom: insets.bottom + 16 }}
      >
        {footerHint ? (
          <Text className="text-text-muted text-sm text-center mb-3">{footerHint}</Text>
        ) : null}
        <Button label={continueLabel} onPress={onContinue} disabled={continueDisabled} fullWidth size="lg" />
        {showSkip && onSkip ? (
          <Button label="Skip for now" variant="ghost" onPress={onSkip} fullWidth className="mt-2" />
        ) : null}
      </View>
    </View>
  );
}
