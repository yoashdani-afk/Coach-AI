/**
 * Benchmark tracking pipeline on a local clip.
 * Usage: npx tsx scripts/benchmark-tracking.ts /path/to/FullSizeRender.mov
 */
import '../lib/tracking/tfNodePolyfill.js';
import fs from 'node:fs/promises';
import type { AnalysisRequestMetadata } from '../lib/types.js';
import { warmupTrackingModels, getTrackingBackendName } from '../lib/tracking/modelLoader.js';
import { runTrackingPipeline } from '../lib/tracking/pipeline.js';
import { getStageTimings } from '../lib/tracking/stageTimer.js';

async function main(): Promise<void> {
  const clipPath = process.argv[2];
  if (!clipPath) {
    console.error('Usage: npx tsx scripts/benchmark-tracking.ts <video-path>');
    process.exit(1);
  }

  await warmupTrackingModels();
  console.log('[Benchmark] backend =', getTrackingBackendName());

  const videoBuffer = await fs.readFile(clipPath);
  const stat = await fs.stat(clipPath);
  const durationMs = 27_000;

  const metadata: AnalysisRequestMetadata = {
    clip: { durationMs, fileName: clipPath.split('/').pop() ?? null, fileSizeBytes: stat.size },
    mode: 'PERFORMANCE',
    profile: {
      firstName: 'Bench',
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

  const started = Date.now();
  await runTrackingPipeline({
    videoBuffer,
    originalName: clipPath.split('/').pop() ?? 'clip.mov',
    metadata,
    jobId: 'benchmark',
  });

  const totalMs = Date.now() - started;
  const timings = getStageTimings().sort((a, b) => b.durationMs - a.durationMs);
  const inference = timings.find((t) => t.stage === 'person_detection_inference');

  console.log('\n[Benchmark] Results');
  console.log('  totalMs:', totalMs);
  console.log('  slowestStage:', timings[0]?.stage, timings[0]?.durationMs, 'ms');
  console.log('  inferenceFps:', inference?.effectiveFps?.toFixed(2));
  console.log('  backend:', getTrackingBackendName());
  console.log('  stages:', timings.map((t) => `${t.stage}=${t.durationMs}ms`).join(', '));
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
