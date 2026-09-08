import type { ImproveDrill, ImproveDrillDifficulty, ImproveDrillPartnerRequirement } from '@/types/improve';

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

export function formatDrillDifficultyStars(difficulty: ImproveDrillDifficulty): string {
  return '★'.repeat(difficulty) + '☆'.repeat(5 - difficulty);
}

export function formatDrillListMetaLine(drill: ImproveDrill): string {
  return `${formatDrillDifficultyStars(drill.difficulty)} · ${drill.creator}`;
}

export function buildDrillVideoUrl(videoUrl: string, videoTimestampSeconds?: number): string {
  if (videoTimestampSeconds == null || videoTimestampSeconds < 0) {
    return videoUrl;
  }

  const separator = videoUrl.includes('?') ? '&' : '?';
  return `${videoUrl}${separator}t=${videoTimestampSeconds}s`;
}

export function extractYouTubeVideoId(videoUrl: string): string | null {
  try {
    const url = new URL(videoUrl);

    if (url.hostname === 'youtu.be') {
      const id = url.pathname.replace(/^\//, '').split('/')[0];
      return id || null;
    }

    if (url.hostname.includes('youtube.com')) {
      const watchId = url.searchParams.get('v');
      if (watchId) return watchId;

      const embedMatch = url.pathname.match(/\/embed\/([^/?]+)/);
      if (embedMatch?.[1]) return embedMatch[1];

      const shortsMatch = url.pathname.match(/\/shorts\/([^/?]+)/);
      if (shortsMatch?.[1]) return shortsMatch[1];
    }
  } catch {
    return null;
  }

  return null;
}
