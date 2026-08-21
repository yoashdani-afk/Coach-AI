export interface StageTimingReport {
  stage: string;
  startMs: number;
  endMs: number;
  durationMs: number;
  framesProcessed?: number;
  effectiveFps?: number;
}

const reports: StageTimingReport[] = [];

export function resetStageTimings(): void {
  reports.length = 0;
}

export async function timeStage<T>(
  stage: string,
  fn: () => Promise<T>,
  opts?: { framesProcessed?: number }
): Promise<T> {
  const startMs = Date.now();
  const result = await fn();
  const endMs = Date.now();
  const durationMs = endMs - startMs;
  const framesProcessed = opts?.framesProcessed;
  const effectiveFps =
    framesProcessed && durationMs > 0 ? (framesProcessed / durationMs) * 1000 : undefined;

  const report: StageTimingReport = {
    stage,
    startMs,
    endMs,
    durationMs,
    framesProcessed,
    effectiveFps,
  };
  reports.push(report);

  console.log('[TrackingTiming]', {
    stage,
    startMs,
    endMs,
    durationMs,
    framesProcessed: framesProcessed ?? null,
    effectiveFps: effectiveFps != null ? Number(effectiveFps.toFixed(2)) : null,
  });

  return result;
}

export function logStageSync(stage: string, startMs: number, opts?: { framesProcessed?: number }): void {
  const endMs = Date.now();
  const durationMs = endMs - startMs;
  const framesProcessed = opts?.framesProcessed;
  const effectiveFps =
    framesProcessed && durationMs > 0 ? (framesProcessed / durationMs) * 1000 : undefined;

  reports.push({ stage, startMs, endMs, durationMs, framesProcessed, effectiveFps });
  console.log('[TrackingTiming]', {
    stage,
    startMs,
    endMs,
    durationMs,
    framesProcessed: framesProcessed ?? null,
    effectiveFps: effectiveFps != null ? Number(effectiveFps.toFixed(2)) : null,
  });
}

export function summarizeStageTimings(jobId?: string): StageTimingReport | null {
  if (reports.length === 0) return null;

  const sorted = [...reports].sort((a, b) => b.durationMs - a.durationMs);
  const slowest = sorted[0];

  console.log('[TrackingTiming] Summary', {
    jobId: jobId ?? null,
    totalStages: reports.length,
    slowestStage: slowest.stage,
    slowestDurationMs: slowest.durationMs,
    stages: reports.map((r) => ({
      stage: r.stage,
      durationMs: r.durationMs,
      effectiveFps: r.effectiveFps != null ? Number(r.effectiveFps.toFixed(2)) : null,
    })),
  });

  return slowest;
}

export function getStageTimings(): StageTimingReport[] {
  return [...reports];
}
