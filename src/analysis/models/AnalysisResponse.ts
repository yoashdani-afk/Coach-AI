/** Structured coaching response returned by Gemini (and mirrored by the server). */
export interface AnalysisScore {
  label: string;
  value: number;
}

export interface AnalysisResponse {
  status?: 'success';
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
  requestId?: string;
  /** Performance mode only — null when no clear single weakness. */
  primaryImprovementArea?: string | null;
  /** Performance mode only — null when area is null. */
  primaryImprovementReasoning?: string | null;
}

export interface InsufficientEvidenceResponse {
  status: 'insufficient_evidence';
  message: string;
  scores: null;
  overallScore: null;
  report: null;
  requestId: string;
  reason?: string;
}

export type AnalyseVideoApiResponse = AnalysisResponse | InsufficientEvidenceResponse;

export function isInsufficientEvidenceResponse(
  value: unknown
): value is InsufficientEvidenceResponse {
  return (
    !!value &&
    typeof value === 'object' &&
    (value as InsufficientEvidenceResponse).status === 'insufficient_evidence'
  );
}

export function isAnalysisResponse(value: unknown): value is AnalysisResponse {
  if (isInsufficientEvidenceResponse(value)) return false;
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
