import type { ClosestMatch } from "../compare/closest";
import { formatSeason, placeLabel } from "../compare/format";

export function ClosestSide({ match }: { match: ClosestMatch | null }) {
  if (!match) return <p className="empty">No recorded sides are loaded.</p>;

  return (
    <section className="closest" aria-label="Closest match">
      <p className="kicker">Closest match</p>
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
      <p className="record">
        {match.won}W {match.drawn}D {match.lost}L · {match.goalsFor}–{match.goalsAgainst} · {match.points} pts
      </p>
      <p className="difference">{match.summary}</p>
    </section>
  );
}
