import { describe, expect, it } from "vitest";
import { createBoard } from "../tactics/board";
import { DEFAULT_INSTRUCTIONS } from "../tactics/instructions";
import { labelSquad } from "../tactics/positions";
import { loadStyleLibrary } from "../data/style-library";
import { playersFromBoard } from "./profile";
import { testTactic, whyLine, type TestOpponent } from "./battery";

function opponent(patch: Partial<TestOpponent> & Pick<TestOpponent, "id" | "team">): TestOpponent {
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

describe("testTactic", () => {
  it("ranks the side that creates more trouble first and says why", () => {
    const board = createBoard();
    const players = playersFromBoard(board.players, labelSquad(board.players), {});
    const quiet = opponent({ id: "quiet", team: "Quiet", shotsPerMatch: 8, pressHeight: 40, xgPerShot: 0.08 });
    const volume = opponent({
      id: "volume",
      team: "Volume",
      shotsPerMatch: 20,
      pressHeight: 40,
      xgPerShot: 0.14,
    });
    const presser = opponent({
      id: "presser",
      team: "Presser",
      shotsPerMatch: 11,
      pressHeight: 70,
      ppda: 5.2,
      xgPerShot: 0.11,
    });
    const sides = [quiet, volume, presser];
    const result = testTactic({
      players,
      instructions: DEFAULT_INSTRUCTIONS,
      opponents: sides,
      styles: sides,
      situation: "level",
      seed: 4,
    });

    expect(result.tested).toBe(3);
    expect(result.weakest[0].team).toBe("Volume");
    expect(result.weakest[0].why).toContain("20 shots");
    expect(result.weakest.map((row) => row.margin)).toEqual([...result.weakest.map((row) => row.margin)].sort((a, b) => b - a));
    expect(result.summary).toContain("Volume");
    expect(result.summary).not.toMatch(/score/i);
    expect(result.weakest.every((row) => !/score|very close/i.test(row.why))).toBe(true);
    expect(testTactic({
      players,
      instructions: DEFAULT_INSTRUCTIONS,
      opponents: sides,
      styles: sides,
      situation: "level",
      seed: 4,
    })).toEqual(result);
  });

  it("names a high press when that press takes value off the chances", () => {
    const why = whyLine(
      opponent({ id: "napoli", team: "Napoli", pressHeight: 60, ppda: 5.4, shotsPerMatch: 12 }),
      40,
      19,
      4,
      [opponent({ id: "napoli", team: "Napoli", pressHeight: 60, ppda: 5.4 })],
    );
    expect(why).toBe("Napoli allow 5.4 passes before a defensive action, and that press takes the value off the chances.");
  });

  it("on the real set, names three sides and keeps the model's xG labeled as a model", () => {
    const board = createBoard();
    const players = playersFromBoard(board.players, labelSquad(board.players), {});
    const styles = loadStyleLibrary().sides;
    const result = testTactic({
      players,
      instructions: DEFAULT_INSTRUCTIONS,
      opponents: styles,
      styles,
      situation: "level",
      seed: 1,
    });

    expect(result.tested).toBe(133);
    expect(result.weakest).toHaveLength(3);
    expect(result.weakest[0].margin).toBeGreaterThanOrEqual(result.weakest[1].margin);
    expect(result.weakest[0].why.length).toBeGreaterThan(20);
    expect(`${result.summary} ${result.weakest.map((row) => row.why).join(" ")}`).not.toMatch(/score|very close/i);
    expect(result.summary).toMatch(/133/);
  });
});
