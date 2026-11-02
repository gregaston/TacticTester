import { describe, expect, it } from "vitest";
import { loadShapeLibrary } from "./shape-library";
import { loadStyleLibrary } from "./style-library";
import { loadSeasonRecords } from "./records";

describe("season records", () => {
  const records = loadSeasonRecords();
  const byId = new Map(records.sides.map((side) => [side.id, side]));

  it("covers every shape and style season", () => {
    expect(records.source).toBe("StatsBomb open data");
    const shapes = loadShapeLibrary().sides.map((side) => side.id);
    const styles = loadStyleLibrary().sides.map((side) => side.id);
    expect(records.sides).toHaveLength(shapes.length);
    expect(new Set(records.sides.map((side) => side.id))).toEqual(new Set(shapes));
    expect(new Set(styles)).toEqual(new Set(shapes));
    for (const side of records.sides) {
      const played = playedIn(side.id);
      expect(side.played).toBe(played);
      expect(side.won + side.drawn + side.lost).toBe(played);
      expect(side.points).toBe(side.won * 3 + side.drawn);
      expect(side.place).toBeGreaterThanOrEqual(1);
      expect(side.place).toBeLessThanOrEqual(20);
      expect(side.manager.split(" ").length).toBeLessThanOrEqual(3);
    }
  });

  it("keeps the published tables for the seasons in this set", () => {
    expect(byId.get("leicester-city-premier-league-2015-2016")).toMatchObject({
      place: 1,
      won: 23,
      drawn: 12,
      lost: 3,
      goalsFor: 68,
      goalsAgainst: 36,
      points: 81,
      manager: "Claudio Ranieri",
    });
    expect(byId.get("barcelona-la-liga-2015-2016")).toMatchObject({
      place: 1,
      won: 29,
      drawn: 4,
      lost: 5,
      goalsFor: 112,
      goalsAgainst: 29,
      points: 91,
      manager: "Luis Enrique",
    });
    expect(byId.get("arsenal-premier-league-2003-2004")).toMatchObject({
      place: 1,
      won: 26,
      drawn: 12,
      lost: 0,
      goalsFor: 73,
      goalsAgainst: 26,
      points: 90,
      manager: "Arsène Wenger",
    });
    expect(byId.get("paris-saint-germain-ligue-1-2015-2016")).toMatchObject({
      place: 1,
      won: 30,
      drawn: 6,
      lost: 2,
      goalsFor: 102,
      goalsAgainst: 19,
      points: 96,
      manager: "Laurent Blanc",
    });
    expect(byId.get("bordeaux-ligue-1-2015-2016")?.place).toBe(11);
    expect(byId.get("empoli-serie-a-2015-2016")?.place).toBe(10);
    expect(byId.get("genoa-serie-a-2015-2016")?.place).toBe(11);
    expect(byId.get("espanyol-la-liga-2015-2016")?.place).toBe(13);
    expect(byId.get("eibar-la-liga-2015-2016")?.place).toBe(14);
    expect(byId.get("bayer-leverkusen-1-bundesliga-2015-2016")).toMatchObject({
      place: 3,
      played: 34,
      won: 18,
      drawn: 6,
      lost: 10,
      goalsFor: 56,
      goalsAgainst: 40,
      points: 60,
      manager: "Roger Schmidt",
    });
    expect(byId.get("bayer-leverkusen-1-bundesliga-2023-2024")).toMatchObject({
      place: 1,
      played: 34,
      won: 28,
      drawn: 6,
      lost: 0,
      goalsFor: 89,
      goalsAgainst: 24,
      points: 90,
      manager: "Xabi Alonso",
    });
    expect(byId.get("chelsea-fcw-fa-women-s-super-league-2023-2024")).toMatchObject({
      place: 1,
      won: 18,
      drawn: 1,
      lost: 3,
      goalsFor: 71,
      goalsAgainst: 18,
      points: 55,
      manager: "Emma Hayes",
    });
    expect(byId.get("bayern-munchen-w-frauen-bundesliga-2023-2024")).toMatchObject({
      place: 1,
      won: 19,
      drawn: 3,
      lost: 0,
      points: 60,
    });
    expect(byId.get("barcelona-wfc-liga-f-2023-2024")).toMatchObject({
      place: 1,
      won: 29,
      drawn: 1,
      lost: 0,
      goalsFor: 137,
      goalsAgainst: 10,
      points: 88,
    });
    expect(byId.get("as-roma-w-serie-a-women-2023-2024")).toMatchObject({
      place: 1,
      played: 26,
      won: 23,
      drawn: 1,
      lost: 2,
      points: 70,
    });
    expect(byId.get("sassuolo-w-serie-a-women-2023-2024")?.place).toBe(4);
    expect(byId.get("ac-milan-w-serie-a-women-2023-2024")?.place).toBe(6);
  });
});

function playedIn(id: string): number {
  if (id.includes("frauen-bundesliga") || id.includes("fa-women")) return 22;
  if (id.includes("1-bundesliga")) return 34;
  if (id.includes("liga-f")) return 30;
  if (id.includes("serie-a-women")) return 26;
  return 38;
}
