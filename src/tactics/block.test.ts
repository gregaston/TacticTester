import { describe, expect, it } from "vitest";
import {
  blockShift,
  engagementAnchor,
  nearestDefensive,
  nearestEngagement,
  shiftedPoint,
  unshiftedPoint,
  STANDARD_ENGAGEMENT_Y,
  STANDARD_LINE_Y,
} from "./block";
import { classifyPoint } from "./positions";
import type { Line } from "./types";

const LINES: Line[] = ["GK", "DEF", "DM", "CM", "AM", "ST"];

describe("blockShift", () => {
  it("leaves every line on its slot when both marks are standard", () => {
    for (const line of LINES) {
      expect(blockShift(line, STANDARD_LINE_Y, STANDARD_ENGAGEMENT_Y)).toBe(0);
    }
  });

  it("steps the goalkeeper and the back line up with a higher defensive line", () => {
    const higher = 38;
    const keeper = shiftedPoint({ x: 50, y: 8 }, "GK", higher, STANDARD_ENGAGEMENT_Y);
    const back = shiftedPoint({ x: 50, y: 24 }, "DEF", higher, STANDARD_ENGAGEMENT_Y);
    const striker = shiftedPoint({ x: 50, y: 86 }, "ST", higher, STANDARD_ENGAGEMENT_Y);
    expect(keeper.y).toBeGreaterThan(8);
    expect(back.y - 24).toBeGreaterThan(keeper.y - 8 - 0.01);
    expect(back.y).toBeGreaterThan(keeper.y);
    expect(striker.y).toBe(86);
  });

  it("drops the goalkeeper and the back line when the defensive line drops", () => {
    const deeper = 12;
    const keeper = shiftedPoint({ x: 50, y: 8 }, "GK", deeper, STANDARD_ENGAGEMENT_Y);
    const back = shiftedPoint({ x: 38, y: 24 }, "DEF", deeper, STANDARD_ENGAGEMENT_Y);
    expect(keeper.y).toBeLessThan(8);
    expect(back.y).toBeLessThan(24);
    expect(keeper.y).toBeLessThan(back.y);
  });

  it("sends the forwards up with engagement and leaves the back line", () => {
    const higher = 86;
    const striker = shiftedPoint({ x: 50, y: 86 }, "ST", STANDARD_LINE_Y, higher);
    const room = shiftedPoint({ x: 50, y: 78 }, "ST", STANDARD_LINE_Y, higher);
    const attack = shiftedPoint({ x: 50, y: 69 }, "AM", STANDARD_LINE_Y, higher);
    const back = shiftedPoint({ x: 50, y: 24 }, "DEF", STANDARD_LINE_Y, higher);
    const keeper = shiftedPoint({ x: 50, y: 8 }, "GK", STANDARD_LINE_Y, higher);
    expect(striker.y).toBe(96);
    expect(room.y - 78).toBeGreaterThan(attack.y - 69);
    expect(attack.y).toBeGreaterThan(69);
    expect(back.y).toBe(24);
    expect(keeper.y).toBe(8);
  });

  it("stretches the side when the line drops and engagement rises, and compresses the other way", () => {
    const stretchedFront = shiftedPoint({ x: 50, y: 86 }, "ST", 12, 86);
    const stretchedBack = shiftedPoint({ x: 50, y: 24 }, "DEF", 12, 86);
    const compactFront = shiftedPoint({ x: 50, y: 86 }, "ST", 38, 56);
    const compactBack = shiftedPoint({ x: 50, y: 24 }, "DEF", 38, 56);
    expect(stretchedFront.y - stretchedBack.y).toBeGreaterThan(86 - 24);
    expect(compactFront.y - compactBack.y).toBeLessThan(86 - 24);
  });
});

describe("unshiftedPoint", () => {
  it("stores the slot under the finger, without the line shift", () => {
    const visual = shiftedPoint({ x: 50, y: 24 }, "DEF", 38, STANDARD_ENGAGEMENT_Y);
    expect(unshiftedPoint(visual, 38, STANDARD_ENGAGEMENT_Y).y).toBeCloseTo(24);
  });

  it("keeps a nudge above a high defensive line in the back line", () => {
    const stored = unshiftedPoint({ x: 38, y: 42 }, 38, STANDARD_ENGAGEMENT_Y);
    expect(stored.y).toBeCloseTo(28);
    expect(classifyPoint(stored).line).toBe("DEF");
  });

  it("reads a point up with the midfield as that midfield band", () => {
    const stored = unshiftedPoint({ x: 50, y: 52 }, 38, STANDARD_ENGAGEMENT_Y);
    expect(classifyPoint(stored).line).toBe("DM");
  });
});

describe("nearest line", () => {
  it("snaps a dragged mark to the nearest option", () => {
    expect(nearestDefensive(20)).toBe("standard");
    expect(nearestDefensive(34)).toBe("higher");
    expect(nearestDefensive(14)).toBe("deeper");
    expect(nearestEngagement(60)).toBe("lower");
    expect(nearestEngagement(80)).toBe("higher");
    expect(engagementAnchor("higher")).toBe(86);
  });
});
