import type { DenseFrame } from './factualEventTypes.js';

/** Leave room for reference crop + prompt overhead in one Gemini call. */
export const MAX_FRAMES_PER_GEMINI_CALL = 56;
export const BATCH_OVERLAP_FRAMES = 4;

export interface FrameBatch {
  batchIndex: number;
  batchCount: number;
  startMs: number;
  endMs: number;
  frames: DenseFrame[];
}

export function splitFramesIntoBatches(
  frames: DenseFrame[],
  maxFramesPerBatch = MAX_FRAMES_PER_GEMINI_CALL
): FrameBatch[] {
  if (frames.length === 0) return [];
  if (frames.length <= maxFramesPerBatch) {
    return [
      {
        batchIndex: 0,
        batchCount: 1,
        startMs: frames[0]!.timestampMs,
        endMs: frames[frames.length - 1]!.timestampMs,
        frames,
      },
    ];
  }

  const batches: FrameBatch[] = [];
  const step = Math.max(1, maxFramesPerBatch - BATCH_OVERLAP_FRAMES);
  let start = 0;

  while (start < frames.length) {
    const slice = frames.slice(start, start + maxFramesPerBatch);
    batches.push({
      batchIndex: batches.length,
      batchCount: 0,
      startMs: slice[0]!.timestampMs,
      endMs: slice[slice.length - 1]!.timestampMs,
      frames: slice,
    });
    if (start + maxFramesPerBatch >= frames.length) break;
    start += step;
  }

  const batchCount = batches.length;
  return batches.map((batch) => ({ ...batch, batchCount }));
}
