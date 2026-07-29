import type { CoachingReport } from '@/types/analysis';
import { hashString } from '@/lib/reports/shared';

export interface StructuredCoachFeedback {
  whatHappened: string;
  whyItMattered: string;
  betterOption: string;
  professionalInsight: string;
  trainingDrill: string;
}

export function formatStructuredFeedback(feedback: StructuredCoachFeedback): string {
  return [
    `What Happened\n${feedback.whatHappened}`,
    `Why It Mattered\n${feedback.whyItMattered}`,
    `Better Option\n${feedback.betterOption}`,
    `Professional Insight\n${feedback.professionalInsight}`,
    `Training Drill\n${feedback.trainingDrill}`,
  ].join('\n\n');
}

export function reportSeed(report: CoachingReport, suffix = ''): number {
  return hashString(`${report.id}:${report.mode}:${suffix}`);
}

export function pickVariant<T>(items: T[], seed: number): T {
  return items[seed % items.length];
}
