import { shotMapCells } from "../testing/profile";
import "./style-reading.css";

export type StyleReadingProps = {
  team: string | null;
  season: string | null;
  competition: string | null;
  matches: number | null;
  xgPerShot: number | null;
  passLength: number;
  shotsPerMatch: number;
  lines: string[];
  note: string;
  shotGrid: number[][] | null;
};

export function StyleReading({
  team,
  season,
  competition,
  matches,
  xgPerShot,
  passLength,
  shotsPerMatch,
  lines,
  note,
  shotGrid,
}: StyleReadingProps) {
  const cells = shotGrid ? shotMapCells(shotGrid) : [];
  const peak = cells.length > 0 ? Math.max(...cells) : 0;

  return (
    <section className="style-reading" aria-label="Style comparison">
      <p className="kicker">Style comparison</p>
      <h2>{team && season ? `${team} ${season}` : "No recorded side"}</h2>
      {team && competition && matches != null && xgPerShot != null ? (
        <p className="meta">
          {competition} · {matches} matches · {xgPerShot.toFixed(2)} xG per shot
        </p>
      ) : null}
      <dl className="style-figures">
        <div>
          <dt>Pass</dt>
          <dd>{formatTenths(passLength)} yd</dd>
        </div>
        <div>
          <dt>Shots</dt>
          <dd>{formatTenths(shotsPerMatch)}</dd>
        </div>
      </dl>
      {lines.map((line) => (
        <p key={line}>{line}</p>
      ))}
      {peak > 0 ? (
        <figure className="style-map">
          <div className="style-grid" aria-hidden="true">
            {cells.map((count, index) => (
              <span key={index} style={{ opacity: 0.12 + 0.88 * (count / peak) }} />
            ))}
          </div>
          <figcaption>Where {team} shot from. The opponent's goal is at the top.</figcaption>
        </figure>
      ) : null}
      <p className="style-note">{note}</p>
    </section>
  );
}

function formatTenths(value: number): string {
  const rounded = Math.round(value * 10) / 10;
  return Number.isInteger(rounded) ? String(rounded) : rounded.toFixed(1);
}
