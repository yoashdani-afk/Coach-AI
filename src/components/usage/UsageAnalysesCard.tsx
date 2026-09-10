import { View, Text } from 'react-native';
import { Card } from '@/components/ui';
import { FREE_TIER_ANALYSES_PER_MONTH } from '@/lib/constants';

interface UsageAnalysesCardProps {
  remaining: number;
  unlimited: boolean;
  /**
   * `home` — fuller helper copy (upload uses one analysis / reset messaging).
   * `profile` — quieter secondary view (no CTA-adjacent copy; Home owns that).
   */
  density?: 'home' | 'profile';
}

export function UsageAnalysesCard({
  remaining,
  unlimited,
  density = 'home',
}: UsageAnalysesCardProps) {
  const limit = FREE_TIER_ANALYSES_PER_MONTH;
  const used = Math.max(0, limit - remaining);
  const progress = unlimited ? 1 : Math.min(1, used / limit);
  const depleted = !unlimited && remaining <= 0;
  const low = !unlimited && remaining === 1;
  const fillColor = depleted ? '#FF3D57' : low ? '#FFB300' : '#00C853';
  const quiet = density === 'profile';

  const body = (() => {
    if (unlimited) {
      return quiet
        ? 'Unlimited in development builds.'
        : 'Unlimited in development builds.';
    }
    if (depleted) {
      return quiet
        ? `You’ve used all ${limit} free analyses this month.`
        : `You’ve used all ${limit} free analyses. Limits reset next month — or upgrade when available.`;
    }
    return quiet
      ? `${remaining} of ${limit} left this month.`
      : `${remaining} of ${limit} left this month. Each upload uses one analysis.`;
  })();

  return (
    <Card
      variant="elevated"
      className="gap-3 overflow-hidden"
      style={{
        borderWidth: 1,
        borderColor: depleted ? 'rgba(255, 61, 87, 0.35)' : 'rgba(0, 200, 83, 0.2)',
      }}
    >
      <View className="flex-row items-start justify-between gap-3">
        <View className="flex-1 gap-1">
          <Text className="text-text-primary font-semibold text-base">
            {depleted ? 'Monthly limit reached' : 'Free analyses'}
          </Text>
          <Text className="text-text-secondary text-sm leading-5">{body}</Text>
        </View>
        {!unlimited ? (
          <View className="px-3 py-1.5 rounded-full" style={{ backgroundColor: `${fillColor}33` }}>
            <Text className="text-sm font-semibold" style={{ color: fillColor }}>
              {remaining} left
            </Text>
          </View>
        ) : (
          <View className="bg-primary-muted px-3 py-1.5 rounded-full">
            <Text className="text-primary text-xs font-semibold">DEV</Text>
          </View>
        )}
      </View>

      {!unlimited ? (
        <View className="h-2 rounded-full bg-border overflow-hidden">
          <View
            className="h-full rounded-full"
            style={{
              width: `${Math.max(progress * 100, depleted ? 100 : 4)}%`,
              backgroundColor: fillColor,
            }}
          />
        </View>
      ) : null}
    </Card>
  );
}
