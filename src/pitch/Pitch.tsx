import { useRef, type PointerEvent } from "react";
import { clientToPitch } from "./pointer";
import { Markings } from "./Markings";
import { Token } from "./Token";
import type { PlayerLabel, SquadLabels } from "../tactics/positions";
import type { PitchPoint, Player } from "../tactics/types";
import "./pitch.css";

type PitchProps = {
  players: Player[];
  labels: SquadLabels;
  selectedId: string | null;
  onSelect: (id: string) => void;
  onPreview: (id: string, point: PitchPoint) => void;
  onCommit: (id: string, point: PitchPoint) => void;
};

export function Pitch({ players, labels, selectedId, onSelect, onPreview, onCommit }: PitchProps) {
  const surface = useRef<HTMLDivElement>(null);

  function pointFrom(event: PointerEvent<SVGGElement>): PitchPoint {
    const rect = surface.current?.getBoundingClientRect();
    if (!rect) return { x: 50, y: 50 };
    return clientToPitch(event.clientX, event.clientY, rect);
  }

  return (
    <div className="pitch" ref={surface}>
      <svg viewBox="0 0 68 105" role="img" aria-label="Tactics pitch">
        <Markings />
        {players.map((player) => (
          <Token
            key={player.id}
            player={player}
            label={labels.byId[player.id] as PlayerLabel}
            selected={player.id === selectedId}
            onSelect={() => onSelect(player.id)}
            onMove={(event) => onPreview(player.id, pointFrom(event))}
            onFinish={(event) => onCommit(player.id, pointFrom(event))}
          />
        ))}
      </svg>
    </div>
  );
}
