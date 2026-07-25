import { View, Text, Pressable } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';

import { isDevPreviewMode } from '@/lib/supabase';

interface ScreenHeaderProps {
  title: string;
  subtitle?: string;
  showBack?: boolean;
  onBack?: () => void;
}

export function ScreenHeader({ title, subtitle, showBack, onBack }: ScreenHeaderProps) {
  const insets = useSafeAreaInsets();
  const topPadding = isDevPreviewMode ? 8 : insets.top + 8;

  return (
    <View className="px-4 pb-4 bg-background border-b border-border" style={{ paddingTop: topPadding }}>
      <View className="flex-row items-center gap-3 min-h-[44px]">
        {showBack && onBack ? (
          <Pressable onPress={onBack} className="w-10 h-10 items-center justify-center rounded-full bg-surface">
            <Ionicons name="chevron-back" size={22} color="#FFFFFF" />
          </Pressable>
        ) : null}
        <View className="flex-1">
          <Text className="text-text-primary text-2xl font-bold">{title}</Text>
          {subtitle ? <Text className="text-text-secondary text-sm mt-0.5">{subtitle}</Text> : null}
        </View>
      </View>
    </View>
  );
}
