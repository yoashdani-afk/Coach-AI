import type { ComponentProps } from 'react';
import type { Ionicons } from '@expo/vector-icons';

export type ImproveCategoryId = 'physical' | 'technical' | 'tactical' | 'mental';

export type ImproveIconName = ComponentProps<typeof Ionicons>['name'];

export type ImproveDrillPartnerRequirement = 'solo' | 'partner' | 'group';

export interface ImproveDrill {
  id: string;
  title: string;
  equipment: string[];
  duration: string;
  requiresPartner: ImproveDrillPartnerRequirement;
  steps: string[];
  coachingCues: string[];
  commonMistakes: string[];
  videoUrl?: string;
  videoTimestamp?: string;
  videoTimestampSeconds?: number;
}

export interface ImproveSkill {
  id: string;
  title: string;
  summary?: string;
  explanation: string;
  drills: ImproveDrill[];
}

export interface ImproveCategory {
  id: ImproveCategoryId;
  title: string;
  description: string;
  icon: ImproveIconName;
  skills: ImproveSkill[];
}
