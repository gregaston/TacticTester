import { FEATURE_KEYS, FEATURE_WEIGHTS, type FeatureKey, type ShapeFeatures } from "./features";
import type { SideSummary } from "./types";

export type FeatureScale = Record<FeatureKey, { mean: number; std: number }>;

export type RankedSide = {
  side: SideSummary;
  distance: number;
  phrase: string;
};

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

export function rankSides(user: ShapeFeatures, sides: SideSummary[], limit = 3): RankedSide[] {
  const scale = featureScale(sides);
  return sides
    .map((side) => ({
      side,
      distance: distance(user, side.features, scale),
      phrase: gapPhrase(user, usualFeatures(side)),
    }))
    .sort((a, b) => a.distance - b.distance || a.side.team.localeCompare(b.side.team))
    .slice(0, limit);
}

export function featureScale(sides: SideSummary[]): FeatureScale {
  const scale = {} as FeatureScale;
  for (const key of FEATURE_KEYS) {
    const values = sides.map((side) => side.features[key]);
    const mean = average(values);
    const variance = average(values.map((value) => (value - mean) ** 2));
    scale[key] = { mean, std: Math.sqrt(variance) };
  }
  return scale;
}

function distance(user: ShapeFeatures, other: ShapeFeatures, scale: FeatureScale): number {
  let total = 0;
  for (const key of FEATURE_KEYS) {
    const std = usableStd(key, scale[key].std);
    if (std === null) continue;
    const gap = (user[key] - other[key]) / std;
    total += (gap * FEATURE_WEIGHTS[key]) ** 2;
  }
  return Math.sqrt(total);
}

const COUNT_KEYS = ["def", "st", "dm", "cm", "am"] as const satisfies readonly FeatureKey[];

function usualFeatures(side: SideSummary): ShapeFeatures {
  const [def, dm, cm, am, st] = side.formationKey.split("-").map(Number);
  return { ...side.features, def, dm, cm, am, st };
}

function gapPhrase(user: ShapeFeatures, other: ShapeFeatures): string {
  const countGap = largestGap(user, other, COUNT_KEYS, 0.5);
  const gap = countGap ?? largestGap(user, other, ["backLine", "forwardLine", "width"], 3);
  if (!gap) return "Very close in shape";
  const wording = PHRASES[gap];
  return user[gap] > other[gap] ? wording.higher : wording.lower;
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

function usableStd(key: FeatureKey, std: number): number | null {
  const floor = key === "def" || key === "dm" || key === "cm" || key === "am" || key === "st" ? 0.25 : 1;
  return std >= floor ? std : null;
}

function average(values: number[]): number {
  if (values.length === 0) return 0;
  return values.reduce((sum, value) => sum + value, 0) / values.length;
}
