import { describe, expect, it } from "vitest";
import { opponentAgrees, runSample, type SampleSide, type Situation } from "./sample";
import type { StyleFingerprint } from "./types";
import { shotXg } from "./xg";

const SITUATIONS: Situation[] = [
  "level",
  "protect-lead",
  "chase",
  "they-have-ten",
  "you-have-ten",
  "goal-kicks",
  "settled-attack",
];

function side(patch: Partial<SampleSide> = {}): SampleSide {
  return {
    passLength: 16,
    passRisk: 0.5,
    width: 36,
    pressHeight: 50,
    shotVolume: 1,
    shotX: 50,
    shotY: 78,
    restDefence: 4,
    ...patch,
  };
}

function fingerprint(patch: Partial<StyleFingerprint> = {}): StyleFingerprint {
  return {
    id: "stoke-2017",
    team: "Stoke",
    season: "2017/2018",
    passLength: 19,
    xgPerShot: 0.11,
    shotsPerMatch: 12,
    ppda: 14.2,
    pressHeight: 50,
    ...patch,
  };
}

function expectFanLines(lines: string[], team: string) {
  expect(lines.length).toBeGreaterThanOrEqual(2);
  expect(lines.length).toBeLessThanOrEqual(4);
  const text = lines.join(" ");
  expect(text).toContain(team);
  expect(text.match(/passes the opponent completes before a defensive action/g)).toHaveLength(1);
  expect(text).not.toMatch(/very close/i);
  expect(text).not.toMatch(/score/i);
  expect(text).not.toMatch(/\d+\s*[-–—]\s*\d+/);
  expect(text).toContain("model's xG");
  expect(text.replaceAll("model's xG", "")).not.toMatch(/xG/i);
}

describe("runSample", () => {
  it("repeats the same report for the same seed and runs 600 possessions", () => {
    const user = side();
    const opp = fingerprint();
    const first = runSample(user, opp, "level", 42);
    const second = runSample(user, opp, "level", 42);
    expect(second).toEqual(first);
    expect(first.seed).toBe(42);
    expect(first.possessions).toBe(600);
    expect(first.passLength).not.toBe(runSample(user, opp, "level", 43).passLength);
  });

  it("does not rewrite the inputs", () => {
    const user = side();
    const opp = fingerprint();
    const userCopy = { ...user };
    const oppCopy = { ...opp };
    runSample(user, opp, "chase", 1);
    expect(user).toEqual(userCopy);
    expect(opp).toEqual(oppCopy);
  });

  it("keeps the user's passes within 2 yards and anchors the opponent", () => {
    const user = side({ passLength: 21.5 });
    const opp = fingerprint({ passLength: 19, ppda: 14.2, shotsPerMatch: 12 });
    const report = runSample(user, opp, "level", 7);
    expect(Math.abs(report.passLength - 21.5)).toBeLessThanOrEqual(1.5);
    expect(report.ppda).toBe(14.2);
    expect(report.lines[0]).toContain("Stoke stay at 19 yards");
    expect(report.lines[1]).toBe("Stoke allow 14.2 passes the opponent completes before a defensive action.");
    expect(report.restDefence).toBe(4);
  });

  it("builds model xG from the geometric sketch times shot volume, not the recorded xG", () => {
    const user = side({ shotX: 50, shotY: 78, shotVolume: 1.5, pressHeight: 50, restDefence: 4 });
    const opp = fingerprint({ xgPerShot: 0.99, shotsPerMatch: 10, pressHeight: 40 });
    const report = runSample(user, opp, "level", 1);
    expect(report.modelXgFor).toBeCloseTo(shotXg(50, 78) * 1.5 * 12, 8);
    expect(report.modelXgAgainst).toBeCloseTo(shotXg(50, 78) * 10, 8);
    expect(report.modelXgAgainst).not.toBeCloseTo(0.99 * 10, 2);
  });

  it("lowers the user's xG per shot only when the press is at least 8 higher", () => {
    const user = side({ pressHeight: 50, shotVolume: 1 });
    const level = runSample(user, fingerprint({ pressHeight: 57.9 }), "level", 2);
    const pressed = runSample(user, fingerprint({ pressHeight: 58 }), "level", 2);
    expect(pressed.modelXgFor).toBeCloseTo(level.modelXgFor * 0.85, 8);
    expect(pressed.modelXgAgainst).toBeCloseTo(level.modelXgAgainst, 8);
  });

  it("raises xG against when rest defence is under 3", () => {
    const opp = fingerprint();
    const open = runSample(side({ restDefence: 2.9 }), opp, "level", 4);
    const shut = runSample(side({ restDefence: 3 }), opp, "level", 4);
    expect(open.modelXgAgainst).toBeCloseTo(shut.modelXgAgainst * 1.25, 8);
    expect(open.modelXgFor).toBeCloseTo(shut.modelXgFor, 8);
    expect(open.lines[2]).toMatch(/^With 2\.9 players behind the ball, the model's xG is /);
    expect(shut.lines.join(" ")).not.toMatch(/behind the ball/);
  });

  it("moves field tilt with the shot-volume gap and keeps it between 0.15 and 0.85", () => {
    const opp = fingerprint({ shotsPerMatch: 12 });
    expect(runSample(side({ shotVolume: 1 }), opp, "level", 1).tilt).toBeCloseTo(0.5, 8);
    expect(runSample(side({ shotVolume: 3 }), opp, "level", 1).tilt).toBeCloseTo(0.75, 8);
    expect(runSample(side({ shotVolume: 0 }), opp, "level", 1).tilt).toBe(0.15);
    expect(runSample(side({ shotVolume: 100 }), opp, "level", 1).tilt).toBe(0.85);
    const quiet = runSample(side({ shotVolume: 1 }), opp, "level", 1).tilt;
    const louder = runSample(side({ shotVolume: 2 }), opp, "level", 1).tilt;
    expect(louder).toBeGreaterThan(quiet);
  });

  it("protects a lead by lifting their press and cutting their shots", () => {
    const user = side({ pressHeight: 50, shotVolume: 1 });
    const opp = fingerprint({ pressHeight: 50, shotsPerMatch: 12 });
    const level = runSample(user, opp, "level", 5);
    const protect = runSample(user, opp, "protect-lead", 5);
    expect(protect.passLength).toBe(level.passLength);
    expect(protect.ppda).toBe(opp.ppda);
    expect(protect.modelXgFor).toBeCloseTo(level.modelXgFor * 0.85, 8);
    expect(protect.modelXgAgainst).toBeCloseTo(level.modelXgAgainst * 0.8, 8);
    expect(protect.tilt).toBeCloseTo(1 / 1.8, 8);
    expect(protect.lines[3]).toBe("Stoke press higher and shoot less often to protect the lead.");
  });

  it("chases by shooting more and pressing higher", () => {
    const user = side({ pressHeight: 50, shotVolume: 1 });
    const opp = fingerprint({ pressHeight: 50, shotsPerMatch: 12 });
    const level = runSample(user, opp, "level", 5);
    const chase = runSample(user, opp, "chase", 5);
    expect(chase.modelXgFor).toBeCloseTo(level.modelXgFor * 1.25, 8);
    expect(chase.modelXgAgainst).toBeCloseTo(level.modelXgAgainst, 8);
    expect(chase.ppda).toBe(level.ppda);
    expect(chase.tilt).toBeCloseTo(1.25 / 2.25, 8);
    expect(chase.lines[3]).toBe("The press steps up and more shots arrive in the chase.");
  });

  it("gives them ten men, one fewer behind the ball, and fewer shots", () => {
    const user = side({ shotVolume: 1, restDefence: 4 });
    const opp = fingerprint({ shotsPerMatch: 12, pressHeight: 50 });
    const level = runSample(user, opp, "level", 6);
    const ten = runSample(user, opp, "they-have-ten", 6);
    expect(ten.modelXgFor).toBeCloseTo(level.modelXgFor, 8);
    expect(ten.modelXgAgainst).toBeCloseTo(level.modelXgAgainst * 0.85, 8);
    expect(ten.ppda).toBe(opp.ppda);
    expect(ten.lines[3]).toBe(
      "Stoke have ten players, so 2 players stay behind the ball and they shoot less often.",
    );
  });

  it("gives you ten men and raises xG against only once rest defence is under 3", () => {
    const opp = fingerprint({ shotsPerMatch: 12, pressHeight: 40 });
    const held = runSample(side({ restDefence: 4, shotVolume: 2, pressHeight: 50 }), opp, "you-have-ten", 8);
    const levelHeld = runSample(side({ restDefence: 4, shotVolume: 2, pressHeight: 50 }), opp, "level", 8);
    expect(held.restDefence).toBe(3);
    expect(held.modelXgFor).toBeCloseTo(levelHeld.modelXgFor * 0.85, 8);
    expect(held.modelXgAgainst).toBeCloseTo(levelHeld.modelXgAgainst, 8);

    const open = runSample(side({ restDefence: 3, shotVolume: 2, pressHeight: 50 }), opp, "you-have-ten", 8);
    const levelOpen = runSample(side({ restDefence: 3, shotVolume: 2, pressHeight: 50 }), opp, "level", 8);
    expect(open.restDefence).toBe(2);
    expect(open.modelXgFor).toBeCloseTo(levelOpen.modelXgFor * 0.85, 8);
    expect(open.modelXgAgainst).toBeCloseTo(levelOpen.modelXgAgainst * 1.25, 8);
    expect(runSample(side({ restDefence: 0 }), opp, "you-have-ten", 1).restDefence).toBe(0);
  });

  it("cuts both shot volumes for goal kicks and talks about the first pass", () => {
    const user = side({ shotVolume: 1, pressHeight: 50 });
    const opp = fingerprint({ shotsPerMatch: 12, pressHeight: 50 });
    const level = runSample(user, opp, "level", 9);
    const kicks = runSample(user, opp, "goal-kicks", 9);
    expect(kicks.modelXgFor).toBeCloseTo(level.modelXgFor * 0.4, 8);
    expect(kicks.modelXgAgainst).toBeCloseTo(level.modelXgAgainst * 0.4, 8);
    expect(kicks.tilt).toBeCloseTo(level.tilt, 8);
    expect(kicks.ppda).toBe(opp.ppda);
    expect(kicks.lines[3]).toBe("Both sides shoot less often, and the first pass starts the possession.");
  });

  it("moves a settled attack 8 closer to goal and caps it at 100", () => {
    const opp = fingerprint({ pressHeight: 40, shotsPerMatch: 12 });
    const settled = runSample(side({ shotX: 42, shotY: 78, shotVolume: 1, pressHeight: 50 }), opp, "settled-attack", 3);
    expect(settled.modelXgFor).toBeCloseTo(shotXg(42, 86) * 12, 8);
    expect(settled.modelXgAgainst).toBeCloseTo(runSample(side({ pressHeight: 50 }), opp, "level", 3).modelXgAgainst, 8);

    const capped = runSample(side({ shotX: 40, shotY: 96, shotVolume: 2, pressHeight: 50 }), opp, "settled-attack", 3);
    expect(capped.modelXgFor).toBeCloseTo(shotXg(40, 100) * 2 * 12, 8);
    const already = runSample(side({ shotX: 40, shotY: 100, shotVolume: 2, pressHeight: 50 }), opp, "settled-attack", 3);
    expect(already.modelXgFor).toBeCloseTo(shotXg(40, 100) * 2 * 12, 8);
    expect(settled.lines[3]).toBe("The attack is settled, so the shots come from closer to the goal.");
  });

  it("names the pass shape without a scoreline in every situation", () => {
    const user = side({ width: 48, passRisk: 0.8 });
    const opp = fingerprint({ team: "Burnley", passLength: 22.4 });
    for (const situation of SITUATIONS) {
      const report = runSample(user, opp, situation, 11);
      expectFanLines(report.lines, "Burnley");
      expect(report.lines[0]).toContain("wide risky passes");
      expect(report.lines[0]).toContain("Burnley stay at 22.4 yards");
      expect(report.ppda).toBe(opp.ppda);
    }
    expect(runSample(side({ width: 12, passRisk: 0.2 }), opp, "level", 1).lines[0]).toContain("narrow safe passes");
    expect(runSample(side({ width: 36, passRisk: 0.5 }), opp, "level", 1).lines[0]).toContain(", passes average");
  });
});

describe("opponentAgrees", () => {
  it("is true only when a mirror at level stays within 2 yards and 2 PPDA", () => {
    const burnley = fingerprint({
      id: "burnley-2017",
      team: "Burnley",
      passLength: 22.4,
      ppda: 14.8,
      pressHeight: 31,
      shotsPerMatch: 11,
      xgPerShot: 0.08,
    });
    const napoli = fingerprint({
      id: "napoli-2017",
      team: "Napoli",
      passLength: 15.2,
      ppda: 6.1,
      pressHeight: 64,
      shotsPerMatch: 16,
      xgPerShot: 0.12,
    });
    for (const seed of [0, 1, 7, 99, 1000]) {
      expect(opponentAgrees(burnley, seed)).toBe(true);
      expect(opponentAgrees(napoli, seed)).toBe(true);
      for (const opp of [burnley, napoli]) {
        const report = runSample(
          {
            passLength: opp.passLength,
            passRisk: 0.5,
            width: 36,
            pressHeight: opp.pressHeight,
            shotVolume: opp.shotsPerMatch / 12,
            shotX: 50,
            shotY: 78,
            restDefence: 3,
          },
          opp,
          "level",
          seed,
        );
        expect(Math.abs(report.passLength - opp.passLength)).toBeLessThanOrEqual(2);
        expect(Math.abs(report.ppda - opp.ppda)).toBeLessThanOrEqual(2);
        expect(report.possessions).toBe(600);
      }
    }
  });
});
