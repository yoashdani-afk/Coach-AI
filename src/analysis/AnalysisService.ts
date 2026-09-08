import { mapResponseToReport } from '@/analysis/mapResponseToReport';
import type { AnalysisRequestPayload } from '@/analysis/models/AnalysisRequest';
import { GeminiProvider } from '@/analysis/providers/GeminiProvider';
import { isAnalysisApiConfigured, logAnalysisApiTarget } from '@/lib/analysisConfig';
import {
  classifyAnalysisError,
  formatFallbackReason,
  isPlayerGroundingFailure,
  type AnalysisFailureCategory,
} from '@/lib/analysisErrors';
import type { CoachingReport, ReportAnalysisSource } from '@/types/analysis';
import { isInsufficientEvidenceResponse } from '@/analysis/models/AnalysisResponse';

export type AnalysisSource = ReportAnalysisSource;

export interface AnalysisSuccessResult {
  outcome: 'report';
  report: CoachingReport;
  source: 'gemini';
}

export interface AnalysisInsufficientEvidenceResult {
  outcome: 'insufficient_evidence';
  message: string;
  requestId?: string;
  source: 'gemini';
}

export interface AnalysisFailedResult {
  outcome: 'failed';
  message: string;
  category: AnalysisFailureCategory;
}

export type AnalysisRunResult =
  | AnalysisSuccessResult
  | AnalysisInsufficientEvidenceResult
  | AnalysisFailedResult;

function userFacingFailureMessage(category: AnalysisFailureCategory, detail?: string): string {
  const reason = formatFallbackReason(category, detail);
  return `Analysis failed — please try again.\n\n${reason}`;
}

/**
 * Runs video analysis through the Gemini provider.
 *
 * Failures (including missing API URL) return outcome: 'failed' — never a silent demo report.
 * Player grounding failures still throw for specialised UI handling.
 */
export async function runAnalysis(
  request: AnalysisRequestPayload
): Promise<AnalysisRunResult> {
  if (!isAnalysisApiConfigured) {
    const category: AnalysisFailureCategory = 'API URL not configured';
    console.log('[Analysis] API URL not configured — failing without demo report');
    return {
      outcome: 'failed',
      message: userFacingFailureMessage(category),
      category,
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

    console.log('[Analysis] Gemini failed — surfacing error (no demo fallback):', {
      category,
      detail,
    });

    return {
      outcome: 'failed',
      message: userFacingFailureMessage(category, detail),
      category,
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
