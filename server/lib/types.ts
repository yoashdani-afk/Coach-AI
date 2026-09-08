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

export type TrackingState = 'CONFIRMED' | 'PROBABLE' | 'SEARCHING' | 'LOST';

export interface TrackingBoundingBox {
  x: number;
  y: number;
  width: number;
  height: number;
}

export type CoordinateSource = 'detection' | 'prediction' | 'interpolated';

export interface TrackingKeyframe {
  timestampMs: number;
  state: TrackingState;
  confidence: number;
  box: TrackingBoundingBox;
  trackId?: string;
  coordinateSource?: CoordinateSource;
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
  /** Original video dimensions used for normalized coordinates. */
  sourceWidth?: number;
  sourceHeight?: number;
  /** Sampling rate of the tracking timeline (~12 FPS). */
  fps?: number;
  selectedTrackId?: string | null;
  /** False when CV pipeline could not reliably follow the selected player. */
  reliable?: boolean;
  /** Fraction of clip duration with confirmed player visibility (0–1). */
  confirmedCoverageRatio?: number;
  /** @deprecated Use confirmedCoverageRatio. */
  coverageRatio?: number;
  failureMessage?: string;
  /** When set, partial rebuild keeps keyframes before this timestamp. */
  rebuildFromMs?: number;
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
  status?: 'success';
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
  requestId?: string;
  /** Performance mode only — null when no clear single weakness. */
  primaryImprovementArea?: string | null;
  /** Performance mode only — null when area is null. */
  primaryImprovementReasoning?: string | null;
}

export interface InsufficientEvidenceResponse {
  status: 'insufficient_evidence';
  message: string;
  scores: null;
  overallScore: null;
  report: null;
  requestId: string;
  reason?: string;
}

export type AnalyseVideoApiResponse = AnalysisResponse | InsufficientEvidenceResponse;

export function isInsufficientEvidenceResponse(
  value: unknown
): value is InsufficientEvidenceResponse {
  return (
    !!value &&
    typeof value === 'object' &&
    (value as InsufficientEvidenceResponse).status === 'insufficient_evidence'
  );
}
