import { auditSelectedPlayerTimeline, buildSelectedPlayerTimeline } from '@/lib/selectedPlayerTrack';
import type { PlayerTrackingData, TrackingBoundingBox } from '@/types/analysis';

export interface TrackingValidationResult {
  ok: boolean;
  reason?: string;
  rawKeyframesCount: number;
  normalizedKeyframesCount: number;
  acceptedTimelineCount: number;
  coverageRatio?: number;
}

const MIN_APPROVAL_COVERAGE_RATIO = 0.55;

function effectiveCoverageRatio(tracking: PlayerTrackingData | null): number | undefined {
  if (!tracking) return undefined;
  if (tracking.confirmedCoverageRatio != null) return tracking.confirmedCoverageRatio;
  return tracking.coverageRatio;
}

function isValidBox(box: TrackingBoundingBox | undefined): boolean {
  if (!box) return false;
  return (
    Number.isFinite(box.x) &&
    Number.isFinite(box.y) &&
    Number.isFinite(box.width) &&
    Number.isFinite(box.height) &&
    box.width > 0 &&
    box.height > 0
  );
}

/** Gate approval — never enter approving without a usable selected-player timeline. */
export function validateTrackingForApproval(tracking: PlayerTrackingData | null): TrackingValidationResult {
  const rawKeyframesCount = tracking?.keyframes?.length ?? 0;
  const coverageRatio = effectiveCoverageRatio(tracking);

  if (!tracking) {
    return { ok: false, reason: 'missing_tracking', rawKeyframesCount: 0, normalizedKeyframesCount: 0, acceptedTimelineCount: 0 };
  }

  if (tracking.reliable === false) {
    return {
      ok: false,
      reason: 'unreliable_tracking',
      rawKeyframesCount,
      normalizedKeyframesCount: tracking.keyframes.length,
      acceptedTimelineCount: 0,
      coverageRatio,
    };
  }

  if (coverageRatio != null && coverageRatio < MIN_APPROVAL_COVERAGE_RATIO) {
    return {
      ok: false,
      reason: 'insufficient_coverage',
      rawKeyframesCount,
      normalizedKeyframesCount: tracking.keyframes.length,
      acceptedTimelineCount: 0,
      coverageRatio,
    };
  }

  if (!Array.isArray(tracking.keyframes) || tracking.keyframes.length === 0) {
    return { ok: false, reason: 'no_keyframes', rawKeyframesCount, normalizedKeyframesCount: 0, acceptedTimelineCount: 0, coverageRatio };
  }

  const withValidBox = tracking.keyframes.filter((k) => isValidBox(k.box));
  if (withValidBox.length === 0) {
    return {
      ok: false,
      reason: 'no_valid_boxes',
      rawKeyframesCount,
      normalizedKeyframesCount: tracking.keyframes.length,
      acceptedTimelineCount: 0,
      coverageRatio,
    };
  }

  const audit = auditSelectedPlayerTimeline(tracking);
  if (audit.acceptedKeyframes === 0) {
    return {
      ok: false,
      reason: 'no_accepted_timeline_samples',
      rawKeyframesCount,
      normalizedKeyframesCount: tracking.keyframes.length,
      acceptedTimelineCount: 0,
      coverageRatio,
    };
  }

  const timeline = buildSelectedPlayerTimeline(tracking);
  const selectedTrackId = tracking.selectedTrackId ?? null;
  if (selectedTrackId) {
    const belongsToSelected = timeline.some(
      (sample) => sample.trackId === selectedTrackId || sample.trackId == null
    );
    if (!belongsToSelected) {
      return {
        ok: false,
        reason: 'selected_track_not_found',
        rawKeyframesCount,
        normalizedKeyframesCount: tracking.keyframes.length,
        acceptedTimelineCount: audit.acceptedKeyframes,
        coverageRatio,
      };
    }
  }

  return {
    ok: true,
    rawKeyframesCount,
    normalizedKeyframesCount: tracking.keyframes.length,
    acceptedTimelineCount: audit.acceptedKeyframes,
    coverageRatio,
  };
}
