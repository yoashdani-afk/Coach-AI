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
  | 'BEGINNER'
  | 'GRASSROOTS'
  | 'SCHOOL'
  | 'ACADEMY'
  | 'AMATEUR'
  | 'SEMI_PROFESSIONAL'
  | 'PROFESSIONAL';

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
  age: number;
  country: string;
  mainPosition: Position;
  secondaryPosition: Position | null;
  preferredFoot: PreferredFoot;
  playingLevel: PlayingLevel;
  club: string | null;
  playingStyle: string[];
  improvementGoals: ImprovementGoal[];
  feedbackAreas: FeedbackArea[];
  isComplete: boolean;
  analysesUsedThisMonth: number;
  updatedAt: string;
}

export type ProfileDraft = Omit<PlayerProfile, 'isComplete' | 'analysesUsedThisMonth' | 'updatedAt'>;
