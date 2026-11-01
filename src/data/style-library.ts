import raw from "./style-library.json";

export type ShotGrid = number[][];

export type StyleSide = {
  id: string;
  team: string;
  season: string;
  competition: string;
  matches: number;
  passLength: number;
  shotsPerMatch: number;
  xgPerShot: number;
  shotGrid: ShotGrid;
  pressHeight: number;
  ppda: number;
  longPassShare: number;
  progressivePerMatch: number;
  fieldTilt: number;
};

export type StyleLibrary = {
  source: string;
  sourceUrl: string;
  note: string;
  sides: StyleSide[];
};

export function loadStyleLibrary(): StyleLibrary {
  return raw as StyleLibrary;
}
