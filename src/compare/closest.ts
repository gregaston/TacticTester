import type { StyleSide } from "../data/style-library";
import type { SeasonRecord } from "../data/records";
import { lineNote, type TeamInstructions } from "../tactics/instructions";
import {
  controlSentence,
  passingStackNote,
  recordedSpread,
  styleControl,
  styleDistance,
  type ProfilePlayer,
  type StyleProfile,
} from "../testing/profile";
import type { ShapeFeatures } from "./features";
import { compactShape } from "./format";
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
  /** Style percent under this is too far to lead with the club as a match. */
  weak: boolean;
  figures: StyleFigure[];
  /** The control behind the largest style gap, with the distance. */
  lever: string | null;
  /** Line height, kept off the formation counts. */
  line: string | null;
  /** In-game shape, only when it differs from the start and shows up often. */
  shift: string | null;
  /** Loft against length, only when the two disagree. */
  loft: string | null;
  /** A side that lost on shape despite a style score at least 8 points higher. */
  closerStyle: { team: string; stylePercent: number } | null;
};

export type StyleFigure = {
  label: string;
  yours: number;
  theirs: number;
  low: number;
  high: number;
  unit: string;
};

/** Below this style percent, the likeness is too weak to lead with the club. */
export const WEAK_STYLE = 40;

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
    minimum: 1.2,
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
  context?: {
    players: ProfilePlayer[];
    instructions: TeamInstructions;
    styles: StyleSide[];
  },
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
  const closer = pool
    .filter((side) => side.shape.id !== best.shape.id && side.styleScore >= best.styleScore + 8)
    .sort((a, b) => b.styleScore - a.styleScore || a.shape.team.localeCompare(b.shape.team))[0];
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
    weak: best.styleScore < WEAK_STYLE,
    figures: styleFigures(profile, best.style, styles),
    lever: context ? leverLine(context.players, context.instructions, context.styles, profile, best.style) : null,
    line: context ? lineNote(context.instructions) : null,
    shift: shiftSentence(best.shape),
    loft: loftSentence(best.style, styles),
    closerStyle: closer ? { team: closer.shape.team, stylePercent: closer.styleScore } : null,
  };
}

function shiftSentence(side: SideSummary): string | null {
  if (!side.shiftKey || side.shiftShare == null) return null;
  if (side.shiftKey === side.formationKey || side.shiftShare < 0.3) return null;
  const percent = Math.round(side.shiftShare * 100);
  return `After kickoff they most often become ${compactShape(side.shiftKey)}, in ${percent}% of matches.`;
}

function loftSentence(side: StyleSide, styles: StyleSide[]): string | null {
  if (typeof side.highPassShare !== "number" || !Number.isFinite(side.highPassShare)) return null;
  const passes = styles.map((item) => item.passLength).filter((value) => Number.isFinite(value));
  const highs = styles
    .map((item) => item.highPassShare)
    .filter((value): value is number => typeof value === "number" && Number.isFinite(value));
  if (passes.length < 8 || highs.length < 8) return null;
  const passLow = quartile(passes, 0.25);
  const passHigh = quartile(passes, 0.75);
  const loftLow = quartile(highs, 0.25);
  const loftHigh = quartile(highs, 0.75);
  if (passHigh <= passLow || loftHigh <= loftLow) return null;
  if (side.passLength >= passHigh && side.highPassShare <= loftLow) return "Their longer passes stay on the ground.";
  if (side.passLength <= passLow && side.highPassShare >= loftHigh) return "Their shorter passes are played in the air.";
  return null;
}

function quartile(values: number[], fraction: number): number {
  const sorted = [...values].sort((a, b) => a - b);
  const index = Math.min(sorted.length - 1, Math.floor((sorted.length - 1) * fraction));
  return sorted[index];
}

function styleFigures(profile: StyleProfile, side: StyleSide, styles: StyleSide[]): StyleFigure[] {
  const spread = recordedSpread(styles);
  return [
    {
      label: "Pass",
      yours: profile.passLength,
      theirs: side.passLength,
      low: spread.passLength.low,
      high: spread.passLength.high,
      unit: "yd",
    },
    {
      label: "Shots",
      yours: profile.shotsPerMatch,
      theirs: side.shotsPerMatch,
      low: spread.shotsPerMatch.low,
      high: spread.shotsPerMatch.high,
      unit: "",
    },
    {
      label: "Press",
      yours: profile.pressHeight,
      theirs: side.pressHeight,
      low: spread.pressHeight.low,
      high: spread.pressHeight.high,
      unit: "",
    },
  ];
}

function leverLine(
  players: ProfilePlayer[],
  instructions: TeamInstructions,
  styles: StyleSide[],
  profile: StyleProfile,
  side: StyleSide,
): string | null {
  const metric = leadingMetric(profile, side);
  if (!metric) return null;
  const control = styleControl(players, instructions, styles, metric.key);
  if (!control || Math.abs(control.amount) < 0.3) return null;
  const account = controlSentence(control.name, control.amount, metric.key);
  const stack = metric.key === "passLength" ? passingStackNote(instructions) : null;
  return stack ? `${stack} ${account}` : account;
}

function leadingMetric(
  profile: StyleProfile,
  side: StyleSide,
): { key: "passLength" | "shotsPerMatch" | "pressHeight" } | null {
  let best: (typeof STYLE_GAPS)[number] | null = null;
  let bestGap = 0;
  for (const gap of STYLE_GAPS) {
    const delta = Math.abs(profile[gap.key] - side[gap.key]);
    if (delta < gap.minimum) continue;
    const scaled = delta / gap.scale;
    if (scaled > bestGap) {
      best = gap;
      bestGap = scaled;
    }
  }
  if (!best) return null;
  return { key: best.key };
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
