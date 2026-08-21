export type Position =
  | 'GOALKEEPER'
  | 'CENTRE_BACK'
  | 'FULL_BACK'
  | 'WING_BACK'
  | 'DEFENSIVE_MIDFIELDER'
  | 'CENTRAL_MIDFIELDER'
  | 'ATTACKING_MIDFIELDER'
  | 'WINGER'
  | 'STRIKER';

export type PreferredFoot = 'LEFT' | 'RIGHT' | 'BOTH';

export type PlayingLevel =
  | 'GRASSROOTS_SCHOOL'
  | 'ACADEMY'
  | 'SEMI_PRO'
  | 'PROFESSIONAL'
  | 'VETERAN_SUNDAY';

/** Pre-expansion levels — only used during AsyncStorage migration. */
export type LegacyPlayingLevel =
  | 'BEGINNER'
  | 'GRASSROOTS'
  | 'SCHOOL'
  | 'AMATEUR'
  | 'SEMI_PROFESSIONAL'
  | 'PROFESSIONAL';

export type HeightDisplayUnit = 'cm' | 'ft_in';
export type WeightDisplayUnit = 'kg' | 'lb';

export type ImprovementGoal =
  | 'FIRST_TOUCH'
  | 'PASSING'
  | 'SHOOTING'
  | 'DRIBBLING'
  | 'DEFENDING'
  | 'POSITIONING'
  | 'MOVEMENT'
  | 'DECISION_MAKING'
  | 'FITNESS'
  | 'CONFIDENCE'
  | 'FOOTBALL_IQ';

export type FeedbackArea =
  | 'FIRST_TOUCH'
  | 'PASSING'
  | 'SHOOTING'
  | 'DEFENDING'
  | 'DRIBBLING'
  | 'MOVEMENT'
  | 'POSITIONING'
  | 'DECISION_MAKING'
  | 'ONE_V_ONE'
  | 'FOOTBALL_IQ';

export interface PlayerProfile {
  firstName: string;
  /** ISO date YYYY-MM-DD */
  dateOfBirth: string;
  /** Derived from dateOfBirth on save — kept for analysis metadata compatibility. */
  age: number;
  nationality: string;
  countryPlayingIn: string;
  yearsPlayingFootball: number;
  yearsInPrimaryPosition: number;
  isGoalkeeper: boolean;
  mainPosition: Position;
  secondaryPosition: Position | null;
  preferredFoot: PreferredFoot;
  playingLevel: PlayingLevel;
  club: string | null;
  clubLevel: string | null;
  heightCm: number | null;
  weightKg: number | null;
  heightDisplayUnit: HeightDisplayUnit;
  weightDisplayUnit: WeightDisplayUnit;
  playingStyle: string[];
  improvementGoals: ImprovementGoal[];
  feedbackAreas: FeedbackArea[];
  isComplete: boolean;
  analysesUsedThisMonth: number;
  updatedAt: string;
}

export type ProfileDraft = Omit<PlayerProfile, 'isComplete' | 'analysesUsedThisMonth' | 'updatedAt'>;
