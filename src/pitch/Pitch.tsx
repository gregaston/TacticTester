import { useEffect, useRef, type PointerEvent as ReactPointerEvent } from "react";
import { clientToPitch } from "./pointer";
import { Arrival } from "./Arrival";
import { Markings } from "./Markings";
import { Token } from "./Token";
import type { PlayerLabel, SquadLabels } from "../tactics/positions";
import type { PitchPoint, Player } from "../tactics/types";
import "./pitch.css";

export type ArrivalMark = PitchPoint & { id: string };

type PitchProps = {
  players: Player[];
  arrivals: ArrivalMark[];
  labels: SquadLabels;
  selectedId: string | null;
  onSelect: (id: string) => void;
  onPreview: (id: string, point: PitchPoint) => void;
  onCommit: (id: string, point: PitchPoint) => void;
};

export function Pitch({
  players,
  arrivals,
  labels,
  selectedId,
  onSelect,
  onPreview,
  onCommit,
}: PitchProps) {
  const surface = useRef<HTMLDivElement>(null);
  const detach = useRef<(() => void) | null>(null);
  const interrupt = useRef<(() => void) | null>(null);

  useEffect(() => () => detach.current?.(), []);

  function pointFrom(event: { clientX: number; clientY: number }): PitchPoint {
    const rect = surface.current?.getBoundingClientRect();
    if (!rect) return { x: 50, y: 50 };
    return clientToPitch(event.clientX, event.clientY, rect);
  }

  function grab(id: string, event: ReactPointerEvent<SVGGElement>) {
    interrupt.current?.();
    const pointerId = event.pointerId;
    let last = pointFrom(event);
    const dropListeners = () => {
      window.removeEventListener("pointermove", move);
      window.removeEventListener("pointerup", finish);
      window.removeEventListener("pointercancel", finish);
      detach.current = null;
      interrupt.current = null;
    };
    const move = (ev: PointerEvent) => {
      if (ev.pointerId !== pointerId) return;
      last = pointFrom(ev);
      onPreview(id, last);
    };
    const finish = (ev: PointerEvent) => {
      if (ev.pointerId !== pointerId) return;
      dropListeners();
      onCommit(id, pointFrom(ev));
    };
    detach.current = dropListeners;
    interrupt.current = () => {
      dropListeners();
      onCommit(id, last);
    };
    window.addEventListener("pointermove", move);
    window.addEventListener("pointerup", finish);
    window.addEventListener("pointercancel", finish);
  }

  return (
    <div className="pitch" ref={surface}>
      <svg viewBox="0 0 68 105" role="img" aria-label="Tactics pitch">
        <Markings />
        {arrivals.map((mark) => (
          <Arrival key={mark.id} point={mark} />
        ))}
        {players.map((player) => (
          <Token
            key={player.id}
            player={player}
            label={labels.byId[player.id] as PlayerLabel}
            selected={player.id === selectedId}
            onSelect={() => onSelect(player.id)}
            onGrab={(event) => grab(player.id, event)}
          />
        ))}
      </svg>
    </div>
  );
}
