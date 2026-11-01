import { type FeatureKey, type ShapeFeatures } from "./features";
import type { SideSummary } from "./types";

export type RankedSide = {
  side: SideSummary;
  distance: number;
  phrase: string;
};

/** A modal lineup below this share is too mixed to use as the comparison. */
const MIN_SHARE = 0.4;

/** At or above this, "same shape" does not need the match percentage repeated. */
const SETTLED_SHARE = 0.5;

const COUNT_KEYS = ["def", "dm", "cm", "am", "st"] as const satisfies readonly FeatureKey[];
const SPATIAL_KEYS = ["backLine", "forwardLine", "width"] as const satisfies readonly FeatureKey[];

const PHRASES: Record<FeatureKey, { higher: string; lower: string }> = {
  backLine: {
    higher: "Back line higher than theirs",
    lower: "Back line deeper than theirs",
  },
  forwardLine: {
    higher: "Forwards higher than theirs",
    lower: "Forwards deeper than theirs",
  },
  width: {
    higher: "Wider than their usual shape",
    lower: "Narrower than their usual shape",
  },
  def: {
    higher: "More defenders than their usual side",
    lower: "Fewer defenders than their usual side",
  },
  dm: {
    higher: "More holding midfielders",
    lower: "Fewer holding midfielders",
  },
  cm: {
    higher: "More central midfielders",
    lower: "Fewer central midfielders",
  },
  am: {
    higher: "More attacking midfielders",
    lower: "Fewer attacking midfielders",
  },
  st: {
    higher: "More forwards",
    lower: "Fewer forwards",
  },
};

export function comparableSides(sides: SideSummary[]): SideSummary[] {
  return comparable(sides);
}

export function formationGap(user: ShapeFeatures, side: SideSummary): number {
  return countDistance(user, side);
}

export function blockGap(user: ShapeFeatures, side: SideSummary): { back: number; forward: number; width: number } {
  return {
    back: user.backLine - side.features.backLine,
    forward: user.forwardLine - side.features.forwardLine,
    width: user.width - side.features.width,
  };
}

/** The largest way the user's shape differs, or null when the shape agrees. */
export function shapeDifference(user: ShapeFeatures, side: SideSummary): string | null {
  const other = usualFeatures(side);
  const countGap = largestGap(user, other, COUNT_KEYS, 0.5);
  if (countGap) return wording(user, other, countGap);
  const spatial = largestGap(user, other, SPATIAL_KEYS, 3);
  if (!spatial) return null;
  return wording(user, other, spatial);
}

export function rankSides(user: ShapeFeatures, sides: SideSummary[], limit = 3): RankedSide[] {
  const pool = comparable(sides);
  return pool
    .map((side) => ({
      side,
      distance: countDistance(user, side),
      spatial: spatialDistance(user, side),
      phrase: gapPhrase(user, side),
    }))
    .sort(
      (a, b) =>
        a.distance - b.distance ||
        b.side.formationShare - a.side.formationShare ||
        a.spatial - b.spatial ||
        a.side.team.localeCompare(b.side.team),
    )
    .slice(0, limit)
    .map(({ side, distance, phrase }) => ({ side, distance, phrase }));
}

function comparable(sides: SideSummary[]): SideSummary[] {
  const settled = sides.filter((side) => side.formationShare >= MIN_SHARE);
  return settled.length > 0 ? settled : sides;
}

function countDistance(user: ShapeFeatures, side: SideSummary): number {
  const modal = side.formationKey.split("-").map(Number);
  return COUNT_KEYS.reduce((sum, key, index) => sum + Math.abs(Math.round(user[key]) - modal[index]), 0);
}

function spatialDistance(user: ShapeFeatures, side: SideSummary): number {
  const back = user.backLine - side.features.backLine;
  const forward = user.forwardLine - side.features.forwardLine;
  const width = user.width - side.features.width;
  return Math.hypot(back, forward, width);
}

function usualFeatures(side: SideSummary): ShapeFeatures {
  const [def, dm, cm, am, st] = side.formationKey.split("-").map(Number);
  return { ...side.features, def, dm, cm, am, st };
}

function gapPhrase(user: ShapeFeatures, side: SideSummary): string {
  const other = usualFeatures(side);
  const countGap = largestGap(user, other, COUNT_KEYS, 0.5);
  if (countGap) return wording(user, other, countGap);
  if (side.formationShare < SETTLED_SHARE) {
    const percent = Math.round(side.formationShare * 100);
    return `Same shape in ${percent}% of matches`;
  }
  const spatial = largestGap(user, other, SPATIAL_KEYS, 3);
  if (!spatial) return "Same shape";
  return wording(user, other, spatial);
}

function wording(user: ShapeFeatures, other: ShapeFeatures, key: FeatureKey): string {
  const phrase = PHRASES[key];
  return user[key] > other[key] ? phrase.higher : phrase.lower;
}

function largestGap(
  user: ShapeFeatures,
  other: ShapeFeatures,
  keys: readonly FeatureKey[],
  minimum: number,
): FeatureKey | null {
  let best: FeatureKey | null = null;
  let bestDelta = minimum;
  for (const key of keys) {
    const delta = Math.abs(user[key] - other[key]);
    if (delta > bestDelta) {
      best = key;
      bestDelta = delta;
    }
  }
  return best;
}
