export type PitchPoint = {
  x: number;
  y: number;
};

export type Line = "GK" | "DEF" | "DM" | "CM" | "AM" | "ST";

export type PositionCode =
  | "GK"
  | "DL"
  | "DC"
  | "DR"
  | "WCB"
  | "WBL"
  | "WBR"
  | "DM"
  | "MC"
  | "ML"
  | "MR"
  | "AMC"
  | "AML"
  | "AMR"
  | "ST";

export type Player = PitchPoint & {
  id: string;
};

export const POSITION_NAMES: Record<PositionCode, string> = {
  GK: "Goalkeeper",
  DL: "Left-back",
  DC: "Centre-back",
  DR: "Right-back",
  WCB: "Wide centre-back",
  WBL: "Left wing-back",
  WBR: "Right wing-back",
  DM: "Defensive midfielder",
  MC: "Central midfielder",
  ML: "Left midfielder",
  MR: "Right midfielder",
  AMC: "Attacking midfielder",
  AML: "Left winger",
  AMR: "Right winger",
  ST: "Striker",
};
