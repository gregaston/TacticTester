export type SideNote = {
  id: string;
  team: string;
  season: string;
  competition: string;
  modelXgFor: number;
  modelXgAgainst: number;
  note: string;
};

/**
 * Which kind of opponent shares a result.
 *
 * Expected xG against follows shot count. The edge is this tactic's margin
 * minus that line. The style whose two ends differ most is the pattern:
 * one end is where the tactic does better than the shot count, the other
 * is where it does worse. A style is named only when that gap is wide
 * enough to be a real split in this run. The bar sits just under the
 * split a flat side shows against central and wide shot maps, so that
 * pattern is named instead of being dropped.
 */

const SHOW = 3;
const MIN_SIDES = 8;
const GAP = 0.05;

export type MatchupSide = {
  id: string;
  team: string;
  season: string;
  competition: string;
  shotsPerMatch: number;
  modelXgFor: number;
  modelXgAgainst: number;
  shotGrid?: number[][];
  pressHeight: number;
  longPassShare?: number;
  fieldTilt?: number;
  shapeWidth?: number;
};

type Scored = MatchupSide & { edge: number };

type Axis = {
  id: string;
  high: string;
  low: string;
  value: (side: MatchupSide) => number | null;
};

const AXES: Axis[] = [
  {
    id: "shots",
    high: "Sides who shoot through the middle",
    low: "Sides who shoot from wide areas",
    value: (side) => shotSplit(side.shotGrid),
  },
  {
    id: "press",
    high: "The higher presses",
    low: "Sides who sit off",
    value: (side) => side.pressHeight,
  },
  {
    id: "shape",
    high: "Wide starting shapes",
    low: "Narrow starting shapes",
    value: (side) => side.shapeWidth ?? null,
  },
  {
    id: "direct",
    high: "Direct sides who see less of the final third",
    low: "Sides who keep the ball in the final third",
    value: (side) => directness(side.longPassShare, side.fieldTilt),
  },
];

export type MatchupRead = {
  strength: string | null;
  weakness: string | null;
  comparison: string | null;
  harder: SideNote[];
  easier: SideNote[];
};

export function axisGaps(sides: MatchupSide[]): { id: string; gap: number }[] {
  if (sides.length === 0) return [];
  const { a, b } = fit(sides.map((side) => side.shotsPerMatch), sides.map((side) => side.modelXgFor - side.modelXgAgainst));
  const scored = sides.map((side) => ({ ...side, edge: side.modelXgFor - side.modelXgAgainst - (a + b * side.shotsPerMatch) }));
  return AXES.map((axis) => {
    const known = scored.filter((side) => axis.value(side) != null);
    if (known.length < MIN_SIDES) return { id: axis.id, gap: 0 };
    const grouped = split(known, (side) => axis.value(side) ?? 0);
    if (grouped.high.length === 0 || grouped.low.length === 0) return { id: axis.id, gap: 0 };
    return { id: axis.id, gap: mean(grouped.high.map((side) => side.edge)) - mean(grouped.low.map((side) => side.edge)) };
  });
}

export function readMatchups(sides: MatchupSide[], prefer: string | null = null): MatchupRead {
  if (sides.length === 0) return { strength: null, weakness: null, comparison: null, harder: [], easier: [] };
  const { a, b } = fit(sides.map((side) => side.shotsPerMatch), sides.map((side) => side.modelXgFor - side.modelXgAgainst));
  const scored = sides.map((side) => ({ ...side, edge: side.modelXgFor - side.modelXgAgainst - (a + b * side.shotsPerMatch) }));
  const pattern = bestAxis(scored, prefer);
  if (!pattern) {
    const ordered = [...scored].sort((left, right) => left.edge - right.edge || left.team.localeCompare(right.team));
    return {
      strength: null,
      weakness: null,
      comparison: "No opponent style separates this run. These are the results furthest from the shot count.",
      harder: ordered.slice(0, SHOW).map((side) => note(side, "No shared style")),
      easier: ordered.slice(-SHOW).reverse().map((side) => note(side, "No shared style")),
    };
  }
  const grouped = split(scored.filter((side) => pattern.axis.value(side) != null), (side) => pattern.axis.value(side) ?? 0);
  const costlyIsHigh = pattern.gap < 0;
  const costly = costlyIsHigh ? grouped.high : grouped.low;
  const easierGroup = costlyIsHigh ? grouped.low : grouped.high;
  const costlyName = costlyIsHigh ? pattern.axis.high : pattern.axis.low;
  const easierName = costlyIsHigh ? pattern.axis.low : pattern.axis.high;
  const gap = Math.abs(pattern.gap);
  const value = (side: Scored) => pattern.axis.value(side) ?? 0;
  return {
    weakness: `${costlyName} cost more than their shot count.`,
    strength: `${easierName} cost less than their shot count.`,
    comparison: `${costlyName} cost ${gap.toFixed(2)} more than ${lowerFirst(easierName)}, after shot count.`,
    harder: examples(costly, value, costlyIsHigh, "worse").map((side) => note(side, costlyName)),
    easier: examples(easierGroup, value, !costlyIsHigh, "better").map((side) => note(side, easierName)),
  };
}

/** The clearer half of one end, then the results that match it. */
function examples(group: Scored[], value: (side: Scored) => number, highEnd: boolean, way: "worse" | "better"): Scored[] {
  const sorted = [...group].sort((left, right) => value(left) - value(right) || left.team.localeCompare(right.team));
  const keep = Math.max(SHOW, Math.ceil(sorted.length / 2));
  const extreme = highEnd ? sorted.slice(-keep) : sorted.slice(0, keep);
  const byResult = [...extreme].sort((left, right) => left.edge - right.edge || left.team.localeCompare(right.team));
  return way === "worse" ? byResult.slice(0, SHOW) : byResult.slice(-SHOW).reverse();
}

function lowerFirst(value: string): string {
  return value.length === 0 ? value : value[0].toLowerCase() + value.slice(1);
}

function bestAxis(sides: Scored[], prefer: string | null): { axis: Axis; gap: number } | null {
  const cleared: { axis: Axis; gap: number }[] = [];
  for (const axis of AXES) {
    const known = sides.filter((side) => axis.value(side) != null);
    if (known.length < MIN_SIDES) continue;
    const values = known.map((side) => axis.value(side) ?? 0);
    if (Math.max(...values) - Math.min(...values) < 1e-6) continue;
    const grouped = split(known, (side) => axis.value(side) ?? 0);
    if (grouped.high.length === 0 || grouped.low.length === 0) continue;
    const gap = mean(grouped.high.map((side) => side.edge)) - mean(grouped.low.map((side) => side.edge));
    if (Math.abs(gap) < GAP) continue;
    cleared.push({ axis, gap });
  }
  const chosen = prefer ? cleared.find((item) => item.axis.id === prefer) : undefined;
  if (chosen) return chosen;
  return cleared.sort((a, b) => Math.abs(b.gap) - Math.abs(a.gap))[0] ?? null;
}

/** Drop a residual side that actually concedes more than this tactic. */
export function concedingLess(sides: SideNote[], meanAgainst: number): SideNote[] {
  return sides.filter((side) => side.modelXgAgainst < meanAgainst);
}

function note(side: Scored, trait: string): SideNote {
  const gap = Math.abs(side.edge);
  const way = side.edge < 0 ? "worse" : "better";
  return {
    id: side.id,
    team: side.team,
    season: side.season,
    competition: side.competition,
    modelXgFor: side.modelXgFor,
    modelXgAgainst: side.modelXgAgainst,
    note: `${trait}. ${gap.toFixed(2)} ${way} than their shot count.`,
  };
}

function shotSplit(grid: number[][] | undefined): number | null {
  if (!grid) return null;
  let central = 0;
  let wide = 0;
  let total = 0;
  for (let row = 0; row < grid.length; row += 1) {
    for (let col = 0; col < grid[row].length; col += 1) {
      const count = grid[row][col];
      total += count;
      if (col < 4) continue;
      if (row === 0 || row === grid.length - 1) wide += count;
      else central += count;
    }
  }
  return total === 0 ? null : (central - wide) / total;
}

function directness(longPassShare: number | undefined, fieldTilt: number | undefined): number | null {
  if (longPassShare == null || fieldTilt == null) return null;
  return (longPassShare - 0.14) / 0.06 + (0.55 - fieldTilt) / 0.2;
}

function split<T>(items: T[], value: (item: T) => number): { high: T[]; low: T[] } {
  const sorted = [...items].sort((left, right) => value(left) - value(right));
  const cut = Math.max(1, Math.floor(sorted.length / 4));
  return { low: sorted.slice(0, cut), high: sorted.slice(-cut) };
}

function fit(xs: number[], ys: number[]): { a: number; b: number } {
  const n = xs.length;
  if (n === 0) return { a: 0, b: 0 };
  const mx = mean(xs);
  const my = mean(ys);
  let num = 0;
  let den = 0;
  for (let i = 0; i < n; i += 1) {
    num += (xs[i] - mx) * (ys[i] - my);
    den += (xs[i] - mx) ** 2;
  }
  const b = den === 0 ? 0 : num / den;
  return { a: my - b * mx, b };
}

function mean(values: number[]): number {
  if (values.length === 0) return 0;
  return values.reduce((sum, value) => sum + value, 0) / values.length;
}
