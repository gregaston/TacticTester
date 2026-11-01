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
      expect(side.played).toBe(38);
      expect(side.won + side.drawn + side.lost).toBe(38);
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
  });
});
