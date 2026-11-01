import { arrivalPoint } from "./arrival";
import { applyInstructions, type TeamInstructions } from "./instructions";
import type { Line, PitchPoint } from "./types";

/**
 * Where a player tends to be, from the slot, the role, and the team instructions.
 *
 * The role arrival is the same point the role sheet describes. Width and
 * overlap push that point out from the centre, in proportion to how wide the
 * slot already is. The defensive line lifts the whole side, the back line
 * most. Pressing and shooting then lean each player by how much their role
 * hunts the ball or the shot. Passing and tempo change the size of the shade,
 * so a change of instructions moves every player's shade.
 */
export type ArrivalEffect = { x: number; y: number; pressing: number };

const LINE_LIFT: Record<Line, number> = {
  GK: 0.45,
  DEF: 1,
  DM: 0.75,
  CM: 0.45,
  AM: 0.25,
  ST: 0.15,
};

const SHOT_LIFT: Record<Line, number> = {
  GK: 0,
  DEF: 0.1,
  DM: 0.15,
  CM: 0.35,
  AM: 0.8,
  ST: 1,
};

/** A full-back sits 36 units off centre. That channel takes the full width shift. */
const WIDTH_CHANNEL = 36;
const PRESS_PULL = 0.22;
const SHOT_STEP = 26;

export function influencedPoint(
  slot: PitchPoint,
  line: Line,
  role: ArrivalEffect,
  instructions: TeamInstructions,
): PitchPoint {
  const team = applyInstructions(instructions);
  const arrived = arrivalPoint(slot, role);
  const flank = (slot.x - 50) / WIDTH_CHANNEL;
  const pressDelta = team.pressHeight - 50;
  return {
    x: clamp(arrived.x + team.width * flank),
    y: clamp(
      arrived.y +
        team.defensiveLine * LINE_LIFT[line] +
        pressDelta * role.pressing * PRESS_PULL +
        (team.shotVolume - 1) * SHOT_STEP * SHOT_LIFT[line],
    ),
  };
}

/** How far the shade spreads. Standard instructions leave this at 1. */
export function heatSpread(instructions: TeamInstructions): number {
  const team = applyInstructions(instructions);
  const pass = Math.max(-0.2, Math.min(0.4, team.passLength / 40));
  return 1 + pass + team.tempo * 0.18;
}

export type HeatBlob = {
  x: number;
  y: number;
  r: number;
  opacity: number;
};

/** Samples from the slot to the arrival. A selected player gets a longer, stronger trail. */
export function heatBlobs(
  slot: PitchPoint,
  arrival: PitchPoint,
  spread: number,
  focus: boolean,
): HeatBlob[] {
  const steps = focus ? 6 : 3;
  const reach = Math.hypot(arrival.x - slot.x, arrival.y - slot.y);
  const radius = (16 + reach * 0.35) * spread * (focus ? 1.08 : 0.92);
  const blobs: HeatBlob[] = [];
  for (let step = 0; step <= steps; step += 1) {
    const t = step / steps;
    blobs.push({
      x: slot.x + (arrival.x - slot.x) * t,
      y: slot.y + (arrival.y - slot.y) * t,
      r: radius * (0.78 + 0.22 * t),
      opacity: (focus ? 0.62 : 0.32) * (0.5 + 0.5 * t),
    });
  }
  return blobs;
}

function clamp(value: number): number {
  return Math.min(100, Math.max(0, value));
}
