import { useState } from "react";
import { featuresFromPlayers } from "./compare/features";
import { shapeSummary } from "./compare/format";
import { rankSides } from "./compare/nearest";
import { loadShapeLibrary } from "./data/shape-library";
import { Pitch } from "./pitch/Pitch";
import { chooseTemplate, createBoard, movePlayer, selectPlayer, setFreePlacement } from "./tactics/board";
import {
  DEFAULT_INSTRUCTIONS,
  instructionNotes,
  type TeamInstructions,
} from "./tactics/instructions";
import { labelSquad } from "./tactics/positions";
import { rolesFor, type Duty } from "./tactics/roles";
import type { PitchPoint, Player, PositionCode } from "./tactics/types";
import { InstructionSheet, type InstructionChoice } from "./ui/InstructionSheet";
import { NearestSide } from "./ui/NearestSide";
import { RoleSheet } from "./ui/RoleSheet";
import { TemplateBar } from "./ui/TemplateBar";
import "./styles/global.css";
import "./ui/shell.css";

const library = loadShapeLibrary();

const WIDE_CODES = new Set<PositionCode>(["DL", "DR", "WBL", "WBR", "ML", "MR", "AML", "AMR"]);

const PASSING: InstructionChoice<TeamInstructions["passing"]>[] = [
  { value: "shorter", label: "Shorter" },
  { value: "standard", label: "Standard" },
  { value: "more direct", label: "More direct" },
];
const TEMPO: InstructionChoice<TeamInstructions["tempo"]>[] = [
  { value: "lower", label: "Lower" },
  { value: "standard", label: "Standard" },
  { value: "higher", label: "Higher" },
];
const WIDTH: InstructionChoice<TeamInstructions["width"]>[] = [
  { value: "narrower", label: "Narrower" },
  { value: "standard", label: "Standard" },
  { value: "wider", label: "Wider" },
];
const LINE: InstructionChoice<TeamInstructions["defensiveLine"]>[] = [
  { value: "deeper", label: "Deeper" },
  { value: "standard", label: "Standard" },
  { value: "higher", label: "Higher" },
];
const ENGAGEMENT: InstructionChoice<TeamInstructions["engagement"]>[] = [
  { value: "lower", label: "Lower" },
  { value: "standard", label: "Standard" },
  { value: "higher", label: "Higher" },
];
const PRESSING: InstructionChoice<TeamInstructions["pressing"]>[] = [
  { value: "less", label: "Less" },
  { value: "standard", label: "Standard" },
  { value: "more", label: "More" },
];

type PlayerSetup = { roleId: string; duty: Duty };

export function App() {
  const [board, setBoard] = useState(() => createBoard());
  const [preview, setPreview] = useState<Player | null>(null);
  const [setups, setSetups] = useState<Record<string, PlayerSetup>>({});
  const [instructions, setInstructions] = useState<TeamInstructions>(DEFAULT_INSTRUCTIONS);
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
  const roleChoices = selected ? rolesFor(selected.line, WIDE_CODES.has(selected.code)) : [];
  const stored = board.selectedId ? setups[board.selectedId] : undefined;
  const roleId =
    stored && roleChoices.some((role) => role.id === stored.roleId)
      ? stored.roleId
      : (roleChoices[0]?.id ?? null);
  const duty = stored?.duty ?? "support";

  function assign(nextRole: string, nextDuty: Duty) {
    if (!board.selectedId) return;
    const id = board.selectedId;
    setSetups((current) => ({ ...current, [id]: { roleId: nextRole, duty: nextDuty } }));
  }

  return (
    <div className="app">
      <header className="masthead">
        <div className="masthead-inner">
          <p className="kicker">Shape</p>
          <h1>TacticTester</h1>
          <p className="shape">
            <span className="shape-name">{title}</span>
            {summary !== title ? <span className="shape-detail">{summary}</span> : null}
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
        {selected && roleId ? (
          <RoleSheet
            positionName={selected.name}
            roles={roleChoices}
            roleId={roleId}
            duty={duty}
            onRole={(id) => assign(id, duty)}
            onDuty={(next) => assign(roleId, next)}
          />
        ) : null}
        <InstructionSheet
          passing={PASSING}
          tempo={TEMPO}
          width={WIDTH}
          defensiveLine={LINE}
          engagement={ENGAGEMENT}
          pressing={PRESSING}
          value={instructions}
          notes={instructionNotes(instructions)}
          onChange={setInstructions}
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
