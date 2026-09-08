import type { AnalysisRequestPayload } from '@/analysis/models/AnalysisRequest';
import type { AnalysisResponse } from '@/analysis/models/AnalysisResponse';
import {
  buildScoresFromGeminiResponse,
  overallScoreFromCategories,
} from '@/analysis/buildGeminiScores';
import type { CoachingReport } from '@/types/analysis';
import { createReportId } from '@/lib/reports/shared';

function firstOrJoin(items: string[], fallback: string): string {
  const cleaned = items.map((s) => s.trim()).filter(Boolean);
  return cleaned[0] ?? fallback;
}

function baseFields(request: AnalysisRequestPayload, response: AnalysisResponse) {
  return {
    id: createReportId(request.clip, request.mode),
    createdAt: new Date().toISOString(),
    isDemo: false,
    analysisSource: 'gemini' as const,
    clip: request.clip,
    mode: request.mode,
    title: response.title.trim() || 'Coaching analysis',
    summary: response.summary.trim(),
    playerSelection: request.playerSelection,
  };
}

/** Converts a validated Gemini response into the existing CoachingReport union. */
export function mapResponseToReport(
  request: AnalysisRequestPayload,
  response: AnalysisResponse
): CoachingReport {
  const scoreSeed = request.clip.uri;
  const trainingTakeaway = firstOrJoin(
    response.trainingAdvice,
    response.professionalInsight
  );

  switch (request.mode) {
    case 'COACH_ME':
      return {
        ...baseFields(request, response),
        mode: 'COACH_ME',
        questionType: request.questionType!,
        question: request.question!,
        context: request.context ?? null,
        verdict: [response.whatHappened, response.whyItMattered]
          .filter(Boolean)
          .join(' '),
        didWell: response.strengths.length > 0 ? response.strengths : ['See summary above.'],
        couldImprove:
          response.improvements.length > 0 ? response.improvements : ['See summary above.'],
        betterOption: response.betterOption,
        trainingTakeaway,
      };

    case 'PERFORMANCE': {
      const categories = buildScoresFromGeminiResponse(
        request.mode,
        response,
        scoreSeed
      );
      return {
        ...baseFields(request, response),
        mode: 'PERFORMANCE',
        categories,
        overallScore: overallScoreFromCategories(categories, response),
        topStrength: firstOrJoin(response.strengths, response.whatHappened),
        biggestImprovement: firstOrJoin(response.improvements, response.betterOption),
        coachSummary: [response.summary, response.professionalInsight]
          .filter(Boolean)
          .join(' '),
        trainingRecommendation: trainingTakeaway,
        primaryImprovementArea: response.primaryImprovementArea ?? null,
        primaryImprovementReasoning: response.primaryImprovementReasoning ?? null,
      };
    }

    case 'GOAL': {
      const categories = buildScoresFromGeminiResponse(
        request.mode,
        response,
        scoreSeed
      );
      return {
        ...baseFields(request, response),
        mode: 'GOAL',
        categories,
        overallScore: overallScoreFromCategories(categories, response),
        whyScoredThisWay: [
          response.whatHappened,
          response.whyItMattered,
          response.professionalInsight,
        ]
          .filter(Boolean)
          .join(' '),
        excellentPoint: firstOrJoin(response.strengths, response.whatHappened),
        couldBeBetter: firstOrJoin(response.improvements, response.betterOption),
      };
    }
  }
}
