/**
 * Verifies fragment reconnect debug compositing with mismatched frame metadata vs JPEG pixels.
 */
import sharp from 'sharp';
import fs from 'node:fs/promises';
import path from 'node:path';
import { writeFragmentReconnectDebugSheet } from '../lib/tracking/fragmentReconnectDebug.js';
import type { ExtractedFrame, ObjectTrack } from '../lib/tracking/types.js';
import type { ReconnectionReport } from '../lib/tracking/trackFragmentReconnect.js';

const jpeg = await sharp({
  create: { width: 480, height: 853, channels: 3, background: '#224422' },
})
  .jpeg()
  .toBuffer();

const frames: ExtractedFrame[] = Array.from({ length: 12 }, (_, i) => ({
  timestampMs: i * 500,
  width: 1280,
  height: 720,
  jpeg,
}));

const track: ObjectTrack = {
  trackId: 'track-8',
  appearance: null,
  consecutiveMisses: 0,
  samples: frames.map((f) => ({
    timestampMs: f.timestampMs,
    box: { x: 0.4, y: 0.3, width: 0.1, height: 0.25 },
    confidence: 0.9,
    source: 'detection',
    state: 'CONFIRMED',
  })),
};

const report: ReconnectionReport = {
  originalTrackCoverageRatio: 0.125,
  mergedTrackIds: ['track-8', 'track-1'],
  mergedCoverageRatio: 0.506,
  confirmedDurationMs: 4000,
  lostDurationMs: 20000,
  remainingLostIntervals: [],
  candidateEvaluations: [],
  rankedCandidates: [],
};

const outDir = path.join(process.cwd(), '.tracking-debug-test');
await fs.rm(outDir, { recursive: true, force: true });

const outPath = await writeFragmentReconnectDebugSheet({
  jobId: 'composite-test',
  frames,
  allTracks: [track],
  anchorTrackId: 'track-8',
  report,
  outputDir: outDir,
});

if (!outPath) throw new Error('Expected debug sheet path');
const stat = await fs.stat(outPath);
if (stat.size <= 0) throw new Error('Debug sheet empty');

console.log('[test-fragment-reconnect-debug] OK', { outPath, bytes: stat.size });
