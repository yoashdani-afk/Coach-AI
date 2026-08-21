import type { TrackingBoundingBox, TrackingState } from '../types.js';

export type CoordinateSource = 'detection' | 'prediction' | 'interpolated';

export interface ExtractedFrame {
  timestampMs: number;
  width: number;
  height: number;
  jpeg: Buffer;
}

export interface PersonDetection {
  timestampMs: number;
  box: TrackingBoundingBox;
  confidence: number;
}

export interface AppearanceFeatures {
  shirtRgb: [number, number, number];
  shortsRgb: [number, number, number];
  socksRgb: [number, number, number];
  aspectRatio: number;
}

export interface TrackSample {
  timestampMs: number;
  box: TrackingBoundingBox;
  confidence: number;
  source: CoordinateSource;
  state: TrackingState;
}

export interface ObjectTrack {
  trackId: string;
  samples: TrackSample[];
  appearance: AppearanceFeatures | null;
  consecutiveMisses: number;
}

export interface TrackingPipelineProgress {
  stage:
    | 'job_accepted'
    | 'decoding_frames'
    | 'detecting_players'
    | 'building_tracks'
    | 'matching_references'
    | 'verifying_identity'
    | 'refining_track'
    | 'complete'
    | 'failed';
  message: string;
  jobId?: string;
  framesDone?: number;
  framesTotal?: number;
  processedDurationMs?: number;
  totalDurationMs?: number;
}

export interface TrackingTimelineResult {
  sourceWidth: number;
  sourceHeight: number;
  fps: number;
  selectedTrackId: string | null;
  reliable: boolean;
  failureMessage?: string;
  detectionsPerFrame: number;
  trackedFrameCount: number;
  keyframes: Array<{
    timestampMs: number;
    state: TrackingState;
    confidence: number;
    box: TrackingBoundingBox;
    trackId?: string;
    coordinateSource: CoordinateSource;
  }>;
}
