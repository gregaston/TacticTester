import { arrivalPoint } from "./arrival";
import { applyInstructions, pressNudge, type TeamInstructions } from "./instructions";
import { effectFor, type Duty, type RoleId } from "./roles";
import type { Line, PitchPoint } from "./types";

/**
 * A 90-minute footprint, then the point the role sheet describes.
 *
 * Match heatmaps (tracking and GPS) paint time-on-pitch: blue or green where a
 * player barely was, yellow in the middle, red where they spent the match, and
 * white where several of those maps sit on top of each other. The shape under
 * that colour is the role. A wing-back is a strip up the wing. A poacher is a
 * tight patch in the box. A false nine's mass sits in the hole.
 *
 * The slot is already where the defensive line, the engagement line, and the
 * user's drag have placed them. Width, pressing, shooting, and the gap between
 * the two lines then stretch that footprint.
 */
export type ArrivalEffect = { x: number; y: number; pressing: number };

const SHOT_LIFT: Record<Line, number> = {
  GK: 0,
  DEF: 0.1,
  DM: 0.15,
  CM: 0.35,
  AM: 0.8,
  ST: 1,
};

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
  return {
    x: clampUnit(arrived.x + team.width * flank),
    y: clampUnit(
      arrived.y +
        pressNudge(instructions) * role.pressing * PRESS_PULL +
        (team.shotVolume - 1) * SHOT_STEP * SHOT_LIFT[line],
    ),
  };
}

/** How far a footprint spreads. Standard instructions leave this at 1. */
export function heatSpread(instructions: TeamInstructions): number {
  const team = applyInstructions(instructions);
  const pass = Math.max(-0.2, Math.min(0.4, team.passLength / 40));
  return 1 + pass + team.tempo * 0.18;
}

export const HEAT_COLS = 68;
export const HEAT_ROWS = 105;

export type HeatSource = {
  x: number;
  y: number;
  line: Line;
  roleId: RoleId;
  duty: Duty;
};

type Kernel = { dx: number; dy: number; sx: number; sy: number; w: number };

/** dx is toward the touchline. The left side mirrors it. */
const FOOTPRINTS: Record<RoleId, Kernel[]> = {
  goalkeeper: [k(0, -2, 7, 3.2, 0.92)],
  "sweeper-keeper": [k(0, -1, 7, 3.4, 0.7), k(0, 9, 6.5, 6.5, 0.48)],
  "centre-back": [k(0, 0, 8, 8, 0.88), k(0, 8, 7, 6, 0.22)],
  "ball-playing-defender": [k(0, 1, 8.5, 10, 0.84), k(0, 10, 7, 6, 0.24)],
  "no-nonsense-centre-back": [k(0, -1, 7, 6.5, 0.92)],
  "covering-centre-back": [k(0, -6, 8, 7, 0.9)],
  stopper: [k(0, 2, 7.5, 7, 0.62), k(0, 12, 6.5, 7, 0.48)],
  "full-back": [k(7, -2, 6, 11, 0.9), k(8, 14, 5.5, 9, 0.42), k(8, 30, 5, 8, 0.18)],
  "wing-back": [k(8, -8, 5.5, 14, 0.78), k(8, 16, 5.5, 15, 0.78), k(8, 42, 5.2, 14, 0.74)],
  "inverted-wing-back": [k(4, -2, 5.5, 9, 0.4), k(-16, 8, 8, 11, 0.86)],
  "defensive-midfielder": [k(0, 0, 11, 9, 0.88)],
  "deep-lying-playmaker": [k(0, 2, 11, 10, 0.84)],
  "ball-winning-midfielder": [k(0, 2, 13, 12, 0.82)],
  "half-back": [k(0, -12, 8, 6.5, 0.9)],
  regista: [k(0, 2, 10, 10, 0.8), k(0, 8, 12, 7, 0.28)],
  "segundo-volante": [k(0, -6, 8, 8, 0.55), k(0, 16, 8, 16, 0.62)],
  "central-midfielder": [k(0, 0, 10, 10, 0.86)],
  "box-to-box": [k(0, -10, 8, 12, 0.58), k(0, 16, 8, 14, 0.62)],
  mezzala: [k(12, 6, 7.5, 13, 0.84)],
  "attacking-midfielder": [k(0, 2, 9, 8, 0.88)],
  "advanced-playmaker": [k(0, 1, 11, 9, 0.8)],
  "shadow-striker": [k(0, 6, 7, 7, 0.55), k(0, 16, 6.5, 6, 0.5)],
  enganche: [k(0, 0, 6.5, 5.5, 0.92)],
  winger: [k(10, 2, 5, 13, 0.86), k(8, -14, 5, 8, 0.28)],
  "inverted-winger": [k(-10, 4, 7.5, 11, 0.72), k(7, 0, 4.5, 9, 0.32)],
  "inside-forward": [k(-12, 8, 6.5, 9, 0.8), k(5, -2, 4.5, 7, 0.22)],
  raumdeuter: [k(-8, 12, 7, 8, 0.74), k(2, 2, 6, 8, 0.28)],
  "advanced-forward": [k(0, 3, 8, 7, 0.78), k(0, 11, 6, 5, 0.32)],
  "deep-lying-forward": [k(0, -10, 9, 8, 0.72), k(0, 2, 7, 6, 0.32)],
  "pressing-forward": [k(0, 0, 8, 12, 0.82)],
  "target-forward": [k(0, 0, 9, 6.5, 0.9)],
  poacher: [k(0, 7, 5.5, 4.2, 0.94)],
  "false-nine": [k(0, -14, 9, 8, 0.74), k(0, 1, 7, 6, 0.3)],
};

const STANDARD_GAP = 46;

export function heatField(
  players: HeatSource[],
  instructions: TeamInstructions,
  lines: { defensiveY: number; engagementY: number },
): Float32Array {
  const field = new Float32Array(HEAT_COLS * HEAT_ROWS);
  const team = applyInstructions(instructions);
  const press = pressNudge(instructions);
  const size = Math.max(0.72, Math.min(1.28, heatSpread(instructions)));
  const stretch = (lines.engagementY - lines.defensiveY) / STANDARD_GAP;

  for (const player of players) {
    const support = effectFor(player.roleId, "support");
    const played = effectFor(player.roleId, player.duty);
    const outward = player.x < 50 ? -1 : 1;
    const flank = (player.x - 50) / WIDTH_CHANNEL;
    const widthPush = team.width * flank * 0.7;
    const shiftX = (played.x - support.x) * 0.55;
    const shiftY = (played.y - support.y) * 0.65;
    const pressLift = press * played.pressing * 0.5;
    const shotLift = (team.shotVolume - 1) * 32 * SHOT_LIFT[player.line];
    for (const kernel of FOOTPRINTS[player.roleId]) {
      const long = kernel.sy >= 11;
      const lengthScale = long ? 0.55 + 0.45 * stretch : 0.9 + 0.1 * stretch;
      const wide = Math.abs(player.x - 50) > 18;
      const sxScale = wide ? 1 - team.width * 0.01 : 1 + Math.abs(team.width) * 0.006;
      addKernel(field, {
        cx: player.x + outward * (kernel.dx + shiftX) + widthPush,
        cy: player.y + kernel.dy + shiftY + pressLift + shotLift,
        sx: Math.max(3.2, kernel.sx * size * Math.max(0.75, sxScale)),
        sy: Math.max(2.6, kernel.sy * size * Math.max(0.65, lengthScale)),
        w: kernel.w,
      });
    }
  }
  return blur(field);
}

export function heatValue(field: Float32Array, x: number, y: number): number {
  const col = Math.min(HEAT_COLS - 1, Math.max(0, Math.floor((x / 100) * HEAT_COLS)));
  const row = Math.min(HEAT_ROWS - 1, Math.max(0, Math.floor(((100 - y) / 100) * HEAT_ROWS)));
  return field[row * HEAT_COLS + col];
}

export function heatPeak(field: Float32Array): { x: number; y: number; value: number } {
  let best = 0;
  let index = 0;
  for (let i = 0; i < field.length; i += 1) {
    if (field[i] > best) {
      best = field[i];
      index = i;
    }
  }
  const col = index % HEAT_COLS;
  const row = Math.floor(index / HEAT_COLS);
  return {
    x: ((col + 0.5) / HEAT_COLS) * 100,
    y: 100 - ((row + 0.5) / HEAT_ROWS) * 100,
    value: best,
  };
}

export type HeatColor = { r: number; g: number; b: number; a: number };

/**
 * Blue and green are time barely spent. Yellow is the middle. Red is where
 * one player spends the match. White is that red added to another player's red.
 */
const COLOR_STOPS: { t: number; r: number; g: number; b: number; a: number }[] = [
  { t: 0, r: 0, g: 0, b: 0, a: 0 },
  { t: 0.08, r: 16, g: 52, b: 150, a: 120 },
  { t: 0.2, r: 18, g: 140, b: 176, a: 165 },
  { t: 0.36, r: 46, g: 168, b: 72, a: 190 },
  { t: 0.52, r: 230, g: 206, b: 42, a: 210 },
  { t: 0.68, r: 240, g: 126, b: 22, a: 225 },
  { t: 0.84, r: 214, g: 32, b: 24, a: 238 },
  { t: 1.05, r: 255, g: 64, b: 36, a: 246 },
  { t: 1.5, r: 255, g: 236, b: 214, a: 252 },
];

export function heatColor(density: number): HeatColor {
  if (density <= 0) return { r: 0, g: 0, b: 0, a: 0 };
  const last = COLOR_STOPS[COLOR_STOPS.length - 1];
  if (density >= last.t) return { r: last.r, g: last.g, b: last.b, a: last.a };
  let upper = COLOR_STOPS[1];
  let lower = COLOR_STOPS[0];
  for (let i = 1; i < COLOR_STOPS.length; i += 1) {
    if (density <= COLOR_STOPS[i].t) {
      upper = COLOR_STOPS[i];
      lower = COLOR_STOPS[i - 1];
      break;
    }
  }
  const span = upper.t - lower.t || 1;
  const mix = (density - lower.t) / span;
  return {
    r: Math.round(lower.r + (upper.r - lower.r) * mix),
    g: Math.round(lower.g + (upper.g - lower.g) * mix),
    b: Math.round(lower.b + (upper.b - lower.b) * mix),
    a: Math.round(lower.a + (upper.a - lower.a) * mix),
  };
}

function k(dx: number, dy: number, sx: number, sy: number, w: number): Kernel {
  return { dx, dy, sx, sy, w };
}

function addKernel(
  field: Float32Array,
  kernel: { cx: number; cy: number; sx: number; sy: number; w: number },
): void {
  const reachX = kernel.sx * 3;
  const reachY = kernel.sy * 3;
  const col0 = Math.max(0, Math.floor(((kernel.cx - reachX) / 100) * HEAT_COLS));
  const col1 = Math.min(HEAT_COLS - 1, Math.ceil(((kernel.cx + reachX) / 100) * HEAT_COLS));
  const row0 = Math.max(0, Math.floor(((100 - (kernel.cy + reachY)) / 100) * HEAT_ROWS));
  const row1 = Math.min(HEAT_ROWS - 1, Math.ceil(((100 - (kernel.cy - reachY)) / 100) * HEAT_ROWS));
  for (let row = row0; row <= row1; row += 1) {
    const y = 100 - ((row + 0.5) / HEAT_ROWS) * 100;
    const ny = (y - kernel.cy) / kernel.sy;
    for (let col = col0; col <= col1; col += 1) {
      const x = ((col + 0.5) / HEAT_COLS) * 100;
      const nx = (x - kernel.cx) / kernel.sx;
      const dist = nx * nx + ny * ny;
      if (dist > 9) continue;
      field[row * HEAT_COLS + col] += kernel.w * Math.exp(-0.5 * dist);
    }
  }
}

function blur(field: Float32Array): Float32Array {
  const next = new Float32Array(field.length);
  for (let row = 0; row < HEAT_ROWS; row += 1) {
    for (let col = 0; col < HEAT_COLS; col += 1) {
      let total = 0;
      let weight = 0;
      for (let dy = -1; dy <= 1; dy += 1) {
        const y = row + dy;
        if (y < 0 || y >= HEAT_ROWS) continue;
        for (let dx = -1; dx <= 1; dx += 1) {
          const x = col + dx;
          if (x < 0 || x >= HEAT_COLS) continue;
          const kernel = dx === 0 && dy === 0 ? 4 : dx === 0 || dy === 0 ? 2 : 1;
          total += field[y * HEAT_COLS + x] * kernel;
          weight += kernel;
        }
      }
      next[row * HEAT_COLS + col] = total / weight;
    }
  }
  return next;
}

function clampUnit(value: number): number {
  return Math.min(100, Math.max(0, value));
}
