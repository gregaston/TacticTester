import { describe, expect, it } from "vitest";
import { pickCorners, SITUATIONS } from "./corners";
import type { StyleFingerprint } from "./types";

function side(patch: Partial<StyleFingerprint> & Pick<StyleFingerprint, "id" | "team">): StyleFingerprint {
  return {
    season: "2017/2018",
    passLength: 18,
    xgPerShot: 0.1,
    shotsPerMatch: 12,
    ppda: 10,
    pressHeight: 45,
    ...patch,
  };
}

const arsenal = side({ id: "arsenal", team: "Arsenal", passLength: 14 });
const burnley = side({ id: "burnley", team: "Burnley", pressHeight: 22 });
const chelsea = side({ id: "chelsea", team: "Chelsea", ppda: 6.5 });
const liverpool = side({ id: "liverpool", team: "Liverpool", xgPerShot: 0.18 });
const wolves = side({ id: "wolves", team: "Wolves", ppda: 6.5 });

const sides = [chelsea, arsenal, wolves, liverpool, burnley];

describe("pickCorners", () => {
  it("picks the deepest side, the lowest press height", () => {
    expect(pickCorners(sides).deepest).toBe(burnley);
  });

  it("picks the hardest press, the lowest PPDA", () => {
    expect(pickCorners(sides).hardestPress).toBe(chelsea);
  });

  it("picks the shortest pass", () => {
    expect(pickCorners(sides).shortestPass).toBe(arsenal);
  });

  it("picks the most direct chance creation, the highest xG per shot", () => {
    expect(pickCorners(sides).mostDirect).toBe(liverpool);
  });

  it("breaks a tie by team name, A to Z", () => {
    expect(pickCorners([wolves, chelsea, burnley]).hardestPress).toBe(chelsea);
    expect(pickCorners([chelsea, wolves, burnley]).hardestPress).toBe(chelsea);
  });

  it("throws when sides is empty", () => {
    expect(() => pickCorners([])).toThrow(/empty/);
  });
});

describe("SITUATIONS", () => {
  it("names the match states a corner can be read against", () => {
    expect(SITUATIONS.map((situation) => [situation.id, situation.label])).toEqual([
      ["level", "Level"],
      ["protect-lead", "Protect a lead"],
      ["chase", "Chase the game"],
      ["they-have-ten", "They have ten"],
      ["you-have-ten", "You have ten"],
      ["goal-kicks", "Goal kicks"],
      ["settled-attack", "Settled attack"],
    ]);
  });
});
