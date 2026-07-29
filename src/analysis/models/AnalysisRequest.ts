import type {
  AnalysisMode,
  ClipMetadata,
  CoachingQuestionType,
  PlayerSelection,
  PlayerTrackingData,
} from '@/types/analysis';
import type { PlayerProfile } from '@/types/profile';

/** Payload sent from the mobile app to the analysis API. */
export interface AnalysisRequestPayload {
  clip: ClipMetadata;
  mode: AnalysisMode;
  profile: PlayerProfile;
  playerSelection: PlayerSelection;
  playerTracking?: PlayerTrackingData;
  questionType?: CoachingQuestionType;
  question?: string;
  context?: string | null;
}

/** Metadata JSON field sent alongside the video in multipart uploads. */
export interface AnalysisRequestMetadata {
  mode: AnalysisMode;
  playerSelection: PlayerSelection;
  playerTracking?: PlayerTrackingData;
  profile: {
    firstName: string;
    age: number;
    mainPosition: PlayerProfile['mainPosition'];
    preferredFoot: PlayerProfile['preferredFoot'];
    playingLevel: PlayerProfile['playingLevel'];
    playingStyle: string[];
    improvementGoals: PlayerProfile['improvementGoals'];
    feedbackAreas: PlayerProfile['feedbackAreas'];
  };
  clip: Pick<ClipMetadata, 'durationMs' | 'fileName' | 'fileSizeBytes'>;
  questionType?: CoachingQuestionType;
  question?: string;
  context?: string | null;
}

export function buildAnalysisRequest(params: {
  clip: ClipMetadata;
  mode: AnalysisMode;
  profile: PlayerProfile;
  playerSelection: PlayerSelection;
  playerTracking?: PlayerTrackingData;
  questionType?: CoachingQuestionType;
  question?: string;
  context?: string | null;
}): AnalysisRequestPayload {
  return {
    clip: params.clip,
    mode: params.mode,
    profile: params.profile,
    playerSelection: params.playerSelection,
    playerTracking: params.playerTracking,
    questionType: params.questionType,
    question: params.question,
    context: params.context ?? null,
  };
}

export function toRequestMetadata(request: AnalysisRequestPayload): AnalysisRequestMetadata {
  return {
    mode: request.mode,
    playerSelection: request.playerSelection,
    playerTracking: request.playerTracking,
    profile: {
      firstName: request.profile.firstName,
      age: request.profile.age,
      mainPosition: request.profile.mainPosition,
      preferredFoot: request.profile.preferredFoot,
      playingLevel: request.profile.playingLevel,
      playingStyle: request.profile.playingStyle,
      improvementGoals: request.profile.improvementGoals,
      feedbackAreas: request.profile.feedbackAreas,
    },
    clip: {
      durationMs: request.clip.durationMs,
      fileName: request.clip.fileName,
      fileSizeBytes: request.clip.fileSizeBytes,
    },
    questionType: request.questionType,
    question: request.question,
    context: request.context,
  };
}
