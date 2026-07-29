import type {
  IdentityReference,
  PlayerIdentityProfile,
  PlayerSelection,
  PlayerTrackingData,
  TrackingInterval,
} from '@/types/analysis';
import { estimateBoxFromTap, keyframeFromTap } from '@/lib/trackingBox';

function buildIntervalsFromKeyframes(
  keyframes: PlayerTrackingData['keyframes']
): {
  confirmedIntervals: TrackingInterval[];
  uncertainIntervals: TrackingInterval[];
  lostIntervals: TrackingInterval[];
} {
  if (keyframes.length === 0) {
    return { confirmedIntervals: [], uncertainIntervals: [], lostIntervals: [] };
  }

  const sorted = [...keyframes].sort((a, b) => a.timestampMs - b.timestampMs);
  const confirmedIntervals: TrackingInterval[] = [];
  const uncertainIntervals: TrackingInterval[] = [];
  const lostIntervals: TrackingInterval[] = [];

  let currentState = sorted[0].state;
  let intervalStart = sorted[0].timestampMs;

  for (let i = 1; i < sorted.length; i++) {
    const frame = sorted[i];
    if (frame.state !== currentState) {
      const interval = { startMs: intervalStart, endMs: frame.timestampMs };
      if (currentState === 'CONFIRMED') confirmedIntervals.push(interval);
      else if (currentState === 'PROBABLE') uncertainIntervals.push(interval);
      else lostIntervals.push(interval);
      currentState = frame.state;
      intervalStart = frame.timestampMs;
    }
  }

  const lastMs = sorted[sorted.length - 1].timestampMs;
  const tail = { startMs: intervalStart, endMs: lastMs };
  if (currentState === 'CONFIRMED') confirmedIntervals.push(tail);
  else if (currentState === 'PROBABLE') uncertainIntervals.push(tail);
  else lostIntervals.push(tail);

  return { confirmedIntervals, uncertainIntervals, lostIntervals };
}

export function referencesFromSelection(selection: PlayerSelection): IdentityReference[] {
  if (selection.identityProfile?.references.length) {
    return selection.identityProfile.references;
  }
  return [
    {
      normalizedX: selection.normalizedX,
      normalizedY: selection.normalizedY,
      timestampMs: selection.timestampMs,
      label: 'primary',
    },
  ];
}

export function resolveIdentityConfidence(
  selection: PlayerSelection
): PlayerIdentityProfile['identityConfidence'] {
  if (selection.identityProfile?.identityConfidence) {
    return selection.identityProfile.identityConfidence;
  }
  return selection.reducedTrackingConfidence ? 'LOW' : 'HIGH';
}

/** Build initial tracking keyframes from multi-frame identity profile — no server required. */
export function createTrackingFromIdentityProfile(
  selection: PlayerSelection,
  clipDurationMs: number
): PlayerTrackingData {
  const refs = referencesFromSelection(selection);
  const identityConfidence = resolveIdentityConfidence(selection);

  const keyframes = refs.map((ref) =>
    keyframeFromTap(ref.timestampMs, ref.normalizedX, ref.normalizedY, 'CONFIRMED')
  );

  const lastRef = refs[refs.length - 1];
  if (clipDurationMs > lastRef.timestampMs + 400) {
    keyframes.push(
      keyframeFromTap(lastRef.timestampMs + 400, lastRef.normalizedX, lastRef.normalizedY, 'PROBABLE')
    );
  }

  keyframes.sort((a, b) => a.timestampMs - b.timestampMs);
  const intervals = buildIntervalsFromKeyframes(keyframes);

  return {
    keyframes,
    userCorrections: [],
    previewAccepted: false,
    identityConfidence,
    ...intervals,
  };
}

export function buildIdentityProfile(
  primary: PlayerSelection,
  secondary: IdentityReference,
  tertiary?: IdentityReference | null,
  identityConfidence: PlayerIdentityProfile['identityConfidence'] = 'HIGH'
): PlayerIdentityProfile {
  const references: IdentityReference[] = [
    {
      normalizedX: primary.normalizedX,
      normalizedY: primary.normalizedY,
      timestampMs: primary.timestampMs,
      label: 'primary',
    },
    secondary,
  ];
  if (tertiary) references.push(tertiary);

  return { references, identityConfidence };
}

export function mergeRefinedTracking(
  base: PlayerTrackingData,
  refined: PlayerTrackingData
): PlayerTrackingData {
  return {
    ...refined,
    userCorrections: base.userCorrections,
    skipTrackingAfterMs: base.skipTrackingAfterMs,
    identityConfidence: base.identityConfidence ?? refined.identityConfidence,
    previewAccepted: false,
  };
}

export function applyTrackingCorrection(
  tracking: PlayerTrackingData,
  timestampMs: number,
  normalizedX: number,
  normalizedY: number
): PlayerTrackingData {
  const box = estimateBoxFromTap(normalizedX, normalizedY);
  const correction = { timestampMs, box };
  const correctionKeyframe = keyframeFromTap(timestampMs, normalizedX, normalizedY, 'CONFIRMED');

  const keyframes = [...tracking.keyframes, correctionKeyframe].sort(
    (a, b) => a.timestampMs - b.timestampMs
  );
  const intervals = buildIntervalsFromKeyframes(keyframes);

  return {
    ...tracking,
    keyframes,
    userCorrections: [...tracking.userCorrections, correction],
    ...intervals,
  };
}

export function firstReferenceTimestampMs(selection: PlayerSelection): number {
  const refs = referencesFromSelection(selection);
  return refs[0]?.timestampMs ?? selection.timestampMs;
}

export function skipTrackingFromTimestamp(
  tracking: PlayerTrackingData,
  timestampMs: number
): PlayerTrackingData {
  const trimmedKeyframes = tracking.keyframes.filter((k) => k.timestampMs <= timestampMs);
  const intervals = buildIntervalsFromKeyframes(trimmedKeyframes);

  return {
    ...tracking,
    keyframes: trimmedKeyframes,
    skipTrackingAfterMs: timestampMs,
    ...intervals,
  };
}
