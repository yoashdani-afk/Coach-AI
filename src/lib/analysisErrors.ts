/** Human-readable failure categories shown in dev when Gemini analysis fails. */
export type AnalysisFailureCategory =
  | 'server unreachable'
  | 'missing API key'
  | 'upload failed'
  | 'Gemini processing failed'
  | 'invalid Gemini response'
  | 'player grounding failed'
  | 'API URL not configured';

export class GeminiAnalysisError extends Error {
  readonly category: AnalysisFailureCategory;
  readonly serverCode?: string;

  constructor(category: AnalysisFailureCategory, message?: string, serverCode?: string) {
    super(message ?? category);
    this.name = 'GeminiAnalysisError';
    this.category = category;
    this.serverCode = serverCode;
  }
}

/** Raised when Gemini ran but could not confidently track the selected player. */
export class PlayerGroundingError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'PlayerGroundingError';
  }
}

export function isPlayerGroundingFailure(error: unknown): error is PlayerGroundingError {
  return error instanceof PlayerGroundingError;
}

const SERVER_CODE_TO_CATEGORY: Record<string, AnalysisFailureCategory> = {
  MISSING_API_KEY: 'missing API key',
  UPLOAD_FAILED: 'upload failed',
  GEMINI_PROCESSING_FAILED: 'Gemini processing failed',
  INVALID_GEMINI_RESPONSE: 'invalid Gemini response',
  PLAYER_GROUNDING_FAILED: 'player grounding failed',
};

function isNetworkFailure(error: unknown): boolean {
  if (!(error instanceof Error)) return false;
  if (error.name === 'AbortError') return true;
  const msg = error.message.toLowerCase();
  return (
    msg.includes('network request failed') ||
    msg.includes('failed to fetch') ||
    msg.includes('network error') ||
    msg.includes('could not connect') ||
    msg.includes('timed out')
  );
}

function categoryFromMessage(message: string): AnalysisFailureCategory | null {
  const lower = message.toLowerCase();

  if (lower.includes('gemini_api_key') || lower.includes('api key is not set')) {
    return 'missing API key';
  }
  if (lower.includes('missing video') || lower.includes('missing metadata')) {
    return 'upload failed';
  }
  if (
    lower.includes('gemini failed to process') ||
    lower.includes('gemini video processing') ||
    lower.includes('gemini returned an empty') ||
    lower.includes('processing timed out')
  ) {
    return 'Gemini processing failed';
  }
  if (
    lower.includes('invalid json') ||
    lower.includes('non-json') ||
    lower.includes('invalid coaching response') ||
    lower.includes('missing required coaching fields')
  ) {
    return 'invalid Gemini response';
  }

  return null;
}

export function classifyAnalysisError(error: unknown): AnalysisFailureCategory {
  if (error instanceof PlayerGroundingError) {
    return 'player grounding failed';
  }

  if (error instanceof GeminiAnalysisError) {
    return error.category;
  }

  const message = error instanceof Error ? error.message : String(error);

  if (isNetworkFailure(error)) {
    return 'server unreachable';
  }

  const fromMessage = categoryFromMessage(message);
  if (fromMessage) return fromMessage;

  if (message.startsWith('Analysis API 400')) return 'upload failed';
  if (message.startsWith('Analysis API 5')) return 'Gemini processing failed';

  return 'server unreachable';
}

export function parseServerErrorBody(body: string): {
  message: string;
  category?: AnalysisFailureCategory;
  code?: string;
} {
  try {
    const parsed = JSON.parse(body) as { error?: string; code?: string; message?: string };
    const message = parsed.error ?? parsed.message ?? body;
    const category = parsed.code ? SERVER_CODE_TO_CATEGORY[parsed.code] : categoryFromMessage(message);
    return { message, category: category ?? undefined, code: parsed.code };
  } catch {
    return { message: body || 'Unknown server error' };
  }
}

export function formatFallbackReason(category: AnalysisFailureCategory, detail?: string): string {
  if (detail && detail !== category) {
    return `${category} — ${detail}`;
  }
  return category;
}
