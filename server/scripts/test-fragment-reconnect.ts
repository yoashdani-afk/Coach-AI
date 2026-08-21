/**
 * Unit test for bidirectional fragment reconnection with identity gallery.
 */
import { reconnectTrackFragments } from '../lib/tracking/trackFragmentReconnect.js';
import type { ObjectTrack, AppearanceFeatures } from '../lib/tracking/types.js';

const kitA: AppearanceFeatures = {
  shirtRgb: [200, 40, 40],
  shortsRgb: [30, 30, 120],
  socksRgb: [240, 240, 240],
  aspectRatio: 0.35,
};

const kitB: AppearanceFeatures = {
  shirtRgb: [40, 180, 40],
  shortsRgb: [20, 20, 20],
  socksRgb: [255, 255, 255],
  aspectRatio: 0.38,
};

function detSample(ts: number, x: number, y: number) {
  return {
    timestampMs: ts,
    box: { x, y, width: 0.08, height: 0.22 },
    confidence: 0.85,
    source: 'detection' as const,
    state: 'CONFIRMED' as const,
  };
}

function makeTrack(id: string, samples: ReturnType<typeof detSample>[], appearance: AppearanceFeatures): ObjectTrack {
  return { trackId: id, samples, appearance, consecutiveMisses: 0 };
}

const anchor = makeTrack(
  'track-8',
  [1000, 1143, 1286, 1429, 1572].map((ts, i) => detSample(ts, 0.4 + i * 0.01, 0.5)),
  kitA
);

const forwardFragment = makeTrack(
  'track-12',
  [3000, 3143, 3286, 3429, 3572, 3715].map((ts, i) => detSample(ts, 0.55 + i * 0.01, 0.52)),
  kitA
);

const backwardFragment = makeTrack(
  'track-3',
  [200, 343, 486, 629, 772].map((ts, i) => detSample(ts, 0.35 + i * 0.008, 0.48)),
  kitA
);

const wrongPlayer = makeTrack(
  'track-99',
  [3000, 3143, 3286, 3429].map((ts, i) => detSample(ts, 0.2 + i * 0.01, 0.3)),
  kitB
);

const { keyframes, report } = await reconnectTrackFragments({
  anchorTrack: anchor,
  anchorTrackId: 'track-8',
  allTracks: [anchor, forwardFragment, backwardFragment, wrongPlayer],
  frames: [],
  detections: [],
  clipDurationMs: 5000,
  fps: 7,
});

if (!report.mergedTrackIds.includes('track-12')) {
  throw new Error(`Expected track-12 merged, got ${report.mergedTrackIds.join(',')}`);
}
if (!report.mergedTrackIds.includes('track-3')) {
  throw new Error(`Expected track-3 merged, got ${report.mergedTrackIds.join(',')}`);
}
if (report.mergedTrackIds.includes('track-99')) {
  throw new Error('Wrong player track-99 should not be merged');
}
if (report.mergedCoverageRatio <= report.originalTrackCoverageRatio) {
  throw new Error(
    `Merged coverage ${report.mergedCoverageRatio} should exceed original ${report.originalTrackCoverageRatio}`
  );
}

console.log('[test-fragment-reconnect] OK', {
  mergedTrackIds: report.mergedTrackIds,
  originalCoverage: report.originalTrackCoverageRatio.toFixed(3),
  mergedCoverage: report.mergedCoverageRatio.toFixed(3),
  candidateCount: report.candidateEvaluations.length,
  acceptedCount: report.candidateEvaluations.filter((e) => e.accepted).length,
});
