import { spawn } from 'node:child_process';
import { copyFile } from 'node:fs/promises';
import { FFMPEG_PATH } from './ffmpegPath.js';
import {
  orientationFromSize,
  probeVideoOrientationPlan,
  rotationToFfmpegVideoFilter,
  type CanonicalRotation,
  type VideoOrientation,
} from './videoOrientation.js';

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
    const rotate = rotationToFfmpegVideoFilter(rotation);
    // Cap resolution + ultrafast to avoid Railway OOM (close code null / "unknown").
    const scale = "scale='min(1280,iw)':-2";
    const vf = rotate ? `${rotate},${scale}` : scale;
    const args = [
      '-hide_banner',
      '-loglevel',
      'error',
      '-noautorotate',
      '-i',
      sourcePath,
      '-vf',
      vf,
      '-c:v',
      'libx264',
      '-preset',
      'ultrafast',
      '-crf',
      '28',
      '-threads',
      '1',
      '-c:a',
      'aac',
      '-b:a',
      '96k',
      '-movflags',
      '+faststart',
      '-y',
      outputPath,
    ];

    console.log('[AnalysisMedia] ffmpeg normalize start', { ffmpeg: FFMPEG_PATH, rotation, vf });

    const stderr: Buffer[] = [];
    const proc = spawn(FFMPEG_PATH, args);

    proc.stderr.on('data', (chunk: Buffer) => stderr.push(chunk));
    proc.on('error', (err) => {
      reject(new Error(`ffmpeg spawn failed (${FFMPEG_PATH}): ${err.message}`));
    });
    proc.on('close', (code, signal) => {
      if (code === 0) {
        resolve();
        return;
      }
      const detail = Buffer.concat(stderr).toString('utf8').trim();
      reject(
        new Error(
          `ffmpeg video normalization failed (code ${code ?? 'unknown'}${signal ? `, signal ${signal}` : ''}, bin ${FFMPEG_PATH}): ${detail || '(no stderr — often OOM/SIGKILL)'}`
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
    ffmpeg: FFMPEG_PATH,
  });

  return result;
}
