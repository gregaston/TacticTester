import type { PointerEvent } from "react";
import type { PlayerLabel } from "../tactics/positions";
import type { Duty } from "../tactics/roles";
import type { Player } from "../tactics/types";
import { toView } from "./view";

type TokenProps = {
  player: Player;
  label: PlayerLabel;
  mark: string;
  roleName: string;
  duty: Duty;
  selected: boolean;
  onGrab: (event: PointerEvent<SVGGElement>) => void;
  onTap: () => void;
};

const DUTY_LABEL: Record<Duty, string> = {
  defend: "Defend",
  support: "Support",
  attack: "Attack",
};

export function Token({ player, label, mark, roleName, duty, selected, onGrab, onTap }: TokenProps) {
  const { x, y } = toView(player);
  const position = label.alternateName ? `${label.name}, or ${label.alternateName}` : label.name;

  return (
    <g
      className={selected ? `token selected duty-${duty}` : `token duty-${duty}`}
      transform={`translate(${x} ${y})`}
      role="button"
      tabIndex={0}
      data-mark={mark}
      data-duty={duty}
      aria-label={`${position}, ${roleName}, ${DUTY_LABEL[duty]}`}
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
      <DutyMark duty={duty} />
      <text fontSize={mark.length > 2 ? 1.65 : 2.15}>{mark}</text>
    </g>
  );
}

function DutyMark({ duty }: { duty: Duty }) {
  if (duty === "attack") return <polygon className="duty" points="0,-5.7 1.2,-3.85 -1.2,-3.85" />;
  if (duty === "defend") return <polygon className="duty" points="0,5.7 1.2,3.85 -1.2,3.85" />;
  return <rect className="duty" x="3.2" y="-0.75" width="1.55" height="1.5" rx="0.3" />;
}
