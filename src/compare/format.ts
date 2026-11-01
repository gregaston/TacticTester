import { formationKey, type ShapeFeatures } from "./features";
import type { SideSummary } from "./types";

const BANDS = [
  "at the back",
  "holding",
  "in midfield",
  "in attacking midfield",
  "up front",
] as const;

export function shapeSummary(features: ShapeFeatures): string {
  return wordsFromCounts(formationKey(features).split("-").map(Number));
}

export function usualShape(side: SideSummary): string {
  const words = wordsFromCounts(side.formationKey.split("-").map(Number));
  if (side.formationShare >= 0.995) return words;
  const percent = Math.round(side.formationShare * 100);
  return `Usually ${words} (${percent}% of matches)`;
}

export function formatSeason(season: string): string {
  const match = season.match(/^(\d{4})\/(\d{4})$/);
  if (!match) return season;
  return `${match[1]}/${match[2].slice(2)}`;
}

function wordsFromCounts(counts: number[]): string {
  const parts = counts.flatMap((count, index) =>
    count > 0 ? [`${count} ${BANDS[index]}`] : [],
  );
  return parts.join(", ");
}
