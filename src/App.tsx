import { useState } from "react";
import { featuresFromPlayers } from "./compare/features";
import { shapeSummary } from "./compare/format";
import { rankSides } from "./compare/nearest";
import { loadShapeLibrary } from "./data/shape-library";
import { Pitch } from "./pitch/Pitch";
import { chooseTemplate, createBoard, movePlayer, selectPlayer, setFreePlacement } from "./tactics/board";
import { labelSquad } from "./tactics/positions";
import type { PitchPoint, Player } from "./tactics/types";
import { NearestSide } from "./ui/NearestSide";
import { TemplateBar } from "./ui/TemplateBar";
import "./styles/global.css";
import "./ui/shell.css";

const library = loadShapeLibrary();

export function App() {
  const [board, setBoard] = useState(() => createBoard());
  const [preview, setPreview] = useState<Player | null>(null);
  const [pinnedId] = useState(() => new URLSearchParams(window.location.search).get("side"));

  const display = preview
    ? board.players.map((player) => (player.id === preview.id ? preview : player))
    : board.players;
  const labels = labelSquad(display);
  const summary = shapeSummary(featuresFromPlayers(display));
  const nearest = rankSides(featuresFromPlayers(board.players), library.sides);
  const pinned = library.sides.find((side) => side.id === pinnedId) ?? null;
  const selected = board.selectedId ? labels.byId[board.selectedId] : null;
  const title = board.templateId ?? "Custom";

  function commit(id: string, point: PitchPoint) {
    setPreview(null);
    setBoard((state) => movePlayer(state, id, point));
  }

  const selectionIsName = Boolean(selected) && !labels.keeperInferred;

  return (
    <div className="app">
      <header className="masthead">
        <div className="masthead-inner">
          <p className="kicker">Shape</p>
          <h1>TacticTester</h1>
          <p className="shape">
            <span className="shape-name">{title}</span>
            <span className="shape-detail">{summary}</span>
          </p>
        </div>
      </header>
      <main className="sheet">
        <TemplateBar
          activeId={board.templateId}
          freePlacement={board.freePlacement}
          onTemplate={(id) => {
            setPreview(null);
            setBoard((state) => chooseTemplate(state, id));
          }}
          onFreePlacement={(free) => setBoard((state) => setFreePlacement(state, free))}
        />
        <p className={selectionIsName ? "selection is-name" : "selection"}>
          {labels.keeperInferred
            ? "No goalkeeper was placed, so the deepest player is marked in goal."
            : selected
              ? selected.alternateName
                ? `${selected.name} / ${selected.alternateName}`
                : selected.name
              : "Drag a player. The position name follows the pitch."}
        </p>
        <Pitch
          players={display}
          labels={labels}
          selectedId={board.selectedId}
          onSelect={(id) => setBoard((state) => selectPlayer(state, id))}
          onPreview={(id, point) => setPreview({ id, ...point })}
          onCommit={commit}
        />
        <NearestSide ranked={nearest} pinned={pinned} />
        <p className="credit">
          {library.sides.length} team-seasons from{" "}
          <a href={library.sourceUrl}>{library.source}</a>. Shapes are starting lineups, not
          measured defensive lines.
        </p>
      </main>
    </div>
  );
}
