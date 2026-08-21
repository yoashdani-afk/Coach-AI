const TIMELINE_CONFIDENCE_MIN = 0.55;

interface CompletePlayEvent {
  eventType: string;
  description: string;
  passType: string;
  confidence: number;
}

interface SelectedPlayerEvent {
  action: string;
  identityState: string;
  identityConfidence: number;
  actionConfidence: number;
}

interface CompletePlayTimelineLog {
  events: CompletePlayEvent[];
}

interface SelectedPlayerTimelineLog {
  events: SelectedPlayerEvent[];
}

export const NARRATIVE_RETRY_SUFFIX = `Your narrative contradicted your own observed event timeline.
Rewrite the report using ONLY events present in the confirmed timeline.
Do not invent tackles, duels, progressive long passes, overlaps, or crosses unless they appear in completePlayTimeline with confidence >= 0.55.
If the selected player's involvement is uncertain, say so explicitly.`;

interface MajorEventPattern {
  key: string;
  narrativePatterns: RegExp[];
  timelinePatterns: RegExp[];
}

const MAJOR_EVENT_PATTERNS: MajorEventPattern[] = [
  {
    key: 'tackle',
    narrativePatterns: [/\btackle\b/i, /\bwon the duel\b/i, /\bwinning a duel\b/i],
    timelinePatterns: [/\btackle\b/i, /\bduel\b/i],
  },
  {
    key: 'goal',
    narrativePatterns: [/\bgoal\b/i, /\bscored\b/i],
    timelinePatterns: [/\bgoal\b/i, /\bfinal_outcome\b/i],
  },
  {
    key: 'shot',
    narrativePatterns: [/\bshot\b/i, /\bshoots?\b/i, /\bstrike\b/i, /\blong[- ]range\b/i],
    timelinePatterns: [/\bshot\b/i],
  },
  {
    key: 'pass',
    narrativePatterns: [/\bpass\b/i, /\bpassed\b/i, /\bplay(?:ed|ing)\b/i],
    timelinePatterns: [/\bpass\b/i, /\bpass_recipient\b/i],
  },
  {
    key: 'dribble',
    narrativePatterns: [/\bdribbl/i],
    timelinePatterns: [/\bdribbl/i],
  },
  {
    key: 'cross',
    narrativePatterns: [/\bcross\b/i, /\bcrosses?\b/i, /\bcrossing\b/i],
    timelinePatterns: [/\bcross\b/i],
  },
];

function timelineBlob(event: {
  eventType?: string;
  description?: string;
  passType?: string;
  action?: string;
}): string {
  return [event.eventType, event.description, event.passType, event.action]
    .filter(Boolean)
    .join(' ')
    .toLowerCase();
}

function timelineSupportsEvent(
  completePlay: CompletePlayTimelineLog | null,
  selectedPlayer: SelectedPlayerTimelineLog | null,
  patterns: RegExp[]
): boolean {
  const completeEvents = completePlay?.events ?? [];
  const selectedEvents = selectedPlayer?.events ?? [];

  for (const event of completeEvents) {
    if (event.confidence < TIMELINE_CONFIDENCE_MIN) continue;
    const blob = timelineBlob(event);
    if (patterns.some((pattern) => pattern.test(blob))) return true;
  }

  for (const event of selectedEvents) {
    if (event.identityState === 'UNCONFIRMED') continue;
    if (event.actionConfidence < TIMELINE_CONFIDENCE_MIN && event.identityConfidence < TIMELINE_CONFIDENCE_MIN) {
      continue;
    }
    const blob = timelineBlob(event);
    if (patterns.some((pattern) => pattern.test(blob))) return true;
  }

  return false;
}

function narrativeClaimsEvent(text: string, patterns: RegExp[]): boolean {
  return patterns.some((pattern) => pattern.test(text));
}

export interface NarrativeConsistencyResult {
  ok: boolean;
  contradictions: string[];
}

/** Compare coaching narrative against Gemini's own timeline objects. */
export function validateNarrativeAgainstTimeline(params: {
  whatHappened: string;
  summary: string;
  completePlay: CompletePlayTimelineLog | null;
  selectedPlayer: SelectedPlayerTimelineLog | null;
}): NarrativeConsistencyResult {
  const narrativeText = `${params.whatHappened} ${params.summary}`.trim();
  const contradictions: string[] = [];

  for (const eventPattern of MAJOR_EVENT_PATTERNS) {
    if (!narrativeClaimsEvent(narrativeText, eventPattern.narrativePatterns)) continue;

    const supported = timelineSupportsEvent(
      params.completePlay,
      params.selectedPlayer,
      eventPattern.timelinePatterns
    );

    if (!supported) {
      contradictions.push(eventPattern.key);
    }
  }

  if (contradictions.length > 0) {
    console.warn('[NarrativeConsistency] Contradictions detected', {
      contradictions,
      whatHappened: params.whatHappened,
      completePlayEventCount: params.completePlay?.events.length ?? 0,
      selectedPlayerEventCount: params.selectedPlayer?.events.length ?? 0,
    });
  }

  return { ok: contradictions.length === 0, contradictions };
}

export function buildUncertainAnalysisResponse(): import('./types.js').AnalysisResponse {
  return {
    title: 'Analysis could not be completed confidently',
    summary:
      'We could not confidently match the coaching narrative to what was visibly observed in this clip.',
    whatHappened:
      'The clip could not be analysed confidently from the footage provided. No specific player actions were verified end-to-end.',
    whyItMattered:
      'Without reliable visual confirmation of the sequence, specific coaching feedback would risk being inaccurate.',
    betterOption:
      'Try selecting yourself on a clearer frame, or choose a moment where your involvement is easier to see.',
    professionalInsight:
      'Accurate video analysis depends on clearly seeing the selected player and the full sequence of play.',
    trainingAdvice: ['Upload a clearer clip or choose a more visible reference frame before analysing again.'],
    strengths: [],
    improvements: [],
    scores: [],
    awards: [],
  };
}
