import { spawn } from 'node:child_process';
import { mkdir, readdir, readFile, rm } from 'node:fs/promises';
import path from 'node:path';
import ffmpegInstaller from '@ffmpeg-installer/ffmpeg';
import sharp from 'sharp';
import type { DenseFrame, DenseFrameExtractionResult } from './factualEventTypes.js';
import { orientationFromSize } from './videoOrientation.js';

const FFMPEG_PATH = ffmpegInstaller.path;
export const DENSE_FRAME_FPS = 5;
const MAX_FRAME_WIDTH = 960;
const JPEG_QUALITY = 82;

function runFfmpegDenseExtract(
  videoPath: string,
  outputDir: string,
  fps: number,
  durationSec: number
): Promise<void> {
  return new Promise((resolve, reject) => {
    const maxFrames = Math.max(1, Math.ceil(durationSec * fps));
    const scaleFilter = `fps=${fps},scale='min(${MAX_FRAME_WIDTH},iw)':-2`;
    const args = [
      '-hide_banner',
      '-loglevel',
      'error',
      '-noautorotate',
      '-i',
      videoPath,
      '-vf',
      scaleFilter,
      '-frames:v',
      String(maxFrames),
      '-q:v',
      '4',
      path.join(outputDir, 'frame_%06d.jpg'),
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
          `ffmpeg dense frame extraction failed (code ${code ?? 'unknown'}): ${Buffer.concat(stderr).toString('utf8').trim()}`
        )
      );
    });
  });
}

/** Extract sequential JPEG frames from a display-oriented normalized analysis video. */
export async function extractDenseFrames(
  normalizedVideoPath: string,
  videoDurationMs: number,
  fps = DENSE_FRAME_FPS
): Promise<DenseFrameExtractionResult> {
  const outputDir = path.join(path.dirname(normalizedVideoPath), 'dense-frames');
  await mkdir(outputDir, { recursive: true });

  const durationSec = Math.max(0.1, videoDurationMs / 1000);
  const intervalMs = 1000 / fps;

  try {
    await runFfmpegDenseExtract(normalizedVideoPath, outputDir, fps, durationSec);

    const fileNames = (await readdir(outputDir))
      .filter((name) => name.startsWith('frame_') && name.endsWith('.jpg'))
      .sort();

    const frames: DenseFrame[] = [];
    let width = 0;
    let height = 0;

    for (let index = 0; index < fileNames.length; index += 1) {
      const filePath = path.join(outputDir, fileNames[index]!);
      const raw = await readFile(filePath);
      const jpeg = await sharp(raw).jpeg({ quality: JPEG_QUALITY }).toBuffer();
      const meta = await sharp(jpeg).metadata();
      const frameWidth = meta.width ?? 0;
      const frameHeight = meta.height ?? 0;
      width = frameWidth || width;
      height = frameHeight || height;
      const orientation = orientationFromSize(frameWidth, frameHeight);
      const timestampMs = Math.min(videoDurationMs, Math.round(index * intervalMs));

      console.log('[VideoEvidence] FRAME', {
        timestampMs,
        width: frameWidth,
        height: frameHeight,
        orientation,
      });

      frames.push({
        timestampMs,
        jpegBase64: jpeg.toString('base64'),
        width: frameWidth,
        height: frameHeight,
        orientation,
      });
    }

    console.log('[DenseFrames]', {
      videoDurationMs,
      fps,
      frameCount: frames.length,
      width,
      height,
    });

    return {
      frames,
      width,
      height,
      fps,
      videoDurationMs,
    };
  } finally {
    await rm(outputDir, { recursive: true, force: true }).catch(() => undefined);
  }
}
