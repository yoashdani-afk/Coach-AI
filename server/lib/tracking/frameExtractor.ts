import { existsSync } from 'node:fs';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { spawn } from 'node:child_process';
import ffmpegInstaller from '@ffmpeg-installer/ffmpeg';
import type { ExtractedFrame } from './types.js';

const FFMPEG_PATH = ffmpegInstaller.path;
/** Inference frame width — keeps decode + detect fast while preserving aspect ratio. */
export const INFERENCE_MAX_WIDTH = 480;
export const PASS1_FPS = 7;
export const PASS2_FPS = 12;

export function computeSampleTimestamps(durationMs: number, fps: number): number[] {
  const intervalMs = Math.round(1000 / fps);
  const timestamps: number[] = [];
  for (let ms = 0; ms <= durationMs; ms += intervalMs) {
    timestamps.push(ms);
  }
  if (timestamps[timestamps.length - 1] !== durationMs) {
    timestamps.push(durationMs);
  }
  return timestamps;
}

function runFfmpeg(args: string[]): Promise<void> {
  return new Promise((resolve, reject) => {
    const proc = spawn(FFMPEG_PATH, args);
    let stderr = '';
    proc.stderr.on('data', (chunk: Buffer) => {
      stderr += chunk.toString();
    });
    proc.on('close', (code) => {
      if (code === 0) resolve();
      else reject(new Error(`ffmpeg exited ${code}: ${stderr.slice(-400)}`));
    });
    proc.on('error', reject);
  });
}

function logFramePathRead(params: {
  framePath: string;
  stage: string;
  timestampMs?: number;
}): void {
  const exists = existsSync(params.framePath);
  console.log('[FrameExtract]', {
    framePath: params.framePath,
    exists,
    stage: params.stage,
    timestampMs: params.timestampMs ?? null,
  });
  if (!exists) {
    throw new Error(`ENOENT: frame file missing before read — ${params.framePath} (${params.stage})`);
  }
}

async function readExtractedJpegs(
  outDir: string,
  fps: number,
  durationMs: number,
  stage: string,
  timeOffsetMs = 0
): Promise<ExtractedFrame[]> {
  const sharp = (await import('sharp')).default;
  const files = (await fs.readdir(outDir))
    .filter((f) => f.endsWith('.jpg') || f.endsWith('.jpeg'))
    .sort();

  const intervalMs = 1000 / fps;
  const frames: ExtractedFrame[] = [];

  for (let i = 0; i < files.length; i++) {
    const framePath = path.join(outDir, files[i]!);
    const timestampMs = Math.min(durationMs, Math.round(timeOffsetMs + i * intervalMs));
    logFramePathRead({ framePath, stage, timestampMs });

    const jpeg = await fs.readFile(framePath);
    if (jpeg.length === 0) {
      throw new Error(`Empty frame file: ${framePath}`);
    }

    const meta = await sharp(jpeg).metadata();
    frames.push({
      timestampMs,
      width: meta.width ?? INFERENCE_MAX_WIDTH,
      height: meta.height ?? Math.round(INFERENCE_MAX_WIDTH * 9 / 16),
      jpeg,
    });
  }

  return frames;
}

/** Single ffmpeg pass — loads JPEG buffers before temp dir cleanup. */
export async function extractVideoFrames(
  videoPath: string,
  durationMs: number,
  fps = PASS1_FPS,
  onProgress?: (extracted: number, total: number) => void
): Promise<ExtractedFrame[]> {
  const outDir = await fs.mkdtemp(path.join(os.tmpdir(), 'coach-ai-frames-'));
  const pattern = path.join(outDir, 'frame_%06d.jpg');
  const expected = computeSampleTimestamps(durationMs, fps).length;

  try {
    await runFfmpeg([
      '-hide_banner',
      '-loglevel',
      'error',
      '-i',
      videoPath,
      '-vf',
      `fps=${fps},scale='min(${INFERENCE_MAX_WIDTH},iw)':-1`,
      '-q:v',
      '4',
      pattern,
    ]);

    const frames = await readExtractedJpegs(outDir, fps, durationMs, 'pass1_full_clip');
    onProgress?.(frames.length, expected);
    return frames;
  } finally {
    await fs.rm(outDir, { recursive: true, force: true }).catch(() => undefined);
  }
}

/** Targeted segment extraction — must await buffer load before deleting outDir. */
export async function extractVideoSegmentFrames(
  videoPath: string,
  startMs: number,
  endMs: number,
  clipDurationMs: number,
  fps = PASS2_FPS
): Promise<ExtractedFrame[]> {
  const outDir = await fs.mkdtemp(path.join(os.tmpdir(), 'coach-ai-seg-'));
  const pattern = path.join(outDir, 'frame_%06d.jpg');
  const startSec = Math.max(0, startMs / 1000);
  const durationSec = Math.max(0.05, (endMs - startMs) / 1000);

  try {
    await runFfmpeg([
      '-hide_banner',
      '-loglevel',
      'error',
      '-ss',
      startSec.toFixed(3),
      '-i',
      videoPath,
      '-t',
      durationSec.toFixed(3),
      '-vf',
      `fps=${fps},scale='min(${INFERENCE_MAX_WIDTH},iw)':-1`,
      '-q:v',
      '4',
      pattern,
    ]);

    // CRITICAL: await in-buffer load before finally deletes outDir.
    // Returning the promise without await caused ENOENT race (frame_000002.jpg).
    return await readExtractedJpegs(outDir, fps, clipDurationMs, 'pass2_segment', startMs);
  } finally {
    await fs.rm(outDir, { recursive: true, force: true }).catch(() => undefined);
  }
}
