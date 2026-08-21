import type { IdentityReference, PlayerSelection } from '../types.js';
import type { ExtractedFrame, ObjectTrack, PersonDetection } from './types.js';
import {
  appearanceDistance,
  boxCenter,
  boxIoU,
  extractAppearanceFeatures,
} from './appearanceFeatures.js';
import { estimateBoxFromTap } from '../parseTrackingPreview.js';

/** Tunable identity thresholds — logged on every match for audit. */
export const IDENTITY_THRESHOLDS = {
  minimumSimilarity: 0.28,
  minimumMargin: 0.04,
  /** Min distance margin between top-2 nearest candidates to auto-accept. */
  tapNearestAmbiguityMargin: 0.025,
  /** Max centre distance for unambiguous auto-nearest (very close only). */
  tapNearestAutoMaxDistance: 0.05,
  referenceTimeToleranceMs: 900,
  tapContainedScore: 0.92,
  tapMultiContainedScore: 0.86,
  tapNearestBaseScore: 0.68,
} as const;

export interface TapMatchCandidate {
  trackId: string;
  box: import('../types.js').TrackingBoundingBox;
  containsTap: boolean;
  nearTap: boolean;
  tapDistanceToBoxCenter: number;
  detectionConfidence: number;
  appearanceSimilarity: number;
}

export interface TapMatchLog {
  referenceTimestampMs: number;
  tapNormalizedX: number;
  tapNormalizedY: number;
  frameWidth: number;
  frameHeight: number;
  candidateCount: number;
  candidates: TapMatchCandidate[];
  chosenTrackId: string | null;
  rejectionReason: string | null;
  selectionMethod: 'tap_containment' | 'tap_expanded' | 'tap_smallest_box' | 'tap_nearest' | 'scored_match' | 'none';
  identityFromTapContainment: boolean;
}

export interface ThresholdAuditLog {
  bestTrackId: string | null;
  bestSimilarity: number;
  secondBestSimilarity: number;
  margin: number;
  minimumSimilarity: number;
  minimumMargin: number;
  reasonRejected: string | null;
}

function referencesFromSelection(selection: PlayerSelection): IdentityReference[] {
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

function pointInBox(px: number, py: number, box: import('../types.js').TrackingBoundingBox): boolean {
  return px >= box.x && px <= box.x + box.width && py >= box.y && py <= box.y + box.height;
}

/** Expand body box upward for head-level taps and slightly sideways. */
function expandBoxForTap(box: import('../types.js').TrackingBoundingBox): import('../types.js').TrackingBoundingBox {
  const padX = box.width * 0.14;
  const padTop = box.height * 0.38;
  const padBottom = box.height * 0.1;
  const x = Math.max(0, box.x - padX);
  const y = Math.max(0, box.y - padTop);
  const width = Math.min(1 - x, box.width + padX * 2);
  const height = Math.min(1 - y, box.height + padTop + padBottom);
  return { x, y, width, height };
}

function tapMatchFlags(
  px: number,
  py: number,
  box: import('../types.js').TrackingBoundingBox
): { containsTap: boolean; nearTap: boolean } {
  if (pointInBox(px, py, box)) return { containsTap: true, nearTap: true };
  if (pointInBox(px, py, expandBoxForTap(box))) return { containsTap: false, nearTap: true };
  return { containsTap: false, nearTap: false };
}

function tapDistanceToBoxCenter(
  px: number,
  py: number,
  box: import('../types.js').TrackingBoundingBox
): number {
  const c = boxCenter(box);
  return Math.hypot(c.x - px, c.y - py);
}

function boxArea(box: import('../types.js').TrackingBoundingBox): number {
  return box.width * box.height;
}

function findTrackForDetection(tracks: ObjectTrack[], det: PersonDetection): string | null {
  let bestTrack: string | null = null;
  let bestIou = 0.2;
  for (const track of tracks) {
    for (const sample of track.samples) {
      if (Math.abs(sample.timestampMs - det.timestampMs) > 400) continue;
      const iou = boxIoU(sample.box, det.box);
      if (iou > bestIou) {
        bestIou = iou;
        bestTrack = track.trackId;
      }
    }
  }
  return bestTrack;
}

function nearestSample(
  track: ObjectTrack,
  timestampMs: number
): ObjectTrack['samples'][number] | null {
  if (track.samples.length === 0) return null;
  return [...track.samples].sort(
    (a, b) => Math.abs(a.timestampMs - timestampMs) - Math.abs(b.timestampMs - timestampMs)
  )[0]!;
}

function spatialScore(
  ref: IdentityReference,
  track: ObjectTrack,
  timestampMs: number
): number {
  const sample = track.samples.find((s) => s.timestampMs === timestampMs);
  if (!sample) return 0;
  const refCenter = { x: ref.normalizedX, y: ref.normalizedY };
  const dist = Math.hypot(
    boxCenter(sample.box).x - refCenter.x,
    boxCenter(sample.box).y - refCenter.y
  );
  return Math.max(0, 1 - dist / 0.16);
}

function buildTapCandidates(params: {
  tracks: ObjectTrack[];
  detections: PersonDetection[];
  ref: IdentityReference;
  frames: ExtractedFrame[];
  refAppearance: Awaited<ReturnType<typeof extractAppearanceFeatures>> | null;
}): TapMatchCandidate[] {
  const { tracks, detections, ref, refAppearance } = params;
  const tolerance = IDENTITY_THRESHOLDS.referenceTimeToleranceMs;
  const byTrack = new Map<string, TapMatchCandidate>();

  const frameDetections = detections.filter(
    (d) => Math.abs(d.timestampMs - ref.timestampMs) <= tolerance
  );

  for (const det of frameDetections) {
    const trackId = findTrackForDetection(tracks, det);
    if (!trackId) continue;

    const track = tracks.find((t) => t.trackId === trackId);
    let appearanceSimilarity = 0;
    if (refAppearance && track?.appearance) {
      appearanceSimilarity = Math.max(
        0,
        1 - appearanceDistance(refAppearance, track.appearance) / 90
      );
    }

    const flags = tapMatchFlags(ref.normalizedX, ref.normalizedY, det.box);
    const candidate: TapMatchCandidate = {
      trackId,
      box: det.box,
      containsTap: flags.containsTap,
      nearTap: flags.nearTap,
      tapDistanceToBoxCenter: tapDistanceToBoxCenter(ref.normalizedX, ref.normalizedY, det.box),
      detectionConfidence: det.confidence,
      appearanceSimilarity,
    };

    const existing = byTrack.get(trackId);
    if (!existing || candidate.detectionConfidence > existing.detectionConfidence) {
      byTrack.set(trackId, candidate);
    }
  }

  for (const track of tracks) {
    if (byTrack.has(track.trackId)) continue;
    const sample = nearestSample(track, ref.timestampMs);
    if (!sample || Math.abs(sample.timestampMs - ref.timestampMs) > tolerance) continue;

    let appearanceSimilarity = 0;
    if (refAppearance && track.appearance) {
      appearanceSimilarity = Math.max(
        0,
        1 - appearanceDistance(refAppearance, track.appearance) / 90
      );
    }

    const flags = tapMatchFlags(ref.normalizedX, ref.normalizedY, sample.box);
    byTrack.set(track.trackId, {
      trackId: track.trackId,
      box: sample.box,
      containsTap: flags.containsTap,
      nearTap: flags.nearTap,
      tapDistanceToBoxCenter: tapDistanceToBoxCenter(ref.normalizedX, ref.normalizedY, sample.box),
      detectionConfidence: sample.confidence,
      appearanceSimilarity,
    });
  }

  return [...byTrack.values()].sort(
    (a, b) => a.tapDistanceToBoxCenter - b.tapDistanceToBoxCenter
  );
}

function selectFromTapCandidates(candidates: TapMatchCandidate[]): {
  trackId: string | null;
  score: number;
  rejectionReason: string | null;
  selectionMethod: TapMatchLog['selectionMethod'];
  identityFromTapContainment: boolean;
} {
  if (candidates.length === 0) {
    return {
      trackId: null,
      score: 0,
      rejectionReason: 'no_candidates_at_reference_timestamp',
      selectionMethod: 'none',
      identityFromTapContainment: false,
    };
  }

  const containing = candidates.filter((c) => c.containsTap);

  if (containing.length === 1) {
    return {
      trackId: containing[0]!.trackId,
      score: IDENTITY_THRESHOLDS.tapContainedScore,
      rejectionReason: null,
      selectionMethod: 'tap_containment',
      identityFromTapContainment: true,
    };
  }

  if (containing.length > 1) {
    const chosen = [...containing].sort((a, b) => {
      const areaDiff = boxArea(a.box) - boxArea(b.box);
      if (Math.abs(areaDiff) > 0.0001) return areaDiff;
      if (a.tapDistanceToBoxCenter !== b.tapDistanceToBoxCenter) {
        return a.tapDistanceToBoxCenter - b.tapDistanceToBoxCenter;
      }
      return b.appearanceSimilarity - a.appearanceSimilarity;
    })[0]!;
    return {
      trackId: chosen.trackId,
      score: IDENTITY_THRESHOLDS.tapMultiContainedScore,
      rejectionReason: null,
      selectionMethod: 'tap_smallest_box',
      identityFromTapContainment: true,
    };
  }

  const nearExpanded = candidates.filter((c) => c.nearTap);
  if (nearExpanded.length === 1) {
    return {
      trackId: nearExpanded[0]!.trackId,
      score: IDENTITY_THRESHOLDS.tapMultiContainedScore,
      rejectionReason: null,
      selectionMethod: 'tap_expanded',
      identityFromTapContainment: true,
    };
  }

  if (nearExpanded.length > 1) {
    const chosen = [...nearExpanded].sort(
      (a, b) => a.tapDistanceToBoxCenter - b.tapDistanceToBoxCenter
    )[0]!;
    const second = nearExpanded[1]!;
    if (second.tapDistanceToBoxCenter - chosen.tapDistanceToBoxCenter < IDENTITY_THRESHOLDS.tapNearestAmbiguityMargin) {
      return {
        trackId: null,
        score: 0,
        rejectionReason: `ambiguous_expanded_match (${chosen.tapDistanceToBoxCenter.toFixed(3)} vs ${second.tapDistanceToBoxCenter.toFixed(3)})`,
        selectionMethod: 'none',
        identityFromTapContainment: false,
      };
    }
    return {
      trackId: chosen.trackId,
      score: IDENTITY_THRESHOLDS.tapMultiContainedScore,
      rejectionReason: null,
      selectionMethod: 'tap_expanded',
      identityFromTapContainment: true,
    };
  }

  const nearest = candidates[0]!;
  const secondNearest = candidates[1];
  const ambiguous =
    secondNearest &&
    secondNearest.tapDistanceToBoxCenter - nearest.tapDistanceToBoxCenter <
      IDENTITY_THRESHOLDS.tapNearestAmbiguityMargin;

  if (ambiguous) {
    return {
      trackId: null,
      score: 0,
      rejectionReason: `ambiguous_nearest_tap (${nearest.tapDistanceToBoxCenter.toFixed(3)} vs ${secondNearest!.tapDistanceToBoxCenter.toFixed(3)})`,
      selectionMethod: 'none',
      identityFromTapContainment: false,
    };
  }

  if (nearest.tapDistanceToBoxCenter <= IDENTITY_THRESHOLDS.tapNearestAutoMaxDistance) {
    return {
      trackId: nearest.trackId,
      score: IDENTITY_THRESHOLDS.tapNearestBaseScore,
      rejectionReason: null,
      selectionMethod: 'tap_nearest',
      identityFromTapContainment: false,
    };
  }

  return {
    trackId: null,
    score: 0,
    rejectionReason: `no_tap_containment (${nearest.tapDistanceToBoxCenter.toFixed(3)} > ${IDENTITY_THRESHOLDS.tapNearestAutoMaxDistance})`,
    selectionMethod: 'none',
    identityFromTapContainment: false,
  };
}

function logThresholdAudit(
  scores: Array<{ trackId: string; score: number }>,
  chosenTrackId: string | null,
  reasonRejected: string | null
): ThresholdAuditLog {
  const sorted = [...scores].sort((a, b) => b.score - a.score);
  const best = sorted[0];
  const second = sorted[1];
  const audit: ThresholdAuditLog = {
    bestTrackId: chosenTrackId ?? best?.trackId ?? null,
    bestSimilarity: best?.score ?? 0,
    secondBestSimilarity: second?.score ?? 0,
    margin: best && second ? best.score - second.score : best?.score ?? 0,
    minimumSimilarity: IDENTITY_THRESHOLDS.minimumSimilarity,
    minimumMargin: IDENTITY_THRESHOLDS.minimumMargin,
    reasonRejected,
  };
  console.log('[IdentityMatch] Threshold audit', audit);
  return audit;
}

export async function matchReferencesToTrack(
  tracks: ObjectTrack[],
  selection: PlayerSelection,
  frames: ExtractedFrame[],
  detections: PersonDetection[] = [],
  options?: {
    preserveTrackId?: string | null;
    mappedTap?: { normalizedX: number; normalizedY: number };
  }
): Promise<{ trackId: string | null; score: number; identityFromTapContainment: boolean; tapCandidates: TapMatchCandidate[] }> {
  const refs = referencesFromSelection(selection);
  const primaryRef = refs.find((r) => r.label === 'primary') ?? refs[0]!;

  const effectiveTap = options?.mappedTap ?? {
    normalizedX: primaryRef.normalizedX,
    normalizedY: primaryRef.normalizedY,
  };
  const primaryRefMapped: IdentityReference = {
    ...primaryRef,
    normalizedX: effectiveTap.normalizedX,
    normalizedY: effectiveTap.normalizedY,
  };

  const refFrame = [...frames].sort(
    (a, b) =>
      Math.abs(a.timestampMs - primaryRef.timestampMs) - Math.abs(b.timestampMs - primaryRef.timestampMs)
  )[0];
  const frameWidth = selection.videoWidth ?? refFrame?.width ?? 0;
  const frameHeight = selection.videoHeight ?? refFrame?.height ?? 0;

  let bestTrackSample: ObjectTrack['samples'][number] | null = null;
  let bestDist = Infinity;
  for (const track of tracks) {
    for (const sample of track.samples) {
      if (Math.abs(sample.timestampMs - primaryRef.timestampMs) > 1200) continue;
      const dist = Math.hypot(
        boxCenter(sample.box).x - primaryRef.normalizedX,
        boxCenter(sample.box).y - primaryRef.normalizedY
      );
      if (dist < bestDist) {
        bestDist = dist;
        bestTrackSample = sample;
      }
    }
  }

  const refBox =
    bestTrackSample && bestDist < 0.18
      ? bestTrackSample.box
      : estimateBoxFromTap(primaryRef.normalizedX, primaryRef.normalizedY);

  let refAppearance: Awaited<ReturnType<typeof extractAppearanceFeatures>> | null = null;
  if (refFrame) {
    try {
      refAppearance = await extractAppearanceFeatures(
        refFrame.jpeg,
        refFrame.width,
        refFrame.height,
        refBox
      );
    } catch {
      refAppearance = null;
    }
  }

  const tapCandidates = buildTapCandidates({
    tracks,
    detections,
    ref: primaryRefMapped,
    frames,
    refAppearance,
  });

  const tapSelection = selectFromTapCandidates(tapCandidates);

  const tapLog: TapMatchLog = {
    referenceTimestampMs: primaryRef.timestampMs,
    tapNormalizedX: effectiveTap.normalizedX,
    tapNormalizedY: effectiveTap.normalizedY,
    frameWidth,
    frameHeight,
    candidateCount: tapCandidates.length,
    candidates: tapCandidates,
    chosenTrackId: tapSelection.trackId,
    rejectionReason: tapSelection.rejectionReason,
    selectionMethod: tapSelection.selectionMethod,
    identityFromTapContainment: tapSelection.identityFromTapContainment,
  };
  console.log('[IdentityMatch] Tap-to-detection match', tapLog);

  if (tapSelection.trackId && tapSelection.identityFromTapContainment && refs.length === 1) {
    logThresholdAudit(
      tapCandidates.map((c) => ({
        trackId: c.trackId,
        score: c.containsTap || c.nearTap
          ? IDENTITY_THRESHOLDS.tapContainedScore
          : IDENTITY_THRESHOLDS.tapNearestBaseScore,
      })),
      tapSelection.trackId,
      null
    );
    return {
      trackId: tapSelection.trackId,
      score: tapSelection.score,
      identityFromTapContainment: true,
      tapCandidates,
    };
  }

  if (tapSelection.trackId && !tapSelection.identityFromTapContainment) {
    logThresholdAudit(
      tapCandidates.map((c) => ({ trackId: c.trackId, score: 1 - c.tapDistanceToBoxCenter })),
      null,
      tapSelection.rejectionReason ?? 'weak_nearest_rejected'
    );
  }

  const refAppearances = await Promise.all(
    refs.map(async (ref) => {
      const frame = [...frames].sort(
        (a, b) => Math.abs(a.timestampMs - ref.timestampMs) - Math.abs(b.timestampMs - ref.timestampMs)
      )[0];
      if (!frame) return null;

      let nearestSample: ObjectTrack['samples'][number] | null = null;
      let nearestDist = Infinity;
      for (const track of tracks) {
        for (const sample of track.samples) {
          if (Math.abs(sample.timestampMs - ref.timestampMs) > 1200) continue;
          const dist = Math.hypot(
            boxCenter(sample.box).x - ref.normalizedX,
            boxCenter(sample.box).y - ref.normalizedY
          );
          if (dist < nearestDist) {
            nearestDist = dist;
            nearestSample = sample;
          }
        }
      }

      const box =
        nearestSample && nearestDist < 0.18
          ? nearestSample.box
          : estimateBoxFromTap(ref.normalizedX, ref.normalizedY);
      try {
        return await extractAppearanceFeatures(frame.jpeg, frame.width, frame.height, box);
      } catch {
        return null;
      }
    })
  );

  const scores = tracks.map((track) => {
    let total = 0;
    let weight = 0;
    for (let i = 0; i < refs.length; i++) {
      const ref = refs[i];
      const refWeight = ref.label === 'primary' ? 1.4 : 1;
      const nearestSample = [...track.samples].sort(
        (a, b) => Math.abs(a.timestampMs - ref.timestampMs) - Math.abs(b.timestampMs - ref.timestampMs)
      )[0];
      if (!nearestSample || Math.abs(nearestSample.timestampMs - ref.timestampMs) > 1500) continue;

      const spatial = spatialScore(ref, track, nearestSample.timestampMs);
      let appearance = 0;
      const refApp = refAppearances[i];
      if (refApp && track.appearance) {
        appearance = Math.max(0, 1 - appearanceDistance(refApp, track.appearance) / 90);
      }
      total += (spatial * 0.5 + appearance * 0.5) * refWeight;
      weight += refWeight;
    }
    return { trackId: track.trackId, score: weight > 0 ? total / weight : 0 };
  });

  scores.sort((a, b) => b.score - a.score);
  const best = scores[0];
  const second = scores[1];

  if (tapSelection.trackId && tapSelection.identityFromTapContainment) {
    const tapScoreEntry = scores.find((s) => s.trackId === tapSelection.trackId);
    const mergedScore = Math.max(tapSelection.score, tapScoreEntry?.score ?? 0);
    logThresholdAudit(scores, tapSelection.trackId, null);
    return {
      trackId: tapSelection.trackId,
      score: mergedScore,
      identityFromTapContainment: true,
      tapCandidates,
    };
  }

  if (options?.preserveTrackId) {
    const preserved = scores.find((s) => s.trackId === options.preserveTrackId);
    if (preserved) {
      logThresholdAudit(scores, options.preserveTrackId!, null);
      return {
        trackId: options.preserveTrackId!,
        score: Math.max(preserved.score, 0.5),
        identityFromTapContainment: false,
        tapCandidates,
      };
    }
  }

  let reasonRejected: string | null = null;
  let chosenTrackId: string | null = null;

  if (!best || best.score < IDENTITY_THRESHOLDS.minimumSimilarity) {
    reasonRejected = `below_minimum_similarity (${(best?.score ?? 0).toFixed(3)} < ${IDENTITY_THRESHOLDS.minimumSimilarity})`;
  } else if (second && best.score - second.score < IDENTITY_THRESHOLDS.minimumMargin) {
    reasonRejected = `margin_too_small (${(best.score - second.score).toFixed(3)} < ${IDENTITY_THRESHOLDS.minimumMargin})`;
  } else {
    chosenTrackId = best.trackId;
  }

  logThresholdAudit(scores, chosenTrackId, reasonRejected);

  if (chosenTrackId) {
    return {
      trackId: chosenTrackId,
      score: best!.score,
      identityFromTapContainment: false,
      tapCandidates,
    };
  }

  return {
    trackId: null,
    score: best?.score ?? 0,
    identityFromTapContainment: false,
    tapCandidates,
  };
}

export function exportTrackTimeline(
  track: ObjectTrack,
  trackId: string
): Array<{
  timestampMs: number;
  state: import('../types.js').TrackingState;
  confidence: number;
  box: import('../types.js').TrackingBoundingBox;
  trackId: string;
  coordinateSource: 'detection' | 'prediction' | 'interpolated';
}> {
  return track.samples.map((s) => ({
    timestampMs: s.timestampMs,
    state: s.state,
    confidence: s.confidence,
    box: s.box,
    trackId,
    coordinateSource: s.source,
  }));
}
