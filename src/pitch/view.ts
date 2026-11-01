import type { PitchPoint } from "../tactics/types";

export const PITCH_VIEW = { width: 68, height: 105 };

export function toView(point: PitchPoint): { x: number; y: number } {
  return {
    x: (point.x / 100) * PITCH_VIEW.width,
    y: ((100 - point.y) / 100) * PITCH_VIEW.height,
  };
}
