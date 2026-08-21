import { spawn } from 'node:child_process';
import ffmpegInstaller from '@ffmpeg-installer/ffmpeg';
import sharp from 'sharp';
import {
  orientationFromSize,
  probeVideoOrientationPlan,
  type CanonicalRotation,
  type VideoOrientation,
} from './videoOrientation.js';

const FFMPEG_PATH = ffmpegInstaller.path;

export type SelectionFrameOrientation = VideoOrientation;

export interface SelectionFrameResult {
  success: boolean;
  jpeg?: Buffer;
  width?: number;
  height?: number;
  orientation?: SelectionFrameOrientation;
  timestampMs: number;
  error?: string;
}

function runFfmpegExtractJpeg(videoPath: string, timestampSec: number): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    const args = [
      '-hide_banner',
      '-loglevel',
      'error',
      '-noautorotate',
      '-ss',
      timestampSec.toFixed(3),
      '-i',
      videoPath,
      '-frames:v',
      '1',
      '-f',
      'image2pipe',
      '-vcodec',
      'mjpeg',
      'pipe:1',
    ];

    const chunks: Buffer[] = [];
    const stderr: Buffer[] = [];
    const proc = spawn(FFMPEG_PATH, args);

    proc.stdout.on('data', (chunk: Buffer) => chunks.push(chunk));
    proc.stderr.on('data', (chunk: Buffer) => stderr.push(chunk));

    proc.on('error', (error) => reject(error));
    proc.on('close', (code) => {
      if (code === 0 && chunks.length > 0) {
        resolve(Buffer.concat(chunks));
        return;
      }
      reject(
        new Error(
          `ffmpeg frame extraction failed (code ${code ?? 'unknown'}): ${Buffer.concat(stderr).toString('utf8').trim()}`
        )
      );
    });
  });
}

async function readImageSize(jpeg: Buffer): Promise<{ width: number; height: number }> {
  const meta = await sharp(jpeg).metadata();
  const width = meta.width ?? 0;
  const height = meta.height ?? 0;
  if (width <= 0 || height <= 0) {
    throw new Error('Could not read frame dimensions');
  }
  return { width, height };
}

async function applyRotation(
  rawJpeg: Buffer,
  rotation: CanonicalRotation
): Promise<{ jpeg: Buffer; width: number; height: number }> {
  if (rotation === 0) {
    const { width, height } = await readImageSize(rawJpeg);
    return { jpeg: rawJpeg, width, height };
  }

  const jpeg = await sharp(rawJpeg).rotate(rotation).jpeg({ quality: 88 }).toBuffer();
  const { width, height } = await readImageSize(jpeg);
  return { jpeg, width, height };
}

/** Extract one display-oriented JPEG for player selection (ffmpeg + rotation correction). */
export async function extractSelectionFrame(
  videoPath: string,
  timestampMs: number
): Promise<SelectionFrameResult> {
  const timestampSec = Math.max(0, timestampMs / 1000);
  const roundedMs = Math.round(timestampMs);

  try {
    const plan = await probeVideoOrientationPlan(videoPath);

    console.log('[video-frame] SOURCE METADATA', {
      codedWidth: plan.codedWidth,
      codedHeight: plan.codedHeight,
      displayWidth: plan.displayWidth,
      displayHeight: plan.displayHeight,
      rotation: plan.appliedRotation,
      sideDataRotation: plan.sideDataRotation,
      tagsRotation: plan.tagsRotation,
    });

    const rawJpeg = await runFfmpegExtractJpeg(videoPath, timestampSec);
    const { width: rawJpegWidth, height: rawJpegHeight } = await readImageSize(rawJpeg);

    if (plan.landscapeFallbackApplied) {
      console.log('[video-frame] LANDSCAPE FALLBACK', {
        triggered: true,
        reason: 'no_rotation_metadata_and_strong_portrait_aspect',
        beforeWidth: rawJpegWidth,
        beforeHeight: rawJpegHeight,
        fallbackRotation: plan.appliedRotation,
      });
    }

    const { jpeg, width: finalWidth, height: finalHeight } = await applyRotation(
      rawJpeg,
      plan.appliedRotation
    );

    console.log('[video-frame] FINAL OUTPUT', {
      rawJpegWidth,
      rawJpegHeight,
      appliedRotation: plan.appliedRotation,
      finalWidth,
      finalHeight,
      orientation: orientationFromSize(finalWidth, finalHeight),
    });

    return {
      success: true,
      jpeg,
      width: finalWidth,
      height: finalHeight,
      orientation: orientationFromSize(finalWidth, finalHeight),
      timestampMs: roundedMs,
    };
  } catch (error) {
    return {
      success: false,
      timestampMs: roundedMs,
      error: error instanceof Error ? error.message : 'Frame extraction failed',
    };
  }
}
