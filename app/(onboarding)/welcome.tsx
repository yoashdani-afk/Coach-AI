import { useCallback, useRef, useState } from 'react';
import {
  View,
  FlatList,
  Dimensions,
  Platform,
  ActivityIndicator,
  type ViewToken,
  type NativeSyntheticEvent,
  type NativeScrollEvent,
  type LayoutChangeEvent,
} from 'react-native';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import { useFonts } from 'expo-font';
import {
  BarlowCondensed_600SemiBold,
  BarlowCondensed_700Bold,
} from '@expo-google-fonts/barlow-condensed';
import Animated, { FadeIn } from 'react-native-reanimated';
import { Button } from '@/components/ui';
import {
  WELCOME_SLIDES,
  WelcomeSlideStage,
  WelcomeSlideCopy,
  WelcomePageDot,
  useWelcomeReducedMotion,
  WELCOME_GREEN,
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
  const [stageHeight, setStageHeight] = useState(0);
  const flatListRef = useRef<FlatList<WelcomeSlide>>(null);
  const activeIndexRef = useRef(0);
  const reducedMotion = useWelcomeReducedMotion();

  const [fontsLoaded] = useFonts({
    BarlowCondensed_600SemiBold,
    BarlowCondensed_700Bold,
  });

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
    [],
  );

  const scrollToSlide = useCallback(
    (index: number) => {
      const clamped = Math.max(0, Math.min(index, WELCOME_SLIDES.length - 1));
      flatListRef.current?.scrollToOffset({
        offset: WINDOW_WIDTH * clamped,
        animated: !reducedMotion,
      });
      activeIndexRef.current = clamped;
      setActiveIndex(clamped);
    },
    [reducedMotion],
  );

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

  const onStageLayout = (event: LayoutChangeEvent) => {
    const next = Math.round(event.nativeEvent.layout.height);
    if (next > 0 && next !== stageHeight) setStageHeight(next);
  };

  const topPadding = isDevPreviewMode ? 8 : insets.top;
  const bottomPad = insets.bottom + 16;

  if (!fontsLoaded) {
    return (
      <View className="flex-1 bg-background items-center justify-center">
        <ActivityIndicator color={WELCOME_GREEN} size="large" />
      </View>
    );
  }

  return (
    <View className="flex-1 bg-background" style={{ paddingTop: topPadding }}>
      <LinearGradient
        pointerEvents="none"
        colors={[activeSlide.accentWash, 'rgba(13,13,15,0.55)', '#0D0D0F']}
        locations={[0, 0.35, 1]}
        style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0 }}
      />

      <Animated.View
        entering={reducedMotion ? undefined : FadeIn.duration(450)}
        style={{ flex: 1, paddingBottom: bottomPad }}
      >
        <View style={{ flex: 1 }} onLayout={onStageLayout}>
          {stageHeight > 0 ? (
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
                requestAnimationFrame(() => scrollToSlide(index));
              }}
              renderItem={({ item, index }) => {
                const isActive = index === activeIndex;
                return (
                  <View
                    style={{ width: WINDOW_WIDTH, height: stageHeight }}
                    pointerEvents={Platform.OS === 'web' ? 'box-none' : 'auto'}
                  >
                    <View style={{ flex: 1, overflow: 'hidden' }}>
                      <WelcomeSlideStage
                        slideId={item.id}
                        active={isActive}
                        reducedMotion={reducedMotion}
                      />
                    </View>
                    <WelcomeSlideCopy
                      title={item.title}
                      description={item.description}
                      active={isActive}
                      reducedMotion={reducedMotion}
                    />
                  </View>
                );
              }}
            />
          ) : null}
        </View>

        <View style={{ paddingHorizontal: 24, paddingTop: 10, gap: 12, zIndex: 2 }}>
          <View style={{ flexDirection: 'row', justifyContent: 'center', gap: 8 }}>
            {WELCOME_SLIDES.map((slide, i) => (
              <WelcomePageDot
                key={slide.id}
                active={i === activeIndex}
                accent={activeSlide.accent}
                reducedMotion={reducedMotion}
              />
            ))}
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
      </Animated.View>
    </View>
  );
}
