import type { ImproveDrill, ImproveDrillPartnerRequirement } from '@/types/improve';

const PARTNER_LABELS: Record<ImproveDrillPartnerRequirement, string> = {
  solo: 'Solo',
  partner: 'Partner',
  group: 'Group',
};

export function labelForPartnerRequirement(requirement: ImproveDrillPartnerRequirement): string {
  return PARTNER_LABELS[requirement];
}

export function formatDrillListSubtitle(drill: ImproveDrill): string {
  return `${labelForPartnerRequirement(drill.requiresPartner)} · ${drill.duration}`;
}

export function buildDrillVideoUrl(videoUrl: string, videoTimestampSeconds?: number): string {
  if (videoTimestampSeconds == null || videoTimestampSeconds < 0) {
    return videoUrl;
  }

  const separator = videoUrl.includes('?') ? '&' : '?';
  return `${videoUrl}${separator}t=${videoTimestampSeconds}s`;
}
