import { describe, expect, it } from "vitest";
import { createBoard } from "../tactics/board";
import { DEFAULT_INSTRUCTIONS } from "../tactics/instructions";
import { labelSquad } from "../tactics/positions";
import { loadStyleLibrary } from "../data/style-library";
import { shapeSummary } from "../compare/format";
import { featuresFromPlayers } from "../compare/features";
import { playersFromBoard, type ProfilePlayer } from "./profile";
import { gradeMove, gradePlace, runCampaign, type CampaignOpponent } from "./campaign";

function opponent(patch: Partial<CampaignOpponent> & Pick<CampaignOpponent, "id" | "team">): CampaignOpponent {
  return {
    season: "2015/2016",
    competition: "Premier League",
    matches: 38,
    passLength: 19,
    xgPerShot: 0.1,
    shotsPerMatch: 12,
    ppda: 10,
    pressHeight: 40,
    ...patch,
  };
}

function playersOf(board = createBoard()): ProfilePlayer[] {
  return playersFromBoard(board.players, labelSquad(board.players), {});
}

describe("gradePlace", () => {
  it("climbs when the model's margin grows, and stays inside 1st to 20th", () => {
    const poor = gradePlace(0.5, 1.4);
    const plain = gradePlace(1.2, 1.5);
    const sharp = gradePlace(1.6, 1.1);
    expect(sharp).toBeLessThan(plain);
    expect(plain).toBeLessThan(poor);
    expect(gradePlace(100, 0)).toBe(1);
    expect(gradePlace(0, 100)).toBe(20);
  });

  it("describes a move against the test before it", () => {
    expect(gradeMove(8, null)).toBe("First test.");
    expect(gradeMove(8, 8)).toBe("Same grade as the test before it.");
    expect(gradeMove(6, 8)).toBe("2 places higher than the test before it.");
    expect(gradeMove(9, 8)).toBe("1 place lower than the test before it.");
  });
});

describe("runCampaign", () => {
  const styles = loadStyleLibrary().sides;

  it("grades the real set without a scoreline, and repeats the same grade", () => {
    const board = createBoard();
    const run = runCampaign({
      players: playersOf(board),
      instructions: DEFAULT_INSTRUCTIONS,
      opponents: styles,
      label: shapeSummary(featuresFromPlayers(board.players)),
      tacticKey: "default",
      seed: 1,
      now: 1,
    });
    const again = runCampaign({
      players: playersOf(board),
      instructions: DEFAULT_INSTRUCTIONS,
      opponents: styles,
      label: "4-4-2",
      tacticKey: "default",
      seed: 1,
      now: 2,
    });
    expect(run.tested).toBe(133);
    expect(run.situations).toBe(7);
    expect(run.place).toBe(again.place);
    expect(run.place).toBe(gradePlace(run.meanFor, run.meanAgainst));
    expect(run.place).toBeGreaterThan(1);
    expect(run.place).toBeLessThan(20);
    expect(run.strengths.length).toBeGreaterThan(0);
    expect(run.worst).toHaveLength(3);
    expect(run.best).toHaveLength(3);
    const text = [...run.strengths, ...run.weaknesses, ...run.worst.map((row) => row.note)].join(" ");
    expect(text).not.toMatch(/score|very close/i);
    expect(run.meanFor).toBeGreaterThan(0);
    expect(run.meanAgainst).toBeGreaterThan(0);
  });

  it("gives a sharper attack a better grade and a blunt one a worse grade", () => {
    const board = createBoard();
    const players = playersOf(board);
    const base = runCampaign({
      players,
      instructions: DEFAULT_INSTRUCTIONS,
      opponents: styles,
      label: "base",
      tacticKey: "base",
      seed: 1,
      now: 1,
    });
    const sharper = runCampaign({
      players,
      instructions: { ...DEFAULT_INSTRUCTIONS, tempo: "higher", shooting: "shoot on sight" },
      opponents: styles,
      label: "sharp",
      tacticKey: "sharp",
      seed: 1,
      now: 2,
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
      now: 3,
    });
    expect(sharper.place).toBeLessThan(base.place);
    expect(deeper.place).toBeGreaterThan(base.place);
  });

  it("names a narrow back line, and wide shots when those sides cause the trouble", () => {
    const board = createBoard();
    board.players = board.players.map((player) => {
      if (player.id === "p2") return { ...player, x: 40 };
      if (player.id === "p5") return { ...player, x: 60 };
      return player;
    });
    const wide = [
      [8, 0, 0, 0, 20, 20],
      [0, 0, 0, 0, 0, 0],
      [0, 0, 0, 0, 0, 0],
      [8, 0, 0, 0, 20, 20],
    ];
    const central = [
      [0, 0, 0, 0, 0, 0],
      [0, 0, 0, 0, 2, 2],
      [0, 0, 0, 0, 2, 2],
      [0, 0, 0, 0, 0, 0],
    ];
    const run = runCampaign({
      players: playersOf(board),
      instructions: DEFAULT_INSTRUCTIONS,
      opponents: [
        opponent({ id: "quiet", team: "Quiet", shotsPerMatch: 8, shotGrid: central }),
        opponent({ id: "wide", team: "Wide", shotsPerMatch: 20, shotGrid: wide }),
      ],
      label: "narrow",
      tacticKey: "narrow",
      seed: 1,
      now: 4,
    });
    expect(run.weaknesses.join(" ")).toMatch(/full-backs sit inside/);
    expect(run.weaknesses.join(" ")).toMatch(/wide areas/);
  });

  it("leads with the empty block, and states what a low-event deep block concedes", () => {
    const board = createBoard();
    const players = playersOf(board);
    const empty = runCampaign({
      players,
      instructions: {
        ...DEFAULT_INSTRUCTIONS,
        defensiveLine: "higher",
        engagement: "lower",
        pressing: "less",
        passing: "more direct",
        distribution: "go long",
        shooting: "shoot on sight",
      },
      opponents: styles,
      label: "empty",
      tacticKey: "empty",
      seed: 1,
      now: 5,
    });
    const deep = runCampaign({
      players,
      instructions: { ...DEFAULT_INSTRUCTIONS, defensiveLine: "deeper", tempo: "lower", shooting: "work the ball" },
      opponents: styles,
      label: "deep-block",
      tacticKey: "deep-block",
      seed: 1,
      now: 6,
    });
    expect(empty.weaknesses[0]).toMatch(/balls over the top/);
    expect(empty.strengths.join(" ")).not.toMatch(/shot count is among the higher/);
    expect(empty.place).toBeGreaterThanOrEqual(18);
    expect(deep.weaknesses.join(" ")).toMatch(/deeper block leaves xG against at/);
    expect(deep.best.every((side) => side.modelXgAgainst < deep.meanAgainst)).toBe(true);
  });
});
