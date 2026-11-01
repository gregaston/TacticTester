import { formationKey, type ShapeFeatures } from "./features";
import type { SideSummary } from "./types";

/** Drop empty bands so 4-0-4-1-1 reads as 4-4-1-1. */
export function compactShape(key: string): string {
  const parts = key.split("-").filter((part) => part !== "0");
  return parts.length > 0 ? parts.join("-") : "0";
}

export function shapeSummary(features: ShapeFeatures): string {
  return compactShape(formationKey(features));
}

export function usualShape(side: SideSummary): string {
  const shape = compactShape(side.formationKey);
  if (side.formationShare >= 0.995) return shape;
  const percent = Math.round(side.formationShare * 100);
  return `Usually ${shape} (${percent}% of matches)`;
}

export function formatSeason(season: string): string {
  const match = season.match(/^(\d{4})\/(\d{4})$/);
  if (!match) return season;
  return `${match[1]}/${match[2].slice(2)}`;
}
