import { useEffect, useId, useRef, useState } from "react";
import { formatSeason, placeLabel } from "../compare/format";
import type { TeamInstructions } from "../tactics/instructions";
import { Markings } from "../pitch/Markings";
import { PITCH_VIEW, toView } from "../pitch/view";
import { gradeMove, runCampaign, type CampaignOpponent, type CampaignRun, type SideNote } from "../testing/campaign";
import { SITUATIONS } from "../testing/corners";
import type { ProfilePlayer } from "../testing/profile";
import { loadTestHistory, saveTestHistory, subscribeTestHistory } from "../testing/history";
import { countMove, placeMove, type FigureMove, type ReportMark } from "../testing/report";
import "./test-sheet.css";

const RUN_PAUSE_MS = 800;

export type TestSheetProps = {
  label: string;
  tacticKey: string;
  players: ProfilePlayer[];
  instructions: TeamInstructions;
  opponents: CampaignOpponent[];
};

export function TestSheet({ label, tacticKey, players, instructions, opponents }: TestSheetProps) {
  const titleId = useId();
  const buttonRef = useRef<HTMLButtonElement>(null);
  const closeRef = useRef<HTMLButtonElement>(null);
  const request = useRef(0);
  const [runs, setRuns] = useState<CampaignRun[]>(() => loadTestHistory(window.localStorage));
  const [openId, setOpenId] = useState<string | null>(null);
  const [phase, setPhase] = useState<"running" | "ready">("ready");
  const open = openId != null;
  const active = runs.find((run) => run.id === openId) ?? null;

  useEffect(() => {
    return subscribeTestHistory(() => {
      request.current += 1;
      setRuns(loadTestHistory(window.localStorage));
      setOpenId(null);
      setPhase("ready");
    });
  }, []);

  useEffect(() => {
    if (!open) return;
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") close();
    };
    document.body.style.overflow = "hidden";
    window.addEventListener("keydown", onKey);
    closeRef.current?.focus();
    return () => {
      document.body.style.overflow = "";
      window.removeEventListener("keydown", onKey);
    };
  }, [open]);

  function close() {
    request.current += 1;
    setOpenId(null);
    setPhase("ready");
    buttonRef.current?.focus();
  }

  function remember(run: CampaignRun) {
    setRuns((current) => {
      const next = [run, ...current.filter((item) => item.id !== run.id)].sort(
        (a, b) => b.createdAt - a.createdAt,
      );
      saveTestHistory(next, window.localStorage);
      return next;
    });
  }

  function start() {
    const mine = ++request.current;
    const started = performance.now();
    const snapshot = { players, instructions, opponents, label, tacticKey };
    setOpenId("pending");
    setPhase("running");
    window.setTimeout(() => {
      const run = runCampaign({ ...snapshot, seed: 1 });
      const wait = Math.max(0, RUN_PAUSE_MS - (performance.now() - started));
      window.setTimeout(() => {
        remember(run);
        if (request.current !== mine) return;
        setOpenId(run.id);
        setPhase("ready");
      }, wait);
    }, 40);
  }

  const newest = runs[0];
  const stale = newest != null && newest.tacticKey !== tacticKey;

  return (
    <section className="test-sheet" aria-label="Test">
      <p className="kicker">Test</p>
      <p className="test-intro">Every situation, against every side.</p>
      <button ref={buttonRef} type="button" className="test-run" onClick={start}>
        Test this tactic
      </button>
      {runs.length > 0 ? (
        <ol className="test-history">
          {runs.map((run, index) => {
            const earlier = runs[index + 1]?.place ?? null;
            return (
              <li key={run.id}>
                <button
                  type="button"
                  onClick={() => {
                    request.current += 1;
                    setPhase("ready");
                    setOpenId(run.id);
                  }}
                >
                  <span className="test-history-label">{run.label}</span>
                  <strong>{placeLabel(run.place)}</strong>
                  <span className="test-history-move">{gradeMove(run.place, earlier)}</span>
                  {index === 0 && stale ? <span className="test-history-stale">Tactic has changed</span> : null}
                </button>
              </li>
            );
          })}
        </ol>
      ) : null}
      {open ? (
        <div className="test-overlay" role="presentation" onClick={close}>
          <div
            className="test-panel"
            role="dialog"
            aria-modal="true"
            aria-labelledby={titleId}
            onClick={(event) => event.stopPropagation()}
          >
            <button ref={closeRef} type="button" className="test-close" onClick={close}>
              Close
            </button>
            {phase === "running" || !active ? (
              <div className="test-running" aria-live="polite">
                <p className="kicker">Testing</p>
                <h2 id={titleId}>Running every situation against every side.</h2>
                <p>
                  {opponents.length} sides, {SITUATIONS.length} situations.
                </p>
              </div>
            ) : (
              <Result run={active} earlier={earlierRun(runs, active.id)} titleId={titleId} />
            )}
          </div>
        </div>
      ) : null}
    </section>
  );
}

function Result({ run, earlier, titleId }: { run: CampaignRun; earlier: CampaignRun | null; titleId: string }) {
  const grade = placeMove(run.place, earlier?.place ?? null);
  const margin = run.meanFor - run.meanAgainst;
  const previousMargin = earlier ? earlier.meanFor - earlier.meanAgainst : null;
  return (
    <div className="test-result">
      <header className="report-mast">
        <p className="kicker">Analyst report</p>
        <p className="report-label">{run.label}</p>
        <p className="test-count">
          {run.tested} sides, {run.situations} situations. Not a league finish.
        </p>
      </header>
      <section className="report-grade" aria-label="Table grade">
        <p className="kicker">Table grade</p>
        <h2 id={titleId}>{placeLabel(run.place)}</h2>
        {grade.tone === "first" ? <p className="delta delta-flat">First test</p> : <Delta move={grade} keepFlat />}
        <p className="test-note">A grade from this model's results against every side.</p>
      </section>
      <dl className="test-figures">
        <div>
          <dt>xG for</dt>
          <dd>{run.meanFor.toFixed(2)}</dd>
          <Delta move={countMove(run.meanFor, earlier?.meanFor ?? null, "higher", 2)} keepFlat />
        </div>
        <div>
          <dt>xG against</dt>
          <dd>{run.meanAgainst.toFixed(2)}</dd>
          <Delta move={countMove(run.meanAgainst, earlier?.meanAgainst ?? null, "lower", 2)} keepFlat />
        </div>
      </dl>
      <p className="report-margin">
        <span>Margin</span>
        <strong>{signed(margin)}</strong>
        <Delta move={countMove(margin, previousMargin, "higher", 2)} keepFlat />
      </p>
      <p className="test-count">xG is TacticTester's zone sketch.</p>
      {run.chanceNote ? <p className="test-note">{run.chanceNote}</p> : null}
      {run.shape && run.shape.length > 0 ? <ReportPitch dots={run.shape} marks={run.marks ?? []} /> : null}
      <Finding title="Strengths" lines={run.strengths} empty="No strength stands out in this run." tone="strong" />
      <Finding title="Weaknesses" lines={run.weaknesses} empty="No weakness stands out in this run." tone="weak" />
      {run.comparison ? (
        <section className="test-pattern">
          <h3>The comparison</h3>
          <p>{run.comparison}</p>
        </section>
      ) : null}
      <SideList title="Worse than the shot count" rows={run.worst} earlier={earlier} />
      <SideList title="Better than the shot count" rows={run.best} earlier={earlier} />
    </div>
  );
}

function Delta({ move, name, keepFlat = false }: { move: FigureMove; name?: string; keepFlat?: boolean }) {
  if (move.tone === "first") return null;
  if (move.tone === "flat" && !keepFlat) return null;
  const text = name ? `${name} ${move.text}` : move.text;
  return <p className={`delta delta-${move.tone}`}>{text}</p>;
}

function ReportPitch({ dots, marks }: { dots: { x: number; y: number }[]; marks: ReportMark[] }) {
  const summary =
    marks.length === 0
      ? "No problem in this run sits on one part of the pitch."
      : `Problem areas: ${marks.map((mark, index) => `${index + 1} ${mark.label}`).join(". ")}.`;
  return (
    <figure className="report-pitch">
      <figcaption className="report-pitch-title">Where it hurts</figcaption>
      <svg viewBox={`0 0 ${PITCH_VIEW.width} ${PITCH_VIEW.height}`} role="img" aria-label={summary}>
        <Markings />
        {marks.map((mark) => {
          const point = toView(mark);
          const radius = (mark.r / 100) * PITCH_VIEW.width;
          return <circle key={mark.id} className="report-zone" cx={point.x} cy={point.y} r={radius} />;
        })}
        {dots.map((dot, index) => {
          const point = toView(dot);
          return <circle key={`p${index}`} className="report-dot" cx={point.x} cy={point.y} r={1.5} />;
        })}
        {marks.map((mark, index) => {
          const point = toView(mark);
          return (
            <text key={`n${mark.id}`} className="report-num" x={point.x} y={point.y}>
              {index + 1}
            </text>
          );
        })}
      </svg>
      <p className="report-pitch-note">Attack is toward the top.</p>
      {marks.length > 0 ? (
        <ol className="report-key">
          {marks.map((mark, index) => (
            <li key={mark.id}>
              <span>{index + 1}</span> {mark.label}
            </li>
          ))}
        </ol>
      ) : (
        <p className="test-note">{summary}</p>
      )}
    </figure>
  );
}

function Finding({ title, lines, empty, tone }: { title: string; lines: string[]; empty: string; tone: "strong" | "weak" }) {
  return (
    <section className={tone === "strong" ? "report-strong" : "report-weak"}>
      <h3>{title}</h3>
      {lines.length > 0 ? (
        <ul>
          {lines.map((line) => (
            <li key={line}>{line}</li>
          ))}
        </ul>
      ) : (
        <p>{empty}</p>
      )}
    </section>
  );
}

function SideList({ title, rows, earlier }: { title: string; rows: CampaignRun["worst"]; earlier: CampaignRun | null }) {
  if (rows.length === 0) return null;
  const trait = sharedTrait(rows.map((row) => row.note));
  const previous = new Map<string, SideNote>();
  for (const row of [...(earlier?.worst ?? []), ...(earlier?.best ?? [])]) previous.set(row.id, row);
  return (
    <section>
      <h3>{title}</h3>
      {trait ? <p className="test-trait">{trait}</p> : null}
      <ol>
        {rows.map((row) => {
          const prior = previous.get(row.id);
          return (
            <li key={row.id}>
              <p className="test-side">
                {row.team} <span>{formatSeason(row.season)}</span>
              </p>
              <p className="test-side-meta">
                {row.competition} · xG {row.modelXgFor.toFixed(2)} for · {row.modelXgAgainst.toFixed(2)} against
              </p>
              {prior ? (
                <div className="report-side-delta">
                  <Delta name="For" move={countMove(row.modelXgFor, prior.modelXgFor, "higher", 2)} />
                  <Delta name="Against" move={countMove(row.modelXgAgainst, prior.modelXgAgainst, "lower", 2)} />
                </div>
              ) : null}
              <p>{edgeNote(row.note)}</p>
            </li>
          );
        })}
      </ol>
    </section>
  );
}

function sharedTrait(notes: string[]): string | null {
  const heads = notes.map((note) => note.split(". ")[0]).filter((head) => head.length > 0);
  if (heads.length === 0 || new Set(heads).size !== 1) return null;
  return heads[0];
}

function edgeNote(note: string): string {
  const splitAt = note.indexOf(". ");
  return splitAt === -1 ? note : note.slice(splitAt + 2);
}

function earlierRun(runs: CampaignRun[], id: string): CampaignRun | null {
  const index = runs.findIndex((run) => run.id === id);
  if (index < 0) return null;
  return runs[index + 1] ?? null;
}

function signed(value: number): string {
  const shown = value.toFixed(2);
  return value > 0 ? `+${shown}` : shown;
}
