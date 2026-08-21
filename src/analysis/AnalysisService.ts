import { mapResponseToReport } from '@/analysis/mapResponseToReport';
import type { AnalysisRequestPayload } from '@/analysis/models/AnalysisRequest';
import { DemoProvider } from '@/analysis/providers/DemoProvider';
import { GeminiProvider } from '@/analysis/providers/GeminiProvider';
import { isAnalysisApiConfigured } from '@/lib/analysisConfig';
import {
  classifyAnalysisError,
  formatFallbackReason,
  isPlayerGroundingFailure,
  type AnalysisFailureCategory,
} from '@/lib/analysisErrors';
import { logAnalysisApiTarget } from '@/lib/analysisConfig';
import type { CoachingReport, ReportAnalysisSource } from '@/types/analysis';
import { isInsufficientEvidenceResponse } from '@/analysis/models/AnalysisResponse';

export type AnalysisSource = ReportAnalysisSource;

export interface AnalysisSuccessResult {
  outcome: 'report';
  report: CoachingReport;
  source: AnalysisSource;
  /** Set when source is demo — explains why Gemini was not used. */
  fallbackReason?: string;
}

export interface AnalysisInsufficientEvidenceResult {
  outcome: 'insufficient_evidence';
  message: string;
  requestId?: string;
  source: 'gemini';
}

export type AnalysisRunResult = AnalysisSuccessResult | AnalysisInsufficientEvidenceResult;

function tagDemoReport(
  report: CoachingReport,
  category: AnalysisFailureCategory,
  detail?: string
): CoachingReport {
  return {
    ...report,
    analysisSource: 'demo',
    analysisFallbackReason: formatFallbackReason(category, detail),
  };
}

/**
 * Runs video analysis through the configured provider chain.
 *
 * 1. If EXPO_PUBLIC_ANALYSIS_API_URL is set, POST the clip to the server (Gemini).
 * 2. On any failure, fall back to the local DemoProvider.
 */
export async function runAnalysis(
  request: AnalysisRequestPayload
): Promise<AnalysisRunResult> {
  if (!isAnalysisApiConfigured) {
    const category: AnalysisFailureCategory = 'API URL not configured';
    console.log('[Analysis] Provider: Demo');
    console.log('[Analysis] Reason for fallback:', category);
    return {
      outcome: 'report',
      report: tagDemoReport(DemoProvider.analyse(request), category),
      source: 'demo',
      fallbackReason: category,
    };
  }

  console.log('[Analysis] Provider: Gemini');
  logAnalysisApiTarget('POST', '/api/analyse-video');

  try {
    const response = await GeminiProvider.analyse(request);
    console.log('[Analysis] Video uploaded successfully');
    console.log('[Analysis] Gemini response received');

    if (isInsufficientEvidenceResponse(response)) {
      console.log('[Analysis] Server returned insufficient_evidence — no report or scores', {
        requestId: response.requestId,
      });
      return {
        outcome: 'insufficient_evidence',
        message: response.message,
        requestId: response.requestId,
        source: 'gemini',
      };
    }

    return {
      outcome: 'report',
      report: mapResponseToReport(request, response),
      source: 'gemini',
    };
  } catch (error) {
    if (isPlayerGroundingFailure(error)) {
      throw error;
    }

    const category = classifyAnalysisError(error);
    const detail = error instanceof Error ? error.message : String(error);

    console.log('[Analysis] Provider: Demo');
    console.log('[Analysis] Reason for fallback:', formatFallbackReason(category, detail));

    if (__DEV__) {
      console.warn('[Analysis] Gemini failed — using demo feedback:', detail);
    }

    return {
      outcome: 'report',
      report: tagDemoReport(DemoProvider.analyse(request), category, detail),
      source: 'demo',
      fallbackReason: formatFallbackReason(category, detail),
    };
  }
}

export const AnalysisService = {
  run: runAnalysis,
};

// Re-export building blocks for tests and future wiring.
export { buildAnalysisRequest, toRequestMetadata } from '@/analysis/models/AnalysisRequest';
export type { AnalysisRequestPayload } from '@/analysis/models/AnalysisRequest';
export type { AnalysisResponse } from '@/analysis/models/AnalysisResponse';
