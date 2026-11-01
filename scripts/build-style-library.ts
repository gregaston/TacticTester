import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";

/**
 * Season style fingerprints from StatsBomb open data.
 *
 * shotGrid is number[4][6]: season shot counts after each shot is moved so
 * the side attacks toward x = 120 (the opponent goal).
 *   row 0 is y 0–20, row 3 is y 60–80
 *   column 0 is x 0–20, column 5 is x 100–120
 * Bins are 20 yards. x = 120 lands in column 5 and y = 80 lands in row 3.
 *
 * Direction is detected per team-period from that team's shots. If their mean
 * shot x is under 60 they are attacking toward x = 0, so the point is flipped
 * (x → 120-x, y → 80-y). StatsBomb stores each event in the event team's own
 * frame, so an opponent point is mirrored again into this side's attacking
 * frame. Press height and the PPDA-style zone (normalised x >= 48, the
 * attacking 60%) then describe the same patch of pitch.
 *
 * passLength is the mean of pass.length on completed passes, in yards.
 * A completed pass has no pass.outcome, or an outcome with no name.
 * Defensive actions are Tackle, Interception, Foul Committed, Block, and
 * Dribbled Past. Current open data records a tackle as a Duel whose duel
 * type is Tackle; those count too. Pressure events are not required.
 */

const ROOT = "https://raw.githubusercontent.com/statsbomb/open-data/master/data";
const CACHE = path.resolve(".cache/statsbomb");
const OUT = path.resolve("src/data/style-library.json");

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
  home_team: { home_team_id: number; home_team_name: string };
  away_team: { away_team_id: number; away_team_name: string };
};

type SbEvent = {
  period?: number;
  type?: { name?: string };
  team?: { id?: number; name?: string };
  location?: number[];
  pass?: { length?: number; outcome?: { name?: string } | null };
  shot?: { statsbomb_xg?: number };
  duel?: { type?: { name?: string } };
};

type ShotGrid = number[][];

type Totals = {
  spec: SeasonSpec;
  team: string;
  matches: number;
  passLengthSum: number;
  passCount: number;
  shots: number;
  xgSum: number;
  xgCount: number;
  shotGrid: ShotGrid;
  pressSum: number;
  pressCount: number;
  ppdaSum: number;
  ppdaMatches: number;
};

type MatchStats = {
  present: boolean;
  passLengthSum: number;
  passCount: number;
  shots: number;
  xgSum: number;
  xgCount: number;
  shotGrid: ShotGrid;
  pressSum: number;
  pressCount: number;
  oppPasses: number;
  defZone: number;
};

type StyleSide = {
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
};

const DEFENSIVE_TYPES = new Set(["Tackle", "Interception", "Foul Committed", "Block", "Dribbled Past"]);

async function main(): Promise<void> {
  const buckets = new Map<string, Totals>();
  let skipped = 0;

  for (const spec of SEASONS) {
    const matches = await cachedJson<MatchRow[]>(
      `${ROOT}/matches/${spec.competitionId}/${spec.seasonId}.json`,
      `matches-${spec.competitionId}-${spec.seasonId}.json`,
    );
    console.log(`${spec.competition} ${spec.season}: ${matches.length} matches`);
    let done = 0;
    await mapPool(matches, 6, async (match) => {
      try {
        const events = await loadEvents(match.match_id);
        absorb(spec, match, events, buckets);
      } catch (error) {
        skipped += 1;
        console.warn(`skip ${match.match_id}: ${error instanceof Error ? error.message : String(error)}`);
      }
      done += 1;
      if (done % 25 === 0 || done === matches.length) {
        console.log(`${spec.competition} ${spec.season}: ${done}/${matches.length}`);
      }
    });
  }

  const sides = [...buckets.values()]
    .map((bucket) => toSide(bucket))
    .filter((side): side is StyleSide => side !== null)
    .sort((a, b) =>
      a.competition.localeCompare(b.competition) ||
      a.season.localeCompare(b.season) ||
      a.team.localeCompare(b.team),
    );

  const library = {
    source: "StatsBomb open data",
    sourceUrl: "https://github.com/statsbomb/open-data",
    note: "PPDA-style press rate inspired by the public Hudl definition, not a copy of their database. xG values are StatsBomb's open-data shot xG, shots maps are coarse counts, and lineups are not re-derived here.",
    sides,
  };
  await mkdir(path.dirname(OUT), { recursive: true });
  await writeFile(OUT, `${JSON.stringify(library, null, 2)}\n`);
  console.log(`Wrote ${sides.length} sides to ${OUT}`);
  console.log(`Skipped ${skipped} matches`);
  for (const side of sides) {
    const odd: string[] = [];
    if (side.passLength < 8 || side.passLength > 40) odd.push(`passLength ${side.passLength}`);
    if (side.xgPerShot < 0.02 || side.xgPerShot > 0.4) odd.push(`xgPerShot ${side.xgPerShot}`);
    if (side.ppda < 2 || side.ppda > 40) odd.push(`ppda ${side.ppda}`);
    if (side.pressHeight < 0 || side.pressHeight > 100) odd.push(`pressHeight ${side.pressHeight}`);
    if (odd.length > 0) console.warn(`${side.id}: ${odd.join(", ")}`);
  }
}

function absorb(spec: SeasonSpec, match: MatchRow, events: SbEvent[], buckets: Map<string, Totals>): void {
  const names = new Map<number, string>([
    [match.home_team.home_team_id, match.home_team.home_team_name],
    [match.away_team.away_team_id, match.away_team.away_team_name],
  ]);
  const focus = [...names.values()].filter((team) => !spec.teams || spec.teams.includes(team));
  if (focus.length === 0 || !Array.isArray(events) || events.length === 0) return;
  const stats = summarise(events, names, focus);
  for (const team of focus) {
    const matchStats = stats.get(team);
    if (!matchStats?.present) continue;
    const key = `${spec.competition}|${spec.season}|${team}`;
    const totals = buckets.get(key) ?? emptyTotals(spec, team);
    addMatch(totals, matchStats);
    buckets.set(key, totals);
  }
}

function summarise(events: SbEvent[], names: Map<number, string>, focus: string[]): Map<string, MatchStats> {
  const stats = new Map(focus.map((team) => [team, emptyMatch()]));
  const towardOwnGoal = directionOf(events, names);
  const opponents = new Map<string, string>();
  const all = [...names.values()];
  for (const team of focus) {
    const other = all.find((name) => name !== team);
    if (other) opponents.set(team, other);
  }

  for (const event of events) {
    const team = canonicalTeam(event, names);
    if (!team) continue;
    const period = event.period ?? 1;
    const own = stats.get(team);
    if (own) own.present = true;
    if (own && isCompletedPass(event)) {
      const length = event.pass?.length;
      if (typeof length === "number" && Number.isFinite(length)) {
        own.passLengthSum += length;
        own.passCount += 1;
      }
    }
    if (own && event.type?.name === "Shot") {
      own.shots += 1;
      const xg = event.shot?.statsbomb_xg;
      if (typeof xg === "number" && Number.isFinite(xg)) {
        own.xgSum += xg;
        own.xgCount += 1;
      }
      const point = readPoint(event.location);
      if (point) {
        const [x, y] = attackingPoint(point.x, point.y, team, team, period, towardOwnGoal);
        const col = Math.min(5, Math.max(0, Math.floor(x / 20)));
        const row = Math.min(3, Math.max(0, Math.floor(y / 20)));
        own.shotGrid[row][col] += 1;
      }
    }
    if (own && isDefensive(event)) {
      const point = readPoint(event.location);
      if (point) {
        const [x] = attackingPoint(point.x, point.y, team, team, period, towardOwnGoal);
        own.pressSum += (x / 120) * 100;
        own.pressCount += 1;
        if (x >= 48) own.defZone += 1;
      }
    }
    if (isCompletedPass(event)) {
      const point = readPoint(event.location);
      if (!point) continue;
      for (const [reference, opponent] of opponents) {
        if (opponent !== team) continue;
        const [x] = attackingPoint(point.x, point.y, team, reference, period, towardOwnGoal);
        if (x >= 48) stats.get(reference)!.oppPasses += 1;
      }
    }
  }
  return stats;
}

function directionOf(events: SbEvent[], names: Map<number, string>): (team: string, period: number) => boolean {
  const shots = new Map<string, { sum: number; n: number }>();
  const teams = new Set<string>();
  for (const event of events) {
    const team = canonicalTeam(event, names);
    if (!team) continue;
    teams.add(team);
    if (event.type?.name !== "Shot") continue;
    const x = event.location?.[0];
    if (typeof x !== "number" || !Number.isFinite(x)) continue;
    const period = event.period ?? 1;
    const row = shots.get(shotKey(team, period)) ?? { sum: 0, n: 0 };
    row.sum += x;
    row.n += 1;
    shots.set(shotKey(team, period), row);
  }
  const cache = new Map<string, boolean>();
  return (team, period) => {
    const key = shotKey(team, period);
    const saved = cache.get(key);
    if (saved !== undefined) return saved;
    const low = attacksTowardOwnGoal(team, period, shots, teams);
    cache.set(key, low);
    return low;
  };
}

function attacksTowardOwnGoal(
  team: string,
  period: number,
  shots: Map<string, { sum: number; n: number }>,
  teams: Set<string>,
): boolean {
  const direct = shots.get(shotKey(team, period));
  if (direct && direct.n > 0) return direct.sum / direct.n < 60;
  for (const [key, row] of shots) {
    if (row.n === 0) continue;
    const [name, periodText] = key.split("\0");
    if (name !== team) continue;
    const other = Number(periodText);
    const low = row.sum / row.n < 60;
    return other % 2 === period % 2 ? low : !low;
  }
  for (const otherTeam of teams) {
    if (otherTeam === team) continue;
    for (const [key, row] of shots) {
      if (row.n === 0) continue;
      const [name, periodText] = key.split("\0");
      if (name !== otherTeam) continue;
      const other = Number(periodText);
      const low = row.sum / row.n < 60;
      const otherLow = other % 2 === period % 2 ? low : !low;
      return !otherLow;
    }
  }
  return false;
}

function attackingPoint(
  x: number,
  y: number,
  eventTeam: string,
  reference: string,
  period: number,
  towardOwnGoal: (team: string, period: number) => boolean,
): [number, number] {
  if (towardOwnGoal(eventTeam, period)) {
    x = 120 - x;
    y = 80 - y;
  }
  if (eventTeam !== reference) {
    x = 120 - x;
    y = 80 - y;
  }
  return [Math.min(120, Math.max(0, x)), Math.min(80, Math.max(0, y))];
}

function canonicalTeam(event: SbEvent, names: Map<number, string>): string | null {
  const id = event.team?.id;
  if (typeof id !== "number") return null;
  return names.get(id) ?? null;
}

function isCompletedPass(event: SbEvent): boolean {
  if (event.type?.name !== "Pass") return false;
  const outcome = event.pass?.outcome;
  if (outcome == null) return true;
  return outcome.name == null || outcome.name === "";
}

function isDefensive(event: SbEvent): boolean {
  const name = event.type?.name;
  if (!name) return false;
  if (DEFENSIVE_TYPES.has(name)) return true;
  return name === "Duel" && event.duel?.type?.name === "Tackle";
}

function readPoint(location: number[] | undefined): { x: number; y: number } | null {
  if (!location || location.length < 2) return null;
  const [x, y] = location;
  if (typeof x !== "number" || typeof y !== "number" || !Number.isFinite(x) || !Number.isFinite(y)) return null;
  return { x, y };
}

function emptyGrid(): ShotGrid {
  return Array.from({ length: 4 }, () => [0, 0, 0, 0, 0, 0]);
}

function emptyMatch(): MatchStats {
  return {
    present: false,
    passLengthSum: 0,
    passCount: 0,
    shots: 0,
    xgSum: 0,
    xgCount: 0,
    shotGrid: emptyGrid(),
    pressSum: 0,
    pressCount: 0,
    oppPasses: 0,
    defZone: 0,
  };
}

function emptyTotals(spec: SeasonSpec, team: string): Totals {
  return {
    spec,
    team,
    matches: 0,
    passLengthSum: 0,
    passCount: 0,
    shots: 0,
    xgSum: 0,
    xgCount: 0,
    shotGrid: emptyGrid(),
    pressSum: 0,
    pressCount: 0,
    ppdaSum: 0,
    ppdaMatches: 0,
  };
}

function addMatch(totals: Totals, match: MatchStats): void {
  totals.matches += 1;
  totals.passLengthSum += match.passLengthSum;
  totals.passCount += match.passCount;
  totals.shots += match.shots;
  totals.xgSum += match.xgSum;
  totals.xgCount += match.xgCount;
  for (let row = 0; row < 4; row += 1) {
    for (let col = 0; col < 6; col += 1) totals.shotGrid[row][col] += match.shotGrid[row][col];
  }
  totals.pressSum += match.pressSum;
  totals.pressCount += match.pressCount;
  if (match.defZone > 0) {
    totals.ppdaSum += match.oppPasses / match.defZone;
    totals.ppdaMatches += 1;
  }
}

function toSide(totals: Totals): StyleSide | null {
  if (totals.matches < 10) return null;
  if (totals.passCount === 0 || totals.xgCount === 0 || totals.pressCount === 0 || totals.ppdaMatches === 0) return null;
  return {
    id: slug(totals.team, totals.spec.competition, totals.spec.season),
    team: totals.team,
    season: totals.spec.season,
    competition: totals.spec.competition,
    matches: totals.matches,
    passLength: round2(totals.passLengthSum / totals.passCount),
    shotsPerMatch: round2(totals.shots / totals.matches),
    xgPerShot: round2(totals.xgSum / totals.xgCount),
    shotGrid: totals.shotGrid,
    pressHeight: round2(totals.pressSum / totals.pressCount),
    ppda: round2(totals.ppdaSum / totals.ppdaMatches),
  };
}

function round2(value: number): number {
  return Math.round(value * 100) / 100;
}

function shotKey(team: string, period: number): string {
  return `${team}\0${period}`;
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

async function loadEvents(matchId: number): Promise<SbEvent[]> {
  const file = path.join(CACHE, "events", `${matchId}.json`);
  const cached = await readEvents(file);
  if (cached) return cached;
  const body = await fetchText(`${ROOT}/events/${matchId}.json`);
  const parsed = JSON.parse(body) as unknown;
  if (!Array.isArray(parsed) || parsed.length === 0) throw new Error(`empty events ${matchId}`);
  await mkdir(path.dirname(file), { recursive: true });
  await writeFile(file, body);
  return parsed as SbEvent[];
}

async function readEvents(file: string): Promise<SbEvent[] | null> {
  try {
    const parsed = JSON.parse(await readFile(file, "utf8")) as unknown;
    if (!Array.isArray(parsed) || parsed.length === 0) return null;
    return parsed as SbEvent[];
  } catch {
    return null;
  }
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
  for (let attempt = 0; attempt < 5; attempt += 1) {
    try {
      const response = await fetch(url);
      if (response.status === 404) throw new Error(`404 ${url}`);
      if (!response.ok) throw new Error(`${response.status} ${url}`);
      return await response.text();
    } catch (error) {
      lastError = error;
      if (error instanceof Error && error.message.startsWith("404 ")) break;
      await new Promise((resolve) => setTimeout(resolve, 500 * 2 ** attempt));
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
  await Promise.all(Array.from({ length: Math.min(limit, items.length) }, () => worker()));
}

main().catch((error: unknown) => {
  console.error(error);
  process.exit(1);
});
