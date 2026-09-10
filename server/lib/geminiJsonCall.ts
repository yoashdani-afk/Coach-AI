import {
  GoogleGenAI,
  MediaResolution,
  type GenerateContentParameters,
  type Part,
} from '@google/genai';
import { ServerAnalysisError } from './analysisErrors.js';
import { logGeminiRequestPayload, logGeminiSuccessResponse } from './geminiDebug.js';
import { GEMINI_GENERATE_ENDPOINT, logGeminiFailure } from './geminiLogger.js';
import { logVideoUnderstandingJson } from './videoUnderstandingLog.js';

function summarizeGeminiParts(parts: Part[]): {
  textParts: number;
  inlineImages: number;
  fileVideoParts: number;
  totalParts: number;
} {
  let textParts = 0;
  let inlineImages = 0;
  let fileVideoParts = 0;

  for (const part of parts) {
    if ('text' in part && part.text) textParts += 1;
    if ('inlineData' in part && part.inlineData?.mimeType?.startsWith('image/')) inlineImages += 1;
    if ('fileData' in part && part.fileData) fileVideoParts += 1;
  }

  return { textParts, inlineImages, fileVideoParts, totalParts: parts.length };
}

export async function callGeminiJson(params: {
  ai: GoogleGenAI;
  modelName: string;
  label: string;
  systemInstruction: string;
  parts: Part[];
  temperature?: number;
  requestId?: string;
}): Promise<string> {
  const payloadSummary = summarizeGeminiParts(params.parts);
  logVideoUnderstandingJson(
    'GEMINI REQUEST PAYLOAD',
    {
      requestId: params.requestId,
      label: params.label,
      model: params.modelName,
      ...payloadSummary,
      originalMp4Sent: payloadSummary.fileVideoParts > 0,
      jpegFramesSent: payloadSummary.inlineImages,
    },
    params.requestId
  );
  const payload: GenerateContentParameters = {
    model: params.modelName,
    contents: [{ role: 'user', parts: params.parts }],
    config: {
      systemInstruction: params.systemInstruction,
      responseMimeType: 'application/json',
      temperature: params.temperature ?? 0.2,
      topP: 0.9,
      mediaResolution: MediaResolution.MEDIA_RESOLUTION_HIGH,
    },
  };

  logGeminiRequestPayload(GEMINI_GENERATE_ENDPOINT, payload, {
    label: params.label,
    inlineSystemInstruction: false,
  });

  try {
    const result = await params.ai.models.generateContent(payload);
    logGeminiSuccessResponse(
      GEMINI_GENERATE_ENDPOINT,
      {
        text: result.text,
        candidates: result.candidates,
        usageMetadata: result.usageMetadata,
        promptFeedback: result.promptFeedback,
        sdkHttpResponse: result.sdkHttpResponse,
        modelVersion: result.modelVersion ?? null,
        responseId: result.responseId ?? null,
      },
      { label: params.label, inlineSystemInstruction: false }
    );

    const text = result.text;
    if (!text?.trim()) {
      throw new ServerAnalysisError(
        `Gemini ${params.label} returned an empty response`,
        'GEMINI_PROCESSING_FAILED'
      );
    }
    return text;
  } catch (error) {
    logGeminiFailure({ model: params.modelName, operation: params.label, error });
    throw error;
  }
}
