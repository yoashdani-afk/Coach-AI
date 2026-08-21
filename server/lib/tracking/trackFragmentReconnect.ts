import type {
  ExtractedFrame,
  ObjectTrack,
  PersonDetection,
  TrackSample,
  AppearanceFeatures,
} from './types.js';
import type { TrackingTimelineResult } from './types.js';
import { boxCenter, extractAppearanceFeatures } from './appearanceFeatures.js';
import { cumulativeCameraShift } from './cameraMotion.js';
import { buildIdentityGallery, scoreAgainstGallery } from './identityGallery.js';
import { computeCoverageMetrics } from './timelineCoverage.js';

type Keyframe = TrackingTimelineResult['keyframes'][number];

const MIN_FRAGMENT_SAMPLES = 3;
const MAX_TEMPORAL_GAP_MS = 12000;
const MIN_AGGREGATED_SIM = 0.48;
const MIN_KIT_SIM = 0.52;
const MIN_APPEARANCE_SIM = 0.4;
const MAX_OVERLAP_RATIO = 0.55;

export interface FragmentReconnectEvaluation {
  anchorTrackId: string;
  candidateTrackId: string;
  direction: 'forward' | 'backward';
  anchorEndMs: number;
  candidateStartMs: number;
  temporalGapMs: number;
  appearanceSimilarity: number;
  kitColorSimilarity: number;
  spatialDistance: number;
  predictedPosition: { x: number; y: number };
  candidateStartPosition: { x: number; y: number };
  scaleRatio: number;
  motionConsistency: number;
  accepted: boolean;
  rejectionReasons: string[];
}

export interface ReconnectionReport {
  originalTrackCoverageRatio: number;
  mergedTrackIds: string[];
  mergedCoverageRatio: number;
  confirmedDurationMs: number;
  lostDurationMs: number;
  remainingLostIntervals: Array<{ startMs: number; endMs: number }>;
  candidateEvaluations: FragmentReconnectEvaluation[];
  rankedCandidates: Array<{
    rank: number;
    candidateTrackId: string;
    direction: 'forward' | 'backward';
    aggregatedScore: number;
    accepted: boolean;
  }>;
}

function isDetectionSample(s: TrackSample): boolean {
  return s.source === 'detection' && s.state !== 'LOST';
}

function detectionSamples(track: ObjectTrack): TrackSample[] {
  return track.samples.filter(isDetectionSample);
}

function trackTimeRange(samples: TrackSample[]): { startMs: number; endMs: number } {
  const sorted = [...samples].sort((a, b) => a.timestampMs - b.timestampMs);
  return {
    startMs: sorted[0]?.timestampMs ?? 0,
    endMs: sorted[sorted.length - 1]?.timestampMs ?? 0,
  };
}

function estimateVelocity(samples: TrackSample[], beforeMs: number): { dx: number; dy: number } {
  const dets = samples
    .filter((s) => isDetectionSample(s) && s.timestampMs <= beforeMs)
    .sort((a, b) => a.timestampMs - b.timestampMs)
    .slice(-4);
  if (dets.length < 2) return { dx: 0, dy: 0 };
  const first = dets[0]!;
  const last = dets[dets.length - 1]!;
  const dt = last.timestampMs - first.timestampMs;
  if (dt <= 0) return { dx: 0, dy: 0 };
  const span = dt / 143;
  return {
    dx: (boxCenter(last.box).x - boxCenter(first.box).x) / span,
    dy: (boxCenter(last.box).y - boxCenter(first.box).y) / span,
  };
}

function maxSpatialForGap(gapMs: number): number {
  if (gapMs <= 2000) return 0.28;
  if (gapMs <= 5000) return 0.42;
  return 0.58;
}

function motionConsistency(
  anchorSamples: TrackSample[],
  candidateSamples: TrackSample[],
  anchorMs: number,
  candidateMs: number
): number {
  const anchorVel = estimateVelocity(anchorSamples, anchorMs);
  const candidateVel = estimateVelocity(
    candidateSamples.filter((s) => s.timestampMs >= candidateMs),
    candidateMs + 500
  );
  const magA = Math.hypot(anchorVel.dx, anchorVel.dy);
  const magC = Math.hypot(candidateVel.dx, candidateVel.dy);
  if (magA < 0.002 && magC < 0.002) return 1;
  if (magA < 0.002 || magC < 0.002) return 0.65;
  const dot = anchorVel.dx * candidateVel.dx + anchorVel.dy * candidateVel.dy;
  const cos = dot / (magA * magC);
  return Math.max(0, (cos + 1) / 2);
}

function overlapRatio(
  anchorDets: TrackSample[],
  candidateDets: TrackSample[]
): number {
  const anchorTimes = new Set(anchorDets.map((s) => s.timestampMs));
  const overlap = candidateDets.filter((s) => anchorTimes.has(s.timestampMs)).length;
  return candidateDets.length > 0 ? overlap / candidateDets.length : 1;
}

function evaluateFragment(params: {
  anchorTrackId: string;
  anchorSamples: TrackSample[];
  candidateTrack: ObjectTrack;
  direction: 'forward' | 'backward';
  detectionsByTime: Map<number, PersonDetection[]>;
  galleryScore: ReturnType<typeof scoreAgainstGallery>;
}): FragmentReconnectEvaluation {
  const {
    anchorTrackId,
    anchorSamples,
    candidateTrack,
    direction,
    detectionsByTime,
    galleryScore,
  } = params;

  const candidateDets = detectionSamples(candidateTrack);
  const anchorDets = anchorSamples.filter(isDetectionSample);
  const anchorRange = trackTimeRange(anchorDets);
  const candidateRange = trackTimeRange(candidateDets);

  const rejectionReasons: string[] = [];

  let anchorEndMs: number;
  let candidateStartMs: number;
  let anchorRefSample: TrackSample;
  let candidateRefSample: TrackSample;

  if (direction === 'forward') {
    anchorEndMs = anchorRange.endMs;
    candidateStartMs = candidateRange.startMs;
    anchorRefSample = anchorDets[anchorDets.length - 1]!;
    candidateRefSample = candidateDets[0]!;
  } else {
    anchorEndMs = anchorRange.startMs;
    candidateStartMs = candidateRange.endMs;
    anchorRefSample = anchorDets[0]!;
    candidateRefSample = candidateDets[candidateDets.length - 1]!;
  }

  const temporalGapMs = Math.abs(candidateStartMs - anchorEndMs);

  const cameraShift = cumulativeCameraShift(
    detectionsByTime,
    anchorEndMs,
    candidateStartMs
  );

  const velocity = estimateVelocity(anchorSamples, anchorEndMs);
  const dtSteps = temporalGapMs / 143;
  const anchorCenter = boxCenter(anchorRefSample.box);
  const predictedPosition = {
    x: anchorCenter.x + velocity.dx * dtSteps + cameraShift.dx,
    y: anchorCenter.y + velocity.dy * dtSteps + cameraShift.dy,
  };

  const candidateStartPosition = boxCenter(candidateRefSample.box);
  const spatialDistance = Math.hypot(
    candidateStartPosition.x - predictedPosition.x,
    candidateStartPosition.y - predictedPosition.y
  );

  const scaleRatio =
    anchorRefSample.box.height > 0
      ? candidateRefSample.box.height / anchorRefSample.box.height
      : 1;

  const motion = motionConsistency(
    anchorSamples,
    candidateDets,
    anchorEndMs,
    candidateStartMs
  );

  let accepted = true;

  if (galleryScore.aggregated < MIN_AGGREGATED_SIM) {
    accepted = false;
    rejectionReasons.push(
      `aggregated_similarity_low (${galleryScore.aggregated.toFixed(3)} < ${MIN_AGGREGATED_SIM})`
    );
  }
  if (galleryScore.kitColorSimilarity < MIN_KIT_SIM) {
    accepted = false;
    rejectionReasons.push(
      `kit_similarity_low (${galleryScore.kitColorSimilarity.toFixed(3)} < ${MIN_KIT_SIM})`
    );
  }
  if (galleryScore.appearanceSimilarity < MIN_APPEARANCE_SIM) {
    accepted = false;
    rejectionReasons.push(
      `appearance_similarity_low (${galleryScore.appearanceSimilarity.toFixed(3)} < ${MIN_APPEARANCE_SIM})`
    );
  }
  if (temporalGapMs > MAX_TEMPORAL_GAP_MS) {
    accepted = false;
    rejectionReasons.push(`temporal_gap_too_long (${temporalGapMs}ms > ${MAX_TEMPORAL_GAP_MS}ms)`);
  }
  if (spatialDistance > maxSpatialForGap(temporalGapMs)) {
    accepted = false;
    rejectionReasons.push(
      `spatial_distance_after_pan_comp (${spatialDistance.toFixed(3)} > ${maxSpatialForGap(temporalGapMs).toFixed(3)})`
    );
  }
  if (scaleRatio < 0.35 || scaleRatio > 2.8) {
    accepted = false;
    rejectionReasons.push(`scale_ratio_out_of_range (${scaleRatio.toFixed(3)})`);
  }
  if (motion < 0.25 && temporalGapMs < 3000) {
    accepted = false;
    rejectionReasons.push(`motion_inconsistent (${motion.toFixed(3)})`);
  }

  // Require both kit and appearance to agree for long gaps
  if (
    temporalGapMs > 4000 &&
    (galleryScore.kitColorSimilarity < 0.58 || galleryScore.appearanceSimilarity < 0.45)
  ) {
    accepted = false;
    rejectionReasons.push('long_gap_requires_strong_dual_match');
  }

  return {
    anchorTrackId,
    candidateTrackId: candidateTrack.trackId,
    direction,
    anchorEndMs,
    candidateStartMs,
    temporalGapMs,
    appearanceSimilarity: galleryScore.appearanceSimilarity,
    kitColorSimilarity: galleryScore.kitColorSimilarity,
    spatialDistance,
    predictedPosition,
    candidateStartPosition,
    scaleRatio,
    motionConsistency: motion,
    accepted,
    rejectionReasons,
  };
}

function sampleToKeyframe(s: TrackSample, trackId: string): Keyframe {
  return {
    timestampMs: s.timestampMs,
    state: s.state,
    confidence: s.confidence,
    box: s.box,
    trackId,
    coordinateSource: s.source,
  };
}

function sparseKeyframesFromTracks(
  anchorTrackId: string,
  anchorTrack: ObjectTrack,
  acceptedTracks: ObjectTrack[]
): Keyframe[] {
  const byTime = new Map<number, { kf: Keyframe; priority: number; score: number }>();

  for (const s of anchorTrack.samples) {
    byTime.set(s.timestampMs, {
      kf: sampleToKeyframe(s, anchorTrackId),
      priority: 3,
      score: 1,
    });
  }

  for (const track of acceptedTracks) {
    for (const s of track.samples) {
      if (!isDetectionSample(s)) continue;
      const existing = byTime.get(s.timestampMs);
      if (existing && existing.priority >= 3) continue;
      const kf = sampleToKeyframe(s, anchorTrackId);
      byTime.set(s.timestampMs, { kf, priority: 2, score: s.confidence });
    }
  }

  return [...byTime.values()]
    .map((v) => v.kf)
    .sort((a, b) => a.timestampMs - b.timestampMs);
}

function lostIntervalsFromKeyframes(
  keyframes: Keyframe[],
  videoDurationMs: number
): Array<{ startMs: number; endMs: number }> {
  const sorted = [...keyframes].sort((a, b) => a.timestampMs - b.timestampMs);
  const intervals: Array<{ startMs: number; endMs: number }> = [];
  let inLost = false;
  let start = 0;

  for (const k of sorted) {
    if (k.state === 'LOST' && !inLost) {
      inLost = true;
      start = k.timestampMs;
    } else if (k.state !== 'LOST' && inLost) {
      intervals.push({ startMs: start, endMs: k.timestampMs });
      inLost = false;
    }
  }
  if (inLost) {
    intervals.push({ startMs: start, endMs: videoDurationMs });
  }
  return intervals;
}

/**
 * Bidirectionally reconnect appearance-matching track fragments into the anchor timeline.
 * Prefers LOST over wrong identity — only merges fragments with strong kit + appearance match.
 */
export async function reconnectTrackFragments(params: {
  anchorTrack: ObjectTrack;
  anchorTrackId: string;
  allTracks: ObjectTrack[];
  frames: ExtractedFrame[];
  detections: PersonDetection[];
  clipDurationMs: number;
  fps: number;
}): Promise<{ keyframes: Keyframe[]; report: ReconnectionReport }> {
  const { anchorTrack, anchorTrackId, allTracks, frames, detections, clipDurationMs, fps } =
    params;

  const gallery = await buildIdentityGallery(anchorTrack, frames);
  const anchorDets = detectionSamples(anchorTrack);

  const detectionsByTime = new Map<number, PersonDetection[]>();
  for (const det of detections) {
    const list = detectionsByTime.get(det.timestampMs) ?? [];
    list.push(det);
    detectionsByTime.set(det.timestampMs, list);
  }

  const originalSparse = sparseKeyframesFromTracks(anchorTrackId, anchorTrack, []);
  const originalMetrics = computeCoverageMetrics(originalSparse, clipDurationMs, fps);

  const candidateEvaluations: FragmentReconnectEvaluation[] = [];

  async function candidateGalleryScore(
    track: ObjectTrack
  ): Promise<ReturnType<typeof scoreAgainstGallery>> {
    const scores: ReturnType<typeof scoreAgainstGallery>[] = [];
    if (track.appearance) scores.push(scoreAgainstGallery(gallery, track.appearance));

    const dets = detectionSamples(track);
    const endpoints = [dets[0], dets[Math.floor(dets.length / 2)], dets[dets.length - 1]].filter(
      Boolean
    ) as TrackSample[];

    for (const sample of endpoints) {
      const frame = frames.find((f) => f.timestampMs === sample.timestampMs);
      if (!frame) continue;
      const features: AppearanceFeatures = await extractAppearanceFeatures(
        frame.jpeg,
        frame.width,
        frame.height,
        sample.box
      );
      scores.push(scoreAgainstGallery(gallery, features));
    }

    if (scores.length === 0) {
      return { appearanceSimilarity: 0, kitColorSimilarity: 0, aggregated: 0 };
    }

    return {
      appearanceSimilarity: Math.max(...scores.map((s) => s.appearanceSimilarity)),
      kitColorSimilarity: Math.max(...scores.map((s) => s.kitColorSimilarity)),
      aggregated: Math.max(...scores.map((s) => s.aggregated)),
    };
  }

  for (const track of allTracks) {
    if (track.trackId === anchorTrackId) continue;
    const candidateDets = detectionSamples(track);
    if (candidateDets.length < MIN_FRAGMENT_SAMPLES) continue;
    if (overlapRatio(anchorDets, candidateDets) > MAX_OVERLAP_RATIO) continue;

    const galleryScore = await candidateGalleryScore(track);
    const anchorRange = trackTimeRange(anchorDets);
    const candidateRange = trackTimeRange(candidateDets);

    const directions: Array<'forward' | 'backward'> = [];
    if (candidateRange.startMs >= anchorRange.startMs - 500) directions.push('forward');
    if (candidateRange.endMs <= anchorRange.endMs + 500) directions.push('backward');
    if (directions.length === 0) {
      if (candidateRange.startMs > anchorRange.endMs) directions.push('forward');
      else if (candidateRange.endMs < anchorRange.startMs) directions.push('backward');
      else directions.push('forward');
    }

    for (const direction of directions) {
      const evaluation = evaluateFragment({
        anchorTrackId,
        anchorSamples: anchorTrack.samples,
        candidateTrack: track,
        direction,
        detectionsByTime,
        galleryScore,
      });
      candidateEvaluations.push(evaluation);
    }
  }

  for (const ev of candidateEvaluations) {
    console.log('[FragmentReconnect] Candidate', ev);
  }

  const rankedCandidates = [...candidateEvaluations]
    .sort((a, b) => {
      const scoreA = a.appearanceSimilarity * 0.35 + a.kitColorSimilarity * 0.65;
      const scoreB = b.appearanceSimilarity * 0.35 + b.kitColorSimilarity * 0.65;
      return scoreB - scoreA;
    })
    .map((ev, i) => ({
      rank: i + 1,
      candidateTrackId: ev.candidateTrackId,
      direction: ev.direction,
      aggregatedScore: ev.appearanceSimilarity * 0.35 + ev.kitColorSimilarity * 0.65,
      accepted: ev.accepted,
    }));

  console.log('[FragmentReconnect] Ranked candidates', rankedCandidates);

  const acceptedTrackIds = new Set<string>();
  const acceptedTracks: ObjectTrack[] = [];
  const anchorRange = trackTimeRange(anchorDets);
  let coverageStart = anchorRange.startMs;
  let coverageEnd = anchorRange.endMs;

  const acceptedEvals = candidateEvaluations
    .filter((e) => e.accepted)
    .sort(
      (a, b) =>
        b.kitColorSimilarity * 0.65 +
        b.appearanceSimilarity * 0.35 -
        (a.kitColorSimilarity * 0.65 + a.appearanceSimilarity * 0.35)
    );

  for (const ev of acceptedEvals) {
    if (acceptedTrackIds.has(ev.candidateTrackId)) continue;

    const track = allTracks.find((t) => t.trackId === ev.candidateTrackId);
    if (!track) continue;

    const candidateRange = trackTimeRange(detectionSamples(track));
    const gapForward = candidateRange.startMs - coverageEnd;
    const gapBackward = coverageStart - candidateRange.endMs;

    const canExtendForward =
      ev.direction === 'forward' && gapForward >= -800 && gapForward <= MAX_TEMPORAL_GAP_MS;
    const canExtendBackward =
      ev.direction === 'backward' && gapBackward >= -800 && gapBackward <= MAX_TEMPORAL_GAP_MS;

    if (!canExtendForward && !canExtendBackward) continue;

    acceptedTrackIds.add(ev.candidateTrackId);
    acceptedTracks.push(track);
    coverageStart = Math.min(coverageStart, candidateRange.startMs);
    coverageEnd = Math.max(coverageEnd, candidateRange.endMs);

    console.log('[FragmentReconnect] Accepted fragment', {
      candidateTrackId: ev.candidateTrackId,
      direction: ev.direction,
      kitColorSimilarity: ev.kitColorSimilarity,
      appearanceSimilarity: ev.appearanceSimilarity,
    });
  }

  // Multi-pass chaining: e.g. track-8 → track-12 → track-21
  let extended = true;
  while (extended) {
    extended = false;
    for (const ev of acceptedEvals) {
      if (acceptedTrackIds.has(ev.candidateTrackId)) continue;
      const track = allTracks.find((t) => t.trackId === ev.candidateTrackId);
      if (!track) continue;

      const candidateRange = trackTimeRange(detectionSamples(track));
      const gapForward = candidateRange.startMs - coverageEnd;
      const gapBackward = coverageStart - candidateRange.endMs;

      const canExtendForward =
        ev.direction === 'forward' && gapForward >= -800 && gapForward <= MAX_TEMPORAL_GAP_MS;
      const canExtendBackward =
        ev.direction === 'backward' && gapBackward >= -800 && gapBackward <= MAX_TEMPORAL_GAP_MS;

      if (!canExtendForward && !canExtendBackward) continue;

      acceptedTrackIds.add(ev.candidateTrackId);
      acceptedTracks.push(track);
      coverageStart = Math.min(coverageStart, candidateRange.startMs);
      coverageEnd = Math.max(coverageEnd, candidateRange.endMs);
      extended = true;

      console.log('[FragmentReconnect] Chained fragment', {
        candidateTrackId: ev.candidateTrackId,
        direction: ev.direction,
      });
    }
  }

  const mergedTrackIds = [anchorTrackId, ...acceptedTracks.map((t) => t.trackId)];
  const keyframes = sparseKeyframesFromTracks(anchorTrackId, anchorTrack, acceptedTracks);
  const mergedMetrics = computeCoverageMetrics(keyframes, clipDurationMs, fps);

  const report: ReconnectionReport = {
    originalTrackCoverageRatio: originalMetrics.coverageRatio,
    mergedTrackIds,
    mergedCoverageRatio: mergedMetrics.coverageRatio,
    confirmedDurationMs: mergedMetrics.confirmedDurationMs,
    lostDurationMs: mergedMetrics.lostDurationMs,
    remainingLostIntervals: lostIntervalsFromKeyframes(keyframes, clipDurationMs),
    candidateEvaluations,
    rankedCandidates,
  };

  console.log('[FragmentReconnect] Report', report);

  return { keyframes, report };
}

export type { Keyframe as FragmentReconnectKeyframe };
