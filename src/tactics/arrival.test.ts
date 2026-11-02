import { describe, expect, it } from "vitest";
import { effectFor } from "./roles";
import { SLOTS } from "./slots";
import { arrivalNote, arrivalPoint, hasArrivalMark } from "./arrival";

describe("arrivalPoint", () => {
  it("mirrors a negative x so a left winger tucks toward the centre", () => {
    const slot = SLOTS.LW;
    const effect = effectFor("inside-forward");
    expect(effect.x).toBeLessThan(0);
    expect(arrivalPoint(slot, effect)).toEqual({ x: slot.x - effect.x, y: slot.y + effect.y });
    const arrival = arrivalPoint({ x: 14, y: 72 }, { x: -8, y: 12 });
    expect(arrival).toEqual({ x: 22, y: 84 });
    expect(arrival.x).toBeGreaterThan(14);
    expect(Math.abs(arrival.x - 50)).toBeLessThan(Math.abs(14 - 50));
  });

  it("keeps a positive x so a right full-back moves toward the right touchline", () => {
    const slot = SLOTS.DR;
    const effect = effectFor("full-back");
    expect(effect.x).toBeGreaterThan(0);
    expect(arrivalPoint(slot, effect)).toEqual({ x: slot.x + effect.x, y: slot.y + effect.y });
    const arrival = arrivalPoint({ x: 86, y: 24 }, { x: 6, y: 8 });
    expect(arrival).toEqual({ x: 92, y: 32 });
    expect(arrival.x).toBeGreaterThan(86);
  });

  it("mirrors a positive x for a player on the left and does not mirror the centre", () => {
    expect(arrivalPoint({ x: 14, y: 24 }, { x: 6, y: 8 })).toEqual({ x: 8, y: 32 });
    expect(arrivalPoint({ x: 50, y: 54 }, { x: 8, y: 4 })).toEqual({ x: 58, y: 58 });
  });

  it("clamps the arrival to the pitch", () => {
    expect(arrivalPoint({ x: 90, y: 96 }, { x: 20, y: 20 })).toEqual({ x: 100, y: 100 });
    expect(arrivalPoint({ x: 8, y: 4 }, { x: 20, y: -10 })).toEqual({ x: 0, y: 0 });
    expect(arrivalPoint({ x: 86, y: 8 }, { x: -4, y: -20 })).toEqual({ x: 82, y: 0 });
  });
});

describe("hasArrivalMark", () => {
  it("stays quiet within two pitch units and marks anything further", () => {
    const slot = { x: 50, y: 24 };
    expect(hasArrivalMark(slot, { x: 50, y: 26 })).toBe(false);
    expect(hasArrivalMark(slot, { x: 50, y: 24 })).toBe(false);
    expect(hasArrivalMark(slot, { x: 51, y: 25 })).toBe(false);
    expect(hasArrivalMark(slot, { x: 50, y: 26.1 })).toBe(true);
    expect(hasArrivalMark(slot, { x: 50, y: 18 })).toBe(true);
  });
});

describe("arrivalNote", () => {
  it("names height, a tuck, and both when the arrival leaves the slot", () => {
    expect(arrivalNote({ x: 50, y: 86 }, { x: 50, y: 100 })).toBe("Arrives higher than the slot.");
    expect(arrivalNote({ x: 38, y: 24 }, { x: 38, y: 18 })).toBe("Drops deeper than the slot.");
    expect(arrivalNote({ x: 86, y: 72 }, { x: 77, y: 72 })).toBe("Tucks inside from the slot.");
    expect(arrivalNote({ x: 14, y: 72 }, { x: 22, y: 72 })).toBe("Tucks inside from the slot.");
    expect(arrivalNote({ x: 14, y: 72 }, { x: 22, y: 84 })).toBe(
      "Arrives higher and tucks inside from the slot.",
    );
    expect(arrivalNote({ x: 86, y: 24 }, { x: 92, y: 32 })).toBe(
      "Arrives higher and wider than the slot.",
    );
    expect(arrivalNote({ x: 86, y: 24 }, { x: 84, y: 18 })).toBe(
      "Drops deeper and tucks inside from the slot.",
    );
    expect(arrivalNote({ x: 14, y: 24 }, { x: 8, y: 18 })).toBe(
      "Drops deeper and wider than the slot.",
    );
    expect(arrivalNote({ x: 86, y: 72 }, { x: 98, y: 72 })).toBe("Arrives wider than the slot.");
    expect(arrivalNote({ x: 40, y: 54 }, { x: 60, y: 54 })).toBe("Shifts across from the slot.");
    expect(arrivalNote({ x: 50, y: 54 }, { x: 50, y: 54 })).toBeNull();
    expect(arrivalNote({ x: 50, y: 24 }, { x: 50, y: 25 })).toBeNull();
  });
});
