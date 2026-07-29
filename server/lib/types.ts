/** Shared types for the analysis server — mirrors the mobile AnalysisResponse shape. */

export type AnalysisMode = 'COACH_ME' | 'PERFORMANCE' | 'GOAL';

export type IdentityConfidenceLevel = 'HIGH' | 'LOW';

export interface IdentityReference {
  normalizedX: number;
  normalizedY: number;
  timestampMs: number;
  label: 'primary' | 'secondary' | 'tertiary';
}

export interface PlayerIdentityProfile {
  references: IdentityReference[];
  identityConfidence: IdentityConfidenceLevel;
}

export interface PlayerSelection {
  normalizedX: number;
  normalizedY: number;
  timestampMs: number;
  displayWidth: number;
  displayHeight: number;
  videoWidth?: number;
  videoHeight?: number;
  trackingQualityWarning?: boolean;
  reducedTrackingConfidence?: boolean;
  identityProfile?: PlayerIdentityProfile;
}

export type TrackingState = 'CONFIRMED' | 'PROBABLE' | 'LOST';

export interface TrackingBoundingBox {
  x: number;
  y: number;
  width: number;
  height: number;
}

export interface TrackingKeyframe {
  timestampMs: number;
  state: TrackingState;
  confidence: number;
  box: TrackingBoundingBox;
}

export interface TrackingCorrection {
  timestampMs: number;
  box: TrackingBoundingBox;
}

export interface TrackingInterval {
  startMs: number;
  endMs: number;
}

export interface PlayerTrackingData {
  keyframes: TrackingKeyframe[];
  userCorrections: TrackingCorrection[];
  confirmedIntervals: TrackingInterval[];
  uncertainIntervals: TrackingInterval[];
  lostIntervals: TrackingInterval[];
  previewAccepted: boolean;
  skipTrackingAfterMs?: number;
  identityConfidence?: IdentityConfidenceLevel;
}

export interface AnalysisTrackingMetadataLog {
  playerTrackingConfidence: number;
  completePlayConfidence: number;
  uncertainIntervals: string[];
  selectedPlayerVisiblePercentage: number;
  reidentificationCount: number;
}

export interface AnalysisRequestMetadata {
  mode: AnalysisMode;
  playerSelection: PlayerSelection;
  /** User-confirmed tracking preview data from the client. */
  playerTracking?: PlayerTrackingData;
  profile: {
    firstName: string;
    age: number;
    mainPosition: string;
    preferredFoot: string;
    playingLevel: string;
    playingStyle: string[];
    improvementGoals: string[];
    feedbackAreas: string[];
  };
  clip: {
    durationMs: number;
    fileName: string | null;
    fileSizeBytes: number | null;
  };
  questionType?: string;
  question?: string;
  context?: string | null;
}

export interface AnalysisScore {
  label: string;
  value: number;
}

export interface AnalysisResponse {
  title: string;
  summary: string;
  whatHappened: string;
  whyItMattered: string;
  betterOption: string;
  professionalInsight: string;
  trainingAdvice: string[];
  strengths: string[];
  improvements: string[];
  scores: AnalysisScore[];
  awards: string[];
}
