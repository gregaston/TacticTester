import type { TeamInstructions } from "../tactics/instructions";
import type { TestOpponent } from "./battery";
import { SITUATIONS } from "./corners";
import { liveSample, restDefenceCount } from "./live";
import { concedingLess, readMatchups, type MatchupRead, type SideNote } from "./matchups";
import { readStyle, type ProfilePlayer } from "./profile";
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
const EDGE_GAP = 0.05;

const SITUATION_NAME: Record<Situation, string> = {
  level: "the game is level",
  "protect-lead": "protecting a lead",
  chase: "chasing the game",
  "they-have-ten": "the opponent has ten",
  "you-have-ten": "playing with ten",
  "goal-kicks": "the ball starts from a goal kick",
  "settled-attack": "the attack is settled",
};

export type CampaignOpponent = TestOpponent & {
  shotGrid?: number[][];
  longPassShare?: number;
  fieldTilt?: number;
  shapeWidth?: number;
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
  worst: SideNote[];
  best: SideNote[];
};

type Row = {
  opponent: CampaignOpponent;
  modelXgFor: number;
  modelXgAgainst: number;
  bySituation: Map<Situation, { modelXgFor: number; modelXgAgainst: number }>;
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
}): CampaignRun {
  const seed = input.seed ?? 1;
  const situations = SITUATIONS.map((item) => item.id);
  const profile = readStyle(input.players, input.instructions, input.opponents).profile;
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
    })),
    preferredAxis(input.instructions),
  );
  const notes = findings(
    input.players,
    input.instructions,
    rows,
    situations,
    profile.pressHeight,
    profile.passLength,
    profile.shotsPerMatch,
    rest,
    pattern,
    meanFor,
    meanAgainst,
  );

  return {
    id: `run-${input.now ?? Date.now()}`,
    createdAt: input.now ?? Date.now(),
    label: input.label,
    tacticKey: input.tacticKey,
    place: rows.length === 0 ? 20 : gradePlace(meanFor, meanAgainst),
    meanFor,
    meanAgainst,
    tested: rows.length,
    situations: situations.length,
    strengths: notes.strengths,
    weaknesses: notes.weaknesses,
    comparison: pattern.comparison,
    worst: pattern.harder,
    best: concedingLess(pattern.easier, meanAgainst),
  };
}

function preferredAxis(instructions: TeamInstructions): string | null {
  if (instructions.defensiveLine === "higher" && instructions.engagement !== "lower") return "direct";
  if (instructions.width === "wider" || instructions.widthIntention === "overlap") return "shape";
  return null;
}

function averageRow(
  players: ProfilePlayer[],
  instructions: TeamInstructions,
  opponent: CampaignOpponent,
  styles: CampaignOpponent[],
  situations: Situation[],
  seed: number,
): Row {
  const bySituation = new Map<Situation, { modelXgFor: number; modelXgAgainst: number }>();
  let modelXgFor = 0;
  let modelXgAgainst = 0;
  for (const situation of situations) {
    const match = liveSample({ players, instructions, opponent, situation, styles, seed });
    modelXgFor += match.report.modelXgFor;
    modelXgAgainst += match.report.modelXgAgainst;
    bySituation.set(situation, { modelXgFor: match.report.modelXgFor, modelXgAgainst: match.report.modelXgAgainst });
  }
  return {
    opponent,
    modelXgFor: modelXgFor / situations.length,
    modelXgAgainst: modelXgAgainst / situations.length,
    bySituation,
  };
}

function findings(
  players: ProfilePlayer[],
  instructions: TeamInstructions,
  rows: Row[],
  situations: Situation[],
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
    weaknesses.push("The defence is high and the press is passive, so balls over the top are easier.");
  }
  if (instructions.engagement === "higher" && instructions.defensiveLine === "deeper") {
    weaknesses.push("The press steps up and the defence sits, so the gap between them shows up in the model's xG against.");
  }
  if (rest < OPEN_REST) {
    weaknesses.push("Fewer than three players stay behind the ball, so the model's xG against is marked up.");
  }
  const passLengths = rows.map((row) => row.opponent.passLength);
  const longest = passLengths.length === 0 ? passLength : Math.max(...passLengths);
  if (passLength > longest + 0.4) {
    weaknesses.push(
      `Passes average ${formatTenths(passLength)} yards, ${formatTenths(passLength - longest)} longer than the most direct side in this set.`,
    );
  }
  if (deepBlock && lowShots) {
    weaknesses.push(
      `The shot count is lower than most sides in this set, and the deeper block leaves xG against at ${meanAgainst.toFixed(2)}.`,
    );
  }

  if (pattern.strength) strengths.push(pattern.strength);
  if (pattern.weakness) weaknesses.push(pattern.weakness);

  const ahead = rows.filter((row) => row.modelXgFor > row.modelXgAgainst).length;
  if (ahead === rows.length) {
    strengths.push("Against every side, the model's xG for stays ahead of the xG against.");
  } else if (ahead > 0) {
    strengths.push(`The model's xG for is ahead against ${ahead} of ${rows.length} sides.`);
  }

  if (highShots && !againstStory) {
    strengths.push("The shot count is among the higher ones in this set.");
  }
  if (lowShots && !deepBlock) {
    weaknesses.push("The shot count is lower than most sides in this set.");
  }

  const presses = rows.map((row) => row.opponent.pressHeight);
  if (passLength <= 17 && pressHeight + PRESS_GAP <= quartile(presses, 0.5)) {
    weaknesses.push("Short passes run into the higher presses in this set, and the model's xG for comes down.");
  }
  if (pressHeight >= quartile(presses, 0.5) + PRESS_GAP && rest < 4) {
    weaknesses.push("The press is higher than most sides here and leaves space behind the ball.");
  }

  const widest = widestDefender(players);
  if (widest != null && widest < NARROW_WIDTH) {
    const wide = wideTrouble(rows);
    weaknesses.push(
      wide
        ? "The full-backs sit inside, and the sides that cause the most trouble take more of their shots from wide areas."
        : "The full-backs sit inside a narrow back line.",
    );
  }

  const levelEdge = situationEdge(rows, "level");
  let worstSituation: Situation | null = null;
  let worstGap = EDGE_GAP;
  let bestSituation: Situation | null = null;
  let bestGap = EDGE_GAP;
  for (const situation of situations) {
    if (situation === "level") continue;
    const gap = situationEdge(rows, situation) - levelEdge;
    if (gap < -worstGap) {
      worstSituation = situation;
      worstGap = -gap;
    }
    if (gap > bestGap) {
      bestSituation = situation;
      bestGap = gap;
    }
  }
  if (bestSituation) strengths.push(`The model's chances are strongest when ${SITUATION_NAME[bestSituation]}.`);
  if (worstSituation) weaknesses.push(`The model's chances drop when ${SITUATION_NAME[worstSituation]}.`);

  return { strengths: strengths.slice(0, 3), weaknesses: weaknesses.slice(0, 3) };
}

function formatTenths(value: number): string {
  const rounded = Math.round(value * 10) / 10;
  return Number.isInteger(rounded) ? String(rounded) : rounded.toFixed(1);
}

function situationEdge(rows: Row[], situation: Situation): number {
  const edges = rows.map((row) => {
    const sample = row.bySituation.get(situation);
    if (!sample) return 0;
    return edge(sample.modelXgFor, sample.modelXgAgainst);
  });
  return mean(edges);
}

function edge(modelXgFor: number, modelXgAgainst: number): number {
  const sum = modelXgFor + modelXgAgainst;
  if (sum <= 0) return 0;
  return (modelXgFor - modelXgAgainst) / sum;
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
