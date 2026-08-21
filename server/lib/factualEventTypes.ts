export type PlayType =
  | 'open_play'
  | 'free_kick'
  | 'corner'
  | 'throw_in'
  | 'penalty'
  | 'unknown';

export type PlayEventType =
  | 'short_pass'
  | 'long_pass'
  | 'shot'
  | 'goal'
  | 'cross'
  | 'tackle'
  | 'dribble'
  | 'run'
  | 'save'
  | 'set_piece'
  | 'other';

export type EventActor = 'selected_player' | 'teammate' | 'opponent' | 'unknown';

export interface CompletePlayEventFact {
  startMs: number;
  endMs: number;
  event: PlayEventType | string;
  actor: EventActor | string;
  confidence: number;
  evidence: string;
}

export interface SelectedPlayerEventFact {
  startMs: number;
  endMs: number;
  action: string;
  confidence: number;
  visible: boolean;
  evidence: string;
}

export interface FactualEventAnalysis {
  playType: PlayType | string;
  goalOccurred: boolean | 'uncertain';
  completePlayTimeline: CompletePlayEventFact[];
  selectedPlayerTimeline: SelectedPlayerEventFact[];
  uncertainEvents: string[];
}

export interface DenseFrame {
  timestampMs: number;
  jpegBase64: string;
  width?: number;
  height?: number;
  orientation?: 'landscape' | 'portrait';
}

export interface DenseFrameExtractionResult {
  frames: DenseFrame[];
  width: number;
  height: number;
  fps: number;
  videoDurationMs: number;
}

export interface ObservationSequenceEvent {
  timestampMs: number;
  actor: EventActor | string;
  action: string;
  confidence: number;
  visualEvidence: string;
}

export interface VideoObservation {
  sequence: ObservationSequenceEvent[];
  goalVisible: boolean | 'uncertain';
  selectedPlayerActions: string[];
  uncertainties: string[];
}

export interface VerifiedEventFact {
  timestampMs: number;
  actor: EventActor | string;
  action: string;
  confidence: number;
  visualEvidence: string;
  correctionNote?: string;
}

export interface VideoVerificationResult {
  verifiedEvents: VerifiedEventFact[];
  rejectedEvents: VerifiedEventFact[];
  correctedEvents: VerifiedEventFact[];
  overallConfidence: number;
}

export interface VideoUnderstandingResult {
  observation: VideoObservation;
  verification: VideoVerificationResult;
  factual: FactualEventAnalysis;
  auditModel: string;
}
