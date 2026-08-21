import type {
  FactualEventAnalysis,
  CompletePlayEventFact,
  SelectedPlayerEventFact,
} from './factualEventTypes.js';
import type { AnalysisResponse } from './types.js';

export const COACHING_TIMELINE_RETRY_SUFFIX = `Your coaching report introduced actions that do not exist in the factual timeline.
Rewrite using ONLY the supplied events.`;

const MAJOR_ACTIONS = [
  'tackle',
  'pass',
  'cross',
  'shot',
  'goal',
  'dribble',
  'save',
  'run',
  'assist',
] as const;

type MajorAction = (typeof MAJOR_ACTIONS)[number];

const ACTION_PATTERNS: Record<MajorAction, RegExp[]> = {
  tackle: [/\btackle\b/i, /\bduel\b/i],
  pass: [/\bpass\b/i, /\bpassed\b/i],
  cross: [/\bcross\b/i, /\bcrosses?\b/i, /\bcrossing\b/i],
  shot: [/\bshot\b/i, /\bshoots?\b/i, /\bstrike\b/i],
  goal: [/\bgoal\b/i, /\bscored\b/i],
  dribble: [/\bdribbl/i],
  save: [/\bsave\b/i, /\bsaved\b/i],
  run: [/\brun\b/i, /\brunning\b/i],
  assist: [/\bassist\b/i, /\bassisted\b/i],
};

const TIMELINE_ACTION_PATTERNS: Record<MajorAction, RegExp[]> = {
  tackle: [/\btackle\b/i],
  pass: [/\bpass\b/i, /\bshort_pass\b/i, /\blong_pass\b/i],
  cross: [/\bcross\b/i],
  shot: [/\bshot\b/i],
  goal: [/\bgoal\b/i],
  dribble: [/\bdribble\b/i],
  save: [/\bsave\b/i],
  run: [/\brun\b/i],
  assist: [/\bassist\b/i, /\bpass\b/i],
};

function factualBlob(event: CompletePlayEventFact | SelectedPlayerEventFact): string {
  if ('event' in event) {
    return [event.event, event.evidence, event.actor].join(' ').toLowerCase();
  }
  return [event.action, event.evidence].join(' ').toLowerCase();
}

function timelineSupportsAction(
  action: MajorAction,
  factual: FactualEventAnalysis
): boolean {
  const patterns = TIMELINE_ACTION_PATTERNS[action];
  const allEvents: Array<CompletePlayEventFact | SelectedPlayerEventFact> = [
    ...factual.completePlayTimeline,
    ...factual.selectedPlayerTimeline.filter((e) => e.confidence >= 0.55),
  ];

  return allEvents.some((event) => {
    const blob = factualBlob(event);
    return patterns.some((pattern) => pattern.test(blob));
  });
}

function narrativeClaimsAction(text: string, action: MajorAction): boolean {
  return ACTION_PATTERNS[action].some((pattern) => pattern.test(text));
}

export interface CoachingConsistencyResult {
  passed: boolean;
  unsupportedActions: string[];
}

export function validateCoachingAgainstFactualTimeline(
  response: AnalysisResponse,
  factual: FactualEventAnalysis
): CoachingConsistencyResult {
  const narrativeText = [
    response.whatHappened,
    response.summary,
    response.whyItMattered,
    response.betterOption,
    response.professionalInsight,
    ...response.strengths,
    ...response.improvements,
  ]
    .join(' ')
    .trim();

  const unsupportedActions: string[] = [];

  for (const action of MAJOR_ACTIONS) {
    if (!narrativeClaimsAction(narrativeText, action)) continue;
    if (!timelineSupportsAction(action, factual)) {
      unsupportedActions.push(action);
    }
  }

  const passed = unsupportedActions.length === 0;

  console.log('[CoachingConsistency]', {
    passed,
    unsupportedActions,
    retryUsed: false,
  });

  return { passed, unsupportedActions };
}

export function buildInsufficientEvidenceResponse(
  requestId: string,
  reason: string
): import('./types.js').InsufficientEvidenceResponse {
  return {
    status: 'insufficient_evidence',
    message: "We couldn't analyse this clip confidently.",
    scores: null,
    overallScore: null,
    report: null,
    requestId,
    reason,
  };
}

/** @deprecated Use buildInsufficientEvidenceResponse */
export function buildLowConfidenceAnalysisResponse(): AnalysisResponse {
  return {
    title: 'Analysis unavailable',
    summary:
      "We couldn't understand this play confidently enough to give you an accurate analysis. Try a clearer or shorter clip.",
    whatHappened:
      "We couldn't understand this play confidently enough to give you an accurate analysis. Try a clearer or shorter clip.",
    whyItMattered:
      'Reliable coaching requires visually verified events. This clip did not meet our confidence threshold.',
    betterOption: 'Try a clearer clip, a shorter moment, or select yourself on a more visible frame.',
    professionalInsight:
      'Accurate analysis depends on what is clearly visible in the footage — not assumptions about typical football patterns.',
    trainingAdvice: [],
    strengths: [],
    improvements: [],
    scores: [],
    awards: [],
  };
}

export function logCoachingConsistency(result: CoachingConsistencyResult, retryUsed: boolean): void {
  console.log('[CoachingConsistency]', {
    passed: result.passed,
    unsupportedActions: result.unsupportedActions,
    retryUsed,
  });
}
