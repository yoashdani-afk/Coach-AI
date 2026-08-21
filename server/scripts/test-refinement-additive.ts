/**
 * Regression: pass2 refinement must preserve pass1 confirmed samples when no improvement found.
 */
import { refineKeyframesInWindows } from '../lib/tracking/trackRefinement.js';

const pass1 = [
  {
    timestampMs: 1000,
    box: { x: 0.4, y: 0.5, width: 0.08, height: 0.2 },
    state: 'CONFIRMED' as const,
    confidence: 0.9,
    coordinateSource: 'detection' as const,
  },
  {
    timestampMs: 2000,
    box: { x: 0.42, y: 0.51, width: 0.08, height: 0.2 },
    state: 'CONFIRMED' as const,
    confidence: 0.88,
    coordinateSource: 'detection' as const,
  },
];

const refined = await refineKeyframesInWindows({
  videoPath: '/nonexistent/video.mp4',
  clipDurationMs: 5000,
  windows: [{ startMs: 800, endMs: 2200 }],
  keyframes: pass1,
  anchorAppearance: null,
});

if (refined.length === 0) {
  throw new Error('Expected pass1 samples to be preserved');
}

const confirmed = refined.filter((k) => k.state === 'CONFIRMED' && k.coordinateSource === 'detection');
if (confirmed.length < pass1.length) {
  throw new Error(`Expected at least ${pass1.length} confirmed samples, got ${confirmed.length}`);
}

console.log('[test-refinement-additive] OK', { count: refined.length, confirmed: confirmed.length });
