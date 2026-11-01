import type { PitchPoint } from "./types";

/**
 * Where a role tends to arrive, measured from the slot.
 * Positive y is toward the opponent goal. Positive x is toward the right
 * touchline, and is mirrored when the slot is on the left (x under 50).
 * A tuck uses a negative x, which already points toward the centre on the right.
 */
export function arrivalPoint(slot: PitchPoint, effect: { x: number; y: number }): PitchPoint {
  const x = slot.x < 50 ? -effect.x : effect.x;
  return {
    x: clamp(slot.x + x),
    y: clamp(slot.y + effect.y),
  };
}

/** A ring is drawn only when the arrival is clearly off the slot. */
export function hasArrivalMark(slot: PitchPoint, arrival: PitchPoint): boolean {
  return Math.hypot(arrival.x - slot.x, arrival.y - slot.y) > 2;
}

/** One line for the role sheet. Null when the arrival stays on the slot. */
export function arrivalNote(slot: PitchPoint, arrival: PitchPoint): string | null {
  if (!hasArrivalMark(slot, arrival)) return null;
  const height = arrival.y > slot.y ? "higher" : arrival.y < slot.y ? "deeper" : null;
  const fromCentre = Math.abs(arrival.x - 50) - Math.abs(slot.x - 50);
  const width = fromCentre < 0 ? "inside" : fromCentre > 0 ? "wider" : null;

  if (height === "higher" && width === "inside") return "Arrives higher and tucks inside from the slot.";
  if (height === "higher" && width === "wider") return "Arrives higher and wider than the slot.";
  if (height === "deeper" && width === "inside") return "Drops deeper and tucks inside from the slot.";
  if (height === "deeper" && width === "wider") return "Drops deeper and wider than the slot.";
  if (height === "higher") return "Arrives higher than the slot.";
  if (height === "deeper") return "Drops deeper than the slot.";
  if (width === "inside") return "Tucks inside from the slot.";
  if (width === "wider") return "Arrives wider than the slot.";
  if (arrival.x !== slot.x) return "Shifts across from the slot.";
  return null;
}

function clamp(value: number): number {
  return Math.min(100, Math.max(0, value));
}
