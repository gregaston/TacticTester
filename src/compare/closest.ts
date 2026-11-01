import type { StyleSide } from "../data/style-library";
import type { SeasonRecord } from "../data/records";
import { styleDistance, type StyleProfile } from "../testing/profile";
import type { ShapeFeatures } from "./features";
import { blockGap, comparableSides, formationGap, shapeDifference } from "./nearest";
import type { SideSummary } from "./types";

export type ClosestMatch = {
  id: string;
  team: string;
  season: string;
  competition: string;
  manager: string;
  place: number;
  won: number;
  drawn: number;
  lost: number;
  goalsFor: number;
  goalsAgainst: number;
  points: number;
  stylePercent: number;
  shapePercent: number;
  summary: string;
};

const OUTFIELD = 10;
const BACK_SPAN = 16;
const FORWARD_SPAN = 16;
const WIDTH_SPAN = 8;

/**
 * Style distance is a hypotenuse of pass length, shots, and press height.
 * A gap of about five on that scale is a plainly different season.
 */
const STYLE_SCALE = 5;

const STYLE_GAPS = [
  {
    key: "passLength" as const,
    scale: 1.2,
    minimum: 1.2,
    higher: "Passes are longer than theirs",
    lower: "Passes are shorter than theirs",
  },
  {
    key: "shotsPerMatch" as const,
    scale: 1.5,
    minimum: 1.5,
    higher: "There are more shots than in their season",
    lower: "There are fewer shots than in their season",
  },
  {
    key: "pressHeight" as const,
    scale: 1.5,
    minimum: 3,
    higher: "The press is higher than theirs",
    lower: "The press is deeper than theirs",
  },
];

export function shapePercent(user: ShapeFeatures, side: SideSummary): number {
  const count = 1 - Math.min(formationGap(user, side), OUTFIELD) / OUTFIELD;
  const gap = blockGap(user, side);
  const spatial =
    (axis(gap.back, BACK_SPAN) + axis(gap.forward, FORWARD_SPAN) + axis(gap.width, WIDTH_SPAN)) / 3;
  return Math.round(100 * (0.7 * count + 0.3 * spatial));
}

export function stylePercent(profile: StyleProfile, side: StyleSide): number {
  return Math.round(100 * Math.exp(-styleDistance(profile, side) / STYLE_SCALE));
}

export function differenceSummary(
  user: ShapeFeatures,
  side: SideSummary,
  profile: StyleProfile,
  style: StyleSide,
): string {
  const shape = shapeDifference(user, side);
  const styleText = styleDifference(profile, style);
  if (shape && styleText) return `${shape}, and ${lowerFirst(styleText)}.`;
  if (shape) return `${shape}.`;
  if (styleText) return `${styleText}.`;
  return "Same shape and a similar style.";
}

export function closestMatch(
  user: ShapeFeatures,
  profile: StyleProfile,
  shapes: SideSummary[],
  styles: StyleSide[],
  records: SeasonRecord[],
): ClosestMatch | null {
  const styleById = new Map(styles.map((side) => [side.id, side]));
  const recordById = new Map(records.map((side) => [side.id, side]));
  const pool = comparableSides(shapes).flatMap((shape) => {
    const style = styleById.get(shape.id);
    const record = recordById.get(shape.id);
    if (!style || !record) return [];
    const styleScore = stylePercent(profile, style);
    const shapeScore = shapePercent(user, shape);
    return [{ shape, style, record, styleScore, shapeScore }];
  });
  pool.sort((a, b) => {
    const total = b.styleScore + b.shapeScore - (a.styleScore + a.shapeScore);
    if (total !== 0) return total;
    const balance = Math.min(b.styleScore, b.shapeScore) - Math.min(a.styleScore, a.shapeScore);
    if (balance !== 0) return balance;
    return a.shape.team.localeCompare(b.shape.team);
  });
  const best = pool[0];
  if (!best) return null;
  return {
    id: best.shape.id,
    team: best.shape.team,
    season: best.shape.season,
    competition: best.shape.competition,
    manager: best.record.manager,
    place: best.record.place,
    won: best.record.won,
    drawn: best.record.drawn,
    lost: best.record.lost,
    goalsFor: best.record.goalsFor,
    goalsAgainst: best.record.goalsAgainst,
    points: best.record.points,
    stylePercent: best.styleScore,
    shapePercent: best.shapeScore,
    summary: differenceSummary(user, best.shape, profile, best.style),
  };
}

function axis(delta: number, span: number): number {
  return 1 - Math.min(Math.abs(delta), span) / span;
}

function styleDifference(profile: StyleProfile, style: StyleSide): string | null {
  let best: (typeof STYLE_GAPS)[number] | null = null;
  let bestGap = 0;
  for (const gap of STYLE_GAPS) {
    const delta = Math.abs(profile[gap.key] - style[gap.key]);
    if (delta < gap.minimum) continue;
    const scaled = delta / gap.scale;
    if (scaled > bestGap) {
      best = gap;
      bestGap = scaled;
    }
  }
  if (!best) return null;
  return profile[best.key] > style[best.key] ? best.higher : best.lower;
}

function lowerFirst(value: string): string {
  return value.charAt(0).toLowerCase() + value.slice(1);
}
