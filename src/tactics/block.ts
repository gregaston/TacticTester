import type { Engagement, LineHeight } from "./instructions";
import { LINE_CENTRES } from "./positions";
import type { Line, PitchPoint } from "./types";

/**
 * The two lines that set the block.
 *
 * The defensive line is where the back line and the goalkeeper sit. Engagement
 * is the height of the press, in the attacking half. Midfielders share the
 * space between them, so raising one and dropping the other stretches the
 * side, and bringing them together compresses it. Standard lines leave every
 * player on the slot they were given.
 */
export const STANDARD_LINE_Y = 24;
export const STANDARD_ENGAGEMENT_Y = 70;

export const DEFENSIVE_STOPS: { value: LineHeight; label: string; face: string; y: number }[] = [
  { value: "deeper", label: "Deeper", face: "Deep", y: 12 },
  { value: "standard", label: "Standard", face: "Std", y: STANDARD_LINE_Y },
  { value: "higher", label: "Higher", face: "High", y: 38 },
];

export const ENGAGEMENT_STOPS: { value: Engagement; label: string; face: string; y: number }[] = [
  { value: "lower", label: "Lower", face: "Low", y: 56 },
  { value: "standard", label: "Standard", face: "Std", y: STANDARD_ENGAGEMENT_Y },
  { value: "higher", label: "Higher", face: "High", y: 86 },
];

const WEIGHT: Record<Line, { line: number; engage: number }> = {
  GK: { line: 1, engage: 0 },
  DEF: { line: 1, engage: 0 },
  DM: { line: 0.65, engage: 0.15 },
  CM: { line: 0.28, engage: 0.42 },
  AM: { line: 0.08, engage: 0.78 },
  ST: { line: 0, engage: 1 },
};

export function defensiveAnchor(value: LineHeight): number {
  return DEFENSIVE_STOPS.find((stop) => stop.value === value)?.y ?? STANDARD_LINE_Y;
}

export function engagementAnchor(value: Engagement): number {
  return ENGAGEMENT_STOPS.find((stop) => stop.value === value)?.y ?? STANDARD_ENGAGEMENT_Y;
}

export function nearestDefensive(y: number): LineHeight {
  return nearest(y, DEFENSIVE_STOPS);
}

export function nearestEngagement(y: number): Engagement {
  return nearest(y, ENGAGEMENT_STOPS);
}

/** Pitch-y added to a slot. Zero when both lines are on their standard marks. */
export function blockShift(line: Line, defensiveY: number, engagementY: number): number {
  const weight = WEIGHT[line];
  return (defensiveY - STANDARD_LINE_Y) * weight.line + (engagementY - STANDARD_ENGAGEMENT_Y) * weight.engage;
}

export function shiftedPoint(
  slot: PitchPoint,
  line: Line,
  defensiveY: number,
  engagementY: number,
): PitchPoint {
  return {
    x: slot.x,
    y: clamp(slot.y + blockShift(line, defensiveY, engagementY)),
  };
}

const LINES: Line[] = ["GK", "DEF", "DM", "CM", "AM", "ST"];

/**
 * The band whose shifted home is nearest the finger.
 * A high line draws the back four beside the defensive-midfield slots, so the
 * drawn point is not a reliable label for the slot underneath it.
 */
function lineAt(y: number, defensiveY: number, engagementY: number): Line {
  return LINES.reduce((best, line) => {
    const home = LINE_CENTRES[line] + blockShift(line, defensiveY, engagementY);
    const bestHome = LINE_CENTRES[best] + blockShift(best, defensiveY, engagementY);
    return Math.abs(y - home) < Math.abs(y - bestHome) ? line : best;
  });
}

/** A finger on the drawn pitch, turned back into the stored slot. */
export function unshiftedPoint(visual: PitchPoint, defensiveY: number, engagementY: number): PitchPoint {
  const line = lineAt(visual.y, defensiveY, engagementY);
  return { x: visual.x, y: clamp(visual.y - blockShift(line, defensiveY, engagementY)) };
}

function nearest<T extends string>(y: number, stops: { value: T; y: number }[]): T {
  return stops.reduce((best, stop) => (Math.abs(stop.y - y) < Math.abs(best.y - y) ? stop : best)).value;
}

/** Leaves room for the token disc, which is about four pitch units across. */
function clamp(value: number): number {
  return Math.min(96, Math.max(4, value));
}
