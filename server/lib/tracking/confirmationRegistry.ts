export type ConfirmationPromptKind = 'second_reference' | 'occluded';

export type ConfirmationAction =
  | 'confirm'
  | 'reject'
  | 'continue_auto'
  | 'skip_reference'
  | 'cancel';

export interface ConfirmationRequest {
  kind: ConfirmationPromptKind;
  checkpointId: string;
  jobId: string;
  /** Frame shown to the user — always the clearest nearby frame, never a bad anchor. */
  timestampMs?: number;
  box?: import('../types.js').TrackingBoundingBox;
  qualityScore?: number;
  previewImageBase64?: string;
  anchorTimestampMs?: number;
  rejectReasons?: string[];
}

export interface ConfirmationResponse {
  action: ConfirmationAction;
  confirmed?: boolean;
  normalizedX?: number;
  normalizedY?: number;
}

interface PendingConfirmation {
  resolve: (response: ConfirmationResponse) => void;
  reject: (error: Error) => void;
  timeout: ReturnType<typeof setTimeout>;
}

const pending = new Map<string, PendingConfirmation>();

export function waitForConfirmation(
  checkpointId: string,
  timeoutMs = 120_000
): Promise<ConfirmationResponse> {
  const existing = pending.get(checkpointId);
  if (existing) {
    clearTimeout(existing.timeout);
    pending.delete(checkpointId);
  }

  return new Promise((resolve, reject) => {
    const timeout = setTimeout(() => {
      pending.delete(checkpointId);
      reject(new Error('Identity confirmation timed out'));
    }, timeoutMs);

    pending.set(checkpointId, { resolve, reject, timeout });
  });
}

export function resolveConfirmation(
  checkpointId: string,
  response: ConfirmationResponse
): boolean {
  const entry = pending.get(checkpointId);
  if (!entry) return false;
  clearTimeout(entry.timeout);
  pending.delete(checkpointId);
  entry.resolve(response);
  return true;
}

export function rejectConfirmation(checkpointId: string, message: string): boolean {
  const entry = pending.get(checkpointId);
  if (!entry) return false;
  clearTimeout(entry.timeout);
  pending.delete(checkpointId);
  entry.reject(new Error(message));
  return true;
}

export function clearConfirmationsForJob(jobId: string): void {
  for (const [id, entry] of pending.entries()) {
    if (!id.startsWith(jobId)) continue;
    clearTimeout(entry.timeout);
    entry.reject(new Error('Tracking job cancelled'));
    pending.delete(id);
  }
}
