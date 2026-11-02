import type { PointerEvent } from "react";
import type { PlayerLabel } from "../tactics/positions";
import type { Player } from "../tactics/types";
import { toView } from "./view";

type TokenProps = {
  player: Player;
  label: PlayerLabel;
  mark: string;
  roleName: string;
  selected: boolean;
  onGrab: (event: PointerEvent<SVGGElement>) => void;
  onTap: () => void;
};

export function Token({ player, label, mark, roleName, selected, onGrab, onTap }: TokenProps) {
  const { x, y } = toView(player);
  const position = label.alternateName ? `${label.name}, or ${label.alternateName}` : label.name;

  return (
    <g
      className={selected ? "token selected" : "token"}
      transform={`translate(${x} ${y})`}
      role="button"
      tabIndex={0}
      data-mark={mark}
      aria-label={`${position}, ${roleName}`}
      aria-pressed={selected}
      onPointerDown={(event) => {
        event.preventDefault();
        onGrab(event);
      }}
      onKeyDown={(event) => {
        if (event.key !== "Enter" && event.key !== " ") return;
        event.preventDefault();
        onTap();
      }}
    >
      <circle className="hit" r="5.6" />
      <circle className="disc" r="3.35" />
      <text fontSize={mark.length > 2 ? 1.65 : 2.15}>{mark}</text>
    </g>
  );
}
