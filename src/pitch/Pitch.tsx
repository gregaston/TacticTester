import { useEffect, useRef, type PointerEvent as ReactPointerEvent } from "react";
import type { HeatBlob } from "../tactics/heat";
import type { PlayerLabel, SquadLabels } from "../tactics/positions";
import type { Duty } from "../tactics/roles";
import type { PitchPoint, Player } from "../tactics/types";
import { BlockGuides } from "./BlockGuides";
import { Grass } from "./Grass";
import { Heatmap } from "./Heatmap";
import { Markings } from "./Markings";
import { Token } from "./Token";
import { clientToPitch, dragStarts } from "./pointer";
import "./pitch.css";

export type TokenFace = {
  mark: string;
  roleName: string;
  duty: Duty;
};

type PitchProps = {
  players: Player[];
  labels: SquadLabels;
  faces: Record<string, TokenFace>;
  heat: HeatBlob[];
  engagementY: number;
  defensiveY: number;
  selectedId: string | null;
  onSelect: (id: string) => void;
  onDeselect: () => void;
  onPreview: (id: string, point: PitchPoint) => void;
  onCommit: (id: string, point: PitchPoint) => void;
};

export function Pitch({
  players,
  labels,
  faces,
  heat,
  engagementY,
  defensiveY,
  selectedId,
  onSelect,
  onDeselect,
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
    const wasSelected = id === selectedId;
    const originX = event.clientX;
    const originY = event.clientY;
    let dragging = false;
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
      const distance = Math.hypot(ev.clientX - originX, ev.clientY - originY);
      if (!dragging) {
        if (!dragStarts(distance, wasSelected)) return;
        dragging = true;
        if (!wasSelected) onSelect(id);
      }
      last = pointFrom(ev);
      onPreview(id, last);
    };
    const finish = (ev: PointerEvent) => {
      if (ev.pointerId !== pointerId) return;
      dropListeners();
      if (!dragging) {
        if (wasSelected) onDeselect();
        else onSelect(id);
        return;
      }
      onCommit(id, pointFrom(ev));
    };
    detach.current = dropListeners;
    interrupt.current = () => {
      const moved = dragging;
      const point = last;
      dropListeners();
      if (moved) onCommit(id, point);
    };
    window.addEventListener("pointermove", move);
    window.addEventListener("pointerup", finish);
    window.addEventListener("pointercancel", finish);
  }

  return (
    <div className="pitch" ref={surface}>
      <svg viewBox="0 0 68 105" role="img" aria-label="Tactics pitch. The shade shows where players arrive.">
        <Grass />
        <Heatmap blobs={heat} />
        <Markings />
        <BlockGuides engagementY={engagementY} defensiveY={defensiveY} />
        {players.map((player) => {
          const face = faces[player.id];
          return (
            <Token
              key={player.id}
              player={player}
              label={labels.byId[player.id] as PlayerLabel}
              mark={face.mark}
              roleName={face.roleName}
              duty={face.duty}
              selected={player.id === selectedId}
              onGrab={(event) => grab(player.id, event)}
              onTap={() => (player.id === selectedId ? onDeselect() : onSelect(player.id))}
            />
          );
        })}
      </svg>
    </div>
  );
}
