import { useId, useState } from "react";
import "./test-sheet.css";

export type TestChoice = { id: string; label: string };

export type TestSheetProps = {
  situationLabel: string;
  opponentLabel: string;
  situations: TestChoice[];
  situation: string;
  opponents: TestChoice[];
  opponent: string;
  onSituation: (id: string) => void;
  onOpponent: (id: string) => void;
};

export function TestSheet({
  situationLabel,
  opponentLabel,
  situations,
  situation,
  opponents,
  opponent,
  onSituation,
  onOpponent,
}: TestSheetProps) {
  const panelId = useId();
  const [open, setOpen] = useState(false);

  return (
    <section className="test-sheet" aria-label="Test">
      <p className="kicker">Test</p>
      <button
        type="button"
        className="test-disclosure"
        aria-expanded={open}
        aria-controls={panelId}
        onClick={() => setOpen((current) => !current)}
      >
        <span>
          {situationLabel} · {opponentLabel}
        </span>
        <span>{open ? "Hide" : "Show"}</span>
      </button>
      {open ? (
        <div id={panelId}>
          <p className="test-label" id={`${panelId}-situation`}>
            Situation
          </p>
          <div className="test-options" role="group" aria-labelledby={`${panelId}-situation`}>
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
          <p className="test-label" id={`${panelId}-opponent`}>
            Opponent
          </p>
          <div className="test-options" role="group" aria-labelledby={`${panelId}-opponent`}>
            {opponents.map((choice) => (
              <button
                key={choice.id}
                type="button"
                aria-pressed={choice.id === opponent}
                onClick={() => onOpponent(choice.id)}
              >
                {choice.label}
              </button>
            ))}
          </div>
        </div>
      ) : null}
    </section>
  );
}
