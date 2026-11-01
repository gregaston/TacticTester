import type { PitchPoint } from "../tactics/types";
import { toView } from "./view";

export function Arrival({ point }: { point: PitchPoint }) {
  const { x, y } = toView(point);
  return (
    <circle className="arrival" cx={x} cy={y} r="1.75" pointerEvents="none" aria-hidden="true" />
  );
}
