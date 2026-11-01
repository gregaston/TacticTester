import { useRef, type PointerEvent as ReactPointerEvent } from "react";

type Stop = { value: string; label: string; face: string; y: number };

type LineSliderProps = {
  name: string;
  mark: string;
  half: "attack" | "defend";
  y: number;
  face: string;
  valueText: string;
  stops: Stop[];
  onLive: (y: number) => void;
  onCommit: (y: number) => void;
  onSelect: (value: string) => void;
};

export function LineSlider({
  name,
  mark,
  half,
  y,
  face,
  valueText,
  stops,
  onLive,
  onCommit,
  onSelect,
}: LineSliderProps) {
  const track = useRef<HTMLDivElement>(null);
  const fraction = half === "attack" ? (100 - y) / 50 : (50 - y) / 50;

  function pitchY(clientY: number): number {
    const rect = track.current?.getBoundingClientRect();
    if (!rect || rect.height === 0) return y;
    const along = Math.min(1, Math.max(0, (clientY - rect.top) / rect.height));
    return half === "attack" ? 100 - along * 50 : 50 - along * 50;
  }

  function grab(event: ReactPointerEvent<HTMLDivElement>) {
    event.preventDefault();
    const pointerId = event.pointerId;
    onLive(pitchY(event.clientY));
    const move = (ev: PointerEvent) => {
      if (ev.pointerId !== pointerId) return;
      onLive(pitchY(ev.clientY));
    };
    const finish = (ev: PointerEvent) => {
      if (ev.pointerId !== pointerId) return;
      window.removeEventListener("pointermove", move);
      window.removeEventListener("pointerup", finish);
      window.removeEventListener("pointercancel", finish);
      onCommit(pitchY(ev.clientY));
    };
    window.addEventListener("pointermove", move);
    window.addEventListener("pointerup", finish);
    window.addEventListener("pointercancel", finish);
  }

  function onKey(event: React.KeyboardEvent<HTMLDivElement>) {
    const index = stops.findIndex((stop) => stop.label === valueText || stop.face === face);
    if (event.key !== "ArrowUp" && event.key !== "ArrowDown") return;
    event.preventDefault();
    const step = event.key === "ArrowUp" ? 1 : -1;
    const next = stops[Math.min(stops.length - 1, Math.max(0, index + step))];
    if (next) onSelect(next.value);
  }

  return (
    <div
      className="line-slider"
      ref={track}
      role="slider"
      tabIndex={0}
      aria-label={name}
      aria-orientation="vertical"
      aria-valuemin={half === "attack" ? 50 : 0}
      aria-valuemax={half === "attack" ? 100 : 50}
      aria-valuenow={Math.round(y)}
      aria-valuetext={valueText}
      onPointerDown={grab}
      onKeyDown={onKey}
    >
      <span className="line-handle" style={{ top: `${Math.min(1, Math.max(0, fraction)) * 100}%` }}>
        <span>{mark}</span>
        <span>{face}</span>
      </span>
    </div>
  );
}
