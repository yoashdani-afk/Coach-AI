import { spawn } from 'node:child_process';
import { copyFile } from 'node:fs/promises';
import ffmpegInstaller from '@ffmpeg-installer/ffmpeg';
import {
  orientationFromSize,
  probeVideoOrientationPlan,
  rotationToFfmpegVideoFilter,
  type CanonicalRotation,
  type VideoOrientation,
} from './videoOrientation.js';

const FFMPEG_PATH = ffmpegInstaller.path;

export interface NormalizedAnalysisVideo {
  normalizedAnalysisVideoPath: string;
  originalWidth: number;
  originalHeight: number;
  outputWidth: number;
  outputHeight: number;
  appliedRotation: CanonicalRotation;
  orientation: VideoOrientation;
  /** True when a new temp file was written (caller should delete on cleanup). */
  isTemporary: boolean;
}

function runFfmpegNormalizeVideo(
  sourcePath: string,
  outputPath: string,
  rotation: CanonicalRotation
): Promise<void> {
  return new Promise((resolve, reject) => {
    const filter = rotationToFfmpegVideoFilter(rotation);
    const args = [
      '-hide_banner',
      '-loglevel',
      'error',
      '-noautorotate',
      '-i',
      sourcePath,
      ...(filter ? ['-vf', filter] : []),
      '-c:v',
      'libx264',
      '-preset',
      'fast',
      '-crf',
      '23',
      '-c:a',
      'aac',
      '-movflags',
      '+faststart',
      '-y',
      outputPath,
    ];

    const stderr: Buffer[] = [];
    const proc = spawn(FFMPEG_PATH, args);

    proc.stderr.on('data', (chunk: Buffer) => stderr.push(chunk));
    proc.on('error', reject);
    proc.on('close', (code) => {
      if (code === 0) {
        resolve();
        return;
      }
      reject(
        new Error(
          `ffmpeg video normalization failed (code ${code ?? 'unknown'}): ${Buffer.concat(stderr).toString('utf8').trim()}`
        )
      );
    });
  });
}

/**
 * Creates a display-oriented analysis video using the same orientation rules as player selection.
 * The returned path is the single source of truth for Gemini analysis and grounding frames.
 */
export async function normalizeAnalysisVideo(
  sourcePath: string,
  outputPath: string
): Promise<NormalizedAnalysisVideo> {
  const plan = await probeVideoOrientationPlan(sourcePath);

  if (plan.appliedRotation === 0) {
    await copyFile(sourcePath, outputPath);
  } else {
    await runFfmpegNormalizeVideo(sourcePath, outputPath, plan.appliedRotation);
  }

  const result: NormalizedAnalysisVideo = {
    normalizedAnalysisVideoPath: outputPath,
    originalWidth: plan.codedWidth,
    originalHeight: plan.codedHeight,
    outputWidth: plan.displayWidth,
    outputHeight: plan.displayHeight,
    appliedRotation: plan.appliedRotation,
    orientation: orientationFromSize(plan.displayWidth, plan.displayHeight),
    isTemporary: true,
  };

  console.log('[AnalysisMedia] NORMALIZED', {
    originalWidth: result.originalWidth,
    originalHeight: result.originalHeight,
    outputWidth: result.outputWidth,
    outputHeight: result.outputHeight,
    appliedRotation: result.appliedRotation,
    orientation: result.orientation,
  });

  return result;
}
