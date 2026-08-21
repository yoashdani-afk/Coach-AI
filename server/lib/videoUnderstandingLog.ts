/** Pretty-print structured logs for the video-understanding pipeline (never `[Object]`). */
export function logVideoUnderstandingJson(
  label: string,
  value: unknown,
  requestId?: string
): void {
  const prefix = requestId ? `[VideoUnderstanding] ${label} ${requestId}` : `[VideoUnderstanding] ${label}`;
  console.log(`${prefix}\n${JSON.stringify(value, null, 2)}`);
}

export function logVideoUnderstandingLine(label: string, requestId: string): void {
  console.log(`[VideoUnderstanding] ${label} ${requestId}`);
}

export function logVideoUnderstandingCoachingSkipped(
  requestId: string,
  reason: string
): void {
  logVideoUnderstandingJson(
    'COACHING SKIPPED',
    { requestId, reason },
    requestId
  );
}

export function logVideoUnderstandingFinalStatus(
  requestId: string,
  status: 'success' | 'insufficient_evidence' | 'error',
  detail: Record<string, unknown>
): void {
  logVideoUnderstandingJson(
    'FINAL STATUS',
    { requestId, status, ...detail },
    requestId
  );
}
