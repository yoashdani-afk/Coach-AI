import { ApiError } from '@google/genai';

export const INTERACTIONS_CREATE_ENDPOINT = 'interactions.create';
export const GEMINI_GENERATE_ENDPOINT = 'models.generateContent';
export const GEMINI_FILES_UPLOAD_ENDPOINT = 'files.upload';
export const GEMINI_FILES_GET_ENDPOINT = 'files.get';
export const GEMINI_MODELS_LIST_ENDPOINT = 'models.list';

export function logGeminiModel(model: string, operation: string): void {
  console.log(`[Gemini] Model: ${model}`);
  console.log(`[Gemini] Endpoint: ${operation}`);
}

function serializeErrorBody(error: unknown): string | undefined {
  if (error instanceof ApiError) {
    return JSON.stringify({ status: error.status, message: error.message });
  }
  if (error && typeof error === 'object') {
    try {
      return JSON.stringify(error);
    } catch {
      return undefined;
    }
  }
  return undefined;
}

export function logGeminiFailure(params: {
  model: string;
  operation: string;
  error: unknown;
  responseBody?: string;
}): void {
  const body = params.responseBody ?? serializeErrorBody(params.error);

  console.error('[Gemini] Request failed', {
    model: params.model,
    endpoint: params.operation,
    message: params.error instanceof Error ? params.error.message : String(params.error),
    status: params.error instanceof ApiError ? params.error.status : undefined,
    responseBody: body,
  });
}

export function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

export function isModelUnavailableError(error: unknown): boolean {
  const message = errorMessage(error).toLowerCase();
  return (
    message.includes('not found') ||
    message.includes('404') ||
    message.includes('no longer available') ||
    message.includes('is not supported')
  );
}
