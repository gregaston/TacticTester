import { describe, expect, it } from "vitest";
import { arrivalPoint } from "./arrival";
import { heatBlobs, heatSpread, influencedPoint } from "./heat";
import { DEFAULT_INSTRUCTIONS, type TeamInstructions } from "./instructions";
import { effectFor } from "./roles";

function instructions(patch: Partial<TeamInstructions>): TeamInstructions {
  return { ...DEFAULT_INSTRUCTIONS, ...patch };
}

describe("influencedPoint", () => {
  const fullBack = effectFor("full-back", "support");

  it("matches the role arrival when every instruction is standard", () => {
    const slot = { x: 14, y: 24 };
    expect(influencedPoint(slot, "DEF", fullBack, DEFAULT_INSTRUCTIONS)).toEqual(
      arrivalPoint(slot, fullBack),
    );
  });

  it("pushes wide players further out when the side plays wider or overlaps", () => {
    const left = { x: 14, y: 24 };
    const right = { x: 86, y: 24 };
    const standardLeft = influencedPoint(left, "DEF", fullBack, DEFAULT_INSTRUCTIONS);
    const standardRight = influencedPoint(right, "DEF", fullBack, DEFAULT_INSTRUCTIONS);
    const widerLeft = influencedPoint(left, "DEF", fullBack, instructions({ width: "wider" }));
    const widerRight = influencedPoint(right, "DEF", fullBack, instructions({ width: "wider" }));
    expect(widerLeft.x).toBeLessThan(standardLeft.x);
    expect(widerRight.x).toBeGreaterThan(standardRight.x);
    const overlap = influencedPoint(left, "DEF", fullBack, instructions({ widthIntention: "overlap" }));
    const underlap = influencedPoint(left, "DEF", fullBack, instructions({ widthIntention: "underlap" }));
    expect(overlap.x).toBeLessThan(underlap.x);
  });

  it("lifts the back line more than the forwards when the line steps up", () => {
    const role = { x: 0, y: 0, pressing: 0.2 };
    const higher = instructions({ defensiveLine: "higher" });
    const back = influencedPoint({ x: 50, y: 24 }, "DEF", role, higher).y;
    const backBase = influencedPoint({ x: 50, y: 24 }, "DEF", role, DEFAULT_INSTRUCTIONS).y;
    const front = influencedPoint({ x: 50, y: 86 }, "ST", role, higher).y;
    const frontBase = influencedPoint({ x: 50, y: 86 }, "ST", role, DEFAULT_INSTRUCTIONS).y;
    expect(back - backBase).toBeGreaterThan(front - frontBase);
    expect(front).toBeGreaterThan(frontBase);
  });

  it("moves a hunter further up than a calm player when the press steps up", () => {
    const slot = { x: 50, y: 40 };
    const pressing = instructions({ pressing: "more", engagement: "higher" });
    const calm = influencedPoint(slot, "DM", { x: 0, y: 0, pressing: 0.15 }, pressing);
    const hunter = influencedPoint(slot, "DM", { x: 0, y: 0, pressing: 0.9 }, pressing);
    const hunterBase = influencedPoint(slot, "DM", { x: 0, y: 0, pressing: 0.9 }, DEFAULT_INSTRUCTIONS);
    expect(hunter.y).toBeGreaterThan(calm.y);
    expect(hunter.y).toBeGreaterThan(hunterBase.y);
  });

  it("sends shoot-on-sight forwards higher than a side that works the ball", () => {
    const slot = { x: 50, y: 86 };
    const role = effectFor("advanced-forward", "support");
    const sight = influencedPoint(slot, "ST", role, instructions({ shooting: "shoot on sight" }));
    const worked = influencedPoint(slot, "ST", role, instructions({ shooting: "work the ball" }));
    expect(sight.y).toBeGreaterThan(worked.y);
  });
});

describe("heatSpread", () => {
  it("grows with longer passing, a higher tempo, and direct distribution", () => {
    const standard = heatSpread(DEFAULT_INSTRUCTIONS);
    expect(heatSpread(instructions({ passing: "more direct" }))).toBeGreaterThan(standard);
    expect(heatSpread(instructions({ passing: "shorter" }))).toBeLessThan(standard);
    expect(heatSpread(instructions({ tempo: "higher" }))).toBeGreaterThan(
      heatSpread(instructions({ tempo: "lower" })),
    );
    expect(heatSpread(instructions({ distribution: "go long" }))).toBeGreaterThan(
      heatSpread(instructions({ distribution: "play out" })),
    );
  });
});

describe("heatBlobs", () => {
  const slot = { x: 14, y: 24 };
  const arrival = { x: 8, y: 40 };

  it("trails from the slot to the arrival, stronger when that player is selected", () => {
    const team = heatBlobs(slot, arrival, 1, false);
    const focus = heatBlobs(slot, arrival, 1, true);
    expect(team[0]).toMatchObject({ x: slot.x, y: slot.y });
    expect(team[team.length - 1]).toMatchObject({ x: arrival.x, y: arrival.y });
    expect(focus.length).toBeGreaterThan(team.length);
    expect(focus[focus.length - 1].opacity).toBeGreaterThan(team[team.length - 1].opacity);
    expect(heatBlobs(slot, arrival, 1.3, false)[0].r).toBeGreaterThan(team[0].r);
  });
});
