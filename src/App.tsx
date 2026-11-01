import { useEffect, useRef, useState } from "react";
import { featuresFromPlayers } from "./compare/features";
import { formatSeason, shapeSummary } from "./compare/format";
import { rankSides } from "./compare/nearest";
import { loadShapeLibrary } from "./data/shape-library";
import { loadStyleLibrary } from "./data/style-library";
import { Pitch } from "./pitch/Pitch";
import { chooseTemplate, createBoard, movePlayer, selectPlayer, setFreePlacement, type BoardState } from "./tactics/board";
import {
  DEFAULT_INSTRUCTIONS,
  dutyNudge,
  instructionNotes,
  readInstructions,
  type TeamInstructions,
} from "./tactics/instructions";
import { labelSquad } from "./tactics/positions";
import { arrivalNote, arrivalPoint, hasArrivalMark } from "./tactics/arrival";
import { decodeTactic, encodeTactic, loadTactic, saveTactic, type SavedTactic } from "./tactics/persist";
import { effectFor, rolesFor, type Duty, type RoleId } from "./tactics/roles";
import { TEMPLATES } from "./tactics/templates";
import type { PitchPoint, Player } from "./tactics/types";
import { pickCorners, SITUATIONS } from "./testing/corners";
import { liveSample, styleShiftNote } from "./testing/live";
import { playersFromBoard, readStyle, resolveRole, STYLE_NOTE, WIDE_CODES } from "./testing/profile";
import type { Situation } from "./testing/sample";
import { InstructionSheet, type InstructionChoice } from "./ui/InstructionSheet";
import { KeepBar } from "./ui/KeepBar";
import { MatchReport } from "./ui/MatchReport";
import { NearestSide } from "./ui/NearestSide";
import { RoleSheet } from "./ui/RoleSheet";
import { StyleReading } from "./ui/StyleReading";
import { TemplateBar } from "./ui/TemplateBar";
import { TestSheet } from "./ui/TestSheet";
import "./styles/global.css";
import "./ui/shell.css";

const library = loadShapeLibrary();
const styles = loadStyleLibrary();

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

type PlayerSetup = { roleId: string; duty: Duty };
type OpponentPick = "nearest" | "deepest" | "hardestPress" | "shortestPass" | "mostDirect";

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
      freePlacement: saved.freePlacement,
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
  const [setups, setSetups] = useState<Record<string, PlayerSetup>>(() => opening?.setups ?? {});
  const [instructions, setInstructions] = useState<TeamInstructions>(
    () => opening?.instructions ?? DEFAULT_INSTRUCTIONS,
  );
  const [situation, setSituation] = useState<Situation>("level");
  const [opponentPick, setOpponentPick] = useState<OpponentPick>("nearest");
  const [status, setStatus] = useState<string | null>(null);
  const [roleShift, setRoleShift] = useState<string | null>(null);
  const styleWatch = useRef<{ nearestId: string | null; setupsKey: string } | null>(null);
  const [pinnedId] = useState(() => new URLSearchParams(window.location.search).get("side"));

  const display = preview
    ? board.players.map((player) => (player.id === preview.id ? preview : player))
    : board.players;
  const labels = labelSquad(display);
  const placed = labelSquad(board.players);
  const arrivals = board.players.flatMap((player) => {
    const label = placed.byId[player.id];
    const choice = resolveRole(label.line, WIDE_CODES.has(label.code), setups[player.id]);
    const arrival = arrivalPoint(
      player,
      effectFor(choice.roleId, dutyNudge(choice.duty, instructions.mentality)),
    );
    return hasArrivalMark(player, arrival) ? [{ id: player.id, ...arrival }] : [];
  });
  const summary = shapeSummary(featuresFromPlayers(display));
  const nearest = rankSides(featuresFromPlayers(board.players), library.sides);
  const profilePlayers = playersFromBoard(board.players, placed, setups).map((player) => ({
    ...player,
    duty: dutyNudge(player.duty, instructions.mentality),
  }));
  const reading = readStyle(profilePlayers, instructions, styles.sides);
  const styleSide = styles.sides.find((side) => side.id === reading.nearestId) ?? null;
  const corners = pickCorners(styles.sides);
  const cornerSide =
    opponentPick === "nearest"
      ? null
      : styles.sides.find((side) => side.id === corners[opponentPick].id) ?? null;
  const opponentSide = cornerSide ?? styleSide;
  const match = opponentSide
    ? liveSample({
        players: profilePlayers,
        instructions,
        opponent: opponentSide,
        situation,
        styles: styles.sides,
        seed: 1,
      })
    : null;
  const setupsKey = JSON.stringify(setups);
  useEffect(() => {
    const previous = styleWatch.current;
    setRoleShift(
      styleShiftNote(
        previous != null && previous.setupsKey !== setupsKey,
        previous?.nearestId ?? null,
        reading.nearestId,
      ),
    );
    styleWatch.current = { nearestId: reading.nearestId, setupsKey };
  }, [setupsKey, reading.nearestId]);
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
  const roleId: RoleId | null =
    roleChoices.find((role) => role.id === stored?.roleId)?.id ?? roleChoices[0]?.id ?? null;
  const duty = stored?.duty ?? "support";
  const nudgedDuty = dutyNudge(duty, instructions.mentality);
  const selectedPlayer = board.players.find((player) => player.id === board.selectedId) ?? null;
  const arrivalLine =
    selectedPlayer && roleId
      ? arrivalNote(selectedPlayer, arrivalPoint(selectedPlayer, effectFor(roleId, nudgedDuty)))
      : null;
  const mentalityNote =
    nudgedDuty === duty
      ? null
      : instructions.mentality === "attacking"
        ? "Attacking mentality pushes this duty on."
        : "Defensive mentality holds this duty back.";
  const arrival = [arrivalLine, mentalityNote].filter((line) => line).join(" ") || null;

  function assign(nextRole: string, nextDuty: Duty) {
    if (!board.selectedId) return;
    const id = board.selectedId;
    setSetups((current) => ({ ...current, [id]: { roleId: nextRole, duty: nextDuty } }));
  }

  function currentTactic(): SavedTactic {
    return {
      version: 1,
      players: board.players.map((player) => ({ id: player.id, x: player.x, y: player.y })),
      templateId: board.templateId,
      freePlacement: board.freePlacement,
      setups,
      instructions,
    };
  }

  function save() {
    saveTactic(window.localStorage, currentTactic());
    setStatus("Saved on this device");
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

  const situationLabel = SITUATIONS.find((item) => item.id === situation)?.label ?? "Level";
  const opponentChoices = [
    { id: "nearest", label: styleSide ? `Nearest · ${styleSide.team}` : "Nearest" },
    { id: "deepest", label: `Deepest · ${corners.deepest.team}` },
    { id: "hardestPress", label: `Hardest press · ${corners.hardestPress.team}` },
    { id: "shortestPass", label: `Shortest pass · ${corners.shortestPass.team}` },
    { id: "mostDirect", label: `Most direct · ${corners.mostDirect.team}` },
  ];
  const opponentLabel =
    opponentChoices.find((choice) => choice.id === opponentPick)?.label ?? "Nearest";
  const sampleLines = (match?.report.lines ?? []).filter((line) => !line.includes("passes the opponent completes"));
  const reportLines = [...sampleLines, ...(match?.notes ?? []), roleShift].filter((line): line is string => Boolean(line));

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
          arrivals={arrivals}
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
            arrival={arrival}
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
          mentality={MENTALITY}
          transition={TRANSITION}
          distribution={DISTRIBUTION}
          widthIntention={WIDTH_INTENTION}
          shooting={SHOOTING}
          value={instructions}
          notes={instructionNotes(instructions)}
          onChange={setInstructions}
        />
        <StyleReading
          team={styleSide?.team ?? null}
          season={styleSide ? formatSeason(styleSide.season) : null}
          competition={styleSide?.competition ?? null}
          matches={styleSide?.matches ?? null}
          xgPerShot={styleSide?.xgPerShot ?? null}
          passLength={reading.profile.passLength}
          shotsPerMatch={reading.profile.shotsPerMatch}
          lines={reading.lines}
          note={STYLE_NOTE}
          shotGrid={styleSide?.shotGrid ?? null}
        />
        <TestSheet
          situationLabel={situationLabel}
          opponentLabel={opponentLabel}
          situations={SITUATIONS.map((item) => ({ id: item.id, label: item.label }))}
          situation={situation}
          opponents={opponentChoices}
          opponent={opponentPick}
          onSituation={(id) => {
            const next = SITUATIONS.find((item) => item.id === id);
            if (next) setSituation(next.id);
          }}
          onOpponent={(id) => {
            const next = opponentChoices.find((choice) => choice.id === id);
            if (next) setOpponentPick(next.id as OpponentPick);
          }}
        />
        {match && opponentSide ? (
          <MatchReport
            team={opponentSide.team}
            season={formatSeason(opponentSide.season)}
            competition={opponentSide.competition}
            matches={opponentSide.matches}
            situation={situationLabel}
            modelXgFor={match.report.modelXgFor}
            modelXgAgainst={match.report.modelXgAgainst}
            tilt={match.report.tilt}
            yourPpda={match.yourPpda}
            theirPpda={opponentSide.ppda}
            restDefence={match.report.restDefence}
            lines={reportLines}
          />
        ) : null}
        <NearestSide ranked={nearest} pinned={pinned} />
        <KeepBar status={status} onSave={save} onShare={() => void share()} />
        <p className="credit">
          {library.sides.length} team-seasons from{" "}
          <a href={library.sourceUrl}>{library.source}</a>. Shapes are starting lineups, not
          measured defensive lines.
        </p>
      </main>
    </div>
  );
}
