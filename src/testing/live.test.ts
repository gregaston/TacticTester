import { describe, expect, it } from "vitest";
import { createBoard } from "../tactics/board";
import { DEFAULT_INSTRUCTIONS } from "../tactics/instructions";
import { labelSquad } from "../tactics/positions";
import { playersFromBoard, readStyle, type ProfilePlayer } from "./profile";
import { shotXg } from "./xg";
import type { StyleFingerprint } from "./types";
import { priceChances } from "./chance";
import { causeNotes, liveSample, restDefenceCount, sketchPpda, styleShiftNote } from "./live";

function fingerprint(patch: Partial<StyleFingerprint> = {}): StyleFingerprint {
  return {
    id: "stoke-2017",
    team: "Stoke",
    season: "2017/2018",
    passLength: 19,
    xgPerShot: 0.11,
    shotsPerMatch: 12,
    ppda: 10,
    pressHeight: 40,
    ...patch,
  };
}

function player(patch: Partial<ProfilePlayer> & Pick<ProfilePlayer, "line" | "y">): ProfilePlayer {
  return {
    x: 50,
    wide: false,
    left: false,
    roleId: patch.line === "GK" ? "goalkeeper" : patch.line === "ST" ? "advanced-forward" : "centre-back",
    duty: "support",
    ...patch,
  };
}

describe("liveSample", () => {
  it("keeps an untouched 4-4-2 on the recorded pass and a back four behind the ball", () => {
    const board = createBoard();
    const players = playersFromBoard(board.players, labelSquad(board.players), {});
    const opponent = fingerprint();
    const match = liveSample({
      players,
      instructions: DEFAULT_INSTRUCTIONS,
      opponent,
      situation: "level",
      styles: [opponent],
      seed: 1,
    });

    expect(match.report.possessions).toBe(600);
    expect(match.report.restDefence).toBe(4);
    expect(Math.abs(match.report.passLength - 19)).toBeLessThanOrEqual(1.5);
    expect(match.yourPpda).toBe(10);
    expect(match.report.ppda).toBe(10);
    expect(match.notes).toEqual([]);
    expect(match.report.lines.join(" ")).not.toMatch(/score/i);
    expect(match.report.lines[0]).toContain(", passes average");
    expect(match.report.lines[0]).not.toMatch(/narrow|wide|safe|risky/);
  });

  it("puts the profile's shots per match through as model xG", () => {
    const players = [player({ line: "ST", y: 86, x: 50, roleId: "advanced-forward" })];
    const opponent = fingerprint({ shotsPerMatch: 12, pressHeight: 40, xgPerShot: 0.99 });
    const match = liveSample({
      players,
      instructions: DEFAULT_INSTRUCTIONS,
      opponent,
      situation: "level",
      styles: [opponent],
      seed: 3,
    });
    const profile = readStyle(players, DEFAULT_INSTRUCTIONS, [opponent]).profile;
    const priced = priceChances({
      players,
      instructions: DEFAULT_INSTRUCTIONS,
      opponent,
      situation: "level",
      passLength: profile.passLength,
      passRisk: 0.5,
      pressHeight: profile.pressHeight,
      shotsPerMatch: profile.shotsPerMatch,
      restDefence: match.report.restDefence,
    });
    expect(match.report.modelXgFor).toBeCloseTo(priced.modelXgFor, 4);
    expect(match.report.modelXgFor).not.toBeCloseTo(shotXg(profile.shotX, profile.shotY) * profile.shotsPerMatch, 1);
    expect(match.report.modelXgAgainst).not.toBeCloseTo(0.99 * 12, 1);
  });

  it("names territory without chances, a high press with space behind, a thin rest defence, and a half-space shot", () => {
    const deep = [
      player({ line: "GK", y: 8, roleId: "goalkeeper" }),
      player({ line: "DEF", y: 24, roleId: "centre-back" }),
      player({ line: "ST", y: 80, x: 32, left: true, roleId: "advanced-forward" }),
    ];
    const styles = [fingerprint({ passLength: 19, shotsPerMatch: 8, pressHeight: 30, ppda: 12 })];
    const opponent = fingerprint({
      id: "villa",
      team: "Villa",
      shotsPerMatch: 4,
      pressHeight: 10,
      ppda: 12,
      xgPerShot: 0.2,
    });
    const open = liveSample({
      players: deep,
      instructions: DEFAULT_INSTRUCTIONS,
      opponent,
      situation: "level",
      styles,
      seed: 2,
    });
    expect(open.report.restDefence).toBe(1);
    expect(open.notes).toContain("The press steps up and leaves space behind it.");
    expect(open.notes).toContain("Fewer than three players stay behind the ball.");

    const half = [
      player({ line: "ST", y: 86, x: 32, left: true, roleId: "advanced-forward" }),
      player({ line: "ST", y: 86, x: 32, left: true, roleId: "advanced-forward" }),
    ];
    const halfMatch = liveSample({
      players: half,
      instructions: DEFAULT_INSTRUCTIONS,
      opponent: fingerprint({ pressHeight: 40, shotsPerMatch: 12 }),
      situation: "level",
      styles: [fingerprint()],
      seed: 2,
    });
    expect(halfMatch.notes).toContain("The shots come from the half-space.");
    expect(halfMatch.notes).toContain("Fewer than three players stay behind the ball.");
  });
});

describe("sketchPpda", () => {
  it("keeps the recorded PPDA when the press matches, and drops it when the press is higher", () => {
    expect(sketchPpda(40, 40, 10)).toBe(10);
    expect(sketchPpda(50, 40, 10)).toBe(3);
    expect(sketchPpda(30, 40, 8)).toBe(15);
  });
});

describe("causeNotes", () => {
  it("says the side has the territory and not the chances", () => {
    const notes = causeNotes(
      { passLength: 18, shotsPerMatch: 20, pressHeight: 40, shotX: 50, shotY: 40 },
      {
        seed: 1,
        possessions: 600,
        modelXgFor: 0.3,
        modelXgAgainst: 0.8,
        passLength: 18,
        ppda: 10,
        tilt: 0.7,
        restDefence: 4,
        lines: [],
      },
      40,
    );
    expect(notes).toEqual(["The side has the territory and not the chances."]);
  });
});

describe("restDefenceCount", () => {
  it("counts outfield players who arrive in their own half", () => {
    const board = createBoard();
    expect(restDefenceCount(playersFromBoard(board.players, labelSquad(board.players), {}))).toBe(4);
  });
});

describe("styleShiftNote", () => {
  it("speaks only when a role edit moves the nearest side", () => {
    expect(styleShiftNote(true, "leicester", "burnley")).toBe("The nearest side changed after that role.");
    expect(styleShiftNote(true, "leicester", "leicester")).toBeNull();
    expect(styleShiftNote(false, "leicester", "burnley")).toBeNull();
    expect(styleShiftNote(true, null, "burnley")).toBeNull();
  });
});
