import {
  GoogleGenAI,
  FileState,
  MediaResolution,
  type Part,
  type GenerateContentParameters,
} from '@google/genai';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { isServerAnalysisError, ServerAnalysisError } from './analysisErrors.js';
import { buildSystemInstruction, buildUserPrompt } from './buildPrompt.js';
import {
  detectRejectedField,
  isInvalidArgumentError,
  logGeminiErrorResponse,
  logGeminiRequestPayload,
  logGeminiSuccessResponse,
  type GenerateContentAttemptOptions,
} from './geminiDebug.js';
import {
  errorMessage,
  GEMINI_FILES_GET_ENDPOINT,
  GEMINI_FILES_UPLOAD_ENDPOINT,
  GEMINI_GENERATE_ENDPOINT,
  INTERACTIONS_CREATE_ENDPOINT,
  isModelUnavailableError,
  logGeminiFailure,
  logGeminiModel,
} from './geminiLogger.js';
import {
  invalidateModelCache,
  normalizeModelId,
  resolveLegacyAnalysisModel,
} from './geminiModelResolver.js';
import {
  extractPlayerGroundingFrames,
  logPlayerGroundingExtraction,
  type PlayerGroundingFramesResult,
} from './playerFrameMarker.js';
import { parseGeminiJson, uncertainAnalysisResponse } from './parseResponse.js';
import type { AnalysisRequestMetadata, AnalyseVideoApiResponse } from './types.js';
import { normalizeAnalysisVideo } from './normalizeAnalysisVideo.js';
import { NARRATIVE_RETRY_SUFFIX } from './narrativeConsistency.js';
import { resolveAnalysisPipeline } from './analysisPipelineConfig.js';
import { analyseVideoWithDenseTimeline } from './denseTimelineAnalysis.js';

const MAX_PROCESSING_WAIT_MS = 90_000;
const FILE_POLL_MS = 2_000;
const MAX_MODEL_ATTEMPTS = 8;

/** Raised when Gemini Files API marks an uploaded video as FAILED (eligible for one re-upload retry). */
class GeminiFileFailedError extends Error {
  constructor(
    message: string,
    readonly fileName: string,
    readonly fileError: unknown
  ) {
    super(message);
    this.name = 'GeminiFileFailedError';
  }
}

function summarizeGeminiFile(file: {
  name?: string;
  state?: FileState;
  mimeType?: string;
  sizeBytes?: string;
  error?: { message?: string; code?: number; details?: Record<string, unknown>[] };
}) {
  return {
    fileName: file.name,
    state: file.state,
    mimeType: file.mimeType,
    sizeBytes: file.sizeBytes,
    error: file.error
      ? {
          message: file.error.message,
          code: file.error.code,
          details: file.error.details,
        }
      : null,
  };
}

/** Temporarily disabled — rethrow the original SDK error after logging. */
function logAndRethrowGeminiError(
  error: unknown,
  modelName: string,
  operation: string
): never {
  logGeminiFailure({ model: modelName, operation, error });
  throw error;
}

function getApiKey(): string {
  const key = process.env.GEMINI_API_KEY?.trim();
  if (!key || key === 'PASTE_KEY_HERE') {
    throw new ServerAnalysisError(
      'GEMINI_API_KEY is not set on the server',
      'MISSING_API_KEY'
    );
  }
  return key;
}

interface GeminiVideoFileRef {
  uri: string;
  mimeType: string;
}

/**
 * Ensures the MIME type sent in fileData matches what Gemini assigned at upload.
 * Uses uploadedFile.mimeType as the single source for generateContent fileData.
 */
function resolveGeminiVideoFileForGenerateContent(params: {
  localDetectedMimeType: string;
  uploadedMimeType: string;
  activeFile: GeminiVideoFileRef;
}): GeminiVideoFileRef {
  const fileDataMimeType = params.uploadedMimeType;

  console.log('[Gemini] File MIME types', {
    localDetectedMimeType: params.localDetectedMimeType,
    uploadedFileMimeType: params.uploadedMimeType,
    activeFileMimeType: params.activeFile.mimeType,
    fileDataMimeType,
  });

  if (params.uploadedMimeType !== params.activeFile.mimeType) {
    throw new ServerAnalysisError(
      `Gemini file MIME mismatch before generateContent: upload=${params.uploadedMimeType}, active=${params.activeFile.mimeType}`,
      'GEMINI_PROCESSING_FAILED'
    );
  }

  if (fileDataMimeType !== params.activeFile.mimeType) {
    throw new ServerAnalysisError(
      `Gemini fileData MIME mismatch: fileData=${fileDataMimeType}, active=${params.activeFile.mimeType}`,
      'GEMINI_PROCESSING_FAILED'
    );
  }

  return {
    uri: params.activeFile.uri,
    mimeType: fileDataMimeType,
  };
}

async function waitForFileActive(
  ai: GoogleGenAI,
  fileName: string,
  modelName: string
): Promise<{ uri: string; mimeType: string }> {
  const started = Date.now();
  let file = await ai.files.get({ name: fileName });
  let pollCount = 0;

  while (file.state !== FileState.ACTIVE) {
    pollCount += 1;
    console.log('[Gemini] File processing poll', {
      model: modelName,
      pollCount,
      elapsedMs: Date.now() - started,
      ...summarizeGeminiFile({ ...file, name: file.name ?? fileName }),
    });

    if (file.state === FileState.FAILED) {
      const summary = summarizeGeminiFile({ ...file, name: file.name ?? fileName });
      console.error('[Gemini] File processing FAILED', {
        model: modelName,
        pollCount,
        elapsedMs: Date.now() - started,
        ...summary,
      });
      throw new GeminiFileFailedError(
        file.error?.message?.trim() ||
          'Gemini failed to process the uploaded video',
        fileName,
        summary.error
      );
    }

    if (Date.now() - started > MAX_PROCESSING_WAIT_MS) {
      console.error('[Gemini] File processing timed out', {
        model: modelName,
        pollCount,
        elapsedMs: Date.now() - started,
        ...summarizeGeminiFile({ ...file, name: file.name ?? fileName }),
      });
      throw new ServerAnalysisError(
        'Gemini video processing timed out',
        'GEMINI_PROCESSING_FAILED'
      );
    }

    await new Promise((resolve) => setTimeout(resolve, FILE_POLL_MS));
    file = await ai.files.get({ name: fileName });
  }

  if (!file.uri || !file.mimeType) {
    throw new ServerAnalysisError(
      'Gemini returned an incomplete file reference',
      'GEMINI_PROCESSING_FAILED'
    );
  }

  console.log('[Gemini] Video file ACTIVE', {
    model: modelName,
    fileName,
    pollCount,
    elapsedMs: Date.now() - started,
    mimeType: file.mimeType,
    sizeBytes: file.sizeBytes,
  });
  return { uri: file.uri, mimeType: file.mimeType };
}

async function uploadNormalizedVideoForAnalysis(params: {
  ai: GoogleGenAI;
  modelName: string;
  normalizedVideoPath: string;
  uploadMimeType: string;
  displayName: string;
  localDetectedMimeType: string;
  originalBytes: number;
  normalizedWidth: number;
  normalizedHeight: number;
  appliedRotation: number;
  contentOrder: string[];
}): Promise<{
  uploadedFileName: string;
  uploadedMimeType: string;
  activeFile: { uri: string; mimeType: string };
}> {
  const uploadedFile = await params.ai.files
    .upload({
      file: params.normalizedVideoPath,
      config: {
        mimeType: params.uploadMimeType,
        displayName: params.displayName,
      },
    })
    .catch((error: unknown) =>
      logAndRethrowGeminiError(error, params.modelName, GEMINI_FILES_UPLOAD_ENDPOINT)
    );

  if (!uploadedFile.name) {
    throw new ServerAnalysisError(
      'Gemini file upload did not return a file name',
      'GEMINI_PROCESSING_FAILED'
    );
  }

  if (!uploadedFile.mimeType) {
    throw new ServerAnalysisError(
      'Gemini file upload did not return a MIME type',
      'GEMINI_PROCESSING_FAILED'
    );
  }

  console.log('[Gemini] Video uploaded to Files API', {
    model: params.modelName,
    fileName: uploadedFile.name,
    bytes: params.originalBytes,
    localDetectedMimeType: params.localDetectedMimeType,
    uploadMimeTypeDeclared: params.uploadMimeType,
    uploadedFileMimeType: uploadedFile.mimeType,
    appliedRotation: params.appliedRotation,
    normalizedVideoPath: params.normalizedVideoPath,
    normalizedWidth: params.normalizedWidth,
    normalizedHeight: params.normalizedHeight,
    contentOrder: params.contentOrder,
  });

  logGeminiModel(params.modelName, GEMINI_FILES_GET_ENDPOINT);
  const activeFile = await waitForFileActive(params.ai, uploadedFile.name, params.modelName);

  return {
    uploadedFileName: uploadedFile.name,
    uploadedMimeType: uploadedFile.mimeType,
    activeFile,
  };
}

/** Full uploaded video — no videoMetadata clipping. */
function buildFullVideoPart(readyFile: { uri: string; mimeType: string }): Part {
  return {
    fileData: {
      fileUri: readyFile.uri,
      mimeType: readyFile.mimeType,
    },
  };
}

function buildInlineImagePart(base64: string, mimeType: string): Part {
  return {
    inlineData: {
      mimeType,
      data: base64,
    },
  };
}

function collectReferenceImages(groundingFrames: PlayerGroundingFramesResult): string[] {
  const referenceImages: string[] = [];
  if (groundingFrames.identityReferenceCropsBase64?.length) {
    referenceImages.push(...groundingFrames.identityReferenceCropsBase64);
  } else if (groundingFrames.cleanCropBase64) {
    referenceImages.push(groundingFrames.cleanCropBase64);
  }
  if (groundingFrames.cleanFrameBase64) referenceImages.push(groundingFrames.cleanFrameBase64);
  if (groundingFrames.markedFrameBase64) referenceImages.push(groundingFrames.markedFrameBase64);
  if (groundingFrames.nearbyCropBase64) {
    referenceImages.push(...groundingFrames.nearbyCropBase64);
  }
  return referenceImages;
}

function buildContentParts(
  readyFile: { uri: string; mimeType: string },
  metadata: AnalysisRequestMetadata,
  groundingFrames: PlayerGroundingFramesResult,
  attempt: GenerateContentAttemptOptions,
  extraInstruction = ''
): Part[] {
  const referenceImages = collectReferenceImages(groundingFrames);
  const systemInstruction = buildSystemInstruction();
  const userPrompt = buildUserPrompt(metadata, referenceImages.length, extraInstruction);
  const promptText = attempt.inlineSystemInstruction
    ? `${systemInstruction}\n\n${userPrompt}`
    : userPrompt;

  const parts: Part[] = [];

  for (const imageBase64 of referenceImages) {
    parts.push(buildInlineImagePart(imageBase64, groundingFrames.mimeType));
  }

  parts.push(buildFullVideoPart(readyFile));
  parts.push({ text: promptText });

  return parts;
}

function buildGenerateContentPayload(
  modelName: string,
  readyFile: { uri: string; mimeType: string },
  metadata: AnalysisRequestMetadata,
  groundingFrames: PlayerGroundingFramesResult,
  attempt: GenerateContentAttemptOptions,
  extraInstruction = ''
): GenerateContentParameters {
  const systemInstruction = buildSystemInstruction();

  const config: GenerateContentParameters['config'] = {
    responseMimeType: 'application/json',
    temperature: 0.15,
    topP: 0.95,
    mediaResolution: MediaResolution.MEDIA_RESOLUTION_HIGH,
  };

  if (!attempt.inlineSystemInstruction) {
    config.systemInstruction = systemInstruction;
  }

  return {
    model: modelName,
    contents: [
      {
        role: 'user',
        parts: buildContentParts(readyFile, metadata, groundingFrames, attempt, extraInstruction),
      },
    ],
    config,
  };
}

async function callGenerateContent(
  ai: GoogleGenAI,
  payload: GenerateContentParameters,
  attempt: GenerateContentAttemptOptions
): Promise<string> {
  logGeminiRequestPayload(GEMINI_GENERATE_ENDPOINT, payload, attempt);

  const result = await ai.models.generateContent(payload);

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
    attempt
  );

  const text = result.text;
  if (!text?.trim()) {
    throw new ServerAnalysisError(
      'Gemini generateContent returned an empty response',
      'GEMINI_PROCESSING_FAILED'
    );
  }

  return text;
}

async function analyzeViaGenerateContent(
  ai: GoogleGenAI,
  modelName: string,
  readyFile: { uri: string; mimeType: string },
  metadata: AnalysisRequestMetadata,
  groundingFrames: PlayerGroundingFramesResult,
  extraInstruction = ''
): Promise<string> {
  logGeminiModel(modelName, GEMINI_GENERATE_ENDPOINT);

  const defaultAttempt: GenerateContentAttemptOptions = {
    label: 'clean-marked-frame-full-video',
    inlineSystemInstruction: false,
  };

  try {
    const payload = buildGenerateContentPayload(
      modelName,
      readyFile,
      metadata,
      groundingFrames,
      defaultAttempt,
      extraInstruction
    );
    return await callGenerateContent(ai, payload, defaultAttempt);
  } catch (firstError) {
    logGeminiErrorResponse(GEMINI_GENERATE_ENDPOINT, firstError, defaultAttempt);

    if (!isInvalidArgumentError(firstError)) {
      throw firstError;
    }

    const rejectedField = detectRejectedField(firstError);
    console.error('[Gemini] Invalid argument — rejected field:', {
      rejectedField: rejectedField ?? 'unknown (see fieldViolations above)',
    });

    if (rejectedField === 'systemInstruction') {
      const inlineAttempt: GenerateContentAttemptOptions = {
        label: 'clean-marked-frame-full-video-inline-system',
        inlineSystemInstruction: true,
      };

      console.warn('[Gemini] Retrying generateContent with inlined systemInstruction');
      const payload = buildGenerateContentPayload(
        modelName,
        readyFile,
        metadata,
        groundingFrames,
        inlineAttempt,
        extraInstruction
      );
      return await callGenerateContent(ai, payload, inlineAttempt);
    }

    throw firstError;
  }
}

/** Fallback only — used when generateContent fails for non-model reasons. */
async function analyzeViaInteractions(
  ai: GoogleGenAI,
  modelName: string,
  readyFile: { uri: string; mimeType: string },
  metadata: AnalysisRequestMetadata,
  groundingFrames: PlayerGroundingFramesResult,
  extraInstruction = ''
): Promise<string> {
  logGeminiModel(modelName, INTERACTIONS_CREATE_ENDPOINT);

  const referenceImages = collectReferenceImages(groundingFrames);
  const userPrompt = buildUserPrompt(metadata, referenceImages.length, extraInstruction);

  const input: Array<
    | { type: 'image'; data: string; mime_type: string }
    | { type: 'video'; uri: string; mime_type: string }
    | { type: 'text'; text: string }
  > = [];

  for (const imageBase64 of referenceImages) {
    input.push({
      type: 'image',
      data: imageBase64,
      mime_type: groundingFrames.mimeType,
    });
  }

  input.push({
    type: 'video',
    uri: readyFile.uri,
    mime_type: readyFile.mimeType,
  });
  input.push({ type: 'text', text: userPrompt });

  const requestPayload = {
    model: modelName,
    system_instruction: buildSystemInstruction(),
    input,
    generation_config: {
      temperature: 0.15,
    },
    response_format: {
      type: 'text' as const,
      mime_type: 'application/json',
    },
  };

  console.log('[Gemini] ── REQUEST PAYLOAD ──', {
    operation: INTERACTIONS_CREATE_ENDPOINT,
  });
  console.log(JSON.stringify(requestPayload, null, 2));

  try {
    const interaction = await ai.interactions.create(requestPayload);

    console.log('[Gemini] ── RESPONSE BODY (success) ──', {
      operation: INTERACTIONS_CREATE_ENDPOINT,
    });
    console.log(JSON.stringify(interaction, null, 2));

    const text = interaction.output_text;
    if (!text?.trim()) {
      throw new ServerAnalysisError(
        'Gemini Interactions API returned an empty response',
        'GEMINI_PROCESSING_FAILED'
      );
    }

    return text;
  } catch (error) {
    logGeminiErrorResponse(INTERACTIONS_CREATE_ENDPOINT, error, {
      label: 'interactions-fallback',
      inlineSystemInstruction: false,
    });
    throw error;
  }
}

async function runAnalysisWithModel(
  ai: GoogleGenAI,
  modelName: string,
  readyFile: { uri: string; mimeType: string },
  metadata: AnalysisRequestMetadata,
  groundingFrames: PlayerGroundingFramesResult,
  extraInstruction = ''
): Promise<string> {
  try {
    return await analyzeViaGenerateContent(
      ai,
      modelName,
      readyFile,
      metadata,
      groundingFrames,
      extraInstruction
    );
  } catch (generateError) {
    logGeminiFailure({
      model: modelName,
      operation: GEMINI_GENERATE_ENDPOINT,
      error: generateError,
    });

    if (isModelUnavailableError(generateError)) {
      throw generateError;
    }

    if (isInvalidArgumentError(generateError)) {
      throw generateError;
    }

    console.warn(
      '[Gemini] generateContent failed — retrying with interactions.create (same model, same file)'
    );
    return analyzeViaInteractions(
      ai,
      modelName,
      readyFile,
      metadata,
      groundingFrames,
      extraInstruction
    );
  }
}

/**
 * Sends the clip to Gemini for football coaching analysis.
 * Routes to dense_timeline (default) or legacy pipeline via ANALYSIS_PIPELINE env.
 */
export async function analyseVideoWithGemini(params: {
  requestId: string;
  videoBuffer: Buffer;
  mimeType: string;
  originalName: string;
  metadata: AnalysisRequestMetadata;
}): Promise<AnalyseVideoApiResponse> {
  const pipeline = resolveAnalysisPipeline();
  console.log('[Analysis] Pipeline', { mode: pipeline, requestId: params.requestId });

  if (pipeline === 'dense_timeline') {
    return analyseVideoWithDenseTimeline(params);
  }

  return analyseVideoWithGeminiLegacy(params);
}

/** Legacy single-pass video + sparse reference frame analysis. */
async function analyseVideoWithGeminiLegacy(params: {
  requestId: string;
  videoBuffer: Buffer;
  mimeType: string;
  originalName: string;
  metadata: AnalysisRequestMetadata;
}): Promise<AnalyseVideoApiResponse> {
  const apiKey = getApiKey();

  const tempDir = await fs.mkdtemp(path.join(os.tmpdir(), 'coach-ai-'));
  const safeName = params.originalName.replace(/[^\w.-]+/g, '_') || 'clip.mp4';
  const tempPath = path.join(tempDir, safeName);

  const ai = new GoogleGenAI({ apiKey });
  let uploadedFileName: string | null = null;
  const failedModels: string[] = [];

  try {
    await fs.writeFile(tempPath, params.videoBuffer);

    const normalizedAnalysisVideoPath = path.join(tempDir, `normalized-${safeName}`);
    const debugMarkedFramePath = path.join(tempDir, 'grounding-marked-debug.jpg');
    const normalizedMedia = await normalizeAnalysisVideo(tempPath, normalizedAnalysisVideoPath);

    const groundingFrames = await extractPlayerGroundingFrames(
      normalizedMedia.normalizedAnalysisVideoPath,
      params.metadata.playerSelection,
      params.metadata.clip.durationMs,
      debugMarkedFramePath
    );
    logPlayerGroundingExtraction(params.metadata.playerSelection, groundingFrames);

    if (groundingFrames.debugMarkedFramePath) {
      console.log('[GeminiGrounding] Debug marked frame saved', {
        path: groundingFrames.debugMarkedFramePath,
      });
    }

    if (params.metadata.playerTracking) {
      console.log('[Analysis] User-confirmed tracking data', {
        previewAccepted: params.metadata.playerTracking.previewAccepted,
        keyframeCount: params.metadata.playerTracking.keyframes.length,
        userCorrections: params.metadata.playerTracking.userCorrections,
        confirmedIntervals: params.metadata.playerTracking.confirmedIntervals,
        lostIntervals: params.metadata.playerTracking.lostIntervals,
      });
    }

    const analysisStarted = Date.now();

    let modelName = await resolveLegacyAnalysisModel(ai, failedModels);
    logGeminiModel(modelName, GEMINI_FILES_UPLOAD_ENDPOINT);

    // Re-encoded (any non-zero rotation) is always H.264/AAC MP4 — do not declare the phone's original MIME.
    const uploadMimeType =
      normalizedMedia.appliedRotation !== 0 ? 'video/mp4' : params.mimeType;

    const contentOrder = groundingFrames.success
      ? ['reference-crops', 'clean-frame', 'marked-frame', 'normalized-video', 'coaching-prompt']
      : ['normalized-video', 'coaching-prompt'];

    const uploadArgs = {
      ai,
      modelName,
      normalizedVideoPath: normalizedMedia.normalizedAnalysisVideoPath,
      uploadMimeType,
      displayName: `normalized-${safeName}`,
      localDetectedMimeType: params.mimeType,
      originalBytes: params.videoBuffer.length,
      normalizedWidth: normalizedMedia.outputWidth,
      normalizedHeight: normalizedMedia.outputHeight,
      appliedRotation: normalizedMedia.appliedRotation,
      contentOrder,
    };

    let uploadedMimeType: string;
    let activeFile: { uri: string; mimeType: string };

    try {
      const first = await uploadNormalizedVideoForAnalysis(uploadArgs);
      uploadedFileName = first.uploadedFileName;
      uploadedMimeType = first.uploadedMimeType;
      activeFile = first.activeFile;
    } catch (firstUploadError) {
      if (!(firstUploadError instanceof GeminiFileFailedError)) {
        throw firstUploadError;
      }

      console.warn('[Gemini] File FAILED — attempting one automatic re-upload', {
        failedFileName: firstUploadError.fileName,
        fileError: firstUploadError.fileError,
        message: firstUploadError.message,
      });

      try {
        await ai.files.delete({ name: firstUploadError.fileName });
      } catch (deleteError) {
        console.warn('[Gemini] Failed to delete FAILED file before retry', {
          fileName: firstUploadError.fileName,
          message: errorMessage(deleteError),
        });
      }

      uploadedFileName = null;

      try {
        const retry = await uploadNormalizedVideoForAnalysis({
          ...uploadArgs,
          displayName: `normalized-retry-${safeName}`,
        });
        uploadedFileName = retry.uploadedFileName;
        uploadedMimeType = retry.uploadedMimeType;
        activeFile = retry.activeFile;
        console.log('[Gemini] Re-upload succeeded after FAILED', {
          fileName: retry.uploadedFileName,
        });
      } catch (retryError) {
        if (retryError instanceof GeminiFileFailedError) {
          throw new ServerAnalysisError(
            retryError.message || 'Gemini failed to process the uploaded video',
            'GEMINI_PROCESSING_FAILED'
          );
        }
        throw retryError;
      }
    }

    const readyFile = resolveGeminiVideoFileForGenerateContent({
      localDetectedMimeType: uploadMimeType,
      uploadedMimeType,
      activeFile,
    });

    let lastError: unknown;
    let narrativeRetryUsed = false;

    while (failedModels.length < MAX_MODEL_ATTEMPTS) {
      modelName = await resolveLegacyAnalysisModel(ai, failedModels);

      try {
        const parseOptions = {
          mode: params.metadata.mode === 'COACH_ME' ? 'COACH_ME' as const : params.metadata.mode,
          playerTracking: params.metadata.playerTracking,
          playerSelection: params.metadata.playerSelection,
        };

        const requestAnalysis = async (extraInstruction: string): Promise<string> =>
          runAnalysisWithModel(
            ai,
            modelName,
            readyFile,
            params.metadata,
            groundingFrames,
            extraInstruction
          );

        let text = await requestAnalysis('');
        try {
          return parseGeminiJson(text, parseOptions);
        } catch (parseError) {
          if (
            isServerAnalysisError(parseError) &&
            parseError.code === 'NARRATIVE_TIMELINE_MISMATCH' &&
            !narrativeRetryUsed
          ) {
            narrativeRetryUsed = true;
            console.warn('[NarrativeConsistency] Retrying Gemini once after timeline mismatch');
            text = await requestAnalysis(NARRATIVE_RETRY_SUFFIX);
            try {
              return parseGeminiJson(text, parseOptions);
            } catch (retryParseError) {
              if (
                isServerAnalysisError(retryParseError) &&
                retryParseError.code === 'NARRATIVE_TIMELINE_MISMATCH'
              ) {
                console.warn(
                  '[NarrativeConsistency] Retry still contradicted timeline — returning uncertain response'
                );
                return uncertainAnalysisResponse();
              }
              throw retryParseError;
            }
          }
          throw parseError;
        }
      } catch (error) {
        lastError = error;

        if (isModelUnavailableError(error)) {
          const failedId = normalizeModelId(modelName);
          failedModels.push(failedId);
          invalidateModelCache();
          console.warn(
            `[Gemini] Model "${failedId}" unavailable for this API key — trying next discovered model`
          );
          continue;
        }

        throw error;
      }
    }

    throw lastError ?? new Error('All discovered Gemini models failed');
  } catch (error) {
    if (error instanceof ServerAnalysisError) throw error;
    throw error;
  } finally {
    if (uploadedFileName) {
      try {
        await ai.files.delete({ name: uploadedFileName });
      } catch (deleteError) {
        console.warn('[Gemini] Failed to delete uploaded file', {
          fileName: uploadedFileName,
          message: errorMessage(deleteError),
        });
      }
    }
    try {
      await fs.rm(tempDir, { recursive: true, force: true });
    } catch {
      // Best-effort cleanup
    }
  }
}
