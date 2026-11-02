import type { ShapeFeatures } from "./features";

export type SideSummary = {
  id: string;
  team: string;
  season: string;
  competition: string;
  matches: number;
  formationKey: string;
  formationShare: number;
  /** Modal shape of the first in-game lineup, in the same bands as formationKey. */
  shiftKey?: string | null;
  /** Share of matches whose first in-game shape is shiftKey. */
  shiftShare?: number;
  features: ShapeFeatures;
};

export type ShapeLibrary = {
  source: string;
  sourceUrl: string;
  note: string;
  sides: SideSummary[];
};
