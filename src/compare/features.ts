import { labelSquad } from "../tactics/positions";
import type { Line, Player } from "../tactics/types";

export const FEATURE_KEYS = [
  "backLine",
  "forwardLine",
  "width",
  "def",
  "dm",
  "cm",
  "am",
  "st",
] as const;

export type FeatureKey = (typeof FEATURE_KEYS)[number];

export type ShapeFeatures = Record<FeatureKey, number>;

export const FEATURE_WEIGHTS: ShapeFeatures = {
  backLine: 1,
  forwardLine: 1,
  width: 1,
  def: 2.2,
  dm: 2.2,
  cm: 2.2,
  am: 2.2,
  st: 2.2,
};

type Placed = {
  x: number;
  y: number;
  line: Line;
};

export function featuresFromPlayers(players: Player[]): ShapeFeatures {
  const labels = labelSquad(players);
  return shapeFeatures(
    players.map((player) => ({
      x: player.x,
      y: player.y,
      line: labels.byId[player.id].line,
    })),
  );
}

export function shapeFeatures(players: Placed[]): ShapeFeatures {
  const outfield = players.filter((player) => player.line !== "GK");
  const defenders = players.filter((player) => player.line === "DEF");
  const forwards = players.filter((player) => player.line === "ST");
  return {
    backLine: mean(defenders.length ? defenders.map((player) => player.y) : [24]),
    forwardLine: mean(forwards.length ? forwards.map((player) => player.y) : [86]),
    width: mean(outfield.map((player) => Math.abs(player.x - 50))),
    def: count(players, "DEF"),
    dm: count(players, "DM"),
    cm: count(players, "CM"),
    am: count(players, "AM"),
    st: count(players, "ST"),
  };
}

/** Five band counts, defenders through forwards. Zeros stay so 4-4-2 is not confused with 4-2-2. */
export function formationKey(features: ShapeFeatures): string {
  return [features.def, features.dm, features.cm, features.am, features.st]
    .map((count) => String(Math.round(count)))
    .join("-");
}

function count(players: Placed[], line: Line): number {
  return players.filter((player) => player.line === line).length;
}

function mean(values: number[]): number {
  if (values.length === 0) return 0;
  return values.reduce((sum, value) => sum + value, 0) / values.length;
}
