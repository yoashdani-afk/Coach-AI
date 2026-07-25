import type { ClipMetadata } from '@/types/analysis';
import { hashString } from '@/lib/reports/shared';

/** Deterministic per-clip adjustment so the same clip always receives the same demo score. */
export function clipCategoryOffset(clip: ClipMetadata, categoryKey: string): number {
  const seed = hashString(`${clip.uri}:${categoryKey}`);
  return ((seed % 7) - 3) * 0.1;
}

export function createSubmissionId(reportId: string): string {
  return `hof-${reportId}`;
}
