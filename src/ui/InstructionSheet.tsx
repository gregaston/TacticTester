import { useId, useState, type ReactNode } from "react";
import type { TeamInstructions } from "../tactics/instructions";
import "./instruction-sheet.css";

export type InstructionChoice<T extends string> = { value: T; label: string };

export type InstructionSheetProps = {
  passing: InstructionChoice<TeamInstructions["passing"]>[];
  tempo: InstructionChoice<TeamInstructions["tempo"]>[];
  width: InstructionChoice<TeamInstructions["width"]>[];
  pressing: InstructionChoice<TeamInstructions["pressing"]>[];
  mentality: InstructionChoice<TeamInstructions["mentality"]>[];
  transition: InstructionChoice<TeamInstructions["transition"]>[];
  distribution: InstructionChoice<TeamInstructions["distribution"]>[];
  widthIntention: InstructionChoice<TeamInstructions["widthIntention"]>[];
  shooting: InstructionChoice<TeamInstructions["shooting"]>[];
  value: TeamInstructions;
  notes: string[];
  onChange: (next: TeamInstructions) => void;
};

type InstructionValue = InstructionSheetProps["value"];

export function InstructionSheet({
  passing,
  tempo,
  width,
  pressing,
  mentality,
  transition,
  distribution,
  widthIntention,
  shooting,
  value,
  notes,
  onChange,
}: InstructionSheetProps) {
  const baseId = useId();
  const [inPossessionOpen, setInPossessionOpen] = useState(false);
  const [outOfPossessionOpen, setOutOfPossessionOpen] = useState(false);
  const [moreOpen, setMoreOpen] = useState(false);

  function update<K extends keyof InstructionValue>(key: K, next: InstructionValue[K]) {
    if (value[key] === next) return;
    onChange({ ...value, [key]: next });
  }

  return (
    <section className="instruction-sheet" aria-label="Team instructions">
      <p className="kicker">Team instructions</p>
      <div className="instruction-group">
        <Segment
          label="Mentality"
          labelId={`${baseId}-mentality`}
          options={mentality}
          selected={value.mentality}
          onSelect={(next) => update("mentality", next)}
        />
        <Segment
          label="Transition"
          labelId={`${baseId}-transition`}
          options={transition}
          selected={value.transition}
          onSelect={(next) => update("transition", next)}
        />
      </div>
      <Disclosure
        title="In possession"
        open={inPossessionOpen}
        controlsId={`${baseId}-in-possession`}
        onToggle={() => setInPossessionOpen((open) => !open)}
      >
        <Segment
          label="Passing"
          labelId={`${baseId}-passing`}
          options={passing}
          selected={value.passing}
          onSelect={(next) => update("passing", next)}
        />
        <Segment
          label="Tempo"
          labelId={`${baseId}-tempo`}
          options={tempo}
          selected={value.tempo}
          onSelect={(next) => update("tempo", next)}
        />
        <Segment
          label="Width"
          labelId={`${baseId}-width`}
          options={width}
          selected={value.width}
          onSelect={(next) => update("width", next)}
        />
      </Disclosure>
      <Disclosure
        title="Out of possession"
        open={outOfPossessionOpen}
        controlsId={`${baseId}-out-of-possession`}
        onToggle={() => setOutOfPossessionOpen((open) => !open)}
      >
        <Segment
          label="Pressing"
          labelId={`${baseId}-pressing`}
          options={pressing}
          selected={value.pressing}
          onSelect={(next) => update("pressing", next)}
        />
      </Disclosure>
      <Disclosure
        title="More"
        open={moreOpen}
        controlsId={`${baseId}-more`}
        onToggle={() => setMoreOpen((open) => !open)}
      >
        <Segment
          label="Keeper distribution"
          labelId={`${baseId}-distribution`}
          options={distribution}
          selected={value.distribution}
          onSelect={(next) => update("distribution", next)}
        />
        <Segment
          label="Width intention"
          labelId={`${baseId}-width-intention`}
          options={widthIntention}
          selected={value.widthIntention}
          onSelect={(next) => update("widthIntention", next)}
        />
        <Segment
          label="Shooting"
          labelId={`${baseId}-shooting`}
          options={shooting}
          selected={value.shooting}
          onSelect={(next) => update("shooting", next)}
        />
      </Disclosure>
      {notes.length > 0 ? (
        <div className="instruction-notes">
          {notes.map((note, index) => (
            <p key={`${index}:${note}`}>{note}</p>
          ))}
        </div>
      ) : null}
    </section>
  );
}

function Disclosure({
  title,
  open,
  controlsId,
  onToggle,
  children,
}: {
  title: string;
  open: boolean;
  controlsId: string;
  onToggle: () => void;
  children: ReactNode;
}) {
  return (
    <div className="instruction-block">
      <button
        type="button"
        className="instruction-disclosure"
        aria-expanded={open}
        aria-controls={controlsId}
        onClick={onToggle}
      >
        <span>{title}</span>
        <span>{open ? "Hide" : "Show"}</span>
      </button>
      {open ? (
        <div className="instruction-group" id={controlsId}>
          {children}
        </div>
      ) : null}
    </div>
  );
}

function Segment<T extends string>({
  label,
  labelId,
  options,
  selected,
  onSelect,
}: {
  label: string;
  labelId: string;
  options: InstructionChoice<T>[];
  selected: T;
  onSelect: (value: T) => void;
}) {
  return (
    <div className="segment">
      <p className="segment-label" id={labelId}>
        {label}
      </p>
      <div className="segment-options" role="group" aria-labelledby={labelId}>
        {options.map((option) => (
          <button
            key={option.value}
            type="button"
            aria-pressed={option.value === selected}
            onClick={() => onSelect(option.value)}
          >
            {option.label}
          </button>
        ))}
      </div>
    </div>
  );
}
