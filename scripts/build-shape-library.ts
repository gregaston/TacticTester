import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { FEATURE_KEYS, featuresFromPlayers, formationKey, type ShapeFeatures } from "../src/compare/features";
import type { ShapeLibrary, SideSummary } from "../src/compare/types";
import { placeStatsBombPosition } from "../src/tactics/slots";

const ROOT = "https://raw.githubusercontent.com/statsbomb/open-data/master/data";
const CACHE = path.resolve(".cache/statsbomb");
const OUT = path.resolve("src/data/shape-library.json");

type SeasonSpec = {
  competitionId: number;
  seasonId: number;
  competition: string;
  season: string;
  teams: string[] | null;
};

const SEASONS: SeasonSpec[] = [
  { competitionId: 2, seasonId: 27, competition: "Premier League", season: "2015/2016", teams: null },
  { competitionId: 11, seasonId: 27, competition: "La Liga", season: "2015/2016", teams: null },
  { competitionId: 12, seasonId: 27, competition: "Serie A", season: "2015/2016", teams: null },
  { competitionId: 7, seasonId: 27, competition: "Ligue 1", season: "2015/2016", teams: null },
  { competitionId: 2, seasonId: 44, competition: "Premier League", season: "2003/2004", teams: ["Arsenal"] },
];

type MatchRow = {
  match_id: number;
  home_team: { home_team_name: string };
  away_team: { away_team_name: string };
};

type LineupFile = Array<{
  team_name: string;
  lineup: Array<{ positions: Array<{ position: string; start_reason: string }> }>;
}>;

type Sample = { features: ShapeFeatures; key: string };

async function main(): Promise<void> {
  const buckets = new Map<string, { spec: SeasonSpec; team: string; samples: Sample[] }>();
  const unknown = new Set<string>();
  let skipped = 0;

  for (const spec of SEASONS) {
    const matches = await cachedJson<MatchRow[]>(
      `${ROOT}/matches/${spec.competitionId}/${spec.seasonId}.json`,
      `matches-${spec.competitionId}-${spec.seasonId}.json`,
    );
    console.log(`${spec.competition} ${spec.season}: ${matches.length} matches`);
    await mapPool(matches, 16, async (match) => {
      const lineup = await cachedJson<LineupFile>(
        `${ROOT}/lineups/${match.match_id}.json`,
        `lineups/${match.match_id}.json`,
      );
      for (const team of lineup) {
        if (spec.teams && !spec.teams.includes(team.team_name)) continue;
        const sample = sampleTeam(team, unknown);
        if (!sample) {
          skipped += 1;
          continue;
        }
        const id = `${spec.competition}|${spec.season}|${team.team_name}`;
        const bucket = buckets.get(id) ?? { spec, team: team.team_name, samples: [] };
        bucket.samples.push(sample);
        buckets.set(id, bucket);
      }
    });
  }

  const sides = [...buckets.values()]
    .filter((bucket) => bucket.samples.length >= 15)
    .map((bucket) => toSide(bucket.spec, bucket.team, bucket.samples))
    .sort((a, b) =>
      a.competition.localeCompare(b.competition) ||
      a.season.localeCompare(b.season) ||
      a.team.localeCompare(b.team),
    );

  const library: ShapeLibrary = {
    source: "StatsBomb open data",
    sourceUrl: "https://github.com/statsbomb/open-data",
    note: "Starting-lineup shapes. Counts use TacticTester position bands. Line height is the named position, not a measured defensive line.",
    sides,
  };
  await mkdir(path.dirname(OUT), { recursive: true });
  await writeFile(OUT, `${JSON.stringify(library, null, 2)}\n`);
  console.log(`Wrote ${sides.length} sides to ${OUT}`);
  console.log(`Skipped ${skipped} team-matches`);
  if (unknown.size > 0) console.log(`Unknown positions: ${[...unknown].join(", ")}`);
}

function sampleTeam(team: LineupFile[number], unknown: Set<string>): Sample | null {
  const names = team.lineup.flatMap((player) =>
    player.positions.filter((spot) => spot.start_reason === "Starting XI").map((spot) => spot.position),
  );
  if (names.length !== 11) return null;
  const points = names.map((name) => {
    const point = placeStatsBombPosition(name);
    if (!point) unknown.add(name);
    return point;
  });
  if (points.some((point) => point === null)) return null;
  const players = points.map((point, index) => ({ id: `s${index}`, ...point! }));
  const features = featuresFromPlayers(players);
  return { features, key: formationKey(features) };
}

function toSide(spec: SeasonSpec, team: string, samples: Sample[]): SideSummary {
  const keys = samples.map((sample) => sample.key);
  const modal = mode(keys);
  return {
    id: slug(team, spec.competition, spec.season),
    team,
    season: spec.season,
    competition: spec.competition,
    matches: samples.length,
    formationKey: modal.value,
    formationShare: Math.round((modal.count / samples.length) * 100) / 100,
    features: averageFeatures(samples.map((sample) => sample.features)),
  };
}

function averageFeatures(rows: ShapeFeatures[]): ShapeFeatures {
  const totals = Object.fromEntries(FEATURE_KEYS.map((key) => [key, 0])) as ShapeFeatures;
  for (const row of rows) {
    for (const key of FEATURE_KEYS) totals[key] += row[key];
  }
  for (const key of FEATURE_KEYS) {
    totals[key] = Math.round((totals[key] / rows.length) * 100) / 100;
  }
  return totals;
}

function mode(values: string[]): { value: string; count: number } {
  const counts = new Map<string, number>();
  for (const value of values) counts.set(value, (counts.get(value) ?? 0) + 1);
  let best = "";
  let count = -1;
  for (const [value, seen] of [...counts.entries()].sort((a, b) => a[0].localeCompare(b[0]))) {
    if (seen > count) {
      best = value;
      count = seen;
    }
  }
  return { value: best, count };
}

function slug(...parts: string[]): string {
  return parts
    .join("-")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
}

async function cachedJson<T>(url: string, name: string): Promise<T> {
  const file = path.join(CACHE, name);
  try {
    return JSON.parse(await readFile(file, "utf8")) as T;
  } catch {
    const body = await fetchText(url);
    await mkdir(path.dirname(file), { recursive: true });
    await writeFile(file, body);
    return JSON.parse(body) as T;
  }
}

async function fetchText(url: string): Promise<string> {
  let lastError: unknown;
  for (let attempt = 0; attempt < 4; attempt += 1) {
    try {
      const response = await fetch(url);
      if (!response.ok) throw new Error(`${response.status} ${url}`);
      return await response.text();
    } catch (error) {
      lastError = error;
      await new Promise((resolve) => setTimeout(resolve, 400 * (attempt + 1)));
    }
  }
  throw lastError;
}

async function mapPool<T>(items: T[], limit: number, task: (item: T) => Promise<void>): Promise<void> {
  let index = 0;
  async function worker(): Promise<void> {
    while (index < items.length) {
      const current = index;
      index += 1;
      await task(items[current]);
    }
  }
  await Promise.all(Array.from({ length: limit }, () => worker()));
}

main().catch((error: unknown) => {
  console.error(error);
  process.exit(1);
});
