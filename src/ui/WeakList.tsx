import "./weak-list.css";

export type WeakRow = {
  id: string;
  team: string;
  season: string;
  competition: string;
  matches: number;
  modelXgFor: number;
  modelXgAgainst: number;
  why: string;
};

export type WeakListProps = {
  summary: string;
  rows: WeakRow[];
  held: WeakRow | null;
};

export function WeakList({ summary, rows, held }: WeakListProps) {
  return (
    <div className="weak-list">
      <h2>Weakest against</h2>
      <p className="weak-summary">{summary}</p>
      <ol>
        {rows.map((row) => (
          <li key={row.id}>
            <p className="weak-team">
              {row.team} <span>{row.season}</span>
            </p>
            <p className="weak-meta">
              {row.competition} · {row.matches} matches
            </p>
            <p className="weak-numbers">
              <span className="weak-xg">xG</span> {row.modelXgFor.toFixed(2)} for
              <span className="weak-dot"> · </span>
              <span className="weak-xg">xG</span> {row.modelXgAgainst.toFixed(2)} against
            </p>
            <p className="weak-why">{row.why}</p>
          </li>
        ))}
      </ol>
      {held ? (
        <p className="weak-held">
          Least trouble was {held.team} {held.season}. {held.why}
        </p>
      ) : null}
    </div>
  );
}
