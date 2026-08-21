import type { PersonDetection } from './types.js';
import { boxCenter } from './appearanceFeatures.js';

const NEARBY_MATCH_MAX = 0.18;

function medianShift(shifts: Array<{ dx: number; dy: number }>): { dx: number; dy: number } {
  if (shifts.length === 0) return { dx: 0, dy: 0 };
  const sortedX = [...shifts].sort((a, b) => a.dx - b.dx);
  const sortedY = [...shifts].sort((a, b) => a.dy - b.dy);
  const mid = Math.floor(shifts.length / 2);
  const dx =
    shifts.length % 2
      ? sortedX[mid]!.dx
      : (sortedX[mid - 1]!.dx + sortedX[mid]!.dx) / 2;
  const dy =
    shifts.length % 2
      ? sortedY[mid]!.dy
      : (sortedY[mid - 1]!.dy + sortedY[mid]!.dy) / 2;
  return { dx, dy };
}

/** Estimate per-frame global camera shift from nearest-neighbor detection matching. */
export function estimateFrameCameraShift(
  prevDets: PersonDetection[],
  curDets: PersonDetection[]
): { dx: number; dy: number } {
  const shifts: Array<{ dx: number; dy: number }> = [];

  for (const d1 of prevDets) {
    let best: PersonDetection | null = null;
    let bestDist = Infinity;
    for (const d2 of curDets) {
      const dist = Math.hypot(
        boxCenter(d1.box).x - boxCenter(d2.box).x,
        boxCenter(d1.box).y - boxCenter(d2.box).y
      );
      if (dist < bestDist) {
        bestDist = dist;
        best = d2;
      }
    }
    if (best && bestDist < NEARBY_MATCH_MAX) {
      shifts.push({
        dx: boxCenter(best.box).x - boxCenter(d1.box).x,
        dy: boxCenter(best.box).y - boxCenter(d1.box).y,
      });
    }
  }

  return medianShift(shifts);
}

/** Cumulative camera shift between two timestamps (for pan-aware spatial checks). */
export function cumulativeCameraShift(
  detectionsByTime: Map<number, PersonDetection[]>,
  tStart: number,
  tEnd: number
): { dx: number; dy: number } {
  const timestamps = [...detectionsByTime.keys()].sort((a, b) => a - b);
  const lo = Math.min(tStart, tEnd);
  const hi = Math.max(tStart, tEnd);
  const inRange = timestamps.filter((t) => t >= lo && t <= hi);
  if (inRange.length < 2) return { dx: 0, dy: 0 };

  let totalDx = 0;
  let totalDy = 0;
  const forward = tEnd >= tStart;

  for (let i = 1; i < inRange.length; i++) {
    const prevTs = inRange[i - 1]!;
    const curTs = inRange[i]!;
    const prev = detectionsByTime.get(prevTs) ?? [];
    const cur = detectionsByTime.get(curTs) ?? [];
    const shift = estimateFrameCameraShift(prev, cur);
    totalDx += forward ? shift.dx : -shift.dx;
    totalDy += forward ? shift.dy : -shift.dy;
  }

  return { dx: totalDx, dy: totalDy };
}
