/**
 * Unit-style regression for tap-containment identity matching (no ML).
 * Usage: npx tsx scripts/test-identity-tap-match.ts
 */
import type { PlayerSelection } from '../lib/types.js';
import type { ExtractedFrame, ObjectTrack, PersonDetection } from '../lib/tracking/types.js';
import { matchReferencesToTrack, IDENTITY_THRESHOLDS } from '../lib/tracking/identityMatcher.js';

function makeTrack(
  trackId: string,
  timestampMs: number,
  box: { x: number; y: number; width: number; height: number }
): ObjectTrack {
  return {
    trackId,
    appearance: null,
    consecutiveMisses: 0,
    samples: [
      {
        timestampMs,
        box,
        confidence: 0.82,
        source: 'detection',
        state: 'CONFIRMED',
      },
    ],
  };
}

async function testTapContainmentSelectsTrack(): Promise<void> {
  const timestampMs = 2000;
  const tapBox = { x: 0.46, y: 0.48, width: 0.08, height: 0.14 };
  const otherBox = { x: 0.12, y: 0.5, width: 0.07, height: 0.13 };

  const tracks = [
    makeTrack('track-target', timestampMs, tapBox),
    makeTrack('track-other', timestampMs, otherBox),
  ];

  const detections: PersonDetection[] = [
    { timestampMs, box: tapBox, confidence: 0.88 },
    { timestampMs, box: otherBox, confidence: 0.75 },
  ];

  const frames: ExtractedFrame[] = [
    { timestampMs, width: 1080, height: 1920, jpeg: Buffer.alloc(64, 128) },
  ];

  const selection: PlayerSelection = {
    normalizedX: 0.5,
    normalizedY: 0.55,
    timestampMs,
    displayWidth: 390,
    displayHeight: 844,
    videoWidth: 1080,
    videoHeight: 1920,
  };

  const { trackId, score } = await matchReferencesToTrack(tracks, selection, frames, detections);

  if (trackId !== 'track-target') {
    throw new Error(`Expected track-target, got ${trackId ?? 'null'}`);
  }
  if (score < IDENTITY_THRESHOLDS.tapContainedScore - 0.01) {
    throw new Error(`Expected high tap-contained score, got ${score}`);
  }
  console.log('[Test] tap containment →', trackId, score);
}

async function testAmbiguousNearestRejected(): Promise<void> {
  const timestampMs = 2000;
  const boxA = { x: 0.38, y: 0.45, width: 0.08, height: 0.14 };
  const boxB = { x: 0.54, y: 0.45, width: 0.08, height: 0.14 };

  const tracks = [makeTrack('track-a', timestampMs, boxA), makeTrack('track-b', timestampMs, boxB)];
  const detections: PersonDetection[] = [
    { timestampMs, box: boxA, confidence: 0.7 },
    { timestampMs, box: boxB, confidence: 0.68 },
  ];
  const frames: ExtractedFrame[] = [
    { timestampMs, width: 1080, height: 1920, jpeg: Buffer.alloc(64, 100) },
  ];

  const selection: PlayerSelection = {
    normalizedX: 0.495,
    normalizedY: 0.52,
    timestampMs,
    displayWidth: 390,
    displayHeight: 844,
    videoWidth: 1080,
    videoHeight: 1920,
  };

  const { trackId } = await matchReferencesToTrack(tracks, selection, frames, detections);
  if (trackId != null) {
    throw new Error('Ambiguous nearest tap should not auto-select a track');
  }
  console.log('[Test] ambiguous nearest rejected');
}

async function testExpandedBoxTap(): Promise<void> {
  const timestampMs = 2000;
  const bodyBox = { x: 0.44, y: 0.55, width: 0.1, height: 0.14 };

  const tracks = [makeTrack('track-near', timestampMs, bodyBox)];
  const detections: PersonDetection[] = [{ timestampMs, box: bodyBox, confidence: 0.6 }];
  const frames: ExtractedFrame[] = [
    { timestampMs, width: 1080, height: 1920, jpeg: Buffer.alloc(64, 100) },
  ];

  const selection: PlayerSelection = {
    normalizedX: 0.49,
    normalizedY: 0.52,
    timestampMs,
    displayWidth: 390,
    displayHeight: 844,
    videoWidth: 1080,
    videoHeight: 1920,
  };

  const { trackId, identityFromTapContainment } = await matchReferencesToTrack(
    tracks,
    selection,
    frames,
    detections
  );

  if (trackId !== 'track-near' || !identityFromTapContainment) {
    throw new Error('Head-level tap should match via expanded body box');
  }
  console.log('[Test] expanded-box head tap →', trackId);
}

async function main(): Promise<void> {
  await testTapContainmentSelectsTrack();
  await testExpandedBoxTap();
  await testAmbiguousNearestRejected();
  console.log('[Test] PASS — identity tap matching');
}

main().catch((error) => {
  console.error('[Test] FAIL', error);
  process.exit(1);
});
