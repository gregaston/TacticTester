import { useId, useState } from "react";
import "./test-sheet.css";

export type TestChoice = { id: string; label: string };

export type TestSheetProps = {
  situationLabel: string;
  situations: TestChoice[];
  situation: string;
  onSituation: (id: string) => void;
  onTest: () => void;
  hasResult: boolean;
  stale: boolean;
};

export function TestSheet({
  situationLabel,
  situations,
  situation,
  onSituation,
  onTest,
  hasResult,
  stale,
}: TestSheetProps) {
  const panelId = useId();
  const [open, setOpen] = useState(false);

  return (
    <section className="test-sheet" aria-label="Test">
      <p className="kicker">Test</p>
      <p className="test-intro">Pit this tactic against every side in the set.</p>
      <button type="button" className="test-run" onClick={onTest}>
        {hasResult ? "Test again" : "Test tactic"}
      </button>
      {stale ? <p className="test-stale">The tactic has changed since this test.</p> : null}
      <button
        type="button"
        className="test-disclosure"
        aria-expanded={open}
        aria-controls={panelId}
        onClick={() => setOpen((current) => !current)}
      >
        <span>{situationLabel}</span>
        <span>{open ? "Hide" : "Show"}</span>
      </button>
      {open ? (
        <div className="test-options" id={panelId} role="group" aria-label="Situation">
          {situations.map((choice) => (
            <button
              key={choice.id}
              type="button"
              aria-pressed={choice.id === situation}
              onClick={() => onSituation(choice.id)}
            >
              {choice.label}
            </button>
          ))}
        </div>
      ) : null}
    </section>
  );
}
