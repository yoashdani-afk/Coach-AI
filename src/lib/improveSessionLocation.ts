import type { SessionLocation } from '@/types/improveSession';

const FIELD_ONLY_SPACE =
  /\b(full[- ]?size goal|full pitch|half pitch|open field|open space\s*\(~?\d+\s*yards?\)|100m|40 yards|50 yards|timing gates)\b/i;

const HARD_GYM =
  /\b(barbell|dumbbells?|weight plates?|trap bar|smith machine|cable machine|row machine|kettlebell)\b/i;

const OUTDOOR_MARKERS =
  /\b(cones?|agility ladder|ladder|zigzag|open space|grass|turf|sideline|mini goal|gates?)\b/i;

const IN_PLACE_ALT = /\b(or no equipment|in place|replicate)\b/i;

const HOME_MARKERS =
  /\b(wall|rebounder|mat|soft floor|soft surface|carpet|foam roller|sliders?|towel|quiet spot|pillows?)\b/i;

const BODYWEIGHT_OR_NONE =
  /\b(none|bodyweight|technique|mindset|mental habit|reflective)\b/i;

const BALL_ONLY = /\b(football|ball)\b/i;

/** Drill IDs whose equipment text is too vague for keywords alone. */
const LOCATION_OVERRIDES: Record<string, SessionLocation[]> = {
  'controlled-lane-dribble': ['field'],
  'fast-lane-dribble': ['field'],
  'gated-turn': ['field'],
  // Needs 15–20m open space — not a gym floor warm-up
  'complete-no-equipment-warmup': ['field'],
  // Video follow-along; works anywhere with room to move
  'warmup-video-option-2': ['home', 'field', 'gym'],
};

function itemAllowsBodyweightPath(item: string): boolean {
  const lower = item.toLowerCase();
  if (/\boptional\b/.test(lower)) return true;
  if (/\bor a light dumbbell\b/.test(lower)) return true;
  if (/\bor light weight\b/.test(lower)) return true;
  if (/\bnone\b/.test(lower) && /\bbodyweight\b/.test(lower)) return true;
  if (/\bbodyweight only\b/.test(lower)) return true;
  if (/\bbodyweight\b/.test(lower) && /\bor\b/.test(lower)) return true;
  if (/\bor\b/.test(lower) && /\b(box|bench|bodyweight|none)\b/.test(lower)) return true;
  return false;
}

function hasHardGymRequirement(equipment: string[]): boolean {
  return equipment.some((item) => {
    if (!HARD_GYM.test(item) && !/\b(cable machine|row machine|smith machine|dip machine|dip bars)\b/i.test(item)) {
      return false;
    }
    if (itemAllowsBodyweightPath(item)) return false;
    // Dip bars/machine OR box — bodyweight path
    if (/\bdip\b/i.test(item) && itemAllowsBodyweightPath(item)) return false;
    if (/\bdip bars, dip machine, or a sturdy box/i.test(item)) return false;
    return HARD_GYM.test(item) || /\b(cable machine|row machine|smith machine)\b/i.test(item);
  });
}

function isFootballOrBallOnly(equipment: string[]): boolean {
  if (equipment.length === 0) return false;
  const joined = equipment.join(' ');
  if (!BALL_ONLY.test(joined)) return false;
  if (OUTDOOR_MARKERS.test(joined) || FIELD_ONLY_SPACE.test(joined)) return false;
  if (HOME_MARKERS.test(joined)) return false;
  if (HARD_GYM.test(joined)) return false;
  // Every item is essentially ball/partner/spot — still ball-centric without space markers
  return equipment.every(
    (item) =>
      BALL_ONLY.test(item) ||
      /\bpartner\b/i.test(item) ||
      /\bteammate\b/i.test(item) ||
      /\bmarked circle|spot on the ground\b/i.test(item)
  );
}

/**
 * Multi-label location inference from equipment text.
 * A drill is eligible for a session location only if this set includes it.
 */
export function inferDrillLocations(equipment: string[], drillId?: string): SessionLocation[] {
  if (drillId && LOCATION_OVERRIDES[drillId]) {
    return [...LOCATION_OVERRIDES[drillId]];
  }

  const joined = equipment.join(' | ');
  const locations = new Set<SessionLocation>();

  // 1. Large outdoor space → Field only
  if (FIELD_ONLY_SPACE.test(joined)) {
    return ['field'];
  }

  // 2. Hard gym requirement (no bodyweight alternative) → Gym only
  if (hasHardGymRequirement(equipment)) {
    return ['gym'];
  }

  // 3. Outdoor markers
  if (OUTDOOR_MARKERS.test(joined)) {
    locations.add('field');
    if (IN_PLACE_ALT.test(joined)) {
      locations.add('home');
    }
  }

  // 4. Home / indoor markers
  if (HOME_MARKERS.test(joined)) {
    locations.add('home');
    if (/\b(wall|rebounder)\b/i.test(joined) && BALL_ONLY.test(joined)) {
      locations.add('field');
    }
    if (/\b(mat|foam roller|soft surface|soft floor|carpet)\b/i.test(joined)) {
      locations.add('gym');
      locations.add('field');
    }
  }

  // 5. Bodyweight / none / mindset → anywhere
  if (BODYWEIGHT_OR_NONE.test(joined) || equipment.length === 0) {
    locations.add('home');
    locations.add('field');
    locations.add('gym');
  }

  // Jump rope / hopping — anywhere
  if (/\bjump rope\b/i.test(joined) || /\bhopping\b/i.test(joined)) {
    locations.add('home');
    locations.add('field');
    locations.add('gym');
  }

  // Optional-weight strength that still has a bodyweight path
  if (
    equipment.some((item) => HARD_GYM.test(item) && itemAllowsBodyweightPath(item)) ||
    /\bdip bars, dip machine, or a sturdy box/i.test(joined)
  ) {
    locations.add('gym');
    locations.add('home');
  }

  // Resistance band / sliders — home + gym
  if (/\b(resistance band|sliders?)\b/i.test(joined)) {
    locations.add('home');
    locations.add('gym');
  }

  // 6. Football / ball only
  if (isFootballOrBallOnly(equipment)) {
    locations.add('home');
    locations.add('field');
  }

  // 7. Fallback
  if (locations.size === 0) {
    locations.add('home');
    locations.add('field');
  }

  return [...locations];
}

export function drillMatchesLocation(
  equipment: string[],
  location: SessionLocation,
  drillId?: string
): boolean {
  return inferDrillLocations(equipment, drillId).includes(location);
}

const LOCATION_FALLBACK_ORDER: SessionLocation[] = ['field', 'home', 'gym'];

type LocationScore = { count: number; exclusive: number };

function scoreLocations(
  drills: Array<{ id: string; equipment: string[] }>
): Record<SessionLocation, LocationScore> {
  const scores: Record<SessionLocation, LocationScore> = {
    field: { count: 0, exclusive: 0 },
    home: { count: 0, exclusive: 0 },
    gym: { count: 0, exclusive: 0 },
  };

  for (const drill of drills) {
    const locs = inferDrillLocations(drill.equipment, drill.id);
    for (const loc of locs) {
      scores[loc].count += 1;
      if (locs.length === 1) {
        scores[loc].exclusive += 1;
      }
    }
  }

  return scores;
}

/**
 * Pick the dominant training location from eligible drills.
 * Tie-break: (1) difficulty-window counts → (2) full skill-pool counts among
 * tied locations → (3) more exclusive drills → (4) field → home → gym.
 */
export function resolveDominantLocation(
  windowDrills: Array<{ id: string; equipment: string[] }>,
  fullSkillDrills: Array<{ id: string; equipment: string[] }>
): SessionLocation {
  const pickAmong = (
    candidates: SessionLocation[],
    scores: Record<SessionLocation, LocationScore>,
    byExclusive: boolean
  ): SessionLocation[] => {
    if (candidates.length === 0) return [...LOCATION_FALLBACK_ORDER];
    const key = byExclusive ? 'exclusive' : 'count';
    const max = Math.max(...candidates.map((loc) => scores[loc][key]));
    return candidates.filter((loc) => scores[loc][key] === max);
  };

  const windowScores = scoreLocations(windowDrills);
  const windowMax = Math.max(...LOCATION_FALLBACK_ORDER.map((l) => windowScores[l].count));

  let tied: SessionLocation[] =
    windowMax > 0
      ? LOCATION_FALLBACK_ORDER.filter((l) => windowScores[l].count === windowMax)
      : [...LOCATION_FALLBACK_ORDER];

  if (tied.length === 1) return tied[0]!;

  // Full skill pool among remaining ties
  const fullScores = scoreLocations(fullSkillDrills);
  tied = pickAmong(tied, fullScores, false);
  if (tied.length === 1) return tied[0]!;

  // Exclusive drills (prefer window exclusive when window had data, else full pool)
  const exclusiveScores = windowMax > 0 ? windowScores : fullScores;
  tied = pickAmong(tied, exclusiveScores, true);
  if (tied.length === 1) return tied[0]!;

  // Also try full-pool exclusive if still tied and we used window exclusive
  if (windowMax > 0) {
    tied = pickAmong(tied, fullScores, true);
    if (tied.length === 1) return tied[0]!;
  }

  return LOCATION_FALLBACK_ORDER.find((l) => tied.includes(l)) ?? 'field';
}
