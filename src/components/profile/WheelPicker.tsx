import { useEffect, useMemo, useRef } from 'react';
import {
  View,
  Text,
  ScrollView,
  NativeSyntheticEvent,
  NativeScrollEvent,
  type NativeScrollPoint,
} from 'react-native';

const ITEM_HEIGHT = 48;
const VISIBLE_ITEMS = 5;

export type WheelItem = {
  label: string;
  value: string;
};

interface WheelPickerProps {
  items: WheelItem[];
  value: string;
  onChange: (value: string) => void;
  /** Optional unit / caption shown beside the selected value */
  suffix?: string;
}

function clampIndex(index: number, length: number) {
  if (length <= 0) return 0;
  return Math.max(0, Math.min(length - 1, index));
}

export function WheelPicker({ items, value, onChange, suffix }: WheelPickerProps) {
  const scrollRef = useRef<ScrollView>(null);
  const isScrolling = useRef(false);
  const selectedIndex = useMemo(() => {
    const idx = items.findIndex((item) => item.value === value);
    return idx >= 0 ? idx : 0;
  }, [items, value]);

  const pad = Math.floor(VISIBLE_ITEMS / 2);
  const contentHeight = ITEM_HEIGHT * VISIBLE_ITEMS;

  useEffect(() => {
    if (isScrolling.current || items.length === 0) return;
    const y = selectedIndex * ITEM_HEIGHT;
    requestAnimationFrame(() => {
      scrollRef.current?.scrollTo({ y, animated: false });
    });
  }, [selectedIndex, items.length]);

  const commitOffset = (offsetY: number) => {
    const index = clampIndex(Math.round(offsetY / ITEM_HEIGHT), items.length);
    const item = items[index];
    if (!item) return;
    if (item.value !== value) onChange(item.value);
    scrollRef.current?.scrollTo({ y: index * ITEM_HEIGHT, animated: true });
  };

  const onMomentumEnd = (e: NativeSyntheticEvent<NativeScrollEvent>) => {
    isScrolling.current = false;
    commitOffset(e.nativeEvent.contentOffset.y);
  };

  const onScrollEndDrag = (e: NativeSyntheticEvent<NativeScrollEvent>) => {
    const offset = e.nativeEvent.contentOffset as NativeScrollPoint;
    // If velocity is near zero, momentum won't fire — snap here.
    const velocity = e.nativeEvent.velocity?.y ?? 0;
    if (Math.abs(velocity) < 0.05) {
      isScrolling.current = false;
      commitOffset(offset.y);
    }
  };

  return (
    <View className="items-center">
      <View style={{ height: contentHeight, width: '100%' }} className="overflow-hidden">
        <View
          pointerEvents="none"
          className="absolute left-0 right-0 border-t border-b border-border bg-surface/40 z-10"
          style={{ top: pad * ITEM_HEIGHT, height: ITEM_HEIGHT }}
        />
        <ScrollView
          ref={scrollRef}
          showsVerticalScrollIndicator={false}
          snapToInterval={ITEM_HEIGHT}
          decelerationRate="fast"
          nestedScrollEnabled
          onScrollBeginDrag={() => {
            isScrolling.current = true;
          }}
          onMomentumScrollEnd={onMomentumEnd}
          onScrollEndDrag={onScrollEndDrag}
          contentContainerStyle={{
            paddingVertical: pad * ITEM_HEIGHT,
          }}
        >
          {items.map((item, index) => {
            const isSelected = index === selectedIndex;
            return (
              <View
                key={`${item.value}-${index}`}
                style={{ height: ITEM_HEIGHT }}
                className="items-center justify-center px-4"
              >
                <Text
                  className={`text-center ${
                    isSelected
                      ? 'text-text-primary text-2xl font-semibold'
                      : 'text-text-muted text-lg'
                  }`}
                >
                  {item.label}
                  {isSelected && suffix ? ` ${suffix}` : ''}
                </Text>
              </View>
            );
          })}
        </ScrollView>
      </View>
    </View>
  );
}

export function rangeWheelItems(from: number, to: number, mapLabel?: (n: number) => string): WheelItem[] {
  const items: WheelItem[] = [];
  for (let n = from; n <= to; n += 1) {
    items.push({ value: String(n), label: mapLabel ? mapLabel(n) : String(n) });
  }
  return items;
}
