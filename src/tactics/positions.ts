import { SLOTS } from "./slots";
import {
  POSITION_NAMES,
  type Line,
  type PitchPoint,
  type Player,
  type PositionCode,
} from "./types";

export const LINE_CENTRES: Record<Line, number> = {
  GK: SLOTS.GK.y,
  DEF: SLOTS.CB.y,
  DM: SLOTS.CDM.y,
  CM: SLOTS.CM.y,
  AM: SLOTS.CAM.y,
  ST: SLOTS.CF.y,
};

const LINES: Line[] = ["GK", "DEF", "DM", "CM", "AM", "ST"];

export type PlayerLabel = {
  code: PositionCode;
  name: string;
  line: Line;
  alternateCode: PositionCode | null;
  alternateName: string | null;
  halfSpace: boolean;
};

export type SquadLabels = {
  byId: Record<string, PlayerLabel>;
  keeperInferred: boolean;
};

type Classified = {
  code: PositionCode;
  line: Line;
  alternateLine: Line | null;
  halfSpace: boolean;
};

export function classifyPoint(point: PitchPoint): Classified {
  const ranked = LINES.map((line) => ({
    line,
    distance: Math.abs(point.y - LINE_CENTRES[line]),
  })).sort((a, b) => a.distance - b.distance);
  const line = ranked[0].line;
  const alternateLine =
    ranked[1].distance - ranked[0].distance <= 4 ? ranked[1].line : null;
  const dx = Math.abs(point.x - 50);
  return {
    code: codeFor(line, point),
    line,
    alternateLine,
    halfSpace: dx > 18 && dx <= 32,
  };
}

export function labelSquad(players: Player[]): SquadLabels {
  const classified = new Map(players.map((player) => [player.id, classifyPoint(player)]));
  markWideCentreBacks(players, classified);
  const keeperInferred = resolveKeeper(players, classified);

  const byId: Record<string, PlayerLabel> = {};
  for (const player of players) {
    const current = classified.get(player.id)!;
    const alternateCode = current.alternateLine
      ? codeFor(current.alternateLine, {
          x: player.x,
          y: LINE_CENTRES[current.alternateLine],
        })
      : null;
    const shownAlternate = alternateCode === current.code ? null : alternateCode;
    byId[player.id] = {
      code: current.code,
      name: POSITION_NAMES[current.code],
      line: current.line,
      alternateCode: shownAlternate,
      alternateName: shownAlternate ? POSITION_NAMES[shownAlternate] : null,
      halfSpace: current.halfSpace,
    };
  }
  return { byId, keeperInferred };
}

function markWideCentreBacks(
  players: Player[],
  classified: Map<string, Classified>,
): void {
  const centres = players
    .filter((player) => classified.get(player.id)?.code === "DC")
    .sort((a, b) => a.x - b.x);
  if (centres.length < 3) return;
  for (const player of [centres[0], centres[centres.length - 1]]) {
    const current = classified.get(player.id)!;
    classified.set(player.id, { ...current, code: "WCB" });
  }
}

function resolveKeeper(players: Player[], classified: Map<string, Classified>): boolean {
  const keepers = players.filter((player) => classified.get(player.id)?.code === "GK");
  if (keepers.length === 1) return false;

  const chosen =
    keepers.length === 0
      ? [...players].sort(byDepthThenCentre)[0]
      : [...keepers].sort(byCentreThenDepth)[0];

  for (const player of keepers) {
    if (player.id === chosen.id) continue;
    const current = classified.get(player.id)!;
    classified.set(player.id, {
      ...current,
      code: Math.abs(player.x - 50) <= 18 ? "DC" : player.x < 50 ? "DL" : "DR",
      line: "DEF",
    });
  }

  if (keepers.length === 0) {
    const current = classified.get(chosen.id)!;
    classified.set(chosen.id, { ...current, code: "GK", line: "GK", alternateLine: null });
    return true;
  }
  return false;
}

function byDepthThenCentre(a: Player, b: Player): number {
  return a.y - b.y || Math.abs(a.x - 50) - Math.abs(b.x - 50);
}

function byCentreThenDepth(a: Player, b: Player): number {
  return Math.abs(a.x - 50) - Math.abs(b.x - 50) || a.y - b.y;
}

function codeFor(line: Line, point: PitchPoint): PositionCode {
  const wide = Math.abs(point.x - 50) > 32;
  const central = Math.abs(point.x - 50) <= 18;
  const left = point.x < 50;
  if (line === "GK") return "GK";
  if (line === "DEF") return wide ? (left ? "DL" : "DR") : "DC";
  if (line === "DM") {
    if (!wide) return "DM";
    return point.y <= LINE_CENTRES.DM ? (left ? "WBL" : "WBR") : left ? "ML" : "MR";
  }
  if (line === "CM") return central ? "MC" : left ? "ML" : "MR";
  if (line === "AM") return central ? "AMC" : left ? "AML" : "AMR";
  return wide ? (left ? "AML" : "AMR") : "ST";
}
