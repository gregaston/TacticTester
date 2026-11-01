import type { PointerEvent } from "react";
import type { PlayerLabel } from "../tactics/positions";
import type { Player } from "../tactics/types";
import { toView } from "./view";

type TokenProps = {
  player: Player;
  label: PlayerLabel;
  selected: boolean;
  onSelect: () => void;
  onGrab: (event: PointerEvent<SVGGElement>) => void;
};

export function Token({ player, label, selected, onSelect, onGrab }: TokenProps) {
  const { x, y } = toView(player);

  return (
    <g
      className={selected ? "token selected" : "token"}
      transform={`translate(${x} ${y})`}
      role="button"
      tabIndex={0}
      aria-label={label.alternateName ? `${label.name}, or ${label.alternateName}` : label.name}
      aria-pressed={selected}
      onPointerDown={(event) => {
        event.preventDefault();
        onSelect();
        onGrab(event);
      }}
    >
      <circle className="hit" r="5.6" />
      <circle className="disc" r="3.1" />
      <text>{label.code}</text>
    </g>
  );
}
