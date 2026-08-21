/**
 * Regression: full-clip timeline must report LOST for uncovered periods.
 * Usage: npx tsx scripts/test-timeline-coverage.ts
 */
import {
  expandToFullClipTimeline,
  assessTimelineReliability,
  computeCoverageMetrics,
} from '../lib/tracking/timelineCoverage.js';

const VIDEO_MS = 27_000;
const FPS = 7;

const sparse = [
  { timestampMs: 1857, state: 'CONFIRMED' as const, confidence: 0.8, box: { x: 0.4, y: 0.5, width: 0.08, height: 0.14 }, trackId: 'track-4', coordinateSource: 'detection' as const },
  { timestampMs: 4000, state: 'CONFIRMED' as const, confidence: 0.75, box: { x: 0.42, y: 0.51, width: 0.08, height: 0.14 }, trackId: 'track-4', coordinateSource: 'detection' as const },
  { timestampMs: 8269, state: 'CONFIRMED' as const, confidence: 0.7, box: { x: 0.44, y: 0.52, width: 0.08, height: 0.14 }, trackId: 'track-4', coordinateSource: 'detection' as const },
];

const full = expandToFullClipTimeline({
  sparseKeyframes: sparse,
  videoDurationMs: VIDEO_MS,
  fps: FPS,
  trackId: 'track-4',
});

const metrics = computeCoverageMetrics(full, VIDEO_MS, FPS);
const reliability = assessTimelineReliability({
  keyframes: full,
  videoDurationMs: VIDEO_MS,
  fps: FPS,
  identityScore: 0.68,
  identityFromTapContainment: false,
});

console.log('[Test] Coverage metrics', metrics);
console.log('[Test] Reliability', reliability);

if (full[0]!.timestampMs !== 0) throw new Error('Timeline must start at 0');
if (full[full.length - 1]!.timestampMs < VIDEO_MS - 500) throw new Error('Timeline must reach clip end');
if (metrics.confirmedCoverageRatio > 0.9) throw new Error(`Expected low confirmed coverage, got ${metrics.confirmedCoverageRatio}`);
if (metrics.confirmedCoverageRatio <= 0) throw new Error('confirmedCoverageRatio must be > 0 when samples exist');
if (metrics.lostFrames === 0) throw new Error('lostFrames must be > 0 for partial coverage');
if (reliability.reliable) throw new Error('Partial coverage must not be reliable');

console.log('[Test] PASS — timeline coverage validation');
