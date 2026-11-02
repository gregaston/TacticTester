import { describe, expect, it } from "vitest";
import { createBoard } from "../tactics/board";
import { DEFAULT_INSTRUCTIONS } from "../tactics/instructions";
import { labelSquad } from "../tactics/positions";
import { loadShapeLibrary } from "../data/shape-library";
import { loadStyleLibrary } from "../data/style-library";
import { playersFromBoard } from "./profile";
import { priceChances } from "./chance";
import { concedingLess, readMatchups, type MatchupSide, type SideNote } from "./matchups";
import { preferredAxis, runCampaign } from "./campaign";

function grid(kind: "central" | "wide"): number[][] {
  if (kind === "wide") {
    return [
      [0, 0, 0, 0, 12, 12],
      [0, 0, 0, 0, 0, 0],
      [0, 0, 0, 0, 0, 0],
      [0, 0, 0, 0, 12, 12],
    ];
  }
  return [
    [0, 0, 0, 0, 0, 0],
    [0, 0, 0, 0, 12, 12],
    [0, 0, 0, 0, 12, 12],
    [0, 0, 0, 0, 0, 0],
  ];
}

function side(id: string, shots: number, kind: "central" | "wide"): MatchupSide {
  const extra = kind === "central" ? 0.3 : 0;
  return {
    id,
    team: id,
    season: "2015/2016",
    competition: "League",
    shotsPerMatch: shots,
    modelXgFor: 1.2,
    modelXgAgainst: shots * 0.1 + extra,
    shotGrid: grid(kind),
    pressHeight: 40,
    longPassShare: 0.15,
    fieldTilt: 0.5,
    shapeWidth: 19.5,
  };
}

describe("readMatchups", () => {
  it("names the shared shot pattern and lists those sides, not the busiest attacks", () => {
    const sides = [
      side("Central low", 10, "central"),
      side("Central mid", 12, "central"),
      side("Central high", 18, "central"),
      side("Central top", 16, "central"),
      side("Wide low", 10, "wide"),
      side("Wide mid", 14, "wide"),
      side("Wide high", 18, "wide"),
      side("Wide top", 20, "wide"),
    ];
    const read = readMatchups(sides);
    expect(read.weakness).toMatch(/shoot through the middle/);
    expect(read.strength).toMatch(/wide areas/);
    expect(read.comparison).toMatch(/shoot through the middle/);
    expect(read.comparison).toMatch(/wide areas/);
    expect(read.comparison).toMatch(/after shot count/);
    expect(read.harder.map((row) => row.team).every((team) => team.startsWith("Central"))).toBe(true);
    expect(read.harder.some((row) => row.team === "Wide top")).toBe(false);
    expect(read.easier.every((row) => row.team.startsWith("Wide"))).toBe(true);
    expect(read.harder[0].note).toMatch(/worse than their shot count/);
    expect(read.harder[0].note).not.toMatch(/score/i);
    expect(new Set(read.harder.map((row) => row.note.split(". ")[0])).size).toBe(1);
  });

  it("names shots soon after a recovery without calling that a counter", () => {
    const sides = Array.from({ length: 8 }, (_, index) => {
      const soon = index >= 6;
      return {
        ...side(soon ? `Soon ${index}` : `Wait ${index}`, 12, "central"),
        regainShotsPerMatch: soon ? 8 : 3,
        modelXgAgainst: 1.2 + (soon ? 0.5 : 0),
      };
    });
    const read = readMatchups(sides, "regain");
    expect(read.weakness).toMatch(/Sides who shoot soon after a recovery/);
    expect(read.strength).toMatch(/Sides who wait after a recovery/);
    expect(`${read.comparison} ${read.harder[0].note}`).not.toMatch(/counter/i);
  });

  it("names frequent crosses and the share of shots they set up", () => {
    const sides = Array.from({ length: 8 }, (_, index) => {
      const often = index >= 6;
      return {
        ...side(often ? `Cross ${index}` : `Quiet ${index}`, 12, "central"),
        crossesPerMatch: often ? 24 : 6,
        crossShotShare: often ? 0.28 : 0.08,
        modelXgAgainst: 1.2 + (often ? 0.5 : 0),
      };
    });
    const read = readMatchups(sides, "crosses");
    expect(read.weakness).toMatch(/Sides who shoot more often from crosses/);
    expect(read.comparison).toMatch(/24 crosses a match/);
    expect(read.comparison).toMatch(/6 crosses a match/);
    expect(read.comparison).not.toMatch(/counter/i);
  });

  it("puts the progressive count beside the final-third sentence", () => {
    const sides = Array.from({ length: 8 }, (_, index) => {
      const direct = index >= 6;
      return {
        ...side(direct ? `Direct ${index}` : `Keep ${index}`, 12, "central"),
        longPassShare: direct ? 0.25 : 0.08,
        fieldTilt: direct ? 0.3 : 0.75,
        progressivePerMatch: direct ? 30 : 90,
        modelXgAgainst: 1.2 + (direct ? 0.5 : 0),
      };
    });
    const read = readMatchups(sides, "direct");
    expect(read.comparison).toMatch(/Direct sides average 30 progressive passes a match/);
    expect(read.comparison).toMatch(/Sides who keep the ball in the final third average 90/);
  });

  it("does not invent a style when every opponent plays the same way", () => {
    const sides = Array.from({ length: 8 }, (_, index) => side(`Side ${index}`, 10 + index, "central")).map((row, index) => ({
      ...row,
      modelXgAgainst: row.shotsPerMatch * 0.1 + (index % 2 === 0 ? 0.2 : 0),
    }));
    const read = readMatchups(sides);
    expect(read.strength).toBeNull();
    expect(read.weakness).toBeNull();
    expect(read.comparison).toMatch(/No shared opponent style/);
    expect(read.harder[0].note).toMatch(/No shared style/);
    expect(read.harder[0].note).not.toMatch(/Their result|score/i);
  });
});

describe("style prices", () => {
  const board = createBoard();
  const players = playersFromBoard(board.players, labelSquad(board.players), {});

  it("gives a wide attack more against a narrow starting shape", () => {
    const base = {
      players,
      instructions: { ...DEFAULT_INSTRUCTIONS, width: "wider" as const, widthIntention: "overlap" as const },
      situation: "level" as const,
      passLength: 19,
      passRisk: 0.4,
      pressHeight: 40,
      shotsPerMatch: 12,
      restDefence: 4,
    };
    const narrow = priceChances({ ...base, opponent: opponent({ shapeWidth: 14 }) }).modelXgFor;
    const wide = priceChances({ ...base, opponent: opponent({ shapeWidth: 24 }) }).modelXgFor;
    expect(narrow).toBeGreaterThan(wide);
  });

  it("makes a high line pay more against direct sides who see less of the final third", () => {
    const shared = {
      players,
      situation: "level" as const,
      passLength: 19,
      passRisk: 0.4,
      pressHeight: 40,
      shotsPerMatch: 12,
      restDefence: 3,
    };
    const direct = opponent({ longPassShare: 0.2, fieldTilt: 0.36 });
    const patient = opponent({ longPassShare: 0.1, fieldTilt: 0.7 });
    const high = { ...DEFAULT_INSTRUCTIONS, defensiveLine: "higher" as const };
    const deep = { ...DEFAULT_INSTRUCTIONS, defensiveLine: "deeper" as const };
    const highGap = priceChances({ ...shared, instructions: high, opponent: direct }).modelXgAgainst
      - priceChances({ ...shared, instructions: high, opponent: patient }).modelXgAgainst;
    const deepGap = priceChances({ ...shared, instructions: deep, opponent: direct }).modelXgAgainst
      - priceChances({ ...shared, instructions: deep, opponent: patient }).modelXgAgainst;
    expect(highGap).toBeGreaterThan(0.05);
    expect(highGap).toBeGreaterThan(deepGap);
  });
});

describe("concedingLess", () => {
  it("drops a residual side that concedes more than this tactic", () => {
    const note = (against: number): SideNote => ({
      id: String(against),
      team: "Side",
      season: "2015/2016",
      competition: "Serie A",
      modelXgFor: 0.7,
      modelXgAgainst: against,
      note: "Narrow starting shapes. 0.20 better than their shot count.",
    });
    expect(concedingLess([note(2.18), note(1.49)], 1.86).map((side) => side.modelXgAgainst)).toEqual([1.49]);
  });
});

describe("a full test names one pattern", () => {
  it("does not hand the hardest list to the three busiest attacks", () => {
    const styles = loadStyleLibrary().sides;
    const widths = new Map(loadShapeLibrary().sides.map((side) => [side.id, side.features.width]));
    const board = createBoard();
    const run = runCampaign({
      players: playersFromBoard(board.players, labelSquad(board.players), {}),
      instructions: DEFAULT_INSTRUCTIONS,
      opponents: styles.map((side) => ({ ...side, shapeWidth: widths.get(side.id) })),
      label: "flat",
      tacticKey: "flat",
      seed: 1,
      now: 1,
    });
    const busiest = [...styles].sort((a, b) => b.shotsPerMatch - a.shotsPerMatch).slice(0, 3).map((side) => side.team);
    expect(run.weaknesses[0]).toMatch(/shoot through the middle/);
    expect(run.weaknesses[0]).toMatch(/cost more than their shot count/);
    expect(run.strengths[0]).toMatch(/wide areas/);
    expect(run.comparison).toMatch(/shoot through the middle/);
    expect(run.comparison).toMatch(/wide areas/);
    expect(run.comparison).toMatch(/after shot count/);
    expect(run.worst).toHaveLength(3);
    expect(run.worst.every((row) => busiest.includes(row.team))).toBe(false);
    expect(new Set(run.worst.map((row) => row.note.split(".")[0])).size).toBe(1);
    expect(new Set(run.best.map((row) => row.note.split(".")[0])).size).toBe(1);
    expect(run.worst[0].note.split(".")[0]).not.toBe(run.best[0].note.split(".")[0]);
    expect(run.worst[0].note).not.toMatch(/score/i);
    expect(run.chanceNote ?? null).toBeNull();
  });

  it("says a wide attack meets wide shapes, and a high line meets direct sides", () => {
    const styles = loadStyleLibrary().sides;
    const widths = new Map(loadShapeLibrary().sides.map((side) => [side.id, side.features.width]));
    const opponents = styles.map((side) => ({ ...side, shapeWidth: widths.get(side.id) }));
    const board = createBoard();
    const players = playersFromBoard(board.players, labelSquad(board.players), {});
    const busiest = [...styles].sort((a, b) => b.shotsPerMatch - a.shotsPerMatch).slice(0, 3).map((side) => side.team);
    const wide = runCampaign({
      players,
      instructions: { ...DEFAULT_INSTRUCTIONS, width: "wider", widthIntention: "overlap" },
      opponents,
      label: "wide",
      tacticKey: "wide",
      seed: 1,
      now: 2,
    });
    const high = runCampaign({
      players,
      instructions: { ...DEFAULT_INSTRUCTIONS, defensiveLine: "higher" },
      opponents,
      label: "high",
      tacticKey: "high",
      seed: 1,
      now: 3,
    });
    expect(wide.weaknesses[0]).toMatch(/Wide starting shapes cost more than their shot count/);
    expect(wide.strengths[0]).toMatch(/Narrow starting shapes cost less than their shot count/);
    expect(wide.comparison).toMatch(/Wide starting shapes cost .* more than narrow starting shapes/);
    expect(wide.comparison).not.toMatch(/counter/i);
    expect(wide.worst.every((row) => busiest.includes(row.team))).toBe(false);
    expect(new Set(wide.worst.map((row) => row.note.split(". ")[0])).size).toBe(1);
    expect(high.weaknesses[0]).toMatch(/Direct sides who see less of the final third/);
    expect(high.strengths[0]).toMatch(/keep the ball in the final third/);
    expect(high.comparison).toMatch(/Direct sides/);
    expect(high.comparison).toMatch(/progressive passes a match/);
    expect(high.chanceNote).toMatch(/Recorded chances average \d\.\d\d xG a shot/);
    expect(high.chanceNote).toMatch(/TacticTester prices those maps at \d\.\d\d a shot/);
    expect(new Set(high.worst.map((row) => row.note.split(". ")[0])).size).toBe(1);
    expect(wide.worst[0].note).not.toMatch(/score|counter/i);
    expect(high.worst[0].note).not.toMatch(/score|counter/i);
    const regroup = {
      ...DEFAULT_INSTRUCTIONS,
      width: "wider" as const,
      widthIntention: "overlap" as const,
      transition: "regroup" as const,
    };
    expect(preferredAxis(regroup)).toBe("regain");
    expect(preferredAxis({ ...regroup, defensiveLine: "higher" })).toBe("direct");
    const recovery = Array.from({ length: 8 }, (_, index) => {
      const soon = index >= 6;
      return {
        ...side(soon ? `Soon ${index}` : `Wait ${index}`, 12, "central"),
        regainShotsPerMatch: soon ? 8 : 3,
        crossesPerMatch: soon ? 6 : 24,
        crossShotShare: soon ? 0.08 : 0.28,
        modelXgAgainst: 1.2 + (soon ? 0.5 : 0),
      };
    });
    const regained = readMatchups(recovery, preferredAxis(regroup));
    expect(regained.weakness).toMatch(/Sides who shoot soon after a recovery/);
    expect(regained.comparison ?? "").not.toMatch(/counter/i);
    const press = runCampaign({
      players,
      instructions: { ...DEFAULT_INSTRUCTIONS, transition: "counter-press" },
      opponents,
      label: "press",
      tacticKey: "press",
      seed: 1,
      now: 4,
    });
    const pressText = [press.comparison, ...press.strengths, ...press.weaknesses, ...press.worst.map((row) => row.note)].join(" ");
    expect(pressText).not.toMatch(/counter/i);
  });
});

function opponent(patch: { shapeWidth?: number; longPassShare?: number; fieldTilt?: number }) {
  return {
    id: "side",
    team: "Side",
    season: "2015/2016",
    passLength: 19,
    xgPerShot: 0.1,
    shotsPerMatch: 14,
    ppda: 10,
    pressHeight: 40,
    shotGrid: grid("central"),
    ...patch,
  };
}
