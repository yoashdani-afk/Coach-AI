export type TrackingEngine = 'custom' | 'botsort';

/** Which player-tracking backend to use. Defaults to botsort in development. */
export function getTrackingEngine(): TrackingEngine {
  const raw = (process.env.TRACKING_ENGINE ?? 'botsort').trim().toLowerCase();
  if (raw === 'custom') return 'custom';
  return 'botsort';
}

export function isBotsortEngine(): boolean {
  return getTrackingEngine() === 'botsort';
}

export function getTrackerServiceUrl(): string {
  return (process.env.TRACKER_SERVICE_URL ?? 'http://127.0.0.1:8765').replace(/\/$/, '');
}
