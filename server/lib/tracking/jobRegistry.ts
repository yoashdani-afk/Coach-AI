import { randomUUID } from 'node:crypto';

const activeJobs = new Map<string, AbortController>();

export function registerTrackingJob(jobId: string): AbortSignal {
  const existing = activeJobs.get(jobId);
  if (existing) existing.abort();

  const controller = new AbortController();
  activeJobs.set(jobId, controller);
  return controller.signal;
}

export function cancelTrackingJob(jobId: string, reason = 'unknown'): boolean {
  const controller = activeJobs.get(jobId);
  if (!controller) return false;
  controller.abort();
  activeJobs.delete(jobId);
  console.log('[TrackingPreview] Job abort signal sent', { jobId, reason });
  return true;
}

export function releaseTrackingJob(jobId: string): void {
  activeJobs.delete(jobId);
}

export function createTrackingJobId(): string {
  return randomUUID();
}

export function mergeAbortSignals(...signals: AbortSignal[]): AbortSignal {
  const controller = new AbortController();
  for (const signal of signals) {
    if (signal.aborted) {
      controller.abort();
      return controller.signal;
    }
    signal.addEventListener('abort', () => controller.abort(), { once: true });
  }
  return controller.signal;
}
