export type AnalysisMode = 'COACH_ME' | 'PERFORMANCE' | 'GOAL';

/** Which provider produced the report — used for dev visibility only. */
export type ReportAnalysisSource = 'gemini' | 'demo';

export type CoachingQuestionType =
  | 'RIGHT_DECISION'
  | 'BETTER_OPTION'
  | 'POSITIONING'
  | 'TECHNIQUE'
  | 'DID_WELL'
  | 'CUSTOM';

export interface ClipMetadata {
  uri: string;
  durationMs: number;
  fileName: string | null;
  fileSizeBytes: number | null;
}

/** Normalised tap on the visible video frame — independent of device size. */
export interface PlayerSelection {
  normalizedX: number;
  normalizedY: number;
  timestampMs: number;
  displayWidth: number;
  displayHeight: number;
  /** Video track width from the player (helps server verify coordinate mapping). */
  videoWidth?: number;
  /** Video track height from the player (helps server verify coordinate mapping). */
  videoHeight?: number;
  /** True when the tapped player appears small, distant, or hard to identify in-frame. */
  trackingQualityWarning?: boolean;
  /** User chose to continue despite trackingQualityWarning. */
  reducedTrackingConfidence?: boolean;
  /** Multi-frame identity profile for re-identification after camera movement. */
  identityProfile?: PlayerIdentityProfile;
}

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

export type TrackingState = 'CONFIRMED' | 'PROBABLE' | 'LOST';

/** Normalised bounding box in source video space (0–1). Origin top-left. */
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
  /** When set, tracking preview stops updating after this timestamp. */
  skipTrackingAfterMs?: number;
  identityConfidence?: IdentityConfidenceLevel;
}

/** Payload for the future real-AI pipeline — kept separate from report generators. */
export interface AnalysisRequest {
  clip: ClipMetadata;
  mode: AnalysisMode;
  profile: import('@/types/profile').PlayerProfile;
  playerSelection: PlayerSelection;
  questionType?: CoachingQuestionType;
  question?: string;
  context?: string | null;
}

export interface ScoredCategory {
  key: string;
  label: string;
  score: number;
}

interface BaseReport {
  id: string;
  createdAt: string;
  isDemo: boolean;
  /** Which analysis provider generated this report. Optional on reports saved before this field existed. */
  analysisSource?: ReportAnalysisSource;
  /** Why demo feedback was used instead of Gemini — dev visibility only. */
  analysisFallbackReason?: string;
  clip: ClipMetadata;
  mode: AnalysisMode;
  title: string;
  summary: string;
  playerSelection: PlayerSelection;
}

export interface CoachMeReport extends BaseReport {
  mode: 'COACH_ME';
  questionType: CoachingQuestionType;
  question: string;
  context: string | null;
  verdict: string;
  didWell: string[];
  couldImprove: string[];
  betterOption: string;
  trainingTakeaway: string;
}

export interface PerformanceReport extends BaseReport {
  mode: 'PERFORMANCE';
  categories: ScoredCategory[];
  overallScore: number;
  topStrength: string;
  biggestImprovement: string;
  coachSummary: string;
  trainingRecommendation: string;
}

export interface GoalReport extends BaseReport {
  mode: 'GOAL';
  categories: ScoredCategory[];
  overallScore: number;
  whyScoredThisWay: string;
  excellentPoint: string;
  couldBeBetter: string;
}

export type CoachingReport = CoachMeReport | PerformanceReport | GoalReport;

export type GenerateReportInput =
  | {
      mode: 'COACH_ME';
      profile: import('@/types/profile').PlayerProfile;
      clip: ClipMetadata;
      playerSelection: PlayerSelection;
      questionType: CoachingQuestionType;
      question: string;
      context: string | null;
    }
  | {
      mode: 'PERFORMANCE';
      profile: import('@/types/profile').PlayerProfile;
      clip: ClipMetadata;
      playerSelection: PlayerSelection;
    }
  | {
      mode: 'GOAL';
      profile: import('@/types/profile').PlayerProfile;
      clip: ClipMetadata;
      playerSelection: PlayerSelection;
    };
