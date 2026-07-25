import type {
  AnalysisMode,
  AnalysisRequest,
  ClipMetadata,
  CoachingQuestionType,
  PlayerSelection,
} from '@/types/analysis';
import type { PlayerProfile } from '@/types/profile';

export function buildAnalysisRequest(params: {
  clip: ClipMetadata;
  mode: AnalysisMode;
  profile: PlayerProfile;
  playerSelection: PlayerSelection;
  questionType?: CoachingQuestionType;
  question?: string;
  context?: string | null;
}): AnalysisRequest {
  return {
    clip: params.clip,
    mode: params.mode,
    profile: params.profile,
    playerSelection: params.playerSelection,
    questionType: params.questionType,
    question: params.question,
    context: params.context ?? null,
  };
}
