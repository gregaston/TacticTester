import { describe, expect, it } from "vitest";
import { arrivalPoint } from "./arrival";
import { heatColor, heatField, heatPeak, heatSpread, heatValue, influencedPoint } from "./heat";
import { STANDARD_ENGAGEMENT_Y, STANDARD_LINE_Y } from "./block";
import { DEFAULT_INSTRUCTIONS, type TeamInstructions } from "./instructions";
import { effectFor } from "./roles";

function instructions(patch: Partial<TeamInstructions>): TeamInstructions {
  return { ...DEFAULT_INSTRUCTIONS, ...patch };
}

describe("influencedPoint", () => {
  const fullBack = effectFor("full-back");

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

  it("leaves the defensive line and engagement to move the slot itself", () => {
    const role = { x: 0, y: 0, pressing: 0.2 };
    const slot = { x: 50, y: 24 };
    const base = influencedPoint(slot, "DEF", role, DEFAULT_INSTRUCTIONS).y;
    expect(influencedPoint(slot, "DEF", role, instructions({ defensiveLine: "higher" })).y).toBe(base);
    expect(influencedPoint(slot, "DEF", role, instructions({ engagement: "higher" })).y).toBe(base);
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
    const role = effectFor("advanced-forward");
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

const lines = { defensiveY: STANDARD_LINE_Y, engagementY: STANDARD_ENGAGEMENT_Y };

function source(
  roleId: Parameters<typeof heatField>[0][number]["roleId"],
  point: { x: number; y: number },
  line: Parameters<typeof heatField>[0][number]["line"] = "DEF",
) {
  return { ...point, line, roleId };
}

describe("heatField", () => {
  it("keeps a wing-back on the wing from one box to the other", () => {
    const field = heatField([source("wing-back", { x: 14, y: 24 })], DEFAULT_INSTRUCTIONS, lines);
    const wingDeep = heatValue(field, 6, 20);
    const wingHigh = heatValue(field, 6, 72);
    expect(wingDeep).toBeGreaterThan(0.45);
    expect(wingHigh).toBeGreaterThan(0.45);
    expect(wingDeep).toBeGreaterThan(heatValue(field, 50, 20) * 4);
    expect(heatValue(field, 6, 78)).toBeGreaterThan(heatValue(field, 32, 78));
  });

  it("keeps a full-back wide and deeper than a wing-back", () => {
    const full = heatField([source("full-back", { x: 14, y: 24 })], DEFAULT_INSTRUCTIONS, lines);
    const wing = heatField([source("wing-back", { x: 14, y: 24 })], DEFAULT_INSTRUCTIONS, lines);
    expect(heatValue(full, 6, 22)).toBeGreaterThan(heatValue(full, 6, 78));
    expect(heatValue(wing, 6, 72)).toBeGreaterThan(heatValue(full, 6, 72));
  });

  it("tucks an inverted wing-back inside the wing stripe", () => {
    const wing = heatField([source("wing-back", { x: 14, y: 24 })], DEFAULT_INSTRUCTIONS, lines);
    const inverted = heatField(
      [source("inverted-wing-back", { x: 14, y: 24 })],
      DEFAULT_INSTRUCTIONS,
      lines,
    );
    expect(heatPeak(inverted).x).toBeGreaterThan(heatPeak(wing).x + 8);
  });

  it("holds a centre-back in the defensive channel and a poacher in the box", () => {
    const back = heatField([source("centre-back", { x: 50, y: 24 })], DEFAULT_INSTRUCTIONS, lines);
    const poacher = heatField(
      [source("poacher", { x: 50, y: 86 }, "ST")],
      DEFAULT_INSTRUCTIONS,
      lines,
    );
    const nine = heatField(
      [source("false-nine", { x: 50, y: 86 }, "ST")],
      DEFAULT_INSTRUCTIONS,
      lines,
    );
    expect(heatPeak(back).y).toBeLessThan(45);
    expect(heatValue(back, 50, 24)).toBeGreaterThan(heatValue(back, 8, 24));
    expect(heatPeak(poacher).y).toBeGreaterThan(heatPeak(nine).y + 8);
    expect(heatPeak(poacher).y).toBeGreaterThan(80);
  });

  it("follows the slot the user dragged", () => {
    const home = heatField([source("centre-back", { x: 50, y: 24 })], DEFAULT_INSTRUCTIONS, lines);
    const stepped = heatField([source("centre-back", { x: 50, y: 42 })], DEFAULT_INSTRUCTIONS, lines);
    expect(heatPeak(stepped).y).toBeGreaterThan(heatPeak(home).y + 10);
  });

  it("adds covering players instead of painting the same red twice", () => {
    const one = heatField([source("central-midfielder", { x: 50, y: 54 }, "CM")], DEFAULT_INSTRUCTIONS, lines);
    const two = heatField(
      [
        source("central-midfielder", { x: 50, y: 54 }, "CM"),
        source("central-midfielder", { x: 50, y: 54 }, "CM"),
      ],
      DEFAULT_INSTRUCTIONS,
      lines,
    );
    const spot = heatValue(one, 50, 54);
    expect(heatValue(two, 50, 54)).toBeGreaterThan(spot * 1.7);
    expect(heatColor(heatValue(two, 50, 54)).g).toBeGreaterThan(heatColor(spot).g);
  });

  it("moves a wide footprint out when the side plays wider", () => {
    const slot = { x: 14, y: 24 };
    const standard = heatPeak(heatField([source("full-back", slot)], DEFAULT_INSTRUCTIONS, lines));
    const wider = heatPeak(
      heatField([source("full-back", slot)], instructions({ width: "wider" }), lines),
    );
    expect(wider.x).toBeLessThan(standard.x);
  });

  it("lifts a hunter when the press steps up, and a finisher when the side shoots", () => {
    const slot = { x: 50, y: 86 };
    const calm = heatPeak(
      heatField(
        [source("pressing-forward", slot, "ST")],
        instructions({ pressing: "less" }),
        lines,
      ),
    );
    const hunter = heatPeak(
      heatField(
        [source("pressing-forward", slot, "ST")],
        instructions({ pressing: "more" }),
        lines,
      ),
    );
    expect(hunter.y).toBeGreaterThan(calm.y);
    const worked = heatPeak(
      heatField(
        [source("advanced-forward", slot, "ST")],
        instructions({ shooting: "work the ball" }),
        lines,
      ),
    );
    const sight = heatPeak(
      heatField(
        [source("advanced-forward", slot, "ST")],
        instructions({ shooting: "shoot on sight" }),
        lines,
      ),
    );
    expect(sight.y).toBeGreaterThan(worked.y);
  });

  it("lengthens a wing-back when the block is stretched", () => {
    const player = source("wing-back", { x: 14, y: 24 });
    const stretched = heatField([player], DEFAULT_INSTRUCTIONS, { defensiveY: 12, engagementY: 86 });
    const compact = heatField([player], DEFAULT_INSTRUCTIONS, { defensiveY: 38, engagementY: 56 });
    expect(heatValue(stretched, 6, 84)).toBeGreaterThan(heatValue(compact, 6, 84));
  });
});

describe("heatColor", () => {
  it("runs from blue through red to white as coverage stacks", () => {
    const cool = heatColor(0.12);
    const hot = heatColor(0.86);
    const stacked = heatColor(1.55);
    expect(heatColor(0).a).toBe(0);
    expect(cool.b).toBeGreaterThan(cool.r);
    expect(hot.r).toBeGreaterThan(hot.b + 40);
    expect(stacked.g).toBeGreaterThan(hot.g + 40);
    expect(stacked.r).toBeGreaterThan(220);
  });
});
