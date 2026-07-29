/** Structured coaching response returned by Gemini (and mirrored by the server). */
export interface AnalysisScore {
  label: string;
  value: number;
}

export interface AnalysisResponse {
  title: string;
  summary: string;
  whatHappened: string;
  whyItMattered: string;
  betterOption: string;
  professionalInsight: string;
  trainingAdvice: string[];
  strengths: string[];
  improvements: string[];
  scores: AnalysisScore[];
  awards: string[];
}

export function isAnalysisResponse(value: unknown): value is AnalysisResponse {
  if (!value || typeof value !== 'object') return false;
  const r = value as Record<string, unknown>;
  return (
    typeof r.title === 'string' &&
    typeof r.summary === 'string' &&
    typeof r.whatHappened === 'string' &&
    typeof r.whyItMattered === 'string' &&
    typeof r.betterOption === 'string' &&
    typeof r.professionalInsight === 'string' &&
    Array.isArray(r.trainingAdvice) &&
    Array.isArray(r.strengths) &&
    Array.isArray(r.improvements) &&
    Array.isArray(r.scores) &&
    Array.isArray(r.awards)
  );
}
