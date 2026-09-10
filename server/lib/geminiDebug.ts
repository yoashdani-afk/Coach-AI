import { ApiError } from '@google/genai';
import type { GenerateContentParameters } from '@google/genai';
import { errorMessage } from './geminiLogger.js';

export type GenerateContentAttemptOptions = {
  inlineSystemInstruction: boolean;
  label: string;
};

function redactPayloadForLog(payload: GenerateContentParameters): GenerateContentParameters {
  return JSON.parse(
    JSON.stringify(payload, (_key, value) => {
      if (
        value &&
        typeof value === 'object' &&
        'inlineData' in value &&
        value.inlineData &&
        typeof value.inlineData === 'object' &&
        'data' in value.inlineData &&
        typeof value.inlineData.data === 'string'
      ) {
        const data = value.inlineData.data as string;
        return {
          ...value,
          inlineData: {
            ...value.inlineData,
            data: `[base64 jpeg omitted — ${data.length} chars]`,
          },
        };
      }
      return value;
    })
  ) as GenerateContentParameters;
}

/** Log the full generateContent payload (never includes the API key). */
export function logGeminiRequestPayload(
  operation: string,
  payload: GenerateContentParameters,
  attempt: GenerateContentAttemptOptions
): void {
  console.log('[Gemini] ── REQUEST PAYLOAD ──', {
    operation,
    attempt: attempt.label,
    inlineSystemInstruction: attempt.inlineSystemInstruction,
    contentOrder: 'marked-frame → full-video → coaching-prompt',
  });
  console.log(JSON.stringify(redactPayloadForLog(payload), null, 2));
}

/** Log the full successful generateContent response body. */
export function logGeminiSuccessResponse(
  operation: string,
  result: {
    text?: string | null;
    candidates?: unknown;
    usageMetadata?: unknown;
    promptFeedback?: unknown;
    sdkHttpResponse?: unknown;
    /** Exact underlying model build from the API (not just the request alias). */
    modelVersion?: string | null;
    /** Per-response id for correlating good vs bad runs. */
    responseId?: string | null;
  },
  attempt: GenerateContentAttemptOptions
): void {
  console.log('[Gemini] ── RESPONSE BODY (success) ──', {
    operation,
    attempt: attempt.label,
    modelVersion: result.modelVersion ?? null,
    responseId: result.responseId ?? null,
  });
  console.log(
    JSON.stringify(
      {
        modelVersion: result.modelVersion ?? null,
        responseId: result.responseId ?? null,
        text: result.text ?? null,
        candidates: result.candidates ?? null,
        usageMetadata: result.usageMetadata ?? null,
        promptFeedback: result.promptFeedback ?? null,
        sdkHttpResponse: result.sdkHttpResponse ?? null,
      },
      null,
      2
    )
  );
}

/** Parse the JSON error body embedded in ApiError.message. */
export function parseGeminiErrorBody(error: unknown): unknown {
  if (!(error instanceof ApiError)) {
    return null;
  }

  const raw = error.message.trim();

  try {
    return JSON.parse(raw);
  } catch {
    const jsonStart = raw.indexOf('{');
    if (jsonStart >= 0) {
      try {
        return JSON.parse(raw.slice(jsonStart));
      } catch {
        return { rawMessage: raw, status: error.status };
      }
    }
    return { rawMessage: raw, status: error.status };
  }
}

function normalizeRejectedFieldName(field: string): string {
  const lower = field.toLowerCase();
  if (lower.includes('video_metadata') || lower.includes('videometadata')) {
    return 'videoMetadata';
  }
  if (lower.includes('system_instruction') || lower.includes('systeminstruction')) {
    return 'systemInstruction';
  }
  if (lower.includes('media_resolution') || lower.includes('mediaresolution')) {
    return 'mediaResolution';
  }
  if (lower.includes('response_mime_type') || lower.includes('responsemimetype')) {
    return 'responseMimeType';
  }
  return field;
}

function fieldViolationsFromBody(body: unknown): string[] {
  if (!body || typeof body !== 'object') return [];

  const root = body as Record<string, unknown>;
  const errorObj = (root.error ?? root) as Record<string, unknown>;
  const details = errorObj.details;

  if (!Array.isArray(details)) return [];

  const fields: string[] = [];
  for (const detail of details) {
    if (!detail || typeof detail !== 'object') continue;
    const violations = (detail as Record<string, unknown>).fieldViolations;
    if (!Array.isArray(violations)) continue;
    for (const violation of violations) {
      if (!violation || typeof violation !== 'object') continue;
      const field = (violation as Record<string, unknown>).field;
      const description = (violation as Record<string, unknown>).description;
      if (typeof field === 'string') {
        fields.push(
          typeof description === 'string'
            ? `${field} (${description})`
            : field
        );
      }
    }
  }
  return fields;
}

/** Best-effort detection of which request field Gemini rejected. */
export function detectRejectedField(error: unknown): string | null {
  const body = parseGeminiErrorBody(error);
  const violations = fieldViolationsFromBody(body);

  if (violations.length > 0) {
    return normalizeRejectedFieldName(violations[0]);
  }

  const haystack = [
    error instanceof ApiError ? error.message : '',
    errorMessage(error),
    body ? JSON.stringify(body) : '',
  ]
    .join(' ')
    .toLowerCase();

  if (haystack.includes('video_metadata') || haystack.includes('videometadata')) {
    return 'videoMetadata';
  }
  if (haystack.includes('system_instruction') || haystack.includes('systeminstruction')) {
    return 'systemInstruction';
  }
  if (haystack.includes('media_resolution') || haystack.includes('mediaresolution')) {
    return 'mediaResolution';
  }

  return null;
}

/** Log the complete Gemini error response and the rejected field. */
export function logGeminiErrorResponse(
  operation: string,
  error: unknown,
  attempt: GenerateContentAttemptOptions
): void {
  const body = parseGeminiErrorBody(error);
  const rejectedField = detectRejectedField(error);
  const violations = fieldViolationsFromBody(body);

  console.error('[Gemini] ── RESPONSE BODY (error) ──', {
    operation,
    attempt: attempt.label,
    status: error instanceof ApiError ? error.status : undefined,
    rejectedField: rejectedField ?? 'unknown',
    fieldViolations: violations.length > 0 ? violations : undefined,
    errorName: error instanceof Error ? error.name : typeof error,
    errorMessage: errorMessage(error),
  });
  console.error(JSON.stringify(body ?? { message: errorMessage(error) }, null, 2));
}

export function isInvalidArgumentError(error: unknown): boolean {
  if (error instanceof ApiError) {
    if (error.status === 400) return true;
    const body = parseGeminiErrorBody(error);
    if (body && typeof body === 'object') {
      const errorObj = ((body as Record<string, unknown>).error ??
        body) as Record<string, unknown>;
      const status = String(errorObj.status ?? '').toUpperCase();
      if (status === 'INVALID_ARGUMENT') return true;
    }
  }

  const message = errorMessage(error).toLowerCase();
  return message.includes('invalid argument') || message.includes('invalid_argument');
}
