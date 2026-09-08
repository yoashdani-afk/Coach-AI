import type { ComponentProps } from 'react';
import type { Ionicons } from '@expo/vector-icons';
import type { AnalysisMode, CoachingQuestionType } from '@/types/analysis';
import type {
  FeedbackArea,
  ImprovementGoal,
  PlayingLevel,
  Position,
  PreferredFoot,
} from '@/types/profile';

export const POSITIONS: { value: Position; label: string; icon: ComponentProps<typeof Ionicons>['name'] }[] = [
  { value: 'GOALKEEPER', label: 'Goalkeeper', icon: 'hand-left-outline' },
  { value: 'CENTRE_BACK', label: 'Centre-back', icon: 'shield-outline' },
  { value: 'FULL_BACK', label: 'Full-back', icon: 'arrow-back-outline' },
  { value: 'WING_BACK', label: 'Wing-back', icon: 'git-branch-outline' },
  { value: 'DEFENSIVE_MIDFIELDER', label: 'Defensive midfielder', icon: 'remove-circle-outline' },
  { value: 'CENTRAL_MIDFIELDER', label: 'Central midfielder', icon: 'swap-horizontal-outline' },
  { value: 'ATTACKING_MIDFIELDER', label: 'Attacking midfielder', icon: 'flash-outline' },
  { value: 'WINGER', label: 'Winger', icon: 'speedometer-outline' },
  { value: 'STRIKER', label: 'Striker', icon: 'football-outline' },
];

export const PREFERRED_FEET: { value: PreferredFoot; label: string }[] = [
  { value: 'LEFT', label: 'Left' },
  { value: 'RIGHT', label: 'Right' },
  { value: 'BOTH', label: 'Both' },
];

export const PLAYING_LEVELS: { value: PlayingLevel; label: string; description: string }[] = [
  {
    value: 'GRASSROOTS_SCHOOL',
    label: 'Grassroots / School',
    description: 'Local, school, or recreational football',
  },
  { value: 'ACADEMY', label: 'Academy', description: 'Youth academy pathway' },
  { value: 'SEMI_PRO', label: 'Semi-Pro', description: 'Paid part-time or high-level amateur' },
  { value: 'PROFESSIONAL', label: 'Professional', description: 'Full-time professional' },
  {
    value: 'VETERAN_SUNDAY',
    label: 'Veteran / Sunday League',
    description: 'Adult amateur, veteran, or Sunday league',
  },
];

export const CLUB_LEVELS: { value: string; label: string }[] = [
  { value: 'U9', label: 'U9' },
  { value: 'U10', label: 'U10' },
  { value: 'U11', label: 'U11' },
  { value: 'U12', label: 'U12' },
  { value: 'U13', label: 'U13' },
  { value: 'U14', label: 'U14' },
  { value: 'U15', label: 'U15' },
  { value: 'U16', label: 'U16' },
  { value: 'U17', label: 'U17' },
  { value: 'U18', label: 'U18' },
  { value: 'U19', label: 'U19' },
  { value: 'U20', label: 'U20' },
  { value: 'U21', label: 'U21' },
  { value: 'U22', label: 'U22' },
  { value: 'U23', label: 'U23' },
  { value: 'MENS_SENIOR', label: "Men's/Senior" },
];

export const PLAYING_STYLES = [
  'Playmaker',
  'Box to box',
  'Pace merchant',
  'Physical',
  'Technical',
  'Direct',
  'Defensive anchor',
  'Creative',
  'Finisher',
  'Wide player',
  'Target man',
  'Ball winner',
] as const;

export const IMPROVEMENT_GOALS: { value: ImprovementGoal; label: string }[] = [
  { value: 'FIRST_TOUCH', label: 'First touch' },
  { value: 'PASSING', label: 'Passing' },
  { value: 'SHOOTING', label: 'Shooting' },
  { value: 'DRIBBLING', label: 'Dribbling' },
  { value: 'DEFENDING', label: 'Defending' },
  { value: 'POSITIONING', label: 'Positioning' },
  { value: 'MOVEMENT', label: 'Movement' },
  { value: 'DECISION_MAKING', label: 'Decision making' },
  { value: 'FITNESS', label: 'Fitness' },
  { value: 'CONFIDENCE', label: 'Confidence' },
  { value: 'FOOTBALL_IQ', label: 'Football IQ' },
];

export const FEEDBACK_AREAS: { value: FeedbackArea; label: string }[] = [
  { value: 'FIRST_TOUCH', label: 'First touch' },
  { value: 'PASSING', label: 'Passing' },
  { value: 'SHOOTING', label: 'Shooting' },
  { value: 'DEFENDING', label: 'Defending' },
  { value: 'DRIBBLING', label: 'Dribbling' },
  { value: 'MOVEMENT', label: 'Movement' },
  { value: 'POSITIONING', label: 'Positioning' },
  { value: 'DECISION_MAKING', label: 'Decision making' },
  { value: 'ONE_V_ONE', label: '1v1 situations' },
  { value: 'FOOTBALL_IQ', label: 'Football IQ' },
];

export const FREE_TIER_ANALYSES_PER_MONTH = 3;

export const MIN_CLIP_DURATION_MS = 10_000;
export const MAX_CLIP_DURATION_MS = 5 * 60 * 1000;

export const ANALYSIS_STATUS_MESSAGES = [
  'Reading your clip',
  'Reviewing the moment',
  'Thinking like your coach',
  'Building your report',
] as const;

export const ANALYSIS_MODES: {
  mode: AnalysisMode;
  label: string;
  emoji: string;
  description: string;
  examples: string[];
  icon: ComponentProps<typeof Ionicons>['name'];
  primary?: boolean;
}[] = [
  {
    mode: 'COACH_ME',
    label: 'Coach Me',
    emoji: '🧠',
    description: 'Ask a football question about a specific moment.',
    examples: [
      'Was this the right decision?',
      'What should I have done?',
      'Analyse my positioning',
      'Analyse my technique',
      'What did I do well?',
    ],
    icon: 'chatbubbles-outline',
    primary: true,
  },
  {
    mode: 'PERFORMANCE',
    label: 'Analyze my performance',
    emoji: '⭐',
    description: 'Receive an overall coaching assessment of this clip.',
    examples: [
      'Decision Making',
      'Positioning',
      'Scanning',
      'Movement',
      'First Touch',
      'Composure',
      'Communication',
    ],
    icon: 'stats-chart-outline',
  },
  {
    mode: 'GOAL',
    label: 'Rate This Goal',
    emoji: '⚽',
    description: 'Analyse one goal or attacking action.',
    examples: ['Finish', 'Technique', 'Difficulty', 'Creativity', 'Decision', 'Composure'],
    icon: 'football-outline',
  },
];

export function labelForAnalysisMode(mode: AnalysisMode): string {
  return ANALYSIS_MODES.find((m) => m.mode === mode)?.label ?? mode;
}

export const COACHING_QUESTIONS: {
  type: CoachingQuestionType;
  label: string;
  icon: ComponentProps<typeof Ionicons>['name'];
}[] = [
  { type: 'RIGHT_DECISION', label: 'Was this the right decision?', icon: 'help-circle-outline' },
  { type: 'BETTER_OPTION', label: 'What should I have done instead?', icon: 'swap-horizontal-outline' },
  { type: 'POSITIONING', label: 'Analyze my positioning', icon: 'locate-outline' },
  { type: 'TECHNIQUE', label: 'Analyze my technique', icon: 'body-outline' },
  { type: 'DID_WELL', label: 'What did I do well?', icon: 'checkmark-circle-outline' },
  { type: 'CUSTOM', label: 'Ask my own question', icon: 'chatbox-ellipses-outline' },
];

export function labelForQuestionType(type: CoachingQuestionType): string {
  return COACHING_QUESTIONS.find((q) => q.type === type)?.label ?? type;
}

export function labelForPosition(value: Position): string {
  return POSITIONS.find((p) => p.value === value)?.label ?? value;
}

export function labelForLevel(value: PlayingLevel): string {
  return PLAYING_LEVELS.find((l) => l.value === value)?.label ?? value;
}

export function labelForClubLevel(value: string | null): string {
  if (!value) return '—';
  return CLUB_LEVELS.find((l) => l.value === value)?.label ?? value;
}

export function labelForFoot(value: PreferredFoot): string {
  return PREFERRED_FEET.find((f) => f.value === value)?.label ?? value;
}

export function labelForGoal(value: ImprovementGoal): string {
  return IMPROVEMENT_GOALS.find((g) => g.value === value)?.label ?? value;
}

export function labelForFeedbackArea(value: FeedbackArea): string {
  return FEEDBACK_AREAS.find((a) => a.value === value)?.label ?? value;
}
