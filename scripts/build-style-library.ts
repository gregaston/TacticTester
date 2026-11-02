import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { SEASONS, type SeasonSpec } from "./seasons";

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
 *
 * longPassShare is the share of those completed passes whose length is at
 * least 30 yards.
 * progressivePerMatch counts completed passes that start at normalised
 * x >= 40 and move the ball at least 25% closer to the opponent goal line
 * (x = 120), using pass.end_location in the same attacking frame. The count
 * is per match.
 * fieldTilt is this side's final-third on-ball events divided by both sides'
 * final-third on-ball events, summed across the matches in the sample (a
 * season ratio, not a mean of match ratios). The final third is normalised
 * x >= 80 in that event team's attacking frame. On-ball events are Pass,
 * Carry, Dribble, Shot, and Ball Receipt. StatsBomb names the receipt
 * "Ball Receipt*".
 *
 * crossesPerMatch counts passes with pass.cross, completed or not.
 * crossShotShare is the share of shots whose shot.key_pass_id is one of
 * those crosses.
 * regainShotsPerMatch counts shots within 8 seconds of a same-team Ball
 * Recovery. Time is period * 100000 + minute * 60 + second, so a recovery
 * in another period does not qualify. The window includes a recovery at
 * the same second.
 * keeperPassLength is the mean pass.length of passes whose position is
 * Goalkeeper, completed or not.
 * highPassShare is High Pass divided by passes that have a height, completed
 * or not.
 */

const ROOT = "https://raw.githubusercontent.com/statsbomb/open-data/master/data";
const CACHE = path.resolve(".cache/statsbomb");
const OUT = path.resolve("src/data/style-library.json");

type MatchRow = {
  match_id: number;
  home_team: { home_team_id: number; home_team_name: string };
  away_team: { away_team_id: number; away_team_name: string };
};

type SbEvent = {
  id?: string;
  period?: number;
  minute?: number;
  second?: number;
  type?: { name?: string };
  team?: { id?: number; name?: string };
  location?: number[];
  position?: { name?: string };
  pass?: {
    length?: number;
    outcome?: { name?: string } | null;
    end_location?: number[];
    cross?: boolean;
    height?: { name?: string };
  };
  shot?: { statsbomb_xg?: number; key_pass_id?: string };
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
  longPasses: number;
  progressive: number;
  ownFinalThird: number;
  oppFinalThird: number;
  crosses: number;
  crossShots: number;
  regainShots: number;
  keeperLengthSum: number;
  keeperPasses: number;
  highPasses: number;
  heightPasses: number;
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
  longPasses: number;
  progressive: number;
  ownFinalThird: number;
  oppFinalThird: number;
  crosses: number;
  crossShots: number;
  regainShots: number;
  keeperLengthSum: number;
  keeperPasses: number;
  highPasses: number;
  heightPasses: number;
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
  longPassShare: number;
  progressivePerMatch: number;
  fieldTilt: number;
  crossesPerMatch: number;
  crossShotShare: number;
  regainShotsPerMatch: number;
  keeperPassLength: number;
  highPassShare: number;
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
    note: "PPDA-style press rate inspired by the public Hudl definition, not a copy of their database. xG values are StatsBomb's open-data shot xG, shots maps are coarse counts, and lineups are not re-derived here. Long-pass share, progressive passes per match, field tilt, crosses, shots within eight seconds of a recovery, goalkeeper pass length, and high-pass share are computed from StatsBomb open data.",
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
    if (side.longPassShare < 0 || side.longPassShare > 1) odd.push(`longPassShare ${side.longPassShare}`);
    if (side.progressivePerMatch < 0) odd.push(`progressivePerMatch ${side.progressivePerMatch}`);
    if (side.fieldTilt < 0 || side.fieldTilt > 1) odd.push(`fieldTilt ${side.fieldTilt}`);
    if (side.crossesPerMatch < 0 || side.crossesPerMatch > 40) odd.push(`crossesPerMatch ${side.crossesPerMatch}`);
    if (side.crossShotShare < 0 || side.crossShotShare > 1) odd.push(`crossShotShare ${side.crossShotShare}`);
    if (side.regainShotsPerMatch < 0 || side.regainShotsPerMatch > 20) odd.push(`regainShotsPerMatch ${side.regainShotsPerMatch}`);
    if (side.keeperPassLength < 5 || side.keeperPassLength > 70) odd.push(`keeperPassLength ${side.keeperPassLength}`);
    if (side.highPassShare < 0 || side.highPassShare > 1) odd.push(`highPassShare ${side.highPassShare}`);
    if (odd.length > 0) console.warn(`${side.id}: ${odd.join(", ")}`);
  }
  reportRanges(sides);
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
  const finalThird = new Map<string, number>();
  const recoveries = new Map<string, number[]>();
  const shotTimes = new Map<string, number[]>();
  const crossIds = new Set<string>();
  const all = [...names.values()];
  for (const team of focus) {
    const other = all.find((name) => name !== team);
    if (other) opponents.set(team, other);
  }
  for (const event of events) {
    if (event.type?.name === "Pass" && event.pass?.cross && event.id) crossIds.add(event.id);
  }

  for (const event of events) {
    const team = canonicalTeam(event, names);
    if (!team) continue;
    const period = event.period ?? 1;
    const own = stats.get(team);
    if (own) own.present = true;
    if (isOnBall(event)) {
      const point = readPoint(event.location);
      if (point) {
        const [x] = attackingPoint(point.x, point.y, team, team, period, towardOwnGoal);
        if (x >= 80) finalThird.set(team, (finalThird.get(team) ?? 0) + 1);
      }
    }
    if (own && isCompletedPass(event)) {
      const length = event.pass?.length;
      if (typeof length === "number" && Number.isFinite(length)) {
        own.passLengthSum += length;
        own.passCount += 1;
        if (length >= 30) own.longPasses += 1;
      }
      const start = readPoint(event.location);
      const end = readPoint(event.pass?.end_location);
      if (start && end) {
        const [startX] = attackingPoint(start.x, start.y, team, team, period, towardOwnGoal);
        const [endX] = attackingPoint(end.x, end.y, team, team, period, towardOwnGoal);
        if (isProgressive(startX, endX)) own.progressive += 1;
      }
    }
    if (own && event.type?.name === "Pass") {
      const height = event.pass?.height?.name;
      if (height) {
        own.heightPasses += 1;
        if (height === "High Pass") own.highPasses += 1;
      }
      if (event.pass?.cross) own.crosses += 1;
      if (event.position?.name === "Goalkeeper") {
        const length = event.pass?.length;
        if (typeof length === "number" && Number.isFinite(length)) {
          own.keeperLengthSum += length;
          own.keeperPasses += 1;
        }
      }
    }
    if (event.type?.name === "Ball Recovery" && own) {
      const times = recoveries.get(team) ?? [];
      times.push(eventStamp(event));
      recoveries.set(team, times);
    }
    if (own && event.type?.name === "Shot") {
      own.shots += 1;
      const times = shotTimes.get(team) ?? [];
      times.push(eventStamp(event));
      shotTimes.set(team, times);
      if (event.shot?.key_pass_id && crossIds.has(event.shot.key_pass_id)) own.crossShots += 1;
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
  for (const [team, match] of stats) {
    const opponent = opponents.get(team);
    match.ownFinalThird = finalThird.get(team) ?? 0;
    match.oppFinalThird = opponent ? (finalThird.get(opponent) ?? 0) : 0;
    match.regainShots = regainCount(recoveries.get(team) ?? [], shotTimes.get(team) ?? []);
  }
  return stats;
}

/** period * 100000 keeps a recovery in another period outside the 8-second window. */
function eventStamp(event: SbEvent): number {
  return (event.period ?? 1) * 100000 + (event.minute ?? 0) * 60 + (event.second ?? 0);
}

function regainCount(recoveries: number[], shots: number[]): number {
  if (recoveries.length === 0 || shots.length === 0) return 0;
  const times = [...recoveries].sort((a, b) => a - b);
  let count = 0;
  for (const shot of shots) {
    let lo = 0;
    let hi = times.length - 1;
    let found = -1;
    while (lo <= hi) {
      const mid = (lo + hi) >> 1;
      if (times[mid] <= shot) {
        found = mid;
        lo = mid + 1;
      } else {
        hi = mid - 1;
      }
    }
    if (found >= 0 && shot - times[found] <= 8) count += 1;
  }
  return count;
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

function isOnBall(event: SbEvent): boolean {
  const name = event.type?.name;
  if (!name) return false;
  if (name === "Pass" || name === "Carry" || name === "Dribble" || name === "Shot") return true;
  return name.startsWith("Ball Receipt");
}

function isProgressive(startX: number, endX: number): boolean {
  if (startX < 40) return false;
  const remain = 120 - startX;
  if (remain <= 0) return false;
  return endX - startX >= 0.25 * remain - 1e-9;
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
    longPasses: 0,
    progressive: 0,
    ownFinalThird: 0,
    oppFinalThird: 0,
    crosses: 0,
    crossShots: 0,
    regainShots: 0,
    keeperLengthSum: 0,
    keeperPasses: 0,
    highPasses: 0,
    heightPasses: 0,
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
    longPasses: 0,
    progressive: 0,
    ownFinalThird: 0,
    oppFinalThird: 0,
    crosses: 0,
    crossShots: 0,
    regainShots: 0,
    keeperLengthSum: 0,
    keeperPasses: 0,
    highPasses: 0,
    heightPasses: 0,
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
  totals.longPasses += match.longPasses;
  totals.progressive += match.progressive;
  totals.ownFinalThird += match.ownFinalThird;
  totals.oppFinalThird += match.oppFinalThird;
  totals.crosses += match.crosses;
  totals.crossShots += match.crossShots;
  totals.regainShots += match.regainShots;
  totals.keeperLengthSum += match.keeperLengthSum;
  totals.keeperPasses += match.keeperPasses;
  totals.highPasses += match.highPasses;
  totals.heightPasses += match.heightPasses;
}

function toSide(totals: Totals): StyleSide | null {
  if (totals.matches < 10) return null;
  if (totals.passCount === 0 || totals.xgCount === 0 || totals.pressCount === 0 || totals.ppdaMatches === 0) return null;
  if (totals.shots === 0 || totals.keeperPasses === 0 || totals.heightPasses === 0) return null;
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
    longPassShare: round2(totals.longPasses / totals.passCount),
    progressivePerMatch: round1(totals.progressive / totals.matches),
    fieldTilt: fieldTiltOf(totals.ownFinalThird, totals.oppFinalThird),
    crossesPerMatch: round2(totals.crosses / totals.matches),
    crossShotShare: round2(totals.crossShots / totals.shots),
    regainShotsPerMatch: round2(totals.regainShots / totals.matches),
    keeperPassLength: round2(totals.keeperLengthSum / totals.keeperPasses),
    highPassShare: round2(totals.highPasses / totals.heightPasses),
  };
}

function fieldTiltOf(own: number, opponent: number): number {
  const both = own + opponent;
  if (both <= 0) return 0;
  return round2(own / both);
}

function round1(value: number): number {
  return Math.round(value * 10) / 10;
}

function round2(value: number): number {
  return Math.round(value * 100) / 100;
}

function reportRanges(sides: StyleSide[]): void {
  for (const key of ["longPassShare", "progressivePerMatch", "fieldTilt", "crossesPerMatch", "crossShotShare", "regainShotsPerMatch", "keeperPassLength", "highPassShare", "passLength"] as const) {
    const values = sides.map((side) => side[key]).sort((a, b) => a - b);
    if (values.length === 0) continue;
    const at = (fraction: number) => values[Math.min(values.length - 1, Math.floor((values.length - 1) * fraction))];
    const mid = values.length % 2 === 1 ? values[(values.length - 1) / 2] : (values[values.length / 2 - 1] + values[values.length / 2]) / 2;
    console.log(`${key}: min ${values[0]} p25 ${at(0.25)} median ${mid} p75 ${at(0.75)} max ${values[values.length - 1]}`);
  }
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
