import "./match-report.css";

export type MatchReportProps = {
  team: string;
  season: string;
  competition: string;
  matches: number;
  situation: string;
  modelXgFor: number;
  modelXgAgainst: number;
  tilt: number;
  yourPpda: number;
  theirPpda: number;
  restDefence: number;
  lines: string[];
};

export function MatchReport({
  team,
  season,
  competition,
  matches,
  situation,
  modelXgFor,
  modelXgAgainst,
  tilt,
  yourPpda,
  theirPpda,
  restDefence,
  lines,
}: MatchReportProps) {
  const players = formatCount(restDefence);

  return (
    <section className="match-report" aria-label="Match sample">
      <p className="kicker">Match sample</p>
      <h2>
        {team} {season}
      </h2>
      <p className="meta">
        {competition} · {matches} matches · {situation}
      </p>
      <dl className="match-figures">
        <div>
          <dt>
            <span className="match-xg">xG</span> for
          </dt>
          <dd>{formatXg(modelXgFor)}</dd>
        </div>
        <div>
          <dt>
            <span className="match-xg">xG</span> against
          </dt>
          <dd>{formatXg(modelXgAgainst)}</dd>
        </div>
        <div>
          <dt>Field tilt</dt>
          <dd>{formatTilt(tilt)}</dd>
        </div>
        <div>
          <dt>Rest defence</dt>
          <dd>
            {players}
            <span className="match-unit"> {players === "1" ? "player" : "players"}</span>
          </dd>
        </div>
      </dl>
      <p>
        Your press allows <span className="match-num">{formatCount(yourPpda)}</span> passes the opponent completes before a defensive action. Theirs allowed <span className="match-num">{formatCount(theirPpda)}</span>.
      </p>
      {lines.map((line, index) => (
        <p key={`${index}:${line}`}>{line}</p>
      ))}
      <p className="match-caption">
        xG is TacticTester's zone sketch. Their press rate is the recorded season.
      </p>
    </section>
  );
}

function formatXg(value: number): string {
  return value.toFixed(2);
}

function formatTilt(value: number): string {
  const percent = Math.abs(value) <= 1 ? value * 100 : value;
  return `${formatCount(percent)}%`;
}

function formatCount(value: number): string {
  const rounded = Math.round(value * 10) / 10;
  return Number.isInteger(rounded) ? String(rounded) : rounded.toFixed(1);
}
