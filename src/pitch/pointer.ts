export type PitchRect = {
  left: number;
  top: number;
  width: number;
  height: number;
};

/** A short drag still moves a player. A selected player needs a clearer pull. */
export const MOVE_SLOP = 10;
export const SELECTED_MOVE_SLOP = 28;

export function dragStarts(distance: number, selected: boolean): boolean {
  return distance >= (selected ? SELECTED_MOVE_SLOP : MOVE_SLOP);
}

export function clientToPitch(
  clientX: number,
  clientY: number,
  rect: PitchRect,
): { x: number; y: number } {
  const x = ((clientX - rect.left) / rect.width) * 100;
  const y = (1 - (clientY - rect.top) / rect.height) * 100;
  return {
    x: Math.min(100, Math.max(0, x)),
    y: Math.min(100, Math.max(0, y)),
  };
}
