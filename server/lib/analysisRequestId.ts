import { randomUUID } from 'node:crypto';

export function createAnalysisRequestId(): string {
  return randomUUID();
}
