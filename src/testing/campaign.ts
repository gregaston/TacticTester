import { placeLabel } from "../compare/format";
import type { TeamInstructions } from "../tactics/instructions";
import type { TestOpponent } from "./battery";
import { SITUATIONS } from "./corners";
import { liveSample, restDefenceCount } from "./live";
import { defensiveAnchor, engagementAnchor, shiftedPoint } from "../tactics/block";
import { concedingLess, readMatchups, type MatchupRead, type SideNote } from "./matchups";
import {
  instructionImpacts,
  passingStackNote,
  pressStackNote,
  recordedSpread,
  refusalLine,
  readStyle,
  type ProfilePlayer,
  type StyleProfile,
  type StyleSpread,
} from "./profile";
import { problemMarks, type ReportDot, type ReportMark } from "./report";
import type { Situation } from "./sample";

/**
 * One test of the tactic against every side, in every situation.
 *
 * The table grade maps the model's xG margin onto 1st–20th. The ends of the
 * ruler are this sketch's own range once shots come from the role cloud and
 * the recorded maps: a flat 4-4-2 sits near the middle, and there is room
 * either way. It is not a predicted league finish, and it is not a scoreline.
 */

const FLOOR_MARGIN = -1.53;
const CEILING_MARGIN = 0.83;

const NARROW_WIDTH = 28;
const OPEN_REST = 3;
const PRESS_GAP = 8;

export type CampaignOpponent = TestOpponent & {
  shotGrid?: number[][];
  longPassShare?: number;
  fieldTilt?: number;
  shapeWidth?: number;
  crossesPerMatch?: number;
  crossShotShare?: number;
  regainShotsPerMatch?: number;
  keeperPassLength?: number;
  progressivePerMatch?: number;
};

export type { SideNote } from "./matchups";

export type CampaignRun = {
  id: string;
  createdAt: number;
  label: string;
  tacticKey: string;
  place: number;
  meanFor: number;
  meanAgainst: number;
  tested: number;
  situations: number;
  strengths: string[];
  weaknesses: string[];
  comparison: string | null;
  /** Recorded xG per shot beside the model's price. Absent when the two agree, and never an input to the grade. */
  chanceNote?: string | null;
  /** The shape that was tested, after the line shift, so the report can draw it. */
  shape?: ReportDot[];
  /** Problem areas named by this run. Empty when none of them sit on the pitch. */
  marks?: ReportMark[];
  /** What the buttons moved, with a stack note first when one is on. */
  impacts?: string[];
  /** Pass, shots, and press beside the set. */
  styleLine?: string;
  /** How a mid-table grade would leave the band. Null outside 11th–14th. */
  band?: string | null;
  /** Stored roles that do not play in the seat. At most two. */
  refusals?: string[];
  closestTeam?: string;
  closestStyle?: number;
  closestShape?: number;
  closestWeak?: boolean;
  closerStyleTeam?: string;
  closerStylePercent?: number;
  worst: SideNote[];
  best: SideNote[];
};

export type CampaignClosest = {
  team: string;
  stylePercent: number;
  shapePercent: number;
  weak: boolean;
  closerStyle: { team: string; stylePercent: number } | null;
};

type Row = {
  opponent: CampaignOpponent;
  modelXgFor: number;
  modelXgAgainst: number;
};

export function gradePlace(meanFor: number, meanAgainst: number): number {
  const margin = meanFor - meanAgainst;
  const span = CEILING_MARGIN - FLOOR_MARGIN;
  const t = span <= 0 ? 0 : clamp((margin - FLOOR_MARGIN) / span, 0, 1);
  return clamp(Math.round(1 + (1 - t) * 19), 1, 20);
}

export function gradeMove(place: number, previous: number | null): string {
  if (previous == null) return "First test.";
  const delta = previous - place;
  if (delta === 0) return "Same grade as the test before it.";
  const places = Math.abs(delta) === 1 ? "place" : "places";
  const way = delta > 0 ? "higher" : "lower";
  return `${Math.abs(delta)} ${places} ${way} than the test before it.`;
}

export function runCampaign(input: {
  players: ProfilePlayer[];
  instructions: TeamInstructions;
  opponents: CampaignOpponent[];
  label: string;
  tacticKey: string;
  seed?: number;
  now?: number;
  closest?: CampaignClosest | null;
}): CampaignRun {
  const seed = input.seed ?? 1;
  const situations = SITUATIONS.map((item) => item.id);
  const profile = readStyle(input.players, input.instructions, input.opponents).profile;
  const spread = recordedSpread(input.opponents);
  const rest = restDefenceCount(input.players);
  const rows = input.opponents.map((opponent) => averageRow(input.players, input.instructions, opponent, input.opponents, situations, seed));
  const meanFor = mean(rows.map((row) => row.modelXgFor));
  const meanAgainst = mean(rows.map((row) => row.modelXgAgainst));
  const pattern = readMatchups(
    rows.map((row) => ({
      id: row.opponent.id,
      team: row.opponent.team,
      season: row.opponent.season,
      competition: row.opponent.competition,
      shotsPerMatch: row.opponent.shotsPerMatch,
      modelXgFor: row.modelXgFor,
      modelXgAgainst: row.modelXgAgainst,
      shotGrid: row.opponent.shotGrid,
      pressHeight: row.opponent.pressHeight,
      longPassShare: row.opponent.longPassShare,
      fieldTilt: row.opponent.fieldTilt,
      shapeWidth: row.opponent.shapeWidth,
      crossesPerMatch: row.opponent.crossesPerMatch,
      crossShotShare: row.opponent.crossShotShare,
      regainShotsPerMatch: row.opponent.regainShotsPerMatch,
      progressivePerMatch: row.opponent.progressivePerMatch,
    })),
    preferredAxis(input.instructions),
  );
  const notes = findings(
    input.players,
    input.instructions,
    rows,
    profile.pressHeight,
    profile.passLength,
    profile.shotsPerMatch,
    rest,
    pattern,
    meanFor,
    meanAgainst,
  );
  const place = rows.length === 0 ? 20 : gradePlace(meanFor, meanAgainst);
  const impacts: string[] = [];
  const passStack = passingStackNote(input.instructions);
  if (passStack) impacts.push(passStack);
  const highPress = pressStackNote(input.players, input.instructions, input.opponents);
  if (highPress) impacts.push(highPress);
  impacts.push(...instructionImpacts(input.players, input.instructions, input.opponents));
  const closest = input.closest;

  return {
    id: `run-${input.now ?? Date.now()}`,
    createdAt: input.now ?? Date.now(),
    label: input.label,
    tacticKey: input.tacticKey,
    place,
    meanFor,
    meanAgainst,
    tested: rows.length,
    situations: situations.length,
    strengths: notes.strengths,
    weaknesses: notes.weaknesses,
    comparison: pattern.comparison,
    chanceNote: recordedChanceNote(rows),
    shape: testedShape(input.players, input.instructions),
    marks: problemMarks(input.instructions, notes.weaknesses),
    impacts,
    styleLine: formatStyleLine(profile, spread),
    band: gradeBand(place, input.instructions),
    refusals: refusalLines(input.players),
    ...(closest
      ? {
          closestTeam: closest.team,
          closestStyle: closest.stylePercent,
          closestShape: closest.shapePercent,
          closestWeak: closest.weak,
          ...(closest.closerStyle
            ? { closerStyleTeam: closest.closerStyle.team, closerStylePercent: closest.closerStyle.stylePercent }
            : {}),
        }
      : {}),
    worst: pattern.harder,
    best: concedingLess(pattern.easier, meanAgainst),
  };
}

function testedShape(players: ProfilePlayer[], instructions: TeamInstructions): ReportDot[] {
  const defensiveY = defensiveAnchor(instructions.defensiveLine);
  const engagementY = engagementAnchor(instructions.engagement);
  return players.map((player) => {
    const point = shiftedPoint({ x: player.x, y: player.y }, player.line, defensiveY, engagementY);
    return { x: Math.round(point.x * 10) / 10, y: Math.round(point.y * 10) / 10 };
  });
}

export function preferredAxis(instructions: TeamInstructions): string | null {
  if (instructions.defensiveLine === "higher" && instructions.engagement !== "lower") return "direct";
  if (instructions.transition === "counter-press") return "regain";
  if (instructions.transition === "regroup") return "regain";
  if (instructions.width === "wider" || instructions.widthIntention === "overlap") return "crosses";
  return null;
}

/** The model's xG against per opponent shot, beside the recorded figure. The grade does not read this. */
function recordedChanceNote(rows: Row[]): string | null {
  if (rows.length === 0) return null;
  const recorded = mean(rows.map((row) => row.opponent.xgPerShot));
  const priced = mean(
    rows.map((row) => (row.opponent.shotsPerMatch > 0 ? row.modelXgAgainst / row.opponent.shotsPerMatch : 0)),
  );
  if (Math.abs(recorded - priced) < 0.02) return null;
  return `Recorded chances average ${recorded.toFixed(2)} xG a shot. TacticTester prices those maps at ${priced.toFixed(2)} a shot.`;
}

function averageRow(
  players: ProfilePlayer[],
  instructions: TeamInstructions,
  opponent: CampaignOpponent,
  styles: CampaignOpponent[],
  situations: Situation[],
  seed: number,
): Row {
  let modelXgFor = 0;
  let modelXgAgainst = 0;
  for (const situation of situations) {
    const match = liveSample({ players, instructions, opponent, situation, styles, seed });
    modelXgFor += match.report.modelXgFor;
    modelXgAgainst += match.report.modelXgAgainst;
  }
  return {
    opponent,
    modelXgFor: modelXgFor / situations.length,
    modelXgAgainst: modelXgAgainst / situations.length,
  };
}

function findings(
  players: ProfilePlayer[],
  instructions: TeamInstructions,
  rows: Row[],
  pressHeight: number,
  passLength: number,
  shotsPerMatch: number,
  rest: number,
  pattern: MatchupRead,
  meanFor: number,
  meanAgainst: number,
): { strengths: string[]; weaknesses: string[] } {
  const strengths: string[] = [];
  const weaknesses: string[] = [];
  if (rows.length === 0) return { strengths, weaknesses };

  const shotCounts = rows.map((row) => row.opponent.shotsPerMatch);
  const lowShots = shotsPerMatch <= quartile(shotCounts, 0.25);
  const highShots = shotsPerMatch >= quartile(shotCounts, 0.75);
  const emptyRest = instructions.defensiveLine === "higher" && instructions.engagement === "lower";
  const deepBlock = instructions.defensiveLine === "deeper";
  const againstStory = emptyRest || meanAgainst >= meanFor + 0.8;

  if (emptyRest) {
    weaknesses.push("Raise the engagement. The defence is high and the press is passive, so balls over the top are easier.");
  }
  if (instructions.engagement === "higher" && instructions.defensiveLine === "deeper") {
    weaknesses.push("The press steps up and the defence sits, so the gap shows in xG against.");
  }
  if (rest < OPEN_REST) {
    weaknesses.push("Fewer than three stay behind the ball, so xG against is up.");
  }
  const longestRow = rows.reduce((best, row) => (row.opponent.passLength > best.opponent.passLength ? row : best));
  if (passLength > longestRow.opponent.passLength + 0.4) {
    const yards = formatTenths(passLength - longestRow.opponent.passLength);
    const tap = instructions.passing === "more direct" ? "Ease More direct." : "Shorten the pass.";
    weaknesses.push(`${tap} Passes are ${yards} yards past ${longestRow.opponent.team}.`);
  }
  if (deepBlock && lowShots) {
    weaknesses.push(
      `Raise the line. The shot count is low, and the deeper block leaves xG against at ${meanAgainst.toFixed(2)}.`,
    );
  }

  if (pattern.strength) strengths.push(pattern.strength);
  if (pattern.weakness) weaknesses.push(withTap(pattern.weakness, instructions));

  const ahead = rows.filter((row) => row.modelXgFor > row.modelXgAgainst).length;
  if (ahead === rows.length) {
    strengths.push("Ahead against every side.");
  } else if (ahead > 0) {
    strengths.push(`Ahead against ${ahead} of ${rows.length} sides.`);
  }

  if (highShots && !againstStory) {
    strengths.push("The shot count is among the higher ones in this set.");
  }
  if (lowShots && !deepBlock) {
    const fact = "The shot count is low.";
    if (instructions.tempo === "standard") weaknesses.push(`Raise the tempo. ${fact}`);
    else if (instructions.shooting === "standard") weaknesses.push(`Shoot on sight. ${fact}`);
    else weaknesses.push(fact);
  }

  const presses = rows.map((row) => row.opponent.pressHeight);
  if (passLength <= 17 && pressHeight + PRESS_GAP <= quartile(presses, 0.5)) {
    weaknesses.push("Ease Shorter passing. Short passes run into the higher presses.");
  }
  if (pressHeight >= quartile(presses, 0.5) + PRESS_GAP && rest < 4) {
    const fact = "The press is higher than most sides here and leaves space behind the ball.";
    const tap =
      instructions.engagement === "higher"
        ? "Drop the engagement."
        : instructions.pressing === "more"
          ? "Ease Pressing more."
          : instructions.defensiveLine === "higher"
            ? "Drop the line."
            : null;
    weaknesses.push(tap ? `${tap} ${fact}` : fact);
  }

  const widest = widestDefender(players);
  if (widest != null && widest < NARROW_WIDTH) {
    const wide = wideTrouble(rows);
    weaknesses.push(
      wide
        ? "Widen the full-backs. The full-backs sit inside, and the sides that cause the most trouble take more of their shots from wide areas."
        : "Widen the full-backs. The full-backs sit inside a narrow back line.",
    );
  }

  return { strengths: strengths.slice(0, 3), weaknesses: weaknesses.slice(0, 3) };
}

function withTap(sentence: string, instructions: TeamInstructions): string {
  if (/Wide starting shapes cost more than their shot count/.test(sentence)) {
    if (instructions.width === "wider") return `Ease Wider. ${sentence}`;
    if (instructions.widthIntention === "overlap") return `Ease Overlap. ${sentence}`;
  }
  if (/Direct sides who see less of the final third/.test(sentence) && instructions.defensiveLine === "higher") {
    return `Drop the line. ${sentence}`;
  }
  if (/shoot more often from crosses/.test(sentence)) {
    if (instructions.widthIntention === "overlap") return `Ease Overlap. ${sentence}`;
    if (instructions.width === "wider") return `Ease Wider. ${sentence}`;
  }
  return sentence;
}

function formatStyleLine(profile: StyleProfile, spread: StyleSpread): string {
  return `Pass ${formatTenths(profile.passLength)} yd · set ${formatTenths(spread.passLength.low)}–${formatTenths(spread.passLength.high)}. Shots ${formatTenths(profile.shotsPerMatch)} · set ${formatTenths(spread.shotsPerMatch.low)}–${formatTenths(spread.shotsPerMatch.high)}. Press ${formatTenths(profile.pressHeight)} · set ${formatTenths(spread.pressHeight.low)}–${formatTenths(spread.pressHeight.high)}.`;
}

/** One sentence inside 11th–14th, and only while those six controls are still standard. */
export function gradeBand(place: number, instructions: TeamInstructions): string | null {
  if (place < 11 || place > 14) return null;
  const untouched =
    instructions.passing === "standard" &&
    instructions.shooting === "standard" &&
    instructions.tempo === "standard" &&
    instructions.defensiveLine === "standard" &&
    instructions.engagement === "standard" &&
    instructions.pressing === "standard";
  if (!untouched) return null;
  return `${placeLabel(place)} is the middle. One button stays in this band. A high line with the press left deep drops out.`;
}

function refusalLines(players: ProfilePlayer[]): string[] {
  const lines: string[] = [];
  for (const player of players) {
    if (!player.refusal) continue;
    lines.push(refusalLine(player.refusal));
    if (lines.length === 2) break;
  }
  return lines;
}

function formatTenths(value: number): string {
  const rounded = Math.round(value * 10) / 10;
  return Number.isInteger(rounded) ? String(rounded) : rounded.toFixed(1);
}

function widestDefender(players: ProfilePlayer[]): number | null {
  const block = players.filter((player) => player.line === "DEF" || (player.wide && player.y < 45));
  if (block.length === 0) return null;
  return Math.max(...block.map((player) => Math.abs(player.x - 50)));
}

function wideTrouble(rows: Row[]): boolean {
  const shares = rows.map((row) => wideShotShare(row.opponent.shotGrid));
  if (shares.every((share) => share === 0)) return false;
  const ranked = [...rows].sort((a, b) => b.modelXgAgainst - a.modelXgAgainst);
  const cut = Math.max(1, Math.ceil(ranked.length / 4));
  const trouble = mean(ranked.slice(0, cut).map((row) => wideShotShare(row.opponent.shotGrid)));
  return trouble >= quartile(shares, 0.5) + 0.01;
}

function wideShotShare(grid: number[][] | undefined): number {
  if (!grid) return 0;
  let wide = 0;
  let total = 0;
  for (let row = 0; row < grid.length; row += 1) {
    for (let col = 0; col < grid[row].length; col += 1) {
      const count = grid[row][col];
      total += count;
      if (col >= 4 && (row === 0 || row === grid.length - 1)) wide += count;
    }
  }
  return total === 0 ? 0 : wide / total;
}

function quartile(values: number[], fraction: number): number {
  if (values.length === 0) return 0;
  const sorted = [...values].sort((a, b) => a - b);
  const index = Math.min(sorted.length - 1, Math.floor((sorted.length - 1) * fraction));
  return sorted[index];
}

function mean(values: number[]): number {
  if (values.length === 0) return 0;
  return values.reduce((sum, value) => sum + value, 0) / values.length;
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}
