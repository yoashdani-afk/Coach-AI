import type { AnalysisMode } from '@/types/analysis';

export const MODE_ACCENT = {
  PERFORMANCE: '#00C853',
  GOAL: '#F5C542',
  COACH_ME: '#A78BFA',
} as const satisfies Record<AnalysisMode, string>;

export const MODE_SHORT_LABEL: Record<AnalysisMode, string> = {
  PERFORMANCE: 'Performance',
  GOAL: 'Goal',
  COACH_ME: 'Coach Me',
};

export const MODE_ICON: Record<
  AnalysisMode,
  'stats-chart-outline' | 'football-outline' | 'chatbubbles-outline'
> = {
  PERFORMANCE: 'stats-chart-outline',
  GOAL: 'football-outline',
  COACH_ME: 'chatbubbles-outline',
};

export function accentForMode(mode: AnalysisMode): string {
  return MODE_ACCENT[mode];
}

export function shortLabelForMode(mode: AnalysisMode): string {
  return MODE_SHORT_LABEL[mode];
}

export function scoreBandColor(score: number): string {
  if (score >= 8) return '#00C853';
  if (score >= 6) return '#FFB300';
  return '#6B6B73';
}
