export type AnalysisMode = 'COACH_ME' | 'PERFORMANCE' | 'GOAL';

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
