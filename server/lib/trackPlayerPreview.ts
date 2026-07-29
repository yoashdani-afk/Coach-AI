import { trackPlayerPreviewFast } from './fastPlayerTracking.js';
import type { AnalysisRequestMetadata, PlayerTrackingData } from './types.js';

/** Lightweight tracking preview — sampled frames only, no full video upload. */
export async function trackPlayerPreviewWithGemini(params: {
  videoBuffer: Buffer;
  mimeType: string;
  originalName: string;
  metadata: AnalysisRequestMetadata;
}): Promise<PlayerTrackingData> {
  return trackPlayerPreviewFast(params);
}
