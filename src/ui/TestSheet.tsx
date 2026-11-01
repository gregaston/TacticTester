import { useEffect, useId, useRef, useState } from "react";
import { formatSeason, placeLabel } from "../compare/format";
import type { TeamInstructions } from "../tactics/instructions";
import { gradeMove, runCampaign, type CampaignOpponent, type CampaignRun } from "../testing/campaign";
import { SITUATIONS } from "../testing/corners";
import type { ProfilePlayer } from "../testing/profile";
import "./test-sheet.css";

const STORAGE_KEY = "tactictester.tests";
const KEEP = 12;
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
  const [runs, setRuns] = useState<CampaignRun[]>(loadRuns);
  const [openId, setOpenId] = useState<string | null>(null);
  const [phase, setPhase] = useState<"running" | "ready">("ready");
  const open = openId != null;
  const active = runs.find((run) => run.id === openId) ?? null;

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
      const next = [run, ...current.filter((item) => item.id !== run.id)]
        .sort((a, b) => b.createdAt - a.createdAt)
        .slice(0, KEEP);
      saveRuns(next);
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
              <Result run={active} earlier={earlierPlace(runs, active.id)} titleId={titleId} />
            )}
          </div>
        </div>
      ) : null}
    </section>
  );
}

function Result({ run, earlier, titleId }: { run: CampaignRun; earlier: number | null; titleId: string }) {
  return (
    <div className="test-result">
      <p className="kicker">Table grade</p>
      <h2 id={titleId}>{placeLabel(run.place)}</h2>
      <p className="test-move">{gradeMove(run.place, earlier)}</p>
      <p className="test-note">A grade from this model's results against every side. Not a league finish.</p>
      <dl className="test-figures">
        <div>
          <dt>xG for</dt>
          <dd>{run.meanFor.toFixed(2)}</dd>
        </div>
        <div>
          <dt>xG against</dt>
          <dd>{run.meanAgainst.toFixed(2)}</dd>
        </div>
      </dl>
      <p className="test-count">
        {run.tested} sides, {run.situations} situations. xG is TacticTester's zone sketch.
      </p>
      <Finding title="Strengths" lines={run.strengths} empty="No strength stands out in this run." />
      <Finding title="Weaknesses" lines={run.weaknesses} empty="No weakness stands out in this run." />
      {run.comparison ? (
        <section className="test-pattern">
          <h3>The comparison</h3>
          <p>{run.comparison}</p>
        </section>
      ) : null}
      <SideList title="Harder than their shots" rows={run.worst} />
      <SideList title="Easier than their shots" rows={run.best} />
    </div>
  );
}

function Finding({ title, lines, empty }: { title: string; lines: string[]; empty: string }) {
  return (
    <section>
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

function SideList({ title, rows }: { title: string; rows: CampaignRun["worst"] }) {
  if (rows.length === 0) return null;
  const trait = sharedTrait(rows.map((row) => row.note));
  return (
    <section>
      <h3>{title}</h3>
      {trait ? <p className="test-trait">{trait}</p> : null}
      <ol>
        {rows.map((row) => (
          <li key={row.id}>
            <p className="test-side">
              {row.team} <span>{formatSeason(row.season)}</span>
            </p>
            <p className="test-side-meta">
              {row.competition} · xG {row.modelXgFor.toFixed(2)} for · {row.modelXgAgainst.toFixed(2)} against
            </p>
            <p>{edgeNote(row.note)}</p>
          </li>
        ))}
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

function earlierPlace(runs: CampaignRun[], id: string): number | null {
  const index = runs.findIndex((run) => run.id === id);
  if (index < 0) return null;
  return runs[index + 1]?.place ?? null;
}

function loadRuns(): CampaignRun[] {
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as unknown;
    if (!Array.isArray(parsed)) return [];
    return parsed.filter(isRun).slice(0, KEEP);
  } catch {
    return [];
  }
}

function saveRuns(runs: CampaignRun[]) {
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(runs));
  } catch {
    // The test still shows. Storage can be full or blocked.
  }
}

function isRun(value: unknown): value is CampaignRun {
  if (!value || typeof value !== "object") return false;
  const run = value as Partial<CampaignRun>;
  return typeof run.id === "string" && typeof run.place === "number" && typeof run.label === "string" && Array.isArray(run.strengths) && Array.isArray(run.weaknesses);
}
