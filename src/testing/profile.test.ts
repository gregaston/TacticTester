import { describe, expect, it } from "vitest";
import { loadStyleLibrary } from "../data/style-library";
import { createBoard, movePlayer } from "../tactics/board";
import { DEFAULT_INSTRUCTIONS, type TeamInstructions } from "../tactics/instructions";
import { labelSquad } from "../tactics/positions";
import type { Duty } from "../tactics/roles";
import { playersFromBoard, readStyle, shotMapCells, type Assignment } from "./profile";
import type { StyleFingerprint } from "./types";

const library = loadStyleLibrary();

function reading(instructions: TeamInstructions = DEFAULT_INSTRUCTIONS, setups: Record<string, Assignment> = {}) {
  const board = createBoard();
  const labels = labelSquad(board.players);
  return readStyle(playersFromBoard(board.players, labels, setups), instructions, library.sides);
}

function text(instructions?: TeamInstructions, setups?: Record<string, Assignment>) {
  return reading(instructions, setups).lines.join(" ");
}

describe("shotMapCells", () => {
  it("puts the attacking column on the top row", () => {
    const grid = [
      [0, 0, 0, 0, 0, 3],
      [0, 0, 0, 0, 0, 1],
      [0, 0, 0, 0, 0, 0],
      [0, 0, 0, 0, 0, 4],
    ];
    expect(shotMapCells(grid).slice(0, 4)).toEqual([3, 1, 0, 4]);
  });
});

describe("readStyle", () => {
  it("reads a flat 4-4-2 inside the recorded spread", () => {
    const result = reading();
    const passes = library.sides.map((side) => side.passLength).sort((a, b) => a - b);
    const presses = library.sides.map((side) => side.pressHeight).sort((a, b) => a - b);
    const shots = library.sides.map((side) => side.shotsPerMatch).sort((a, b) => a - b);
    const mid = (values: number[]) => Math.round(values[(values.length - 1) / 2] * 10) / 10;
    expect(result.profile.passLength).toBe(mid(passes));
    expect(result.profile.pressHeight).toBe(mid(presses));
    expect(result.profile.shotsPerMatch).toBe(mid(shots));
    expect(result.nearestId).toBeTruthy();
    expect(result.lines.length).toBeGreaterThanOrEqual(2);
    expect(result.lines.length).toBeLessThanOrEqual(4);
    expect(result.lines[0]).toMatch(/inside the box|edge of the area/);
    expect(result.lines[0]).toMatch(/central/);
    expect(text()).not.toMatch(/very close/i);
    expect(text()).not.toMatch(/score/i);
    expect(text().match(/passes the opponent completes before a defensive action/g)).toHaveLength(1);
  });

  it("lands more direct passing on the longest side without rewriting the press", () => {
    const standard = reading();
    const result = reading({ ...DEFAULT_INSTRUCTIONS, passing: "more direct" });
    const longest = Math.max(...library.sides.map((side) => side.passLength));
    expect(result.profile.passLength).toBeCloseTo(longest, 0);
    expect(result.lines[1]).not.toMatch(/longer than .+ the most direct side in this set/);
    expect(result.lines[2]).toBe(standard.lines[2]);
    expect(result.lines.join(" ")).not.toMatch(/very close/i);
  });

  it("lands shorter passing on the shortest side in the set", () => {
    const result = reading({ ...DEFAULT_INSTRUCTIONS, passing: "shorter" });
    const shortest = Math.min(...library.sides.map((side) => side.passLength));
    expect(result.profile.passLength).toBeCloseTo(shortest, 0);
    expect(result.lines[1]).not.toMatch(/shorter than .+ the shortest-passing side in this set/);
  });

  it("steps just past the set when go long is added to more direct", () => {
    const result = reading({ ...DEFAULT_INSTRUCTIONS, passing: "more direct", distribution: "go long" });
    const longest = Math.max(...library.sides.map((side) => side.passLength));
    expect(result.profile.passLength).toBeGreaterThan(longest);
    expect(result.profile.passLength).toBeLessThan(longest + 3);
    expect(result.lines[1]).toMatch(/longer than .+ the most direct side in this set/);
  });

  it("lands the named high press on the highest side", () => {
    const result = reading({
      ...DEFAULT_INSTRUCTIONS,
      defensiveLine: "higher",
      engagement: "higher",
      pressing: "more",
    });
    const highest = Math.max(...library.sides.map((side) => side.pressHeight));
    expect(result.profile.pressHeight).toBeCloseTo(highest, 0);
    expect(result.lines.join(" ")).not.toMatch(/higher than .+ the highest side in this set/);
  });

  it("lands the named deep block on the deepest side", () => {
    const result = reading({
      ...DEFAULT_INSTRUCTIONS,
      defensiveLine: "deeper",
      engagement: "lower",
      pressing: "less",
    });
    const deepest = Math.min(...library.sides.map((side) => side.pressHeight));
    expect(result.profile.pressHeight).toBeCloseTo(deepest, 0);
    expect(result.lines.join(" ")).not.toMatch(/deeper than .+ the deepest side in this set/);
  });

  it("moves poachers onto the goal and a deep forward away from it", () => {
    const board = createBoard();
    const labels = labelSquad(board.players);
    const strikers = board.players.filter((player) => labels.byId[player.id].line === "ST");
    const duty = (roleId: string, next: Duty): Record<string, Assignment> =>
      Object.fromEntries(strikers.map((player) => [player.id, { roleId, duty: next }]));
    const poach = readStyle(
      playersFromBoard(board.players, labels, duty("poacher", "attack")),
      DEFAULT_INSTRUCTIONS,
      library.sides,
    );
    const hold = readStyle(
      playersFromBoard(board.players, labels, duty("deep-lying-forward", "defend")),
      DEFAULT_INSTRUCTIONS,
      library.sides,
    );
    expect(poach.profile.shotY).toBeGreaterThan(hold.profile.shotY);
    expect(poach.lines[0]).toMatch(/inside the six-yard box/);
    expect(hold.lines[0]).not.toMatch(/six-yard/);
    expect(poach.profile.shotsPerMatch).toBeGreaterThan(hold.profile.shotsPerMatch);
  });

  it("lengthens the pass when the centre-backs become ball-playing defenders", () => {
    const board = createBoard();
    const labels = labelSquad(board.players);
    const centres = board.players.filter((player) => labels.byId[player.id].code === "DC");
    const setups = Object.fromEntries(
      centres.map((player) => [player.id, { roleId: "ball-playing-defender", duty: "support" as const }]),
    );
    const plain = reading();
    const builders = reading(DEFAULT_INSTRUCTIONS, setups);
    expect(builders.profile.passLength).toBeGreaterThan(plain.profile.passLength + 1);
    expect(builders.profile.pressHeight).toBeCloseTo(plain.profile.pressHeight, 0);
  });

  it("breaks an equal distance by team name and still describes the shot", () => {
    const side = (team: string): StyleFingerprint => ({
      id: team,
      team,
      season: "2015/2016",
      passLength: 19,
      xgPerShot: 0.1,
      shotsPerMatch: 12,
      ppda: 8,
      pressHeight: 40,
    });
    const board = createBoard();
    const result = readStyle(playersFromBoard(board.players, labelSquad(board.players), {}), DEFAULT_INSTRUCTIONS, [
      side("Wolves"),
      side("Arsenal"),
    ]);
    expect(result.nearestId).toBe("Arsenal");
    expect(result.lines[0]).toMatch(/^In a sample of possessions/);
    expect(result.lines.join(" ")).not.toMatch(/score/i);
  });

  it("keeps a role when a full-back lands on the wide defensive-midfield line", () => {
    const board = movePlayer(createBoard(), "p2", { x: 14, y: 40 });
    const labels = labelSquad(board.players);
    expect(labels.byId.p2).toMatchObject({ line: "DM", code: "WBL" });
    const players = playersFromBoard(board.players, labels, {});
    expect(players.find((player) => player.line === "DM" && player.wide)?.roleId).toBe("full-back");
    expect(() => readStyle(players, DEFAULT_INSTRUCTIONS, library.sides)).not.toThrow();
  });

  it("resolves a role for every channel and line, including gaps between the grid", () => {
    const board = createBoard();
    const spots = [
      ...[14, 32, 50, 68, 86].flatMap((x) => [8, 24, 40, 54, 69, 86].map((y) => ({ x, y }))),
      { x: 8, y: 33 },
      { x: 92, y: 46 },
    ];
    for (const spot of spots) {
      const next = movePlayer(board, "p2", spot);
      const labels = labelSquad(next.players);
      expect(() => playersFromBoard(next.players, labels, {})).not.toThrow();
    }
  });

  it("still describes the shot when no seasons are loaded", () => {
    const board = createBoard();
    const result = readStyle(
      playersFromBoard(board.players, labelSquad(board.players), {}),
      DEFAULT_INSTRUCTIONS,
      [],
    );
    expect(result.nearestId).toBeNull();
    expect(result.lines).toHaveLength(2);
    expect(result.lines[0]).toMatch(/shots are coming from/);
    expect(result.lines.join(" ")).not.toMatch(/passes the opponent completes/);
  });
});
