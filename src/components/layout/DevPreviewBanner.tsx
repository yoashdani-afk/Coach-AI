import { View, Text } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { isDevPreviewMode } from '@/lib/supabase';

export function DevPreviewBanner() {
  const insets = useSafeAreaInsets();

  if (!isDevPreviewMode) return null;

  return (
    <View
      className="bg-surface/80 border-b border-border/60 px-3 pb-1"
      style={{ paddingTop: Math.max(insets.top, 4) }}
    >
      <Text className="text-text-muted text-[10px] text-center">
        Dev preview · local profile only
      </Text>
    </View>
  );
}
