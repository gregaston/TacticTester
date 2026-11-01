import { useState } from "react";
import { formatSeason, usualShape } from "../compare/format";
import type { RankedSide } from "../compare/nearest";
import type { SideSummary } from "../compare/types";

type NearestSideProps = {
  ranked: RankedSide[];
  pinned: SideSummary | null;
};

export function NearestSide({ ranked, pinned }: NearestSideProps) {
  const [open, setOpen] = useState(false);
  const nearest = ranked[0];
  if (!nearest) return <p className="empty">No recorded sides are loaded.</p>;

  const rest = ranked.slice(1);
  const showPinned = pinned && pinned.id !== nearest.side.id;

  return (
    <section className="nearest" aria-label="Nearest recorded side">
      <p className="kicker">Nearest recorded side</p>
      <h2>
        {nearest.side.team} {formatSeason(nearest.side.season)}
      </h2>
      <p className="meta">
        {nearest.side.competition} · {nearest.side.matches} matches
      </p>
      <p>{usualShape(nearest.side)}</p>
      <p className="phrase">{nearest.phrase}</p>
      {showPinned ? (
        <p className="pinned">
          Pinned: {pinned.team} {formatSeason(pinned.season)}. {usualShape(pinned)}
        </p>
      ) : null}
      {rest.length > 0 ? (
        <button type="button" aria-expanded={open} onClick={() => setOpen((value) => !value)}>
          {open ? "Hide other sides" : "Two more sides"}
        </button>
      ) : null}
      {open ? (
        <ol>
          {rest.map((item) => (
            <li key={item.side.id}>
              <strong>
                {item.side.team} {formatSeason(item.side.season)}
              </strong>
              <span>
                {item.side.competition} · {item.side.matches} matches · {item.phrase}
              </span>
            </li>
          ))}
        </ol>
      ) : null}
    </section>
  );
}
