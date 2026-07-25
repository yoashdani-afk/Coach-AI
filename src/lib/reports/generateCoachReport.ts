import type {
  ClipMetadata,
  CoachMeReport,
  CoachingQuestionType,
  PlayerSelection,
} from '@/types/analysis';
import type { PlayerProfile } from '@/types/profile';
import {
  baseReportFields,
  buildProfileContext,
  createReportId,
  hashString,
} from './shared';

type ReportContent = Pick<
  CoachMeReport,
  'verdict' | 'didWell' | 'couldImprove' | 'betterOption' | 'trainingTakeaway'
>;

interface ContentContext {
  positionLabel: string;
  levelLabel: string;
  footLabel: string;
  firstName: string;
  contextNote: string | null;
  customVerdict: string;
}

const CONTENT_BY_QUESTION: Record<CoachingQuestionType, (ctx: ContentContext) => ReportContent> = {
  RIGHT_DECISION: (ctx) => ({
    verdict:
      'Mostly yes — your idea was sound, but the timing was half a second late under pressure.',
    didWell: [
      'You spotted space early and showed intent to play forward rather than turning back.',
      `As a ${ctx.positionLabel}, choosing to play on the front foot fits your role.`,
      ctx.contextNote,
    ].filter(Boolean) as string[],
    couldImprove: [
      'You committed before checking shoulder — one quick scan would have confirmed the pass was on.',
      'Your first touch was slightly heavy, which forced a rushed second action.',
    ],
    betterOption:
      'Take one touch to set, scan left and right, then play the simple pass to the free teammate. A safe pass keeps the attack moving.',
    trainingTakeaway:
      'In your next session, receive with an open body shape and call out your first pass before the ball arrives.',
  }),

  BETTER_OPTION: (ctx) => ({
    verdict:
      'There was a cleaner option available — you forced the harder path when a simpler one was open.',
    didWell: [
      'You showed bravery to receive in a tight area instead of hiding from the ball.',
      'Your touch was controlled enough to keep possession under pressure.',
    ],
    couldImprove: [
      'The pass into traffic was low-percentage — the wide player was free on the other side.',
      'You did not use your body to shield before deciding, so the defender closed the lane quickly.',
    ],
    betterOption: `Release the ball earlier to the ${ctx.footLabel.toLowerCase()}-side option, or carry one touch wide where the space was. Patience beats forcing a line that is not there.`,
    trainingTakeaway:
      'Practice 3v2 rondos: before every pass, point to the free player. Build the habit of finding the easy option first.',
  }),

  POSITIONING: (ctx) => ({
    verdict:
      'Your starting position was reasonable, but you drifted ball-side and lost sight of the runner behind you.',
    didWell: [
      'You stayed goal-side in the first phase and showed good awareness of the nearest opponent.',
      'You recovered with intent when the ball moved — that attitude is exactly what coaches want to see.',
    ],
    couldImprove: [
      'You were flat-footed when the ball switched — a step early would have cut out the passing lane.',
      'Your spacing was too tight to the ball carrier, which removed your ability to see both ball and runner.',
    ],
    betterOption:
      'Hold a position half a step deeper and side-on. Scan as the ball travels, not when it arrives at your feet.',
    trainingTakeaway:
      'Shadow defending drill: jockey while checking your shoulder every two seconds. Repeat until scanning feels automatic.',
  }),

  TECHNIQUE: (ctx) => ({
    verdict:
      'The technique was close — small details in body shape and contact point held you back from a cleaner action.',
    didWell: [
      `You used your ${ctx.footLabel.toLowerCase()} foot confidently in a moment that mattered.`,
      'Your balance was generally good — you did not lean back or rush the contact.',
    ],
    couldImprove: [
      'Your planting foot was too narrow, which limited power and accuracy on the action.',
      'You struck across the ball slightly instead of through the centre of your target.',
    ],
    betterOption:
      'Set your hips toward the target, plant beside the ball, and strike through the middle with a locked ankle. One extra touch to set is fine if it improves quality.',
    trainingTakeaway:
      'Wall passing: 20 reps per foot focusing on plant foot placement and a clean strike through the ball.',
  }),

  DID_WELL: (ctx) => ({
    verdict:
      'There is plenty to be proud of here — you showed composure and good habits in a difficult moment.',
    didWell: [
      'You kept your head up before receiving, which helped you play quickly and with purpose.',
      `Your decision matched your role as a ${ctx.positionLabel.toLowerCase()} — that shows growing football intelligence.`,
      'You stayed calm when pressed instead of panicking into a clearance.',
      ctx.contextNote,
    ].filter(Boolean) as string[],
    couldImprove: [
      'The only tweak: arrive half a step earlier next time so you have more time on the ball.',
      'You could communicate louder to teammates before receiving — a call helps everyone.',
    ],
    betterOption:
      'Keep doing what you did here — the same scan, touch, and calmness will work at higher levels. Add one loud call before receiving to level up further.',
    trainingTakeaway:
      'Pick one strength from this clip and repeat it deliberately in your next three training sessions.',
  }),

  CUSTOM: (ctx) => ({
    verdict: ctx.customVerdict,
    didWell: [
      'You stayed engaged in the moment and did not switch off when the ball arrived.',
      `Your effort level fits what we expect from a ${ctx.levelLabel.toLowerCase()} player at your stage.`,
      ctx.contextNote,
    ].filter(Boolean) as string[],
    couldImprove: [
      'There is room to decide one touch earlier — hesitation gave the defender time to recover.',
      'Your body shape could be more open so you see more of the pitch before acting.',
    ],
    betterOption:
      'Focus on the one thing you asked about: simplify the action, play what you see, and trust your first good option.',
    trainingTakeaway:
      'Write down one cue from this clip and repeat it in warm-up before your next session.',
  }),
};

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
  const seed = hashString(id);
  const profileCtx = buildProfileContext(profile);

  const ctx: ContentContext = {
    positionLabel: profileCtx.positionLabel,
    levelLabel: profileCtx.levelLabel,
    footLabel: profileCtx.footLabel,
    firstName: profileCtx.firstName,
    contextNote: context?.trim()
      ? `Based on your note — "${context.trim()}" — you were identifiable in the clip.`
      : null,
    customVerdict: `On your question — "${question}" — here is an honest coach's view: you are on the right track, with one or two habits to sharpen.`,
  };

  const base = CONTENT_BY_QUESTION[questionType](ctx);

  if (seed % 2 === 0 && questionType !== 'CUSTOM') {
    base.didWell.push(
      seed % 3 === 0
        ? `${ctx.firstName}, your work rate in this moment stood out — that effort creates opportunities.`
        : 'You showed maturity by not forcing a highlight when a simple action was available.'
    );
  }

  const content = { ...base };

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
