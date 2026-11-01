import { useEffect, useRef, useState } from "react";
import { featuresFromPlayers } from "./compare/features";
import { formatSeason, shapeSummary } from "./compare/format";
import { rankSides } from "./compare/nearest";
import { loadShapeLibrary } from "./data/shape-library";
import { loadStyleLibrary } from "./data/style-library";
import { Pitch } from "./pitch/Pitch";
import { chooseTemplate, createBoard, movePlayer, selectPlayer, type BoardState } from "./tactics/board";
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
import { testTactic, type Battery } from "./testing/battery";
import { SITUATIONS } from "./testing/corners";
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
import { WeakList } from "./ui/WeakList";
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
  const [setups, setSetups] = useState<Record<string, PlayerSetup>>(() => opening?.setups ?? {});
  const [instructions, setInstructions] = useState<TeamInstructions>(
    () => opening?.instructions ?? DEFAULT_INSTRUCTIONS,
  );
  const [situation, setSituation] = useState<Situation>("level");
  const [battery, setBattery] = useState<Battery | null>(null);
  const [testedKey, setTestedKey] = useState<string | null>(null);
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
  const tacticKey = JSON.stringify({
    players: board.players.map((player) => [player.id, player.x, player.y]),
    setups,
    instructions,
    situation,
  });
  const weakest = battery?.weakest[0] ?? null;
  const weakestSide = weakest ? styles.sides.find((side) => side.id === weakest.id) ?? null : null;
  const weakestMatch = weakestSide
    ? liveSample({
        players: profilePlayers,
        instructions,
        opponent: weakestSide,
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
      freePlacement: false,
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
  const sampleLines = (weakestMatch?.report.lines ?? []).filter(
    (line) => !line.includes("passes the opponent completes"),
  );
  const reportLines = [...sampleLines, ...(weakestMatch?.notes ?? []), roleShift].filter(
    (line): line is string => Boolean(line),
  );

  function runTest() {
    setBattery(
      testTactic({
        players: profilePlayers,
        instructions,
        opponents: styles.sides,
        styles: styles.sides,
        situation,
        seed: 1,
      }),
    );
    setTestedKey(tacticKey);
  }

  function shown(row: NonNullable<Battery["held"]>) {
    return { ...row, season: formatSeason(row.season) };
  }

  return (
    <div className="app">
      <header className="masthead">
        <div className="masthead-inner">
          <h1>TacticTester</h1>
          <KeepBar status={status} onSave={save} onShare={() => void share()} />
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
        <p className={selectionIsName ? "selection is-name" : "selection"}>
          {labels.keeperInferred
            ? "No goalkeeper was placed, so the deepest player is marked in goal."
            : selected
              ? selected.alternateName
                ? `${selected.name} / ${selected.alternateName}`
                : selected.name
              : "Drag a player. The position name follows the pitch."}
        </p>
        <section className="formation-readout" aria-label="Formation">
          {board.templateId ? <span className="formation-name">{board.templateId}</span> : null}
          {board.templateId && summary !== board.templateId ? " " : null}
          {!board.templateId || summary !== board.templateId ? (
            <span className={board.templateId ? "formation-code" : "formation-name"}>{summary}</span>
          ) : null}
        </section>
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
          situations={SITUATIONS.map((item) => ({ id: item.id, label: item.label }))}
          situation={situation}
          onSituation={(id) => {
            const next = SITUATIONS.find((item) => item.id === id);
            if (next) setSituation(next.id);
          }}
          onTest={runTest}
          hasResult={battery != null}
          stale={battery != null && testedKey !== tacticKey}
        />
        {battery ? (
          <WeakList
            summary={battery.summary}
            rows={battery.weakest.map(shown)}
            held={battery.held ? shown(battery.held) : null}
          />
        ) : null}
        {battery && weakestMatch && weakestSide ? (
          <MatchReport
            team={weakestSide.team}
            season={formatSeason(weakestSide.season)}
            competition={weakestSide.competition}
            matches={weakestSide.matches}
            situation={situationLabel}
            modelXgFor={weakestMatch.report.modelXgFor}
            modelXgAgainst={weakestMatch.report.modelXgAgainst}
            tilt={weakestMatch.report.tilt}
            yourPpda={weakestMatch.yourPpda}
            theirPpda={weakestSide.ppda}
            restDefence={weakestMatch.report.restDefence}
            lines={reportLines}
          />
        ) : null}
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
