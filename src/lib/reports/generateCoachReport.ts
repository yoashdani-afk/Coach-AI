import type {
  ClipMetadata,
  CoachMeReport,
  CoachingQuestionType,
  PlayerSelection,
} from '@/types/analysis';
import type { PlayerProfile } from '@/types/profile';
import { coachMeContent } from '@/lib/coaching/feedbackBank';
import {
  baseReportFields,
  buildProfileContext,
  createReportId,
  hashString,
} from './shared';

export function generateCoachReport(params: {
  profile: PlayerProfile;
  clip: ClipMetadata;
  playerSelection: PlayerSelection;
  questionType: CoachingQuestionType;
  question: string;
  context: string | null;
}): CoachMeReport {
  const { profile, clip, playerSelection, questionType, question, context } = params;
  const id = createReportId(clip, question);
  const seed = hashString(clip.uri + questionType + profile.mainPosition);
  const profileCtx = buildProfileContext(profile);

  const content = coachMeContent(questionType, {
    positionLabel: profileCtx.positionLabel,
    footLabel: profileCtx.footLabel,
    contextNote: context?.trim()
      ? `Context — "${context.trim()}" — confirms which player we are analysing in this frame.`
      : null,
    customQuestion: questionType === 'CUSTOM' ? question : undefined,
    seed,
  });

  return {
    id,
    mode: 'COACH_ME',
    title: question,
    summary: content.verdict,
    playerSelection,
    questionType,
    question,
    context: context?.trim() || null,
    ...content,
    ...baseReportFields(clip),
  };
}
