/**
 * Regression: temp segment frames must stay on disk until JPEG buffers are loaded.
 * Reproduces ENOENT on frame_000002.jpg from missing await before finally cleanup.
 *
 * Usage:
 *   npx tsx scripts/test-frame-extractor-lifecycle.ts
 *   npx tsx scripts/test-frame-extractor-lifecycle.ts /path/to/clip.mov   # full pipeline (~192 frames)
 */
import fs from 'node:fs/promises';
import { spawn } from 'node:child_process';
import ffmpegInstaller from '@ffmpeg-installer/ffmpeg';
import {
  extractVideoFrames,
  extractVideoSegmentFrames,
  PASS1_FPS,
  computeSampleTimestamps,
} from '../lib/tracking/frameExtractor.js';

const FFMPEG = ffmpegInstaller.path;
const SYNTHETIC_CLIP = '.test-lifecycle.mov';
const DURATION_MS = 27_000;

async function ensureSyntheticVideo(outPath: string): Promise<void> {
  try {
    await fs.access(outPath);
    return;
  } catch {
    // generate below
  }

  await new Promise<void>((resolve, reject) => {
    const proc = spawn(FFMPEG, [
      '-y',
      '-hide_banner',
      '-loglevel',
      'error',
      '-f',
      'lavfi',
      '-i',
      `testsrc2=size=1080x1920:rate=30:duration=${DURATION_MS / 1000}`,
      '-c:v',
      'libx264',
      '-pix_fmt',
      'yuv420p',
      outPath,
    ]);
    proc.on('close', (code) => (code === 0 ? resolve() : reject(new Error(`ffmpeg ${code}`))));
    proc.on('error', reject);
  });
}

async function testSegmentBuffersLoadedBeforeCleanup(videoPath: string): Promise<void> {
  const segmentFrames = await extractVideoSegmentFrames(videoPath, 0, 3000, DURATION_MS);
  if (segmentFrames.length < 2) {
    throw new Error(`Expected ≥2 segment frames, got ${segmentFrames.length}`);
  }
  const second = segmentFrames[1]!;
  if (second.jpeg.length === 0) {
    throw new Error('frame_000002 equivalent has empty JPEG buffer after cleanup race fix');
  }
  console.log('[Test] Segment frame 2 buffer bytes:', second.jpeg.length);
}

async function testPass1FrameCount(videoPath: string): Promise<number> {
  const expected = computeSampleTimestamps(DURATION_MS, PASS1_FPS).length;
  const frames = await extractVideoFrames(videoPath, DURATION_MS, PASS1_FPS);
  console.log('[Test] Pass 1 frames extracted:', frames.length, '(expected ~', expected, ')');
  if (frames.length < 100) {
    throw new Error(`Expected ~192 pass-1 frames for 27s clip, got ${frames.length}`);
  }
  if (frames[1]!.jpeg.length === 0) {
    throw new Error('Pass-1 frame_000002 equivalent has empty buffer');
  }
  return frames.length;
}

async function testFullPipeline(videoPath: string): Promise<void> {
  await import('../lib/tracking/tfNodePolyfill.js');
  const { warmupTrackingModels } = await import('../lib/tracking/modelLoader.js');
  const { runTrackingPipeline } = await import('../lib/tracking/pipeline.js');

  await warmupTrackingModels();

  const videoBuffer = await fs.readFile(videoPath);
  const stat = await fs.stat(videoPath);

  const metadata: import('../lib/types.js').AnalysisRequestMetadata = {
    clip: { durationMs: DURATION_MS, fileName: videoPath.split('/').pop() ?? null, fileSizeBytes: stat.size },
    mode: 'PERFORMANCE',
    profile: {
      firstName: 'Test',
      age: 12,
      mainPosition: 'midfielder',
      preferredFoot: 'right',
      playingLevel: 'youth',
      playingStyle: [],
      improvementGoals: [],
      feedbackAreas: [],
    },
    playerSelection: {
      normalizedX: 0.5,
      normalizedY: 0.55,
      timestampMs: 2000,
      displayWidth: 390,
      displayHeight: 844,
      videoWidth: 1080,
      videoHeight: 1920,
    },
  };

  const { playerTracking } = await runTrackingPipeline({
    videoBuffer,
    originalName: videoPath.split('/').pop() ?? 'clip.mov',
    metadata,
    jobId: 'lifecycle-regression',
  });

  const keyframesCount = playerTracking.keyframes.length;
  console.log('[Test] Full pipeline keyframesCount:', keyframesCount);
  if (keyframesCount === 0) {
    throw new Error('Job must complete with keyframesCount > 0');
  }
}

async function main(): Promise<void> {
  const clipArg = process.argv[2];
  const videoPath = clipArg ?? SYNTHETIC_CLIP;
  if (!clipArg) {
    await ensureSyntheticVideo(videoPath);
  }

  console.log('[Test] Video:', videoPath);

  await testSegmentBuffersLoadedBeforeCleanup(videoPath);
  const frameCount = await testPass1FrameCount(videoPath);
  console.log('[Test] Pass 1 frame count OK:', frameCount);

  if (clipArg) {
    console.log('[Test] Running full pipeline (identity recovery + pass-2 refinement)...');
    await testFullPipeline(videoPath);
  } else {
    console.log('[Test] Skipping full ML pipeline on synthetic clip — pass segment-extraction regression only');
    console.log('[Test] Re-run with a real football clip path for end-to-end keyframesCount validation');
  }

  console.log('[Test] PASS — no ENOENT during frame read');
}

main().catch((error) => {
  console.error('[Test] FAIL', error);
  process.exit(1);
});
