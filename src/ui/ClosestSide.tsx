import type { ClosestMatch } from "../compare/closest";
import { formatSeason, placeLabel } from "../compare/format";

export function ClosestSide({ match }: { match: ClosestMatch | null }) {
  if (!match) return <p className="empty">No recorded sides are loaded.</p>;

  return (
    <section className="closest" aria-label="Closest match">
      <p className="kicker">{match.weak ? "Weak likeness" : "Closest match"}</p>
      <h2>{match.team}</h2>
      <p className="season">{formatSeason(match.season)}</p>
      <dl className="identity">
        <div>
          <dt>Manager</dt>
          <dd>{match.manager}</dd>
        </div>
        <div>
          <dt>League</dt>
          <dd>{match.competition}</dd>
        </div>
        <div>
          <dt>Place</dt>
          <dd>{placeLabel(match.place)}</dd>
        </div>
      </dl>
      <div className="match-scores">
        <div>
          <span>Style</span>
          <strong>{match.stylePercent}%</strong>
        </div>
        <div>
          <span>Shape</span>
          <strong>{match.shapePercent}%</strong>
        </div>
      </div>
      {match.closerStyle ? (
        <p className="difference">
          {match.closerStyle.team} is closer in style, {match.closerStyle.stylePercent}%.
        </p>
      ) : null}
      <dl className="style-figures">
        {match.figures.map((figure) => (
          <div key={figure.label}>
            <dt>{figure.label}</dt>
            <dd>
              {formatFigure(figure.yours)}
              {figure.unit ? ` ${figure.unit}` : ""}
              <span>
                {" "}
                · theirs {formatFigure(figure.theirs)} · set {formatFigure(figure.low)}–{formatFigure(figure.high)}
              </span>
            </dd>
          </div>
        ))}
      </dl>
      <p className="record">
        {match.won}W {match.drawn}D {match.lost}L · {match.goalsFor}–{match.goalsAgainst} · {match.points} pts
      </p>
      {match.lever ? <p className="difference">{match.lever}</p> : null}
      {match.line ? <p className="difference">{match.line}</p> : null}
      <p className="difference">{match.summary}</p>
      {match.shift ? <p className="difference">{match.shift}</p> : null}
      {match.loft ? <p className="difference">{match.loft}</p> : null}
    </section>
  );
}

function formatFigure(value: number): string {
  const rounded = Math.round(value * 10) / 10;
  return Number.isInteger(rounded) ? String(rounded) : rounded.toFixed(1);
}
