import type { PitchPoint } from "./types";

export const CHANNEL_X = [14, 32, 50, 68, 86] as const;
export const LINE_Y = [8, 24, 40, 54, 69, 86] as const;

const SNAP_DISTANCE = 7;
const MIN_SEPARATION = 7;

export function snapPoint(point: PitchPoint, others: PitchPoint[]): PitchPoint {
  const snapped = nearestIntersection(point) ?? point;
  return separate(clamp(snapped), others);
}

export function nearestIntersection(point: PitchPoint): PitchPoint | null {
  let best: PitchPoint | null = null;
  let bestDistance = SNAP_DISTANCE;
  for (const x of CHANNEL_X) {
    for (const y of LINE_Y) {
      const distance = Math.hypot(point.x - x, point.y - y);
      if (distance <= bestDistance) {
        best = { x, y };
        bestDistance = distance;
      }
    }
  }
  return best;
}

export function separate(point: PitchPoint, others: PitchPoint[]): PitchPoint {
  let current = { ...point };
  for (let attempt = 0; attempt < 8; attempt += 1) {
    const blocking = others.find((other) => distance(current, other) < MIN_SEPARATION);
    if (!blocking) return clamp(current);
    const gap = distance(current, blocking);
    const push = MIN_SEPARATION - gap + 0.1;
    if (gap < 0.01) {
      current = { x: current.x + push, y: current.y };
      continue;
    }
    current = {
      x: current.x + ((current.x - blocking.x) / gap) * push,
      y: current.y + ((current.y - blocking.y) / gap) * push,
    };
  }
  return clamp(current);
}

export function clamp(point: PitchPoint): PitchPoint {
  return {
    x: Math.min(98, Math.max(2, point.x)),
    y: Math.min(98, Math.max(2, point.y)),
  };
}

function distance(a: PitchPoint, b: PitchPoint): number {
  return Math.hypot(a.x - b.x, a.y - b.y);
}
