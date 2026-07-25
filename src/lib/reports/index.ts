import type { CoachingReport, GenerateReportInput } from '@/types/analysis';
import { generateCoachReport } from './generateCoachReport';
import { generateGoalReport } from './generateGoalReport';
import { generatePerformanceReport } from './generatePerformanceReport';

/**
 * Single entry point for report generation.
 * Replace the implementations in ./generate*Report.ts with AI calls later —
 * this function signature and return type stay the same.
 */
export function generateReport(input: GenerateReportInput): CoachingReport {
  switch (input.mode) {
    case 'COACH_ME':
      return generateCoachReport({
        profile: input.profile,
        clip: input.clip,
        playerSelection: input.playerSelection,
        questionType: input.questionType,
        question: input.question,
        context: input.context,
      });
    case 'PERFORMANCE':
      return generatePerformanceReport({
        profile: input.profile,
        clip: input.clip,
        playerSelection: input.playerSelection,
      });
    case 'GOAL':
      return generateGoalReport({
        profile: input.profile,
        clip: input.clip,
        playerSelection: input.playerSelection,
      });
  }
}

export { generateCoachReport } from './generateCoachReport';
export { generatePerformanceReport } from './generatePerformanceReport';
export { generateGoalReport } from './generateGoalReport';
