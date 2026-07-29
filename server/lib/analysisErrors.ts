export type ServerAnalysisErrorCode =
  | 'MISSING_API_KEY'
  | 'UPLOAD_FAILED'
  | 'GEMINI_PROCESSING_FAILED'
  | 'INVALID_GEMINI_RESPONSE'
  | 'PLAYER_GROUNDING_FAILED';

export class ServerAnalysisError extends Error {
  readonly code: ServerAnalysisErrorCode;

  constructor(message: string, code: ServerAnalysisErrorCode) {
    super(message);
    this.name = 'ServerAnalysisError';
    this.code = code;
  }
}

export function isServerAnalysisError(error: unknown): error is ServerAnalysisError {
  return error instanceof ServerAnalysisError;
}
