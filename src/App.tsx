import { useEffect, useRef, useState } from "react";
import { closestMatch } from "./compare/closest";
import { closestShape, featuresFromPlayers } from "./compare/features";
import { shapeSummary } from "./compare/format";
import { loadSeasonRecords } from "./data/records";
import { loadShapeLibrary } from "./data/shape-library";
import { loadStyleLibrary } from "./data/style-library";
import { LineSlider } from "./pitch/LineSlider";
import { Pitch, type TokenFace } from "./pitch/Pitch";
import {
  DEFENSIVE_STOPS,
  ENGAGEMENT_STOPS,
  defensiveAnchor,
  engagementAnchor,
  nearestDefensive,
  nearestEngagement,
  shiftedPoint,
  unshiftedPoint,
} from "./tactics/block";
import { chooseTemplate, createBoard, movePlayer, selectPlayer, type BoardState } from "./tactics/board";
import {
  DEFAULT_INSTRUCTIONS,
  instructionNotes,
  readInstructions,
  type Engagement,
  type LineHeight,
  type TeamInstructions,
} from "./tactics/instructions";
import { labelSquad } from "./tactics/positions";
import { arrivalNote } from "./tactics/arrival";
import { heatField, influencedPoint } from "./tactics/heat";
import { decodeTactic, encodeTactic, loadTactic, saveTactic, type SavedTactic } from "./tactics/persist";
import { effectFor, roleMark, roleName, rolesFor, type RoleId } from "./tactics/roles";
import { TEMPLATES } from "./tactics/templates";
import type { PitchPoint, Player } from "./tactics/types";
import { clearTestHistory } from "./testing/history";
import { playersFromBoard, readStyle, resolveRole, WIDE_CODES } from "./testing/profile";
import { InstructionSheet, type InstructionChoice } from "./ui/InstructionSheet";
import { KeepBar } from "./ui/KeepBar";
import { applyTheme, loadTheme, saveTheme, type ThemeName } from "./ui/theme";
import { ClosestSide } from "./ui/ClosestSide";
import { RoleSheet } from "./ui/RoleSheet";
import { TemplateBar } from "./ui/TemplateBar";
import { TestSheet } from "./ui/TestSheet";
import "./styles/global.css";
import "./ui/shell.css";

const library = loadShapeLibrary();
const styles = loadStyleLibrary();
const records = loadSeasonRecords();

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
const PRESSING: InstructionChoice<TeamInstructions["pressing"]>[] = [
  { value: "less", label: "Less" },
  { value: "standard", label: "Standard" },
  { value: "more", label: "More" },
];
const MENTALITY: InstructionChoice<TeamInstructions["mentality"]>[] = [
  { value: "defensive", label: "Defensive" },
  { value: "balanced", label: "Balanced" },
  { value: "attacking", label: "Attacking" },
];
const TRANSITION: InstructionChoice<TeamInstructions["transition"]>[] = [
  { value: "regroup", label: "Regroup" },
  { value: "standard", label: "Standard" },
  { value: "counter-press", label: "Counter-press" },
];
const DISTRIBUTION: InstructionChoice<TeamInstructions["distribution"]>[] = [
  { value: "play out", label: "Play out" },
  { value: "mixed", label: "Mixed" },
  { value: "go long", label: "Go long" },
];
const WIDTH_INTENTION: InstructionChoice<TeamInstructions["widthIntention"]>[] = [
  { value: "underlap", label: "Underlap" },
  { value: "balanced", label: "Balanced" },
  { value: "overlap", label: "Overlap" },
];
const SHOOTING: InstructionChoice<TeamInstructions["shooting"]>[] = [
  { value: "work the ball", label: "Work the ball" },
  { value: "standard", label: "Standard" },
  { value: "shoot on sight", label: "Shoot on sight" },
];

type PlayerSetup = { roleId: string };

function openingFromLocation(): {
  board: BoardState;
  setups: Record<string, PlayerSetup>;
  instructions: TeamInstructions;
} | null {
  const saved = decodeTactic(window.location.hash) ?? loadTactic(window.localStorage);
  if (!saved || saved.players.length === 0) return null;
  const templateId =
    saved.templateId && TEMPLATES.some((template) => template.id === saved.templateId) ? saved.templateId : null;
  return {
    board: {
      players: saved.players.map((player) => ({ id: player.id, x: player.x, y: player.y })),
      selectedId: null,
      templateId,
    },
    setups: saved.setups,
    instructions: readInstructions(saved.instructions),
  };
}

export function App() {
  const [opening] = useState(openingFromLocation);
  const [board, setBoard] = useState(() => opening?.board ?? createBoard());
  const [preview, setPreview] = useState<Player | null>(null);
  const [lineLive, setLineLive] = useState<{ kind: "engagement" | "defensive"; y: number } | null>(null);
  const [setups, setSetups] = useState<Record<string, PlayerSetup>>(() => opening?.setups ?? {});
  const [instructions, setInstructions] = useState<TeamInstructions>(
    () => opening?.instructions ?? DEFAULT_INSTRUCTIONS,
  );
  const [status, setStatus] = useState<string | null>(null);
  const [theme, setTheme] = useState<ThemeName>(() => loadTheme(window.localStorage));
  const defensiveY =
    lineLive?.kind === "defensive" ? lineLive.y : defensiveAnchor(instructions.defensiveLine);
  const engagementY =
    lineLive?.kind === "engagement" ? lineLive.y : engagementAnchor(instructions.engagement);
  const engagementStop =
    ENGAGEMENT_STOPS.find(
      (stop) =>
        stop.value ===
        (lineLive?.kind === "engagement" ? nearestEngagement(lineLive.y) : instructions.engagement),
    ) ?? ENGAGEMENT_STOPS[1];
  const defensiveStop =
    DEFENSIVE_STOPS.find(
      (stop) =>
        stop.value ===
        (lineLive?.kind === "defensive" ? nearestDefensive(lineLive.y) : instructions.defensiveLine),
    ) ?? DEFENSIVE_STOPS[1];
  const previewStored = preview
    ? { id: preview.id, ...unshiftedPoint(preview, defensiveY, engagementY) }
    : null;
  const storedDisplay = previewStored
    ? board.players.map((player) => (player.id === previewStored.id ? previewStored : player))
    : board.players;
  const labels = labelSquad(storedDisplay);
  const placed = labelSquad(board.players);
  const visualPlayers = board.players.map((player) => {
    if (preview && player.id === preview.id) return preview;
    const line = placed.byId[player.id]?.line;
    return line ? { ...player, ...shiftedPoint(player, line, defensiveY, engagementY) } : player;
  });
  const faces: Record<string, TokenFace> = {};
  const heatPlayers = [];
  for (const player of visualPlayers) {
    const label = labels.byId[player.id];
    const choice = resolveRole(label.line, WIDE_CODES.has(label.code), setups[player.id]);
    faces[player.id] = {
      mark: roleMark(choice),
      roleName: roleName(choice),
    };
    if (board.selectedId && player.id !== board.selectedId) continue;
    heatPlayers.push({
      x: player.x,
      y: player.y,
      line: label.line,
      roleId: choice,
    });
  }
  const heat = heatField(heatPlayers, instructions, { defensiveY, engagementY });
  const summary = shapeSummary(featuresFromPlayers(storedDisplay));
  const profilePlayers = playersFromBoard(board.players, placed, setups);
  const reading = readStyle(profilePlayers, instructions, styles.sides);
  const match = closestMatch(
    closestShape(storedDisplay),
    reading.profile,
    library.sides,
    styles.sides,
    records.sides,
    { players: profilePlayers, instructions, styles: styles.sides },
  );
  const tacticKey = JSON.stringify({
    players: board.players.map((player) => [player.id, player.x, player.y]),
    setups,
    instructions,
  });
  const selected = board.selectedId ? labels.byId[board.selectedId] : null;

  function commit(id: string, point: PitchPoint) {
    setPreview(null);
    setBoard((state) => {
      const current = state.players.find((player) => player.id === id);
      const line = current ? labelSquad(state.players).byId[id]?.line : undefined;
      if (current && line) {
        const displayed = shiftedPoint(current, line, defensiveY, engagementY);
        if (Math.hypot(point.x - displayed.x, point.y - displayed.y) < 1.5) return state;
      }
      return movePlayer(state, id, unshiftedPoint(point, defensiveY, engagementY));
    });
  }

  function liveLine(kind: "engagement" | "defensive", y: number) {
    setLineLive({ kind, y });
  }

  function commitLine(kind: "engagement" | "defensive", y: number) {
    setLineLive(null);
    setInstructions((current) =>
      kind === "defensive"
        ? { ...current, defensiveLine: nearestDefensive(y) }
        : { ...current, engagement: nearestEngagement(y) },
    );
  }

  function selectLine(kind: "engagement" | "defensive", value: Engagement | LineHeight) {
    setLineLive(null);
    setInstructions((current) =>
      kind === "defensive"
        ? { ...current, defensiveLine: value as LineHeight }
        : { ...current, engagement: value as Engagement },
    );
  }

  const roleChoices = selected ? rolesFor(selected.line, WIDE_CODES.has(selected.code)) : [];
  const stored = board.selectedId ? setups[board.selectedId] : undefined;
  const roleId: RoleId | null =
    roleChoices.find((role) => role.id === stored?.roleId)?.id ?? roleChoices[0]?.id ?? null;
  const selectedPlayer = visualPlayers.find((player) => player.id === board.selectedId) ?? null;
  const arrival =
    selectedPlayer && roleId && selected
      ? arrivalNote(
          selectedPlayer,
          influencedPoint(selectedPlayer, selected.line, effectFor(roleId), instructions),
        )
      : null;

  function assign(nextRole: string) {
    if (!board.selectedId) return;
    const id = board.selectedId;
    setSetups((current) => ({ ...current, [id]: { roleId: nextRole } }));
  }

  function currentTactic(): SavedTactic {
    return {
      version: 1,
      players: board.players.map((player) => ({ id: player.id, x: player.x, y: player.y })),
      templateId: board.templateId,
      freePlacement: false,
      setups,
      instructions,
    };
  }

  const persistKey = JSON.stringify(currentTactic());
  const openedKey = useRef(persistKey);

  useEffect(() => {
    try {
      saveTactic(window.localStorage, currentTactic());
    } catch {
      // The board still works. Storage can be full or blocked.
    }
    if (persistKey === openedKey.current) return;
    if (decodeTactic(window.location.hash)) {
      window.history.replaceState(null, "", `${window.location.pathname}${window.location.search}`);
    }
  }, [persistKey]);

  function chooseTheme(next: ThemeName) {
    setTheme(next);
    applyTheme(next);
    try {
      saveTheme(next, window.localStorage);
    } catch {
      // The colours still change for this visit.
    }
  }

  function save() {
    saveTactic(window.localStorage, currentTactic());
    setStatus("Saved on this device");
  }

  function clearHistory() {
    clearTestHistory(window.localStorage);
    setStatus("Test history cleared");
  }

  async function share() {
    const hash = encodeTactic(currentTactic());
    const url = `${window.location.origin}${window.location.pathname}${window.location.search}#${hash}`;
    window.history.replaceState(null, "", `#${hash}`);
    try {
      await navigator.clipboard.writeText(url);
      setStatus("Link copied");
    } catch {
      setStatus("Link ready");
    }
  }

  return (
    <div className="app">
      <header className="masthead">
        <div className="masthead-inner">
          <h1>TacticTester</h1>
          <div className="masthead-tools">
            <button
              type="button"
              className="theme-switch"
              aria-pressed={theme === "night"}
              aria-label="Night mode"
              onClick={() => chooseTheme(theme === "night" ? "day" : "night")}
            >
              Night
            </button>
            <KeepBar
              status={status}
              onSave={save}
              onShare={() => void share()}
              onClearHistory={clearHistory}
            />
          </div>
        </div>
      </header>
      <main className="sheet">
        <TemplateBar
          activeId={board.templateId}
          onTemplate={(id) => {
            setPreview(null);
            setBoard((state) => chooseTemplate(state, id));
          }}
        />
        {labels.keeperInferred ? (
          <p className="selection">No goalkeeper was placed, so the deepest player is marked in goal.</p>
        ) : null}
        <section className="formation-readout">
          <span className="formation-label">Current formation:</span>
          <span className="formation-value">
            {board.templateId ? <span className="formation-name">{board.templateId}</span> : null}
            {board.templateId && summary !== board.templateId ? " " : null}
            {!board.templateId || summary !== board.templateId ? (
              <span className={board.templateId ? "formation-code" : "formation-name"}>{summary}</span>
            ) : null}
          </span>
        </section>
        <div className="pitch-frame">
          <div className="pitch-rail">
            <LineSlider
              name="Engagement"
              mark="Eng"
              half="attack"
              y={engagementY}
              face={engagementStop.face}
              valueText={engagementStop.label}
              stops={ENGAGEMENT_STOPS}
              onLive={(y) => liveLine("engagement", y)}
              onCommit={(y) => commitLine("engagement", y)}
              onSelect={(value) => selectLine("engagement", value as Engagement)}
            />
            <LineSlider
              name="Defensive line"
              mark="Line"
              half="defend"
              y={defensiveY}
              face={defensiveStop.face}
              valueText={defensiveStop.label}
              stops={DEFENSIVE_STOPS}
              onLive={(y) => liveLine("defensive", y)}
              onCommit={(y) => commitLine("defensive", y)}
              onSelect={(value) => selectLine("defensive", value as LineHeight)}
            />
          </div>
          <Pitch
            players={visualPlayers}
            labels={labels}
            faces={faces}
            heat={heat}
            engagementY={engagementY}
            defensiveY={defensiveY}
            selectedId={board.selectedId}
            onSelect={(id) => setBoard((state) => selectPlayer(state, id))}
            onDeselect={() => {
              setPreview(null);
              setBoard((state) => selectPlayer(state, null));
            }}
            onPreview={(id, point) => setPreview({ id, ...point })}
            onCommit={commit}
          />
        </div>
        {selected && roleId ? (
          <RoleSheet
            positionName={selected.name}
            roles={roleChoices}
            roleId={roleId}
            arrival={arrival}
            onRole={assign}
          />
        ) : null}
        <InstructionSheet
          passing={PASSING}
          tempo={TEMPO}
          width={WIDTH}
          pressing={PRESSING}
          mentality={MENTALITY}
          transition={TRANSITION}
          distribution={DISTRIBUTION}
          widthIntention={WIDTH_INTENTION}
          shooting={SHOOTING}
          value={instructions}
          notes={instructionNotes(instructions)}
          onChange={setInstructions}
        />
        <ClosestSide match={match} />
        <TestSheet
          label={`${board.templateId ?? summary} · ${instructions.mentality}`}
          tacticKey={tacticKey}
          players={profilePlayers}
          instructions={instructions}
          opponents={styles.sides.map((side) => ({
            ...side,
            shapeWidth: library.sides.find((shape) => shape.id === side.id)?.features.width,
          }))}
        />
        <p className="credit">
          {library.sides.length} team-seasons from{" "}
          <a href={library.sourceUrl}>{library.source}</a>. The record is that season's league
          table. Shapes are starting lineups, not measured defensive lines.
        </p>
      </main>
    </div>
  );
}
