import type { IdentityReference, PlayerSelection } from '../types.js';
import type { ExtractedFrame, ObjectTrack, PersonDetection } from './types.js';
import { exportTrackTimeline, matchReferencesToTrack } from './identityMatcher.js';
import {
  AUTO_REF_THRESHOLD,
  findWeakIdentityAnchors,
  pickAutoReferenceCandidate,
  centerOfBox,
} from './autoReferenceSelector.js';
import type { TrackingTimelineResult } from './types.js';

export interface IdentityRecoveryResult {
  keyframes: TrackingTimelineResult['keyframes'];
  trackId: string | null;
  identityScore: number;
  autoReferencesAdded: IdentityReference[];
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

function appendReference(
  selection: PlayerSelection,
  ref: IdentityReference
): PlayerSelection {
  const existing = referencesFromSelection(selection);
  const label: IdentityReference['label'] =
    existing.length === 1 ? 'secondary' : 'tertiary';
  const references = [...existing, { ...ref, label }];
  return {
    ...selection,
    identityProfile: {
      references,
      identityConfidence: selection.identityProfile?.identityConfidence ?? 'HIGH',
    },
  };
}

async function applyReferenceAndRematch(
  objectTracks: ObjectTrack[],
  selection: PlayerSelection,
  ref: IdentityReference,
  frames: ExtractedFrame[],
  detections: PersonDetection[],
  preserveTrackId: string | null
): Promise<{
  selection: PlayerSelection;
  trackId: string | null;
  identityScore: number;
  keyframes: TrackingTimelineResult['keyframes'];
}> {
  const updatedSelection = appendReference(selection, ref);
  const rematch = await matchReferencesToTrack(
    objectTracks,
    updatedSelection,
    frames,
    detections,
    { preserveTrackId }
  );
  const effectiveTrackId = rematch.trackId ?? preserveTrackId;
  let keyframes: TrackingTimelineResult['keyframes'] = [];
  if (rematch.trackId && rematch.trackId !== preserveTrackId) {
    const matched = objectTracks.find((t) => t.trackId === rematch.trackId);
    if (matched) {
      keyframes = exportTrackTimeline(matched, rematch.trackId);
    }
  }
  if (!rematch.trackId && preserveTrackId) {
    console.log('[IdentityRecovery] Rematch rejected — keeping tap anchor track', {
      preserveTrackId,
      rematchScore: rematch.score,
    });
  }
  return {
    selection: updatedSelection,
    trackId: effectiveTrackId,
    identityScore: rematch.trackId ? rematch.score : Math.max(rematch.score, 0.5),
    keyframes,
  };
}

/** Silently adds auto-references at weak identity anchors — no user prompts during build. */
export async function recoverIdentityWithAutoReferences(params: {
  frames: ExtractedFrame[];
  detections: PersonDetection[];
  objectTracks: ObjectTrack[];
  selection: PlayerSelection;
  trackId: string | null;
  initialKeyframes: TrackingTimelineResult['keyframes'];
  identityScore: number;
}): Promise<IdentityRecoveryResult> {
  const {
    frames,
    detections,
    objectTracks,
    selection: initialSelection,
    trackId: initialTrackId,
    initialKeyframes,
    identityScore: initialScore,
  } = params;

  if (!initialTrackId) {
    return {
      keyframes: initialKeyframes,
      trackId: null,
      identityScore: initialScore,
      autoReferencesAdded: [],
    };
  }

  let selection = initialSelection;
  let trackId: string | null = initialTrackId;
  let identityScore = initialScore;
  let keyframes = initialKeyframes;
  const autoReferencesAdded: IdentityReference[] = [];

  const track = objectTracks.find((t) => t.trackId === trackId);
  if (!track) {
    return { keyframes, trackId, identityScore, autoReferencesAdded };
  }

  const weakAnchors = findWeakIdentityAnchors(keyframes);
  const handledAnchors = new Set<number>();

  for (const anchorMs of weakAnchors) {
    if (handledAnchors.has(anchorMs)) continue;
    handledAnchors.add(anchorMs);

    const autoCandidate = await pickAutoReferenceCandidate(
      frames,
      track,
      anchorMs,
      detections
    );

    if (!autoCandidate || autoCandidate.total < AUTO_REF_THRESHOLD) continue;

    const center = centerOfBox(autoCandidate.box);
    const ref: IdentityReference = {
      normalizedX: center.x,
      normalizedY: center.y,
      timestampMs: autoCandidate.timestampMs,
      label: autoReferencesAdded.length === 0 ? 'secondary' : 'tertiary',
    };

    console.log('[IdentityRecovery] Silently adding auto-reference', {
      anchorMs,
      refMs: autoCandidate.timestampMs,
      score: autoCandidate.total,
    });

    autoReferencesAdded.push(ref);
    const rematched = await applyReferenceAndRematch(
      objectTracks,
      selection,
      ref,
      frames,
      detections,
      trackId
    );
    selection = rematched.selection;
    trackId = rematched.trackId;
    identityScore = rematched.identityScore;
    if (rematched.keyframes.length) keyframes = rematched.keyframes;
  }

  return { keyframes, trackId, identityScore, autoReferencesAdded };
}

export function mergeTrackingPrefix(
  prefixKeyframes: TrackingTimelineResult['keyframes'],
  tailKeyframes: TrackingTimelineResult['keyframes'],
  fromTimestampMs: number
): TrackingTimelineResult['keyframes'] {
  const kept = prefixKeyframes.filter((k) => k.timestampMs < fromTimestampMs);
  const tail = tailKeyframes.filter((k) => k.timestampMs >= fromTimestampMs);
  return [...kept, ...tail].sort((a, b) => a.timestampMs - b.timestampMs);
}
