export type TieBreak = "goalDifference" | "headToHead";

export type SeasonSpec = {
  competitionId: number;
  seasonId: number;
  competition: string;
  season: string;
  /**
   * Null keeps every club. A list keeps one club when the file is that
   * club's complete league season and the other clubs are only opponents.
   */
  teams: string[] | null;
  tieBreak: TieBreak;
  /** Matches that club played. A short file is rejected rather than published. */
  matchesEach: number;
  /** Published finish, used when the file cannot build the rest of the table. */
  publishedPlace?: number;
  /** Three published Ligue 1 results missing from the 2015/16 file. */
  fillLigue201516?: boolean;
  /**
   * After this many matches the season splits. Places stay inside each
   * group: the top groupSize clubs after those matches, then the rest.
   */
  splitAfter?: { matches: number; groupSize: number };
};

/**
 * Domestic league seasons in StatsBomb open data that are complete for the
 * clubs they include. Men's league files after 2015/16 are one club and
 * short of a full season, apart from Bayer Leverkusen's two Bundesliga
 * seasons. 2024/25 and 2025/26 are not in the open data.
 */
export const SEASONS: SeasonSpec[] = [
  { competitionId: 2, seasonId: 27, competition: "Premier League", season: "2015/2016", teams: null, tieBreak: "goalDifference", matchesEach: 38 },
  { competitionId: 11, seasonId: 27, competition: "La Liga", season: "2015/2016", teams: null, tieBreak: "headToHead", matchesEach: 38 },
  { competitionId: 12, seasonId: 27, competition: "Serie A", season: "2015/2016", teams: null, tieBreak: "headToHead", matchesEach: 38 },
  { competitionId: 7, seasonId: 27, competition: "Ligue 1", season: "2015/2016", teams: null, tieBreak: "goalDifference", matchesEach: 38, fillLigue201516: true },
  { competitionId: 2, seasonId: 44, competition: "Premier League", season: "2003/2004", teams: ["Arsenal"], tieBreak: "goalDifference", matchesEach: 38, publishedPlace: 1 },
  { competitionId: 9, seasonId: 27, competition: "1. Bundesliga", season: "2015/2016", teams: ["Bayer Leverkusen"], tieBreak: "goalDifference", matchesEach: 34, publishedPlace: 3 },
  { competitionId: 9, seasonId: 281, competition: "1. Bundesliga", season: "2023/2024", teams: ["Bayer Leverkusen"], tieBreak: "goalDifference", matchesEach: 34, publishedPlace: 1 },
  { competitionId: 37, seasonId: 281, competition: "FA Women's Super League", season: "2023/2024", teams: null, tieBreak: "goalDifference", matchesEach: 22 },
  { competitionId: 135, seasonId: 281, competition: "Frauen Bundesliga", season: "2023/2024", teams: null, tieBreak: "goalDifference", matchesEach: 22 },
  { competitionId: 182, seasonId: 281, competition: "Liga F", season: "2023/2024", teams: null, tieBreak: "headToHead", matchesEach: 30 },
  { competitionId: 131, seasonId: 281, competition: "Serie A Women", season: "2023/2024", teams: null, tieBreak: "headToHead", matchesEach: 26, splitAfter: { matches: 90, groupSize: 5 } },
];
