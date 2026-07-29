import type { AnalysisRequestPayload } from '@/analysis/models/AnalysisRequest';
import type { CoachingReport } from '@/types/analysis';
import { generateReport } from '@/lib/reports';

/**
 * Local demo analysis — wraps the existing deterministic report generators.
 * Used when the analysis API is unavailable or Gemini analysis fails.
 */
export function analyseWithDemo(request: AnalysisRequestPayload): CoachingReport {
  switch (request.mode) {
    case 'COACH_ME':
      return generateReport({
        mode: 'COACH_ME',
        profile: request.profile,
        clip: request.clip,
        playerSelection: request.playerSelection,
        questionType: request.questionType!,
        question: request.question!,
        context: request.context ?? null,
      });
    case 'PERFORMANCE':
      return generateReport({
        mode: 'PERFORMANCE',
        profile: request.profile,
        clip: request.clip,
        playerSelection: request.playerSelection,
      });
    case 'GOAL':
      return generateReport({
        mode: 'GOAL',
        profile: request.profile,
        clip: request.clip,
        playerSelection: request.playerSelection,
      });
  }
}

export const DemoProvider = {
  analyse: analyseWithDemo,
};
