import type { ShapeFeatures } from "./features";

export type SideSummary = {
  id: string;
  team: string;
  season: string;
  competition: string;
  matches: number;
  formationKey: string;
  formationShare: number;
  features: ShapeFeatures;
};

export type ShapeLibrary = {
  source: string;
  sourceUrl: string;
  note: string;
  sides: SideSummary[];
};
