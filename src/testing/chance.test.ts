import { describe, expect, it } from "vitest";
import { createBoard } from "../tactics/board";
import { DEFAULT_INSTRUCTIONS } from "../tactics/instructions";
import { labelSquad } from "../tactics/positions";
import { loadStyleLibrary } from "../data/style-library";
import { playersFromBoard, type ProfilePlayer } from "./profile";
import { priceChances } from "./chance";
import { runCampaign } from "./campaign";
import type { StyleFingerprint } from "./types";

function playersOf(board = createBoard()): ProfilePlayer[] {
  return playersFromBoard(board.players, labelSquad(board.players), {});
}

function opponent(patch: Partial<StyleFingerprint> & { shotGrid?: number[][] } = {}): StyleFingerprint & { shotGrid?: number[][] } {
  return {
    id: "side",
    team: "Side",
    season: "2015/2016",
    passLength: 19,
    xgPerShot: 0.99,
    shotsPerMatch: 14,
    ppda: 10,
    pressHeight: 40,
    ...patch,
  };
}

const wideGrid = [
  [8, 0, 0, 0, 20, 20],
  [0, 0, 0, 0, 0, 0],
  [0, 0, 0, 0, 0, 0],
  [8, 0, 0, 0, 20, 20],
];

const centralGrid = [
  [0, 0, 0, 0, 0, 0],
  [0, 0, 0, 0, 8, 20],
  [0, 0, 0, 0, 8, 20],
  [0, 0, 0, 0, 0, 0],
];

function price(patch: Partial<Parameters<typeof priceChances>[0]> = {}) {
  return priceChances({
    players: playersOf(),
    instructions: DEFAULT_INSTRUCTIONS,
    opponent: opponent(),
    situation: "level",
    passLength: 19,
    passRisk: 0.4,
    pressHeight: 40,
    shotsPerMatch: 12,
    restDefence: 4,
    ...patch,
  });
}

describe("priceChances", () => {
  it("prices the recorded map with the geometric ruler, not the recorded xG per shot", () => {
    const result = price({ opponent: opponent({ xgPerShot: 0.99, shotGrid: centralGrid, shotsPerMatch: 10 }) });
    expect(result.modelXgAgainst).not.toBeCloseTo(0.99 * 10, 1);
    expect(result.modelXgAgainst).toBeGreaterThan(0);
    expect(result.modelXgFor).toBeGreaterThan(0);
  });

  it("marks wide shots up when the full-backs tuck in, and leaves a central map unchanged", () => {
    const board = createBoard();
    const narrow = playersOf({
      ...board,
      players: board.players.map((player) => {
        if (player.id === "p2") return { ...player, x: 40 };
        if (player.id === "p5") return { ...player, x: 60 };
        return player;
      }),
    });
    const wide = playersOf({
      ...board,
      players: board.players.map((player) => {
        if (player.id === "p2") return { ...player, x: 8 };
        if (player.id === "p5") return { ...player, x: 92 };
        return player;
      }),
    });
    const narrowWide = price({ players: narrow, opponent: opponent({ shotGrid: wideGrid }) }).modelXgAgainst;
    const coveredWide = price({ players: wide, opponent: opponent({ shotGrid: wideGrid }) }).modelXgAgainst;
    const narrowCentral = price({ players: narrow, opponent: opponent({ shotGrid: centralGrid }) }).modelXgAgainst;
    const coveredCentral = price({ players: wide, opponent: opponent({ shotGrid: centralGrid }) }).modelXgAgainst;
    expect(narrowWide).toBeGreaterThan(coveredWide);
    expect(narrowCentral).toBeCloseTo(coveredCentral, 8);
  });

  it("concedes more when a high press sits in front of a deep line", () => {
    const leak = price({
      instructions: { ...DEFAULT_INSTRUCTIONS, engagement: "higher", defensiveLine: "deeper" },
    }).modelXgAgainst;
    const compact = price({
      instructions: { ...DEFAULT_INSTRUCTIONS, engagement: "higher", defensiveLine: "higher" },
    }).modelXgAgainst;
    expect(leak).toBeGreaterThan(compact);
  });

  it("moves the shot cloud when the passes get longer and riskier", () => {
    const short = price({ passLength: 11, passRisk: 0.25, instructions: { ...DEFAULT_INSTRUCTIONS, passing: "shorter" } });
    const direct = price({ passLength: 29, passRisk: 0.62, instructions: { ...DEFAULT_INSTRUCTIONS, passing: "more direct" } });
    expect(direct.meanShotY).toBeGreaterThan(short.meanShotY + 5);
    expect(direct.modelXgFor).not.toBeCloseTo(short.modelXgFor, 2);
  });

  it("holds a lead in a compact block and leaks when the same press leaves a gap", () => {
    const compact = price({
      situation: "protect-lead",
      instructions: { ...DEFAULT_INSTRUCTIONS, engagement: "higher", defensiveLine: "higher" },
    }).modelXgAgainst;
    const leak = price({
      situation: "protect-lead",
      instructions: { ...DEFAULT_INSTRUCTIONS, engagement: "higher", defensiveLine: "deeper" },
    }).modelXgAgainst;
    expect(leak).toBeGreaterThan(compact);
  });

  it("makes playing out from a goal kick suffer against a high press", () => {
    const presser = opponent({ pressHeight: 70, ppda: 6 });
    const playOut = price({
      situation: "goal-kicks",
      opponent: presser,
      passLength: 15,
      passRisk: 0.3,
      instructions: { ...DEFAULT_INSTRUCTIONS, distribution: "play out" },
    }).modelXgFor;
    const goLong = price({
      situation: "goal-kicks",
      opponent: presser,
      passLength: 25,
      passRisk: 0.5,
      instructions: { ...DEFAULT_INSTRUCTIONS, distribution: "go long" },
    }).modelXgFor;
    expect(goLong).toBeGreaterThan(playOut);
  });

  it("gives a side that already shoots more a larger reward for chasing", () => {
    const quiet = price({ shotsPerMatch: 9, situation: "chase" }).modelXgFor / price({ shotsPerMatch: 9 }).modelXgFor;
    const busy = price({ shotsPerMatch: 16, situation: "chase" }).modelXgFor / price({ shotsPerMatch: 16 }).modelXgFor;
    expect(busy).toBeGreaterThan(quiet);
  });

  it("bends a stocked rest defence less than a thin one when a player is missing", () => {
    const stocked = price({ restDefence: 5, situation: "you-have-ten" }).modelXgAgainst;
    const thin = price({ restDefence: 3, situation: "you-have-ten" }).modelXgAgainst;
    expect(thin).toBeGreaterThan(stocked);
  });
});

describe("the grade after the shot maps", () => {
  const styles = loadStyleLibrary().sides;

  it("separates a flat side, a sharper one, and a blunt one, and repeats", () => {
    const board = createBoard();
    const players = playersOf(board);
    const flat = runCampaign({
      players,
      instructions: DEFAULT_INSTRUCTIONS,
      opponents: styles,
      label: "flat",
      tacticKey: "flat",
      seed: 1,
      now: 1,
    });
    const again = runCampaign({
      players,
      instructions: DEFAULT_INSTRUCTIONS,
      opponents: styles,
      label: "flat",
      tacticKey: "flat",
      seed: 1,
      now: 2,
    });
    const sharper = runCampaign({
      players,
      instructions: { ...DEFAULT_INSTRUCTIONS, tempo: "higher", shooting: "shoot on sight" },
      opponents: styles,
      label: "sharp",
      tacticKey: "sharp",
      seed: 1,
      now: 3,
    });
    const blunt = createBoard();
    blunt.players = blunt.players.map((player) => (player.y > 20 ? { ...player, y: 30 } : player));
    const deeper = runCampaign({
      players: playersOf(blunt),
      instructions: { ...DEFAULT_INSTRUCTIONS, tempo: "lower", shooting: "work the ball" },
      opponents: styles,
      label: "deep",
      tacticKey: "deep",
      seed: 1,
      now: 4,
    });
    expect(again.place).toBe(flat.place);
    expect(again.meanFor).toBe(flat.meanFor);
    expect(sharper.place).toBeLessThan(flat.place);
    expect(deeper.place).toBeGreaterThan(flat.place);
    expect(flat.place).toBeGreaterThan(4);
    expect(flat.place).toBeLessThan(16);
    const text = [...flat.strengths, ...flat.weaknesses].join(" ");
    expect(text).not.toMatch(/score|very close/i);
  });
});
