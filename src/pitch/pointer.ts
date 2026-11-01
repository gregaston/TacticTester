export type PitchRect = {
  left: number;
  top: number;
  width: number;
  height: number;
};

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
