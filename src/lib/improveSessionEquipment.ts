/**
 * Under-14 Strength equipment rule:
 * A drill stays eligible if it has ANY bodyweight-only path, even when optional
 * added weight is also mentioned.
 */

const REQUIRED_WEIGHTED_PATTERN =
  /\b(barbell|dumbbells?|weight plates?|trap bar|smith machine|cable machine|row machine|kettlebell)\b/i;

function itemAllowsBodyweightPath(item: string): boolean {
  const lower = item.toLowerCase();

  if (/\boptional\b/.test(lower)) return true;
  if (/\bor a light dumbbell\b/.test(lower)) return true;
  if (/\bor light weight\b/.test(lower)) return true;
  if (/\bnone\b/.test(lower) && /\bbodyweight\b/.test(lower)) return true;
  if (/\bbodyweight only\b/.test(lower)) return true;
  if (/\bbodyweight\b/.test(lower) && /\bor\b/.test(lower)) return true;

  // Dip bars / machine OR sturdy box/bench — box path is fine
  if (/\bor\b/.test(lower) && /\b(box|bench|bodyweight|none)\b/.test(lower)) {
    return true;
  }

  return false;
}

function itemRequiresWeightedEquipment(item: string): boolean {
  if (!REQUIRED_WEIGHTED_PATTERN.test(item)) return false;
  if (itemAllowsBodyweightPath(item)) return false;
  return true;
}

/** True when a Strength drill is safe to include for players under the age cutoff. */
export function isStrengthDrillAllowedForYouth(equipment: string[]): boolean {
  if (equipment.length === 0) return true;

  // If every item that looks weighted also offers a bodyweight/optional path, allow.
  const hasHardWeightedRequirement = equipment.some(itemRequiresWeightedEquipment);
  if (hasHardWeightedRequirement) return false;

  return true;
}
