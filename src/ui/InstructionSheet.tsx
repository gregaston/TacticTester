import { useId, useState, type ReactNode } from "react";
import "./instruction-sheet.css";

export type InstructionChoice<T extends string> = { value: T; label: string };

export type InstructionSheetProps = {
  passing: InstructionChoice<"shorter" | "standard" | "more direct">[];
  tempo: InstructionChoice<"lower" | "standard" | "higher">[];
  width: InstructionChoice<"narrower" | "standard" | "wider">[];
  defensiveLine: InstructionChoice<"deeper" | "standard" | "higher">[];
  engagement: InstructionChoice<"lower" | "standard" | "higher">[];
  pressing: InstructionChoice<"less" | "standard" | "more">[];
  value: {
    passing: "shorter" | "standard" | "more direct";
    tempo: "lower" | "standard" | "higher";
    width: "narrower" | "standard" | "wider";
    defensiveLine: "deeper" | "standard" | "higher";
    engagement: "lower" | "standard" | "higher";
    pressing: "less" | "standard" | "more";
  };
  notes: string[];
  onChange: (next: InstructionSheetProps["value"]) => void;
};

type InstructionValue = InstructionSheetProps["value"];

export function InstructionSheet({
  passing,
  tempo,
  width,
  defensiveLine,
  engagement,
  pressing,
  value,
  notes,
  onChange,
}: InstructionSheetProps) {
  const baseId = useId();
  const [inPossessionOpen, setInPossessionOpen] = useState(false);
  const [outOfPossessionOpen, setOutOfPossessionOpen] = useState(false);

  function update<K extends keyof InstructionValue>(key: K, next: InstructionValue[K]) {
    if (value[key] === next) return;
    onChange({ ...value, [key]: next });
  }

  return (
    <section className="instruction-sheet" aria-label="Team instructions">
      <p className="kicker">Team instructions</p>
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
          label="Defensive line"
          labelId={`${baseId}-line`}
          options={defensiveLine}
          selected={value.defensiveLine}
          onSelect={(next) => update("defensiveLine", next)}
        />
        <Segment
          label="Engagement"
          labelId={`${baseId}-engagement`}
          options={engagement}
          selected={value.engagement}
          onSelect={(next) => update("engagement", next)}
        />
        <Segment
          label="Pressing"
          labelId={`${baseId}-pressing`}
          options={pressing}
          selected={value.pressing}
          onSelect={(next) => update("pressing", next)}
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
