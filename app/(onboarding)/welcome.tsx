import { useRef, useState } from 'react';
import { View, Text, FlatList, Dimensions, type ViewToken } from 'react-native';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { Button } from '@/components/ui';
import { isDevPreviewMode } from '@/lib/supabase';
import { useProfileStore } from '@/stores/profileStore';

const { width } = Dimensions.get('window');

const SLIDES = [
  {
    id: '1',
    icon: 'football' as const,
    title: 'Your personal football coach',
    description:
      'Upload a clip from training or a match and get clear, personalised feedback in minutes.',
  },
  {
    id: '2',
    icon: 'trending-up' as const,
    title: 'Improve with every clip',
    description:
      'Understand what you did well, what to improve, and what to practise next.',
  },
];

export default function WelcomeScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const setHasSeenOnboarding = useProfileStore((s) => s.setHasSeenOnboarding);
  const [activeIndex, setActiveIndex] = useState(0);
  const flatListRef = useRef<FlatList>(null);

  const onViewableItemsChanged = useRef(({ viewableItems }: { viewableItems: ViewToken[] }) => {
    if (viewableItems[0]?.index != null) setActiveIndex(viewableItems[0].index);
  }).current;

  const isLastSlide = activeIndex === SLIDES.length - 1;

  const goToAuth = () => {
    setHasSeenOnboarding(true);
    router.push('/(auth)/register');
  };

  const topPadding = isDevPreviewMode ? 8 : insets.top;

  return (
    <View className="flex-1 bg-background" style={{ paddingTop: topPadding, paddingBottom: insets.bottom + 24 }}>
      <FlatList
        ref={flatListRef}
        data={SLIDES}
        horizontal
        pagingEnabled
        showsHorizontalScrollIndicator={false}
        keyExtractor={(item) => item.id}
        onViewableItemsChanged={onViewableItemsChanged}
        viewabilityConfig={{ viewAreaCoveragePercentThreshold: 50 }}
        renderItem={({ item }) => (
          <View style={{ width }} className="flex-1 items-center justify-center px-8">
            <View className="w-24 h-24 rounded-3xl bg-primary-muted border border-primary/30 items-center justify-center mb-8">
              <Ionicons name={item.icon} size={44} color="#00C853" />
            </View>
            <Text className="text-text-primary text-3xl font-bold text-center mb-4">{item.title}</Text>
            <Text className="text-text-secondary text-lg text-center leading-7">{item.description}</Text>
          </View>
        )}
      />
      <View className="px-6 gap-4">
        <View className="flex-row justify-center gap-2 mb-2">
          {SLIDES.map((_, i) => (
            <View
              key={i}
              className={`h-2 rounded-full ${i === activeIndex ? 'w-6 bg-primary' : 'w-2 bg-border'}`}
            />
          ))}
        </View>
        <Button
          label={isLastSlide ? 'Get Started' : 'Next'}
          onPress={() =>
            isLastSlide
              ? goToAuth()
              : flatListRef.current?.scrollToIndex({ index: activeIndex + 1, animated: true })
          }
          fullWidth
          size="lg"
        />
        <Button
          label="I already have an account"
          variant="ghost"
          onPress={() => {
            setHasSeenOnboarding(true);
            router.push('/(auth)/login');
          }}
          fullWidth
        />
      </View>
    </View>
  );
}
