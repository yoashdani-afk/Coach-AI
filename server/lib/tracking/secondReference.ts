import type { IdentityReference, PlayerSelection } from '../types.js';
import type { ExtractedFrame, ObjectTrack, PersonDetection } from './types.js';
import {
  centerOfBox,
  pickAutoReferenceCandidate,
  pickConfirmationCandidate,
} from './autoReferenceSelector.js';
import type { ConfirmationRequest, ConfirmationResponse } from './confirmationRegistry.js';
import { waitForConfirmation } from './confirmationRegistry.js';
import { matchReferencesToTrack } from './identityMatcher.js';

const SECOND_REF_SCORE_THRESHOLD = 0.42;

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

function appendReference(selection: PlayerSelection, ref: IdentityReference): PlayerSelection {
  const existing = referencesFromSelection(selection);
  if (existing.length >= 2) return selection;
  return {
    ...selection,
    identityProfile: {
      references: [...existing, { ...ref, label: 'secondary' }],
      identityConfidence: selection.identityProfile?.identityConfidence ?? 'HIGH',
    },
  };
}

async function findBestReferenceAcrossClip(
  frames: ExtractedFrame[],
  track: ObjectTrack,
  detections: PersonDetection[],
  clipDurationMs: number
) {
  const anchors = [
    0,
    Math.round(clipDurationMs * 0.25),
    Math.round(clipDurationMs * 0.5),
    Math.round(clipDurationMs * 0.75),
    clipDurationMs,
  ];

  let best: Awaited<ReturnType<typeof pickConfirmationCandidate>> = null;
  for (const anchorMs of anchors) {
    const candidate = await pickConfirmationCandidate(frames, track, anchorMs, detections);
    if (candidate && (!best || candidate.total > best.total)) {
      best = candidate;
    }
  }
  return best;
}

export async function findNextIdentifiableTimestamp(
  frames: ExtractedFrame[],
  track: ObjectTrack,
  fromMs: number,
  detections: PersonDetection[],
  clipDurationMs: number
): Promise<number | null> {
  const step = 500;
  for (let ms = fromMs + step; ms <= clipDurationMs; ms += step) {
    const candidate = await pickConfirmationCandidate(frames, track, ms, detections);
    if (candidate?.userIdentifiable) return candidate.timestampMs;
    const auto = await pickAutoReferenceCandidate(frames, track, ms, detections);
    if (auto && auto.userIdentifiable) return auto.timestampMs;
  }
  return null;
}

export async function maybeRequestSecondReference(params: {
  selection: PlayerSelection;
  trackId: string | null;
  identityScore: number;
  objectTracks: ObjectTrack[];
  frames: ExtractedFrame[];
  detections: PersonDetection[];
  clipDurationMs: number;
  jobId?: string;
  onConfirmationRequired?: (request: ConfirmationRequest) => void;
}): Promise<{ selection: PlayerSelection; trackId: string | null; identityScore: number }> {
  const {
    selection,
    trackId: initialTrackId,
    identityScore: initialScore,
    objectTracks,
    frames,
    detections,
    clipDurationMs,
    jobId,
    onConfirmationRequired,
  } = params;

  const refs = referencesFromSelection(selection);
  if (refs.length >= 2) {
    return { selection, trackId: initialTrackId, identityScore: initialScore };
  }

  const needsSecond = !initialTrackId || initialScore < SECOND_REF_SCORE_THRESHOLD;
  if (!needsSecond) {
    return { selection, trackId: initialTrackId, identityScore: initialScore };
  }

  if (!onConfirmationRequired) {
    console.warn('[SecondReference] No confirmation handler — cannot prompt for second tap');
    return { selection, trackId: initialTrackId, identityScore: initialScore };
  }

  const checkpointId = `${jobId ?? 'job'}-second-ref`;

  if (!initialTrackId) {
    console.log('[SecondReference] Ambiguous first tap — requesting user second tap', {
      jobId,
      checkpointId,
      timestampMs: selection.timestampMs,
    });

    onConfirmationRequired({
      kind: 'second_reference',
      checkpointId,
      jobId: jobId ?? checkpointId,
      timestampMs: selection.timestampMs,
      anchorTimestampMs: selection.timestampMs,
    });

    let response: ConfirmationResponse;
    try {
      response = await waitForConfirmation(checkpointId, 300_000);
    } catch {
      return { selection, trackId: null, identityScore: initialScore };
    }

    if (response.action === 'skip_reference' || response.action === 'reject' || response.action === 'cancel') {
      return { selection, trackId: null, identityScore: initialScore };
    }

    if (response.normalizedX == null || response.normalizedY == null) {
      return { selection, trackId: null, identityScore: initialScore };
    }

    const ref: IdentityReference = {
      normalizedX: response.normalizedX,
      normalizedY: response.normalizedY,
      timestampMs: selection.timestampMs,
      label: 'secondary',
    };
    const updatedSelection = appendReference(selection, ref);
    const rematch = await matchReferencesToTrack(objectTracks, updatedSelection, frames, detections);

    return {
      selection: updatedSelection,
      trackId: rematch.trackId,
      identityScore: rematch.score,
    };
  }

  const track =
    objectTracks.find((t) => t.trackId === initialTrackId) ??
    [...objectTracks].sort((a, b) => b.samples.length - a.samples.length)[0];

  if (!track) {
    return { selection, trackId: initialTrackId, identityScore: initialScore };
  }

  const candidate =
    (await pickConfirmationCandidate(frames, track, selection.timestampMs, detections)) ??
    (await findBestReferenceAcrossClip(frames, track, detections, clipDurationMs));

  if (!candidate || !candidate.userIdentifiable) {
    const skipToMs = await findNextIdentifiableTimestamp(
      frames,
      track,
      selection.timestampMs,
      detections,
      clipDurationMs
    );

    if (!skipToMs) {
      return { selection, trackId: initialTrackId, identityScore: initialScore };
    }

    onConfirmationRequired({
      kind: 'occluded',
      checkpointId,
      jobId: jobId ?? checkpointId,
      anchorTimestampMs: selection.timestampMs,
      timestampMs: skipToMs,
    });

    try {
      await waitForConfirmation(checkpointId, 300_000);
    } catch {
      return { selection, trackId: initialTrackId, identityScore: initialScore };
    }

    return { selection, trackId: initialTrackId, identityScore: initialScore };
  }

  onConfirmationRequired({
    kind: 'second_reference',
    checkpointId,
    jobId: jobId ?? checkpointId,
    timestampMs: candidate.timestampMs,
    box: candidate.box,
    qualityScore: candidate.total,
    anchorTimestampMs: selection.timestampMs,
  });

  let response: ConfirmationResponse;
  try {
    response = await waitForConfirmation(checkpointId, 300_000);
  } catch {
    return { selection, trackId: initialTrackId, identityScore: initialScore };
  }

  if (response.action === 'skip_reference' || response.action === 'reject') {
    return { selection, trackId: initialTrackId, identityScore: initialScore };
  }

  if (response.action !== 'confirm' && response.confirmed !== true) {
    return { selection, trackId: initialTrackId, identityScore: initialScore };
  }

  const center = centerOfBox(candidate.box);
  const ref: IdentityReference = {
    normalizedX: response.normalizedX ?? center.x,
    normalizedY: response.normalizedY ?? center.y,
    timestampMs: candidate.timestampMs,
    label: 'secondary',
  };

  const updatedSelection = appendReference(selection, ref);
  const rematch = await matchReferencesToTrack(
    objectTracks,
    updatedSelection,
    frames,
    detections,
    { preserveTrackId: initialTrackId }
  );

  return {
    selection: updatedSelection,
    trackId: rematch.trackId ?? initialTrackId,
    identityScore: rematch.trackId ? rematch.score : Math.max(rematch.score, 0.5),
  };
}
