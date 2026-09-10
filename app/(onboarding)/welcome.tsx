import { useCallback, useRef, useState } from 'react';
import {
  View,
  Text,
  FlatList,
  Dimensions,
  Platform,
  type ViewToken,
  type NativeSyntheticEvent,
  type NativeScrollEvent,
} from 'react-native';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Button } from '@/components/ui';
import {
  WELCOME_SLIDES,
  WelcomeSlideHero,
  type WelcomeSlide,
} from '@/components/onboarding/WelcomeSlides';
import { isDevPreviewMode } from '@/lib/supabase';
import { useProfileStore } from '@/stores/profileStore';

const { width: WINDOW_WIDTH } = Dimensions.get('window');

export default function WelcomeScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const setHasSeenOnboarding = useProfileStore((s) => s.setHasSeenOnboarding);
  const [activeIndex, setActiveIndex] = useState(0);
  const flatListRef = useRef<FlatList<WelcomeSlide>>(null);
  const activeIndexRef = useRef(0);

  const onViewableItemsChanged = useRef(({ viewableItems }: { viewableItems: ViewToken[] }) => {
    if (viewableItems[0]?.index != null) {
      activeIndexRef.current = viewableItems[0].index;
      setActiveIndex(viewableItems[0].index);
    }
  }).current;

  const activeSlide = WELCOME_SLIDES[activeIndex] ?? WELCOME_SLIDES[0]!;
  const isLastSlide = activeIndex === WELCOME_SLIDES.length - 1;

  const goToAuth = () => {
    setHasSeenOnboarding(true);
    router.push('/(auth)/register');
  };

  const getItemLayout = useCallback(
    (_: ArrayLike<WelcomeSlide> | null | undefined, index: number) => ({
      length: WINDOW_WIDTH,
      offset: WINDOW_WIDTH * index,
      index,
    }),
    []
  );

  const scrollToSlide = useCallback((index: number) => {
    const clamped = Math.max(0, Math.min(index, WELCOME_SLIDES.length - 1));
    // Prefer offset on web — scrollToIndex is unreliable without a fully measured list.
    flatListRef.current?.scrollToOffset({
      offset: WINDOW_WIDTH * clamped,
      animated: true,
    });
    activeIndexRef.current = clamped;
    setActiveIndex(clamped);
  }, []);

  const handleNext = () => {
    if (isLastSlide) {
      goToAuth();
      return;
    }
    scrollToSlide(activeIndexRef.current + 1);
  };

  const onMomentumScrollEnd = (event: NativeSyntheticEvent<NativeScrollEvent>) => {
    const next = Math.round(event.nativeEvent.contentOffset.x / WINDOW_WIDTH);
    if (Number.isFinite(next) && next !== activeIndexRef.current) {
      activeIndexRef.current = next;
      setActiveIndex(next);
    }
  };

  const topPadding = isDevPreviewMode ? 8 : insets.top;

  return (
    <View
      className="flex-1 bg-background"
      style={{ paddingTop: topPadding, paddingBottom: insets.bottom + 24 }}
    >
      <FlatList
        ref={flatListRef}
        style={{ flex: 1 }}
        data={WELCOME_SLIDES}
        horizontal
        pagingEnabled
        showsHorizontalScrollIndicator={false}
        keyExtractor={(item) => item.id}
        getItemLayout={getItemLayout}
        onViewableItemsChanged={onViewableItemsChanged}
        onMomentumScrollEnd={onMomentumScrollEnd}
        viewabilityConfig={{ viewAreaCoveragePercentThreshold: 50 }}
        onScrollToIndexFailed={({ index }) => {
          // Web / unmeasured list fallback
          requestAnimationFrame(() => scrollToSlide(index));
        }}
        renderItem={({ item }) => (
          <View
            style={{ width: WINDOW_WIDTH }}
            className="justify-center px-6"
            // Let presses pass through empty slide chrome to the footer on web.
            pointerEvents={Platform.OS === 'web' ? 'box-none' : 'auto'}
          >
            <WelcomeSlideHero slideId={item.id} />
            <Text className="text-text-primary text-3xl font-bold text-center mb-4">
              {item.title}
            </Text>
            <Text className="text-text-secondary text-lg text-center leading-7 px-1">
              {item.description}
            </Text>
          </View>
        )}
      />

      <View className="px-6 gap-4" style={{ zIndex: 2 }} pointerEvents="box-none">
        <View className="flex-row justify-center gap-2 mb-2" pointerEvents="none">
          {WELCOME_SLIDES.map((slide, i) => {
            const isActive = i === activeIndex;
            return (
              <View
                key={slide.id}
                className="h-2 rounded-full"
                style={{
                  width: isActive ? 24 : 8,
                  backgroundColor: isActive ? activeSlide.accent : '#2E2E33',
                }}
              />
            );
          })}
        </View>
        <Button
          label={isLastSlide ? 'Create free account' : 'Next'}
          onPress={handleNext}
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
