import { getAllImproveCategories } from '@/lib/improveContent';
import { isStrengthDrillAllowedForYouth } from '@/lib/improveSessionEquipment';
import {
  drillMatchesLocation,
  resolveDominantLocation,
} from '@/lib/improveSessionLocation';
import type {
  ImproveCategoryId,
  ImproveDrill,
  ImproveDrillDifficulty,
  ImproveMuscleGroupId,
} from '@/types/improve';
import type { ImprovementGoal, PlayerProfile, PlayingLevel } from '@/types/profile';
import {
  REHAB_DISCLAIMER,
  SESSION_DURATION_DRILL_COUNTS,
  SESSION_STRENGTH_AGE_CUTOFF,
  type GeneratedSession,
  type SessionDrillRef,
  type SessionInputs,
  type SessionIntensity,
  type SessionLocation,
  type SessionSituation,
  type SessionTarget,
} from '@/types/improveSession';

interface SkillPair {
  categoryId: ImproveCategoryId;
  skillId: string;
}

interface CandidateDrill extends SessionDrillRef {
  skillKey: string;
  diversityKey: string;
}

/** Chance to include a low-difficulty juggling drill on Recovery/Rehab sessions. */
const RECOVERY_JUGGLING_CHANCE = 0.12;

function createSessionId(): string {
  return `session-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
}

function shuffle<T>(items: T[]): T[] {
  const copy = [...items];
  for (let i = copy.length - 1; i > 0; i -= 1) {
    const j = Math.floor(Math.random() * (i + 1));
    [copy[i], copy[j]] = [copy[j], copy[i]];
  }
  return copy;
}

function intensityOuterBand(
  intensity: SessionIntensity
): [ImproveDrillDifficulty, ImproveDrillDifficulty] {
  switch (intensity) {
    case 'low':
      return [1, 2];
    case 'medium':
      return [2, 4];
    case 'high':
      return [3, 5];
  }
}

/**
 * Level × intensity window (start → end within the intensity outer band).
 * Veteran/Sunday matches Grassroots/School.
 */
function levelIntensityWindow(
  intensity: SessionIntensity,
  playingLevel: PlayingLevel | null | undefined
): [ImproveDrillDifficulty, ImproveDrillDifficulty] {
  const level = playingLevel ?? 'ACADEMY';

  const table: Record<
    PlayingLevel,
    Record<SessionIntensity, [ImproveDrillDifficulty, ImproveDrillDifficulty]>
  > = {
    GRASSROOTS_SCHOOL: { low: [1, 2], medium: [2, 3], high: [3, 4] },
    VETERAN_SUNDAY: { low: [1, 2], medium: [2, 3], high: [3, 4] },
    ACADEMY: { low: [1, 2], medium: [2, 4], high: [3, 5] },
    SEMI_PRO: { low: [2, 2], medium: [3, 4], high: [4, 5] },
    PROFESSIONAL: { low: [2, 2], medium: [3, 4], high: [4, 5] },
  };

  return table[level][intensity];
}

function intersectBands(
  a: [ImproveDrillDifficulty, ImproveDrillDifficulty],
  b: [ImproveDrillDifficulty, ImproveDrillDifficulty]
): [ImproveDrillDifficulty, ImproveDrillDifficulty] {
  return [
    Math.max(a[0], b[0]) as ImproveDrillDifficulty,
    Math.min(a[1], b[1]) as ImproveDrillDifficulty,
  ];
}

function widenBand(
  band: [ImproveDrillDifficulty, ImproveDrillDifficulty],
  steps = 1
): [ImproveDrillDifficulty, ImproveDrillDifficulty] {
  return [
    Math.max(1, band[0] - steps) as ImproveDrillDifficulty,
    Math.min(5, band[1] + steps) as ImproveDrillDifficulty,
  ];
}

/** Widen toward the intensity outer band only (never beyond it). */
function widenWithinOuter(
  band: [ImproveDrillDifficulty, ImproveDrillDifficulty],
  outer: [ImproveDrillDifficulty, ImproveDrillDifficulty]
): [ImproveDrillDifficulty, ImproveDrillDifficulty] {
  return [
    Math.max(outer[0], band[0] - 1) as ImproveDrillDifficulty,
    Math.min(outer[1], band[1] + 1) as ImproveDrillDifficulty,
  ];
}

function getSituationDifficultyBand(
  situation: SessionSituation
): [ImproveDrillDifficulty, ImproveDrillDifficulty] | null {
  switch (situation) {
    case 'pre-match':
      return [1, 2];
    case 'in-season':
      return [2, 4];
    case 'off-season':
      return [1, 5];
    case 'recovery-day':
    case 'rehab':
      return null;
  }
}

function inBand(
  difficulty: ImproveDrillDifficulty,
  band: [ImproveDrillDifficulty, ImproveDrillDifficulty]
) {
  return difficulty >= band[0] && difficulty <= band[1];
}

/** First matching goal in user order → one skill. */
function mapGoalToSkill(goal: ImprovementGoal): SkillPair | null {
  switch (goal) {
    case 'FIRST_TOUCH':
      return { categoryId: 'technical', skillId: 'first-touch' };
    case 'PASSING':
      return { categoryId: 'technical', skillId: 'passing' };
    case 'SHOOTING':
      return { categoryId: 'technical', skillId: 'shooting' };
    case 'DRIBBLING':
      return { categoryId: 'technical', skillId: 'dribbling' };
    case 'CONFIDENCE':
      return { categoryId: 'mental', skillId: 'confidence' };
    case 'FITNESS':
      return { categoryId: 'physical', skillId: 'speed' };
    case 'MOVEMENT':
    case 'DEFENDING':
      return { categoryId: 'physical', skillId: 'agility' };
    case 'POSITIONING':
    case 'DECISION_MAKING':
    case 'FOOTBALL_IQ':
      return { categoryId: 'mental', skillId: 'composure' };
    default:
      return null;
  }
}

export function resolveProfileSkill(profile: PlayerProfile | null): SkillPair {
  for (const goal of profile?.improvementGoals ?? []) {
    const mapped = mapGoalToSkill(goal);
    if (mapped) return mapped;
  }
  return { categoryId: 'technical', skillId: 'first-touch' };
}

function resolveTargetSkill(target: SessionTarget, profile: PlayerProfile | null): SkillPair {
  if (target.kind === 'skill') {
    return { categoryId: target.categoryId, skillId: target.skillId };
  }
  return resolveProfileSkill(profile);
}

function preMatchAllowedSkill(categoryId: ImproveCategoryId, skillId: string): boolean {
  if (categoryId === 'technical') return true;
  if (categoryId === 'recovery') return true;
  if (categoryId === 'mental') return true;
  void skillId;
  return false;
}

function listAllSkillPairs(): SkillPair[] {
  return getAllImproveCategories().flatMap((category) =>
    category.skills.map((skill) => ({ categoryId: category.id, skillId: skill.id }))
  );
}

function diversityKey(categoryId: string, skillId: string, drill: ImproveDrill): string {
  return (
    drill.recoveryFocus ??
    drill.muscleGroup ??
    drill.speedFocus ??
    drill.agilityFocus ??
    `${categoryId}/${skillId}`
  );
}

function collectCandidates(
  skillPairs: SkillPair[],
  inputs: SessionInputs,
  difficultyBand: [ImproveDrillDifficulty, ImproveDrillDifficulty],
  options: {
    recoveryOnly: boolean;
    rehab: boolean;
    preMatch: boolean;
    excludeDrillIds?: Set<string>;
    /** When true, also allow technical/juggling at difficulty 1–2 (Recovery/Rehab variety). */
    allowRecoveryJuggling?: boolean;
  }
): CandidateDrill[] {
  const categories = getAllImproveCategories();
  const results: CandidateDrill[] = [];
  const pairs = [...skillPairs];

  if (options.allowRecoveryJuggling) {
    pairs.push({ categoryId: 'technical', skillId: 'juggling' });
  }

  for (const pair of pairs) {
    if (options.recoveryOnly || options.rehab) {
      const isRecovery = pair.categoryId === 'recovery' && pair.skillId === 'recovery-mobility';
      const isJugglingVariety =
        options.allowRecoveryJuggling &&
        pair.categoryId === 'technical' &&
        pair.skillId === 'juggling';
      if (!isRecovery && !isJugglingVariety) continue;
    }

    if (options.preMatch && !preMatchAllowedSkill(pair.categoryId, pair.skillId)) continue;

    // Warm-up is selected separately — never part of the main pool
    if (pair.categoryId === 'physical' && pair.skillId === 'warm-up') continue;

    const category = categories.find((c) => c.id === pair.categoryId);
    const skill = category?.skills.find((s) => s.id === pair.skillId);
    if (!skill) continue;

    for (const drill of skill.drills) {
      if (options.excludeDrillIds?.has(drill.id)) continue;
      if (!inputs.hasPartner && drill.requiresPartner === 'partner') continue;
      if (!inputs.hasPartner && drill.requiresPartner === 'group') continue;

      // Hard location filter when resolved — never widen past this
      if (
        inputs.location != null &&
        !drillMatchesLocation(drill.equipment, inputs.location, drill.id)
      ) {
        continue;
      }

      let difficultyOk = inBand(drill.difficulty, difficultyBand);

      // Recovery/Rehab juggling variety: only difficulty 1–2
      if (
        options.allowRecoveryJuggling &&
        pair.categoryId === 'technical' &&
        pair.skillId === 'juggling'
      ) {
        difficultyOk = drill.difficulty <= 2;
      }

      // Pre-match: allow difficulty 3 for Technical only
      if (options.preMatch && pair.categoryId === 'technical' && drill.difficulty === 3) {
        difficultyOk = drill.difficulty >= difficultyBand[0] && drill.difficulty <= 3;
      }

      // In-season: avoid hardest Strength/Stamina
      if (
        inputs.situation === 'in-season' &&
        pair.categoryId === 'physical' &&
        (pair.skillId === 'strength' || pair.skillId === 'stamina') &&
        drill.difficulty === 5
      ) {
        difficultyOk = false;
      }

      if (options.rehab && pair.skillId !== 'juggling' && (drill.difficulty < 1 || drill.difficulty > 2)) {
        difficultyOk = false;
      }

      if (!difficultyOk) continue;

      if (
        pair.categoryId === 'physical' &&
        pair.skillId === 'strength' &&
        inputs.age < SESSION_STRENGTH_AGE_CUTOFF &&
        !isStrengthDrillAllowedForYouth(drill.equipment)
      ) {
        continue;
      }

      // Pre-match never includes Strength
      if (options.preMatch && pair.skillId === 'strength') continue;

      // Juggling only when explicitly targeted, or as Recovery/Rehab rare variety
      if (pair.skillId === 'juggling') {
        const isExplicitTarget = skillPairs.some(
          (p) => p.categoryId === 'technical' && p.skillId === 'juggling'
        );
        if (!isExplicitTarget && !options.allowRecoveryJuggling) continue;
      }

      results.push({
        categoryId: pair.categoryId,
        skillId: pair.skillId,
        drill,
        skillKey: `${pair.categoryId}/${pair.skillId}`,
        diversityKey: diversityKey(pair.categoryId, pair.skillId, drill),
      });
    }
  }

  return results;
}

function pickDiverse(candidates: CandidateDrill[], count: number): CandidateDrill[] {
  const shuffled = shuffle(candidates);
  const selected: CandidateDrill[] = [];
  const usedDrillIds = new Set<string>();
  const skillCounts = new Map<string, number>();
  const diversityCounts = new Map<string, number>();

  const score = (candidate: CandidateDrill) => {
    const skillCount = skillCounts.get(candidate.skillKey) ?? 0;
    const divCount = diversityCounts.get(candidate.diversityKey) ?? 0;
    return skillCount * 3 + divCount * 2 + Math.random();
  };

  while (selected.length < count && shuffled.length > 0) {
    shuffled.sort((a, b) => score(a) - score(b));
    const nextIndex = shuffled.findIndex((c) => !usedDrillIds.has(c.drill.id));
    if (nextIndex === -1) break;
    const [next] = shuffled.splice(nextIndex, 1);
    selected.push(next);
    usedDrillIds.add(next.drill.id);
    skillCounts.set(next.skillKey, (skillCounts.get(next.skillKey) ?? 0) + 1);
    diversityCounts.set(next.diversityKey, (diversityCounts.get(next.diversityKey) ?? 0) + 1);
  }

  return selected;
}

/** Ascending difficulty; shuffle within the same difficulty for variety. */
function pickAscendingByDifficulty(candidates: CandidateDrill[], count: number): CandidateDrill[] {
  const byDiff = new Map<number, CandidateDrill[]>();
  for (const c of candidates) {
    const list = byDiff.get(c.drill.difficulty) ?? [];
    list.push(c);
    byDiff.set(c.drill.difficulty, list);
  }

  const ordered: CandidateDrill[] = [];
  const used = new Set<string>();
  for (const diff of [1, 2, 3, 4, 5]) {
    const group = shuffle(byDiff.get(diff) ?? []);
    for (const c of group) {
      if (used.has(c.drill.id)) continue;
      ordered.push(c);
      used.add(c.drill.id);
      if (ordered.length >= count) return ordered;
    }
  }
  return ordered;
}

function pickWarmUpDrill(location: SessionLocation | undefined): SessionDrillRef | null {
  const skill = getAllImproveCategories()
    .find((c) => c.id === 'physical')
    ?.skills.find((s) => s.id === 'warm-up');
  const drills = (skill?.drills ?? []).filter((d) =>
    location == null ? true : drillMatchesLocation(d.equipment, location, d.id)
  );
  if (drills.length === 0) return null;
  const drill = drills[Math.floor(Math.random() * drills.length)]!;
  return { categoryId: 'physical', skillId: 'warm-up', drill };
}

const TECHNICAL_STRETCH_GROUPS: ImproveMuscleGroupId[] = ['hamstrings', 'quads', 'calves'];
const SPEED_AGILITY_STRETCH_GROUPS: ImproveMuscleGroupId[] = [
  'hamstrings',
  'quads',
  'calves',
  'glutes',
  'hip-flexors',
];
const STAMINA_STRETCH_GROUPS: ImproveMuscleGroupId[] = ['hamstrings', 'calves', 'quads'];
const MENTAL_STRETCH_GROUPS: ImproveMuscleGroupId[] = ['core', 'hamstrings'];
const GENERAL_STRETCH_GROUPS: ImproveMuscleGroupId[] = [
  'hamstrings',
  'quads',
  'glutes',
  'calves',
  'core',
];

/** Muscle groups for closing stretches based on session target skill + selected drills. */
function stretchGroupsForSession(
  primarySkill: SkillPair,
  mainDrills: SessionDrillRef[]
): ImproveMuscleGroupId[] {
  const { skillId } = primarySkill;

  if (
    skillId === 'passing' ||
    skillId === 'shooting' ||
    skillId === 'dribbling' ||
    skillId === 'first-touch' ||
    skillId === 'juggling'
  ) {
    return [...TECHNICAL_STRETCH_GROUPS];
  }

  if (skillId === 'speed' || skillId === 'agility') {
    return [...SPEED_AGILITY_STRETCH_GROUPS];
  }

  if (skillId === 'stamina') {
    return [...STAMINA_STRETCH_GROUPS];
  }

  if (skillId === 'composure' || skillId === 'confidence') {
    return [...MENTAL_STRETCH_GROUPS];
  }

  if (skillId === 'strength') {
    const worked = new Set<ImproveMuscleGroupId>();
    for (const item of mainDrills) {
      if (item.skillId !== 'strength') continue;
      if (item.drill.muscleGroup) worked.add(item.drill.muscleGroup);
    }
    if (worked.size > 0) return [...worked];
    return [...GENERAL_STRETCH_GROUPS];
  }

  // Expanded / pre-match multi-skill fallback
  return [...GENERAL_STRETCH_GROUPS];
}

/**
 * Pick up to 3 closing stretches across the 2–3 most relevant muscle groups.
 * Avoids dumping all picks into one group when the pool allows variety.
 */
function pickClosingStretches(
  excludeIds: Set<string>,
  location: SessionLocation | undefined,
  targetGroups: ImproveMuscleGroupId[],
  count = 3
): SessionDrillRef[] {
  const skill = getAllImproveCategories()
    .find((c) => c.id === 'recovery')
    ?.skills.find((s) => s.id === 'recovery-mobility');
  const pool = (skill?.drills ?? []).filter(
    (d) =>
      d.recoveryFocus === 'stretching' &&
      !excludeIds.has(d.id) &&
      (location == null || drillMatchesLocation(d.equipment, location, d.id))
  );
  if (pool.length === 0) return [];

  // Use 2–3 groups when possible (cap at 3 for a 3-stretch close)
  let activeGroups = shuffle(
    targetGroups.filter((g) => pool.some((d) => d.muscleGroup === g))
  );
  if (activeGroups.length === 0) {
    activeGroups = shuffle(
      [...new Set(pool.map((d) => d.muscleGroup).filter(Boolean))] as ImproveMuscleGroupId[]
    );
  }
  if (activeGroups.length > 3) {
    activeGroups = activeGroups.slice(0, 3);
  }
  if (activeGroups.length === 0) {
    // Untagged fallback
    return shuffle(pool)
      .slice(0, count)
      .map((drill) => ({
        categoryId: 'recovery' as const,
        skillId: 'recovery-mobility',
        drill,
      }));
  }

  const selected: ImproveDrill[] = [];
  const used = new Set<string>();

  const takeFromGroup = (group: ImproveMuscleGroupId): ImproveDrill | null => {
    const candidates = shuffle(
      pool.filter((d) => d.muscleGroup === group && !used.has(d.id))
    );
    return candidates[0] ?? null;
  };

  // First pass: one stretch per active group
  for (const group of activeGroups) {
    if (selected.length >= count) break;
    const pick = takeFromGroup(group);
    if (pick) {
      selected.push(pick);
      used.add(pick.id);
    }
  }

  // Fill remaining — prefer groups not yet represented, then any target group, then any stretch
  while (selected.length < count) {
    const represented = new Set(
      selected.map((d) => d.muscleGroup).filter(Boolean) as ImproveMuscleGroupId[]
    );
    const underrepresented = activeGroups.filter((g) => !represented.has(g));
    let pick: ImproveDrill | null = null;

    for (const group of shuffle(underrepresented)) {
      pick = takeFromGroup(group);
      if (pick) break;
    }
    if (!pick) {
      for (const group of shuffle(activeGroups)) {
        pick = takeFromGroup(group);
        if (pick) break;
      }
    }
    if (!pick) {
      for (const group of shuffle(targetGroups)) {
        pick = takeFromGroup(group);
        if (pick) break;
      }
    }
    if (!pick) {
      const any = shuffle(pool.filter((d) => !used.has(d.id)));
      pick = any[0] ?? null;
    }
    if (!pick) break;
    selected.push(pick);
    used.add(pick.id);
  }

  return selected.map((drill) => ({
    categoryId: 'recovery' as const,
    skillId: 'recovery-mobility',
    drill,
  }));
}

export function generateImproveSession(
  inputs: SessionInputs,
  profile: PlayerProfile | null = null
): GeneratedSession {
  const notes: string[] = [];
  const desiredCount = SESSION_DURATION_DRILL_COUNTS[inputs.durationMinutes];
  const recoveryOnly =
    inputs.situation === 'recovery-day' || inputs.situation === 'rehab';
  const rehab = inputs.situation === 'rehab';
  const preMatch = inputs.situation === 'pre-match';
  const situationBand = getSituationDifficultyBand(inputs.situation);
  const intensityOuter = intensityOuterBand(inputs.intensity);

  const allowRecoveryJuggling =
    recoveryOnly && Math.random() < RECOVERY_JUGGLING_CHANCE;

  if (rehab) {
    notes.push(REHAB_DISCLAIMER);
  }

  if (recoveryOnly) {
    notes.push(
      allowRecoveryJuggling
        ? 'Target is ignored for Recovery day / Rehab — Recovery & Mobility drills are used, with light juggling variety this time.'
        : 'Target is ignored for Recovery day / Rehab — only Recovery & Mobility drills are used.'
    );
  }

  // Single skill from profile or manual pick (category targets removed)
  let primarySkill = recoveryOnly
    ? ({ categoryId: 'recovery', skillId: 'recovery-mobility' } as SkillPair)
    : resolveTargetSkill(inputs.target, profile);

  let skillPairs: SkillPair[] = [primarySkill];
  let isSingleSkillSession = !recoveryOnly;

  if (preMatch && !recoveryOnly) {
    if (!preMatchAllowedSkill(primarySkill.categoryId, primarySkill.skillId)) {
      notes.push(
        'Pre-match sessions use Technical, Recovery, and Mental drills — your target was adjusted.'
      );
      skillPairs = listAllSkillPairs().filter((p) =>
        preMatchAllowedSkill(p.categoryId, p.skillId)
      );
      isSingleSkillSession = false;
    }
  }

  let difficultyBand: [ImproveDrillDifficulty, ImproveDrillDifficulty];
  if (rehab) {
    difficultyBand = [1, 2];
  } else if (recoveryOnly) {
    difficultyBand = intersectBands(intensityOuter, [1, 5]);
  } else if (isSingleSkillSession) {
    // Level × intensity window, then intersect situation
    const levelWindow = levelIntensityWindow(inputs.intensity, profile?.playingLevel);
    difficultyBand = situationBand
      ? intersectBands(levelWindow, situationBand)
      : levelWindow;
  } else if (situationBand) {
    difficultyBand = intersectBands(intensityOuter, situationBand);
  } else {
    difficultyBand = intensityOuter;
  }

  if (difficultyBand[0] > difficultyBand[1]) {
    notes.push('Intensity was eased to match this situation’s safe difficulty range.');
    if (rehab) {
      difficultyBand = [1, 2];
    } else if (preMatch) {
      difficultyBand = [1, 3];
    } else if (isSingleSkillSession) {
      difficultyBand = levelIntensityWindow(inputs.intensity, profile?.playingLevel);
    } else {
      difficultyBand = intensityOuter;
    }
  }

  const filterOptions = {
    recoveryOnly,
    rehab,
    preMatch,
    allowRecoveryJuggling,
  };

  // Collect without location first (location is auto-resolved next)
  const inputsWithoutLocation: SessionInputs = { ...inputs, location: undefined };

  let candidates = collectCandidates(
    skillPairs,
    inputsWithoutLocation,
    difficultyBand,
    filterOptions
  );

  // Widen within intensity outer band for thin single-skill pools
  if (candidates.length < desiredCount && isSingleSkillSession) {
    const widened = widenWithinOuter(difficultyBand, intensityOuter);
    if (widened[0] !== difficultyBand[0] || widened[1] !== difficultyBand[1]) {
      notes.push('Difficulty range was widened slightly within your intensity band.');
      difficultyBand = rehab ? [1, 2] : widened;
      candidates = collectCandidates(
        skillPairs,
        inputsWithoutLocation,
        difficultyBand,
        filterOptions
      );
    }
  }

  if (candidates.length < desiredCount) {
    const widened = widenBand(difficultyBand, 1);
    if (widened[0] !== difficultyBand[0] || widened[1] !== difficultyBand[1]) {
      if (rehab) {
        difficultyBand = [1, 2];
      } else {
        notes.push('Difficulty range was widened slightly to fill this session.');
        difficultyBand = widened;
      }
      candidates = collectCandidates(
        skillPairs,
        inputsWithoutLocation,
        difficultyBand,
        filterOptions
      );
    }
  }

  if (candidates.length < desiredCount && !recoveryOnly) {
    notes.push('Skill pool was expanded to find enough matching drills.');
    const jugglingOk = primarySkill.skillId === 'juggling';
    const expanded = (
      preMatch
        ? listAllSkillPairs().filter((p) => preMatchAllowedSkill(p.categoryId, p.skillId))
        : listAllSkillPairs()
    ).filter((p) => jugglingOk || p.skillId !== 'juggling');
    skillPairs = expanded;
    isSingleSkillSession = false;
    candidates = collectCandidates(
      skillPairs,
      inputsWithoutLocation,
      difficultyBand,
      filterOptions
    );
  }

  if (candidates.length < desiredCount && !rehab) {
    const fullyOpen: [ImproveDrillDifficulty, ImproveDrillDifficulty] = [1, 5];
    notes.push('Filters were relaxed further so a full session could be built.');
    candidates = collectCandidates(skillPairs, inputsWithoutLocation, fullyOpen, {
      ...filterOptions,
      allowRecoveryJuggling: recoveryOnly ? allowRecoveryJuggling : false,
    });
  }

  // Auto-location: skip for Recovery day / Rehab
  let resolvedLocation: SessionLocation | undefined;
  if (!recoveryOnly) {
    const fullPool = collectCandidates(skillPairs, inputsWithoutLocation, [1, 5], {
      ...filterOptions,
      allowRecoveryJuggling: false,
    });
    resolvedLocation = resolveDominantLocation(
      candidates.map((c) => ({ id: c.drill.id, equipment: c.drill.equipment })),
      fullPool.map((c) => ({ id: c.drill.id, equipment: c.drill.equipment }))
    );

    const locatedInputs: SessionInputs = { ...inputs, location: resolvedLocation };
    candidates = candidates.filter((c) =>
      drillMatchesLocation(c.drill.equipment, resolvedLocation!, c.drill.id)
    );

    // If location filter thins the pool, widen difficulty but keep location fixed
    if (candidates.length < desiredCount && !rehab) {
      const widened = widenBand(difficultyBand, 1);
      if (widened[0] !== difficultyBand[0] || widened[1] !== difficultyBand[1]) {
        notes.push('Difficulty range was widened slightly to fill this session.');
        difficultyBand = widened;
        candidates = collectCandidates(skillPairs, locatedInputs, difficultyBand, filterOptions);
      }
    }

    if (candidates.length < desiredCount && !rehab) {
      const fullyOpen: [ImproveDrillDifficulty, ImproveDrillDifficulty] = [1, 5];
      notes.push('Filters were relaxed further so a full session could be built.');
      candidates = collectCandidates(skillPairs, locatedInputs, fullyOpen, {
        ...filterOptions,
        allowRecoveryJuggling: false,
      });
    }
  }

  const warmUp = pickWarmUpDrill(resolvedLocation);

  let picked: CandidateDrill[];
  if (isSingleSkillSession) {
    picked = pickAscendingByDifficulty(candidates, desiredCount);
  } else if (allowRecoveryJuggling) {
    const jugglingCandidates = candidates.filter((c) => c.skillId === 'juggling');
    const recoveryCandidates = candidates.filter((c) => c.skillId !== 'juggling');
    if (jugglingCandidates.length > 0 && desiredCount > 0) {
      const jugglingPick = pickDiverse(jugglingCandidates, 1);
      const rest = pickDiverse(
        recoveryCandidates.filter((c) => c.drill.id !== jugglingPick[0]?.drill.id),
        Math.max(0, desiredCount - 1)
      );
      picked = shuffle([...jugglingPick, ...rest]);
    } else {
      picked = pickDiverse(candidates, desiredCount);
    }
  } else {
    picked = pickDiverse(candidates, desiredCount);
  }

  if (picked.length < desiredCount) {
    notes.push(`Only ${picked.length} matching drills were available for these inputs.`);
  }

  const mainDrills: SessionDrillRef[] = picked.map(({ categoryId, skillId, drill }) => ({
    categoryId,
    skillId,
    drill,
  }));

  const usedIds = new Set(mainDrills.map((d) => d.drill.id));
  if (warmUp) usedIds.add(warmUp.drill.id);

  // Closing stretches — not for Recovery day / Rehab
  const stretchGroups = stretchGroupsForSession(primarySkill, mainDrills);
  const stretches = recoveryOnly
    ? []
    : pickClosingStretches(usedIds, resolvedLocation, stretchGroups, 3);

  const drills: SessionDrillRef[] = [
    ...(warmUp ? [warmUp] : []),
    ...mainDrills,
    ...stretches,
  ];

  const resolvedInputs: SessionInputs = {
    ...inputs,
    ...(resolvedLocation != null ? { location: resolvedLocation } : { location: undefined }),
  };

  return {
    id: createSessionId(),
    createdAt: new Date().toISOString(),
    inputs: resolvedInputs,
    drills,
    notes,
  };
}
