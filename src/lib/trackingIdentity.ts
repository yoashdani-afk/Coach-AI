import type { TrackingBoundingBox, TrackingState } from '@/types/analysis';

const IDENTITY_SWITCH_THRESHOLD = 0.18;
const HYSTERESIS_FRAMES_REQUIRED = 3;

export interface IdentityHysteresisState {
  lastBox: TrackingBoundingBox | null;
  lastState: TrackingState;
  pendingJumpBox: TrackingBoundingBox | null;
  pendingJumpCount: number;
  candidateId: string;
}

export function createIdentityHysteresisState(
  initialBox: TrackingBoundingBox | null = null
): IdentityHysteresisState {
  return {
    lastBox: initialBox,
    lastState: 'CONFIRMED',
    pendingJumpBox: null,
    pendingJumpCount: 0,
    candidateId: 'manual-reference',
  };
}

function boxCenter(box: TrackingBoundingBox): { x: number; y: number } {
  return { x: box.x + box.width / 2, y: box.y + box.height / 2 };
}

function boxDistance(a: TrackingBoundingBox, b: TrackingBoundingBox): number {
  const ca = boxCenter(a);
  const cb = boxCenter(b);
  return Math.hypot(cb.x - ca.x, cb.y - ca.y);
}

/**
 * Prevents instant identity switches when a candidate jumps toward another player.
 * Requires consecutive frames of strong evidence before accepting a large displacement.
 */
export function applyIdentityHysteresis(
  incomingBox: TrackingBoundingBox,
  incomingState: TrackingState,
  incomingConfidence: number,
  state: IdentityHysteresisState
): {
  box: TrackingBoundingBox;
  state: TrackingState;
  confidence: number;
  hysteresis: IdentityHysteresisState;
} {
  if (incomingState === 'LOST') {
    return {
      box: state.lastBox ?? incomingBox,
      state: 'LOST',
      confidence: incomingConfidence,
      hysteresis: {
        ...state,
        lastState: 'LOST',
        pendingJumpBox: null,
        pendingJumpCount: 0,
      },
    };
  }

  if (!state.lastBox) {
    return {
      box: incomingBox,
      state: incomingState === 'PROBABLE' ? 'PROBABLE' : 'CONFIRMED',
      confidence: incomingConfidence,
      hysteresis: {
        ...state,
        lastBox: incomingBox,
        lastState: incomingState,
        pendingJumpBox: null,
        pendingJumpCount: 0,
      },
    };
  }

  const jump = boxDistance(state.lastBox, incomingBox);

  if (jump < IDENTITY_SWITCH_THRESHOLD) {
    return {
      box: incomingBox,
      state: incomingState,
      confidence: incomingConfidence,
      hysteresis: {
        ...state,
        lastBox: incomingBox,
        lastState: incomingState,
        pendingJumpBox: null,
        pendingJumpCount: 0,
      },
    };
  }

  const pendingSame =
    state.pendingJumpBox != null && boxDistance(state.pendingJumpBox, incomingBox) < 0.06;
  const pendingJumpCount = pendingSame ? state.pendingJumpCount + 1 : 1;

  if (pendingJumpCount >= HYSTERESIS_FRAMES_REQUIRED && incomingConfidence >= 0.72) {
    return {
      box: incomingBox,
      state: incomingState === 'PROBABLE' ? 'PROBABLE' : 'CONFIRMED',
      confidence: incomingConfidence,
      hysteresis: {
        ...state,
        lastBox: incomingBox,
        lastState: incomingState,
        pendingJumpBox: null,
        pendingJumpCount: 0,
      },
    };
  }

  return {
    box: state.lastBox,
    state: 'SEARCHING',
    confidence: Math.min(incomingConfidence, 0.4),
    hysteresis: {
      ...state,
      lastState: 'SEARCHING',
      pendingJumpBox: incomingBox,
      pendingJumpCount,
    },
  };
}
