import { labelForAnalysisMode } from '@/lib/constants';
import { buildChatFeedback, type ChatIntent } from '@/lib/coaching/feedbackBank';
import type { CoachingReport } from '@/types/analysis';
import {
  formatStructuredFeedback,
  reportSeed,
} from '@/lib/coaching/structuredFeedback';

export interface ReportCoachContext {
  mode: CoachingReport['mode'];
  modeLabel: string;
  summary: string;
  strengths: string[];
  improvements: string[];
  trainingAdvice: string;
  primaryInsight: string;
  alternativeAction?: string;
  question?: string;
}

export function extractReportContext(report: CoachingReport): ReportCoachContext {
  switch (report.mode) {
    case 'COACH_ME':
      return {
        mode: report.mode,
        modeLabel: labelForAnalysisMode(report.mode),
        summary: report.summary,
        strengths: report.didWell,
        improvements: report.couldImprove,
        trainingAdvice: report.trainingTakeaway,
        primaryInsight: report.verdict,
        alternativeAction: report.betterOption,
        question: report.question,
      };
    case 'PERFORMANCE':
      return {
        mode: report.mode,
        modeLabel: labelForAnalysisMode(report.mode),
        summary: report.summary,
        strengths: [report.topStrength],
        improvements: [report.biggestImprovement],
        trainingAdvice: report.trainingRecommendation,
        primaryInsight: report.coachSummary,
      };
    case 'GOAL':
      return {
        mode: report.mode,
        modeLabel: labelForAnalysisMode(report.mode),
        summary: report.summary,
        strengths: [report.excellentPoint],
        improvements: [report.couldBeBetter],
        trainingAdvice: report.couldBeBetter,
        primaryInsight: report.whyScoredThisWay,
      };
  }
}

function normalizeQuestion(input: string): string {
  return input.toLowerCase().replace(/[^\w\s?']/g, ' ').replace(/\s+/g, ' ').trim();
}

function detectIntent(question: string): ChatIntent {
  const q = normalizeQuestion(question);

  if (
    q.includes('wrong decision') ||
    q.includes('why was that') ||
    q.includes('why did i') ||
    q.includes('was that wrong') ||
    q.includes('bad decision')
  ) {
    return 'WRONG_DECISION';
  }
  if (
    q.includes('instead') ||
    q.includes('should i have') ||
    q.includes('what should i') ||
    q.includes('better option') ||
    q.includes('what would you')
  ) {
    return 'BETTER_OPTION';
  }
  if (
    q.includes('space') ||
    q.includes('position') ||
    q.includes('positioning') ||
    q.includes('movement') ||
    q.includes('where should i stand') ||
    q.includes('create room') ||
    q.includes('overload')
  ) {
    return 'SPACE';
  }
  if (q.includes('first touch') || q.includes('touch good') || q.includes('receive')) {
    return 'FIRST_TOUCH';
  }
  if (
    q.includes('drill') ||
    q.includes('practise') ||
    q.includes('practice') ||
    q.includes('train') ||
    q.includes('session') ||
    q.includes('work on')
  ) {
    return 'DRILL';
  }
  if (
    q.includes('well') ||
    q.includes('strength') ||
    q.includes('positive') ||
    q.includes('did right')
  ) {
    return 'STRENGTH';
  }
  if (
    q.includes('improve') ||
    q.includes('weak') ||
    q.includes('fix') ||
    q.includes('mistake') ||
    q.includes('better next time')
  ) {
    return 'IMPROVEMENT';
  }
  return 'GENERAL';
}

export function generateDemoCoachResponse(report: CoachingReport, question: string): string {
  const ctx = extractReportContext(report);
  const intent = detectIntent(question);
  const seed = reportSeed(report, intent + question.slice(0, 24));

  const feedback = buildChatFeedback(
    intent,
    {
      alternative: ctx.alternativeAction,
      training: ctx.trainingAdvice,
      reportVerdict: ctx.primaryInsight,
      reportSummary: ctx.summary,
    },
    seed
  );

  return formatStructuredFeedback(feedback);
}

export const DemoCoach = {
  extractReportContext,
  generateResponse: generateDemoCoachResponse,
};
