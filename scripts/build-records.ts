import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { loadShapeLibrary } from "../src/data/shape-library";

const CACHE = path.resolve(".cache/statsbomb");
const OUT = path.resolve("src/data/season-records.json");

type SeasonSpec = {
  file: string;
  competition: string;
  season: string;
  tieBreak: "goalDifference" | "headToHead";
  arsenalOnly?: boolean;
};

const SEASONS: SeasonSpec[] = [
  { file: "matches-2-27.json", competition: "Premier League", season: "2015/2016", tieBreak: "goalDifference" },
  { file: "matches-11-27.json", competition: "La Liga", season: "2015/2016", tieBreak: "headToHead" },
  { file: "matches-12-27.json", competition: "Serie A", season: "2015/2016", tieBreak: "headToHead" },
  { file: "matches-7-27.json", competition: "Ligue 1", season: "2015/2016", tieBreak: "goalDifference" },
  { file: "matches-2-44.json", competition: "Premier League", season: "2003/2004", tieBreak: "goalDifference", arsenalOnly: true },
];

/**
 * StatsBomb's 2015/16 Ligue 1 file has 377 of 380 matches. These three return
 * fixtures are the ones absent from that file. Scores are the published
 * Ligue 1 results grid for 2015/16.
 */
const LIGUE_1_MISSING = [
  { date: "2016-01-31", home: "Saint-Étienne", away: "Paris Saint-Germain", homeScore: 0, awayScore: 2 },
  { date: "2016-02-13", home: "Bastia", away: "Gazélec Ajaccio", homeScore: 1, awayScore: 2 },
  { date: "2016-02-20", home: "Troyes", away: "Bordeaux", homeScore: 2, awayScore: 4 },
];

const SHORT_NAMES: Record<string, string> = {
  "Francisco Martín Ayestarán Barandiarán": "Pako Ayestarán",
  "Joan Francesc Ferrer Sicilia": "Rubi",
  "José Leonardo Nunes Alves Sousa Jardim": "Leonardo Jardim",
  "José Luis Mendilibar Etxebarria": "José Luis Mendilibar",
  "José Manuel González López": "José González",
  "José Mario Felix dos Santos Mourinho": "José Mourinho",
  "José Miguel González Martín del Campo": "Míchel",
  "José Ramón Sandoval Huertas": "José Ramón Sandoval",
  "Juan Eduardo Esnáider Belén": "Juan Esnáider",
  "Luis Enrique Martínez García": "Luis Enrique",
  "Luis Lucas Alcaraz González": "Lucas Alcaraz",
  "Manuel Luis Pellegrini Ripamonti": "Manuel Pellegrini",
  "Marcelo Alberto Bielsa Caldera": "Marcelo Bielsa",
  "Mauricio Roberto Pochettino Trossero": "Mauricio Pochettino",
  "Nuno Herlander Simões Espírito Santo": "Nuno Espírito Santo",
  "Paulo Manuel Carvalho de Sousa": "Paulo Sousa",
  "Philippe Jacques William Montanier": "Philippe Montanier",
  "Ricardo Miguel Moreira da Costa": "Ricardo Costa",
  "Víctor Sánchez del Amo": "Víctor Sánchez",
  "Diego Pablo Simeone": "Diego Simeone",
};

type Manager = { name: string; nickname: string | null };

type MatchTeam = {
  home_team_name?: string;
  away_team_name?: string;
  managers?: Manager[];
};

type MatchRow = {
  match_date: string;
  home_team: MatchTeam & { home_team_name: string };
  away_team: MatchTeam & { away_team_name: string };
  home_score: number;
  away_score: number;
};

type Tally = {
  team: string;
  played: number;
  won: number;
  drawn: number;
  lost: number;
  goalsFor: number;
  goalsAgainst: number;
  managers: Map<string, { name: string; nickname: string | null; count: number; last: string }>;
};

type Standing = {
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

async function main(): Promise<void> {
  const records: Standing[] = [];
  for (const spec of SEASONS) {
    const rows = JSON.parse(await readFile(path.join(CACHE, spec.file), "utf8")) as MatchRow[];
    if (spec.competition === "Ligue 1") {
      for (const extra of LIGUE_1_MISSING) {
        rows.push({
          match_date: extra.date,
          home_score: extra.homeScore,
          away_score: extra.awayScore,
          home_team: { home_team_name: extra.home, managers: [] },
          away_team: { away_team_name: extra.away, managers: [] },
        });
      }
    }
    const table = standings(rows, spec);
    if (spec.arsenalOnly) {
      const arsenal = table.find((row) => row.team === "Arsenal");
      if (!arsenal) throw new Error("Arsenal are missing from 2003/04");
      records.push(toRecord(arsenal, spec, 1));
      continue;
    }
    table.forEach((row, index) => records.push(toRecord(row, spec, index + 1)));
  }

  const library = loadShapeLibrary();
  const byId = new Map(records.map((row) => [row.id, row]));
  const missing = library.sides.filter((side) => !byId.has(side.id)).map((side) => side.id);
  if (missing.length > 0) throw new Error(`No record for ${missing.join(", ")}`);

  const long = records.filter((row) => row.manager.split(" ").length > 3).map((row) => row.manager);
  if (long.length > 0) throw new Error(`Manager names still long: ${[...new Set(long)].join("; ")}`);

  const file = {
    source: "StatsBomb open data",
    sourceUrl: "https://github.com/statsbomb/open-data",
    note: "Wins, draws, losses, goals, and points are counted from each season's matches. Places follow that league's tie-break. Three Ligue 1 2015/16 fixtures missing from the open data are filled from the published results. Arsenal 2003/04 contains only Arsenal's matches, so their place is the published final standing.",
    sides: records.sort((a, b) => a.id.localeCompare(b.id)),
  };
  await mkdir(path.dirname(OUT), { recursive: true });
  await writeFile(OUT, `${JSON.stringify(file, null, 2)}\n`);
  console.log(`Wrote ${records.length} records`);
}

function standings(rows: MatchRow[], spec: SeasonSpec): Tally[] {
  const teams = new Map<string, Tally>();
  const meetings = new Map<string, MatchRow[]>();
  for (const match of rows) {
    const home = match.home_team.home_team_name;
    const away = match.away_team.away_team_name;
    const key = [home, away].sort().join("|");
    const played = meetings.get(key) ?? [];
    played.push(match);
    meetings.set(key, played);
    add(teams, home, match.home_score, match.away_score, match.home_team.managers ?? [], match.match_date);
    add(teams, away, match.away_score, match.home_score, match.away_team.managers ?? [], match.match_date);
  }
  const names = [...teams.keys()];
  names.sort((a, b) => compareTeams(a, b, teams, meetings, spec.tieBreak));
  return names.map((name) => teams.get(name)!);
}

function add(
  teams: Map<string, Tally>,
  team: string,
  goalsFor: number,
  goalsAgainst: number,
  managers: Manager[],
  date: string,
): void {
  const row = teams.get(team) ?? {
    team,
    played: 0,
    won: 0,
    drawn: 0,
    lost: 0,
    goalsFor: 0,
    goalsAgainst: 0,
    managers: new Map(),
  };
  row.played += 1;
  row.goalsFor += goalsFor;
  row.goalsAgainst += goalsAgainst;
  if (goalsFor > goalsAgainst) row.won += 1;
  else if (goalsFor < goalsAgainst) row.lost += 1;
  else row.drawn += 1;
  for (const manager of managers) {
    const seen = row.managers.get(manager.name) ?? { name: manager.name, nickname: manager.nickname, count: 0, last: "" };
    seen.count += 1;
    if (date > seen.last) seen.last = date;
    if (manager.nickname) seen.nickname = manager.nickname;
    row.managers.set(manager.name, seen);
  }
  teams.set(team, row);
}

function compareTeams(
  a: string,
  b: string,
  teams: Map<string, Tally>,
  meetings: Map<string, MatchRow[]>,
  tieBreak: SeasonSpec["tieBreak"],
): number {
  const left = teams.get(a)!;
  const right = teams.get(b)!;
  const pointsGap = points(right) - points(left);
  if (pointsGap !== 0) return pointsGap;
  if (tieBreak === "headToHead") {
    const tied = [...teams.keys()].filter((name) => points(teams.get(name)!) === points(left));
    const mini = headToHead(tied, meetings);
    const leftMini = mini.get(a)!;
    const rightMini = mini.get(b)!;
    if (rightMini.points !== leftMini.points) return rightMini.points - leftMini.points;
    if (rightMini.difference !== leftMini.difference) return rightMini.difference - leftMini.difference;
    if (rightMini.goals !== leftMini.goals) return rightMini.goals - leftMini.goals;
  }
  const difference = right.goalsFor - right.goalsAgainst - (left.goalsFor - left.goalsAgainst);
  if (difference !== 0) return difference;
  if (right.goalsFor !== left.goalsFor) return right.goalsFor - left.goalsFor;
  return a.localeCompare(b);
}

function headToHead(group: string[], meetings: Map<string, MatchRow[]>): Map<string, { points: number; difference: number; goals: number }> {
  const mini = new Map(group.map((team) => [team, { points: 0, difference: 0, goals: 0 }]));
  for (let i = 0; i < group.length; i += 1) {
    for (let j = i + 1; j < group.length; j += 1) {
      const played = meetings.get([group[i], group[j]].sort().join("|")) ?? [];
      for (const match of played) {
        const home = mini.get(match.home_team.home_team_name);
        const away = mini.get(match.away_team.away_team_name);
        if (!home || !away) continue;
        home.goals += match.home_score;
        away.goals += match.away_score;
        home.difference += match.home_score - match.away_score;
        away.difference += match.away_score - match.home_score;
        if (match.home_score > match.away_score) home.points += 3;
        else if (match.home_score < match.away_score) away.points += 3;
        else {
          home.points += 1;
          away.points += 1;
        }
      }
    }
  }
  return mini;
}

function points(row: Tally): number {
  return row.won * 3 + row.drawn;
}

function toRecord(row: Tally, spec: SeasonSpec, place: number): Standing {
  const manager = [...row.managers.values()].sort((a, b) => b.count - a.count || b.last.localeCompare(a.last))[0];
  if (!manager) throw new Error(`No manager for ${row.team} ${spec.season}`);
  return {
    id: slug(row.team, spec.competition, spec.season),
    manager: manager.nickname?.trim() || SHORT_NAMES[manager.name] || manager.name,
    place,
    played: row.played,
    won: row.won,
    drawn: row.drawn,
    lost: row.lost,
    goalsFor: row.goalsFor,
    goalsAgainst: row.goalsAgainst,
    points: points(row),
  };
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

main().catch((error: unknown) => {
  console.error(error);
  process.exit(1);
});
