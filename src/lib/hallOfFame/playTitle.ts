import type { CoachingReport } from '@/types/analysis';

const TITLE_PATTERNS: { pattern: RegExp; title: string }[] = [
  { pattern: /bicycle\s+kick|overhead\s+kick|scissor\s+kick|acrobatic\s+finish/i, title: 'Bicycle Kick' },
  { pattern: /goal[\s-]?line\s+clearance|cleared off the line|off the line/i, title: 'Goal-Line Clearance' },
  {
    pattern: /outside[\s-]?of[\s-]?the[\s-]?foot|trivela/i,
    title: 'Outside-of-the-Boot Finish',
  },
  { pattern: /top\s+corner|upper\s+90|roof of the net/i, title: 'Top Corner Finish' },
  { pattern: /volley|half[\s-]?volley|side[\s-]?volley/i, title: 'Volley Finish' },
  { pattern: /long[\s-]?range|from distance|25\s+yards|30\s+yards/i, title: 'Long Range Strike' },
  { pattern: /chip|lob|dinked finish/i, title: 'Chip Finish' },
  { pattern: /header|heading/i, title: 'Header Finish' },
  { pattern: /one[\s-]?two|give[\s-]?and[\s-]?go|third[\s-]?man/i, title: 'One-Two Finish' },
  { pattern: /nutmeg|skill move|roulette|elastico/i, title: 'Skill Move Goal' },
  { pattern: /assist|through\s+ball|key pass|cross/i, title: 'Outside-of-the-Boot Assist' },
  { pattern: /tackle|interception|recovery/i, title: 'Defensive Masterclass' },
  { pattern: /save|reflex/i, title: 'Reflex Save' },
];

function collectText(report: CoachingReport): string {
  const parts = [report.title, report.summary];
  if (report.mode === 'GOAL') {
    parts.push(report.whyScoredThisWay, report.excellentPoint);
  } else if (report.mode === 'PERFORMANCE') {
    parts.push(report.coachSummary, report.topStrength);
  } else {
    parts.push(report.verdict, ...report.didWell);
  }
  return parts.join(' ');
}

/** Derive a memorable play title from the AI analysis text. */
export function deriveHallOfFamePlayTitle(report: CoachingReport): string {
  const text = collectText(report);

  for (const { pattern, title } of TITLE_PATTERNS) {
    if (pattern.test(text)) {
      if (title === 'Outside-of-the-Boot Assist' && /finish|scored|goal|strike/i.test(text)) {
        continue;
      }
      return title;
    }
  }

  if (report.mode === 'GOAL') return 'Goal Scoring Moment';
  if (report.mode === 'PERFORMANCE') return 'Elite Performance';
  return report.title.trim() || 'Standout Moment';
}
