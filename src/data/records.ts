import raw from "./season-records.json";

export type SeasonRecord = {
  id: string;
  manager: string;
  place: number;
  played: number;
  won: number;
  drawn: number;
  lost: number;
  goalsFor: number;
  goalsAgainst: number;
  points: number;
};

export type RecordLibrary = {
  source: string;
  sourceUrl: string;
  note: string;
  sides: SeasonRecord[];
};

export function loadSeasonRecords(): RecordLibrary {
  return raw as RecordLibrary;
}
