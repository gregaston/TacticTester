import { describe, expect, it } from "vitest";
import { runTest } from "./run";
import type { StyleFingerprint, TestSetup } from "./types";
import { shotXg } from "./xg";

const SIX_YARD_Y = 100 - ((6 * 0.9144) / 105) * 100;

function setup(patch: Partial<TestSetup> = {}): TestSetup {
  return {
    passLength: 15,
    passRisk: 0.5,
    width: 36,
    pressHeight: 70,
    shotVolume: 1,
    shotX: 50,
    shotY: 78,
    ...patch,
  };
}

function style(patch: Partial<StyleFingerprint> = {}): StyleFingerprint {
  return {
    id: "city-2017",
    team: "Manchester City",
    season: "2017/2018",
    passLength: 15,
    xgPerShot: shotXg(50, 78),
    shotsPerMatch: 8,
    ppda: 8.6,
    pressHeight: 70,
    ...patch,
  };
}

describe("shotXg", () => {
  it("rates a central six-yard shot far above a shot from halfway", () => {
    const sixYard = shotXg(50, SIX_YARD_Y);
    const halfway = shotXg(50, 50);
    expect(sixYard).toBeGreaterThan(halfway * 8);
  });

  it("rates the corner of the box below a central shot from the same distance", () => {
    const cornerX = 50 + (20.16 / 68) * 100;
    const cornerY = 100 - (16.5 / 105) * 100;
    const distance = Math.hypot(cornerX - 50, cornerY - 100);
    expect(shotXg(cornerX, cornerY)).toBeLessThan(shotXg(50, 100 - distance));
  });

  it("stays inside (0, 1)", () => {
    const spots: Array<[number, number]> = [
      [50, SIX_YARD_Y],
      [50, 50],
      [50, 0],
      [50, 100],
      [0, 100],
      [100, 0],
      [44.6, 100],
      [79.6, 84.3],
      [20, 90],
    ];
    for (const [x, y] of spots) {
      const value = shotXg(x, y);
      expect(value).toBeGreaterThan(0);
      expect(value).toBeLessThan(1);
    }
  });
});

describe("runTest", () => {
  const stoke = style({
    id: "stoke-2017",
    team: "Stoke",
    passLength: 34,
    xgPerShot: 0.05,
    shotsPerMatch: 12,
    ppda: 15.4,
    pressHeight: 28,
  });

  it("ranks the side copied onto the pass length, the press, and the chance", () => {
    const report = runTest(setup(), [stoke, style()]);
    expect(report.nearestId).toBe("city-2017");
    expect(report.passLength).toBe(15);
    expect(report.pressHeight).toBe(70);
    expect(report.shotsPerMatch).toBe(8);
    expect(report.xgPerShot).toBeCloseTo(shotXg(50, 78));
    expect(report.lines).toEqual([
      "In a sample of possessions, shots are coming from the edge of the area, and they are central.",
      "Passing is short.",
      "The press is high (Manchester City: 8.6 passes the opponent completes before a defensive action).",
    ]);
  });

  it("names the longer passes and stays with the same side", () => {
    const styles = [stoke, style()];
    const before = runTest(setup(), styles);
    const after = runTest(setup({ passLength: 34 }), styles);
    expect(before.nearestId).toBe("city-2017");
    expect(after.nearestId).toBe("city-2017");
    expect(after.xgPerShot).toBeCloseTo(shotXg(50, 78) * 0.92);
    expect(after.lines[0]).toBe(before.lines[0]);
    expect(after.lines[1]).toBe("Passing is direct, longer than Manchester City by 19 yards.");
    expect(after.lines[2]).toBe(before.lines[2]);
    expect(after.lines).toHaveLength(3);
    expect(after.lines.join(" ")).not.toMatch(/Stoke/);
    expect(after.lines.join(" ")).not.toMatch(/very close/i);
    expect(after.lines.join(" ")).not.toMatch(/score/i);
  });

  it("describes the shot location when no styles are passed in", () => {
    const report = runTest(setup({ shotX: 50, shotY: 92, passLength: 14, pressHeight: 36 }), []);
    expect(report.nearestId).toBeNull();
    expect(report.lines[0]).toBe(
      "In a sample of possessions, shots are coming from inside the box, and they are central.",
    );
    expect(report.lines.join(" ")).not.toMatch(/score/i);
    expect(report.lines.length).toBeGreaterThanOrEqual(2);
    expect(report.lines.length).toBeLessThanOrEqual(4);
  });

  it("mentions chance quality only at the extremes", () => {
    const low = runTest(setup({ shotX: 50, shotY: 50 }), []);
    const middle = runTest(setup({ shotX: 50, shotY: 78 }), []);
    const high = runTest(setup({ shotX: 50, shotY: 90 }), []);
    expect(low.xgPerShot).toBeLessThan(0.08);
    expect(low.lines.at(-1)).toMatch(/^The chances are low quality, at \d\.\d\d xG per shot\.$/);
    expect(middle.lines.join(" ")).not.toMatch(/quality/);
    expect(high.xgPerShot).toBeGreaterThan(0.18);
    expect(high.lines.at(-1)).toMatch(/^The chances are high quality, at \d\.\d\d xG per shot\.$/);
  });

  it("calls a wide shot from the halfway line wide and from range", () => {
    const report = runTest(setup({ shotX: 86, shotY: 50 }), []);
    expect(report.lines[0]).toBe(
      "In a sample of possessions, shots are coming from range, and they are wide.",
    );
  });

  it("rounds the shot count to one decimal and caps it at 20", () => {
    expect(runTest(setup({ shotVolume: 1.1, passRisk: 0 }), []).shotsPerMatch).toBe(7.5);
    expect(runTest(setup({ shotVolume: 4, passRisk: 1 }), []).shotsPerMatch).toBe(20);
  });

  it("lowers xG slightly when passes are longer than 25 yards", () => {
    const settled = runTest(setup({ passLength: 25 }), []);
    const direct = runTest(setup({ passLength: 26 }), []);
    expect(settled.xgPerShot).toBeCloseTo(shotXg(50, 78));
    expect(direct.xgPerShot).toBeCloseTo(settled.xgPerShot * 0.92);
  });

  it("names a pass or press gap instead of calling the side very close", () => {
    const report = runTest(setup({ passLength: 19, pressHeight: 70 }), [
      style({ passLength: 15, pressHeight: 55, ppda: 11 }),
    ]);
    const text = report.lines.join(" ");
    expect(text).not.toMatch(/very close/i);
    expect(text).toContain("Passing is mixed, longer than Manchester City by 4 yards.");
    expect(text).toContain("15 higher than Manchester City");
    expect(text.match(/passes the opponent completes before a defensive action/g)).toHaveLength(1);
  });

  it("breaks an equal distance by team name", () => {
    const shared = style({ xgPerShot: shotXg(50, 78), shotsPerMatch: 8, passLength: 15, pressHeight: 70 });
    const report = runTest(setup(), [
      { ...shared, id: "wolves", team: "Wolves" },
      { ...shared, id: "arsenal", team: "Arsenal" },
    ]);
    expect(report.nearestId).toBe("arsenal");
  });

  it("distinguishes a short pass, a mixed pass, and the press bands", () => {
    expect(runTest(setup({ passLength: 15 }), []).lines[1]).toBe("Passing is short.");
    expect(runTest(setup({ passLength: 16 }), []).lines[1]).toBe("Passing is mixed.");
    expect(runTest(setup({ passLength: 22 }), []).lines[1]).toBe("Passing is mixed.");
    expect(runTest(setup({ passLength: 23 }), []).lines[1]).toBe("Passing is direct.");
    expect(runTest(setup({ pressHeight: 62 }), []).lines[2]).toBe("The press is high.");
    expect(runTest(setup({ pressHeight: 61 }), []).lines[2]).toBe("The press is in a mid-block.");
    expect(runTest(setup({ pressHeight: 40 }), []).lines[2]).toBe("The press is deep.");
    expect(runTest(setup({ pressHeight: 41 }), []).lines[2]).toBe("The press is in a mid-block.");
  });
});
