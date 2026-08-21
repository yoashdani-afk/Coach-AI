import type { PlayerTrackingData } from '@/types/analysis';
import type { TrackingJobSnapshot } from '@/lib/trackingJobClient';

export function logTrackingResponseSummary(
  snapshot: TrackingJobSnapshot,
  tracking: PlayerTrackingData | null
): void {
  if (!__DEV__) return;

  const first = tracking?.keyframes?.[0] ?? null;
  const last = tracking?.keyframes?.[tracking.keyframes.length - 1] ?? null;

  console.log('[TrackingResponse]', {
    jobId: snapshot.jobId,
    status: snapshot.status,
    selectedTrackId: tracking?.selectedTrackId ?? null,
    keyframesCount: tracking?.keyframes?.length ?? 0,
    partialKeyframesCount: snapshot.partialKeyframes.length,
    lostIntervalsCount: tracking?.lostIntervals?.length ?? 0,
    confirmedIntervalsCount: tracking?.confirmedIntervals?.length ?? 0,
    tracksCount: null,
    firstKeyframe: first,
    lastKeyframe: last,
    rawResultKeys: snapshot.result ? Object.keys(snapshot.result as object) : [],
    recentEventTypes: snapshot.events.map((e) => e.type),
  });
}
