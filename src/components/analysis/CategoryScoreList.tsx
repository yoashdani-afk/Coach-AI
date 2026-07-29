import { View, Text } from 'react-native';
import type { ScoredCategory } from '@/types/analysis';

interface CategoryScoreListProps {
  categories: ScoredCategory[];
  showOverall?: boolean;
  overallScore?: number;
  overallLabel?: string;
  /** When true, hides the demo-only "Not AI analysed" badge. */
  isAiAnalysed?: boolean;
}

export function CategoryScoreList({
  categories,
  showOverall = false,
  overallScore,
  overallLabel = 'Overall',
  isAiAnalysed = false,
}: CategoryScoreListProps) {
  return (
    <View className="gap-3">
      {showOverall && overallScore != null ? (
        <View className="flex-row items-center justify-between bg-surface-elevated rounded-xl px-4 py-3 border border-border">
          <View>
            <Text className="text-text-primary font-semibold">{overallLabel}</Text>
            {!isAiAnalysed && overallLabel === 'Demo Score' ? (
              <Text className="text-text-muted text-[10px] uppercase mt-0.5">Not AI analysed</Text>
            ) : null}
          </View>
          <Text className="text-primary text-2xl font-bold">{overallScore.toFixed(1)}</Text>
        </View>
      ) : null}
      {categories.map((category) => (
        <CategoryScoreRow key={category.key} category={category} />
      ))}
    </View>
  );
}

function CategoryScoreRow({ category }: { category: ScoredCategory }) {
  const pct = Math.min(100, (category.score / 10) * 100);
  const barColor =
    category.score >= 8 ? '#00C853' : category.score >= 6.5 ? '#69F0AE' : '#FFB300';

  return (
    <View className="gap-1.5">
      <View className="flex-row items-center justify-between">
        <Text className="text-text-primary text-sm font-medium">{category.label}</Text>
        <Text className="text-text-primary text-sm font-bold">{category.score.toFixed(1)}</Text>
      </View>
      <View className="h-2 bg-surface-elevated rounded-full overflow-hidden">
        <View
          className="h-full rounded-full"
          style={{ width: `${pct}%`, backgroundColor: barColor }}
        />
      </View>
    </View>
  );
}
