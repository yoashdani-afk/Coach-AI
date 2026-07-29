import { spawn } from 'node:child_process';
import ffmpegInstaller from '@ffmpeg-installer/ffmpeg';
import { GoogleGenAI } from '@google/genai';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { buildTrackingSystemInstruction, buildTrackingUserPrompt } from './buildTrackingPrompt.js';
import { resolveAnalysisModel } from './geminiModelResolver.js';
import {
  extractPlayerGroundingFrames,
  logPlayerGroundingExtraction,
} from './playerFrameMarker.js';
import {
  fallbackTrackingFromSelection,
  logTrackingPreviewStates,
  parseTrackingPreviewJson,
} from './parseTrackingPreview.js';
import type { AnalysisRequestMetadata, PlayerTrackingData } from './types.js';

const FFMPEG_PATH = ffmpegInstaller.path;
const FRAME_INTERVAL_MS = 750;
const MAX_FRAMES = 18;

async function extractFrameAt(videoPath: string, timestampSec: number): Promise<Buffer | null> {
  return new Promise((resolve) => {
    const args = [
      '-hide_banner',
      '-loglevel',
      'error',
      '-ss',
      timestampSec.toFixed(3),
      '-i',
      videoPath,
      '-frames:v',
      '1',
      '-vf',
      'scale=480:-1',
      '-f',
      'image2pipe',
      '-vcodec',
      'mjpeg',
      'pipe:1',
    ];

    const chunks: Buffer[] = [];
    const proc = spawn(FFMPEG_PATH, args);
    proc.stdout.on('data', (chunk: Buffer) => chunks.push(chunk));
    proc.on('close', (code) => {
      resolve(code === 0 && chunks.length > 0 ? Buffer.concat(chunks) : null);
    });
    proc.on('error', () => resolve(null));
  });
}

function getApiKey(): string | null {
  const key = process.env.GEMINI_API_KEY?.trim();
  if (!key || key === 'PASTE_KEY_HERE') return null;
  return key;
}

export async function trackPlayerPreviewFast(params: {
  videoBuffer: Buffer;
  mimeType: string;
  originalName: string;
  metadata: AnalysisRequestMetadata;
}): Promise<PlayerTrackingData> {
  const started = Date.now();
  const { playerSelection, clip } = params.metadata;
  const fallback = fallbackTrackingFromSelection(playerSelection, clip.durationMs);

  const tempDir = await fs.mkdtemp(path.join(os.tmpdir(), 'coach-ai-track-'));
  const safeName = params.originalName.replace(/[^\w.-]+/g, '_') || 'clip.mp4';
  const tempPath = path.join(tempDir, safeName);

  try {
    await fs.writeFile(tempPath, params.videoBuffer);

    const groundingFrames = await extractPlayerGroundingFrames(
      tempPath,
      playerSelection,
      clip.durationMs
    );
    logPlayerGroundingExtraction(playerSelection, groundingFrames);

    const apiKey = getApiKey();
    if (!apiKey) {
      console.warn('[TrackingPreview] No API key — using selection fallback');
      return fallback;
    }

    const sampleTimesMs: number[] = [];
    for (let ms = 0; ms <= clip.durationMs; ms += FRAME_INTERVAL_MS) {
      sampleTimesMs.push(ms);
      if (sampleTimesMs.length >= MAX_FRAMES) break;
    }
    if (sampleTimesMs[sampleTimesMs.length - 1] !== clip.durationMs) {
      sampleTimesMs.push(clip.durationMs);
    }

    const sampledFrames: { timestampMs: number; base64: string }[] = [];
    for (const timestampMs of sampleTimesMs) {
      const frame = await extractFrameAt(tempPath, timestampMs / 1000);
      if (frame) {
        sampledFrames.push({ timestampMs, base64: frame.toString('base64') });
      }
    }

    console.log('[TrackingPreview] Fast preview frames extracted', {
      frameCount: sampledFrames.length,
      durationMs: Date.now() - started,
    });

    if (sampledFrames.length === 0) {
      return fallback;
    }

    const ai = new GoogleGenAI({ apiKey });
    const modelName = await resolveAnalysisModel(ai, []);

    const parts: Array<{ inlineData?: { mimeType: string; data: string }; text?: string }> = [];

    if (groundingFrames.identityReferenceCropsBase64?.length) {
      for (const crop of groundingFrames.identityReferenceCropsBase64) {
        parts.push({ inlineData: { mimeType: 'image/jpeg', data: crop } });
      }
    } else {
      if (groundingFrames.cleanCropBase64) {
        parts.push({ inlineData: { mimeType: 'image/jpeg', data: groundingFrames.cleanCropBase64 } });
      }
      if (groundingFrames.markedFrameBase64) {
        parts.push({ inlineData: { mimeType: 'image/jpeg', data: groundingFrames.markedFrameBase64 } });
      }
    }

    for (const frame of sampledFrames) {
      parts.push({
        inlineData: { mimeType: 'image/jpeg', data: frame.base64 },
      });
    }

    parts.push({
      text: `${buildTrackingUserPrompt(params.metadata)}

The reference images identify the marked player. The following ${sampledFrames.length} still frames are sampled every ~${FRAME_INTERVAL_MS}ms from the clip (in chronological order). For each sampled timestamp, return a bounding box for the marked player in NORMALISED 0–1 coordinates (top-left x,y plus width,height relative to the full video frame).`,
    });

    const response = await ai.models.generateContent({
      model: modelName,
      contents: [{ role: 'user', parts }],
      config: {
        systemInstruction: buildTrackingSystemInstruction(),
        temperature: 0.15,
        responseMimeType: 'application/json',
      },
    });

    const text = response.text?.trim();
    if (!text) {
      console.warn('[TrackingPreview] Empty fast tracking response — fallback');
      return fallback;
    }

    const tracking = parseTrackingPreviewJson(text, fallback);
    logTrackingPreviewStates(tracking);

    console.log('[TrackingPreview] Fast preview complete', {
      keyframeCount: tracking.keyframes.length,
      durationMs: Date.now() - started,
    });

    return tracking;
  } catch (error) {
    console.warn('[TrackingPreview] Fast preview failed — fallback', {
      message: error instanceof Error ? error.message : String(error),
      durationMs: Date.now() - started,
    });
    return fallback;
  } finally {
    try {
      await fs.rm(tempDir, { recursive: true, force: true });
    } catch {
      // Best-effort
    }
  }
}
