import { describe, expect, it } from "vitest";
import { featuresFromPlayers } from "../compare/features";
import { rankSides } from "../compare/nearest";
import { TEMPLATES } from "../tactics/templates";
import { loadShapeLibrary } from "./shape-library";

describe("shape library", () => {
  const library = loadShapeLibrary();

  it("keeps a full sample for every side and credits StatsBomb", () => {
    expect(library.source).toBe("StatsBomb open data");
    expect(library.sides.length).toBe(81);
    expect(new Set(library.sides.map((side) => side.id)).size).toBe(81);
    for (const side of library.sides) {
      expect(side.matches).toBeGreaterThanOrEqual(15);
      expect(side.formationKey.split("-")).toHaveLength(5);
    }
  });

  it("includes Arsenal's unbeaten league season and Leicester's title season", () => {
    const arsenal = library.sides.find((side) => side.id === "arsenal-premier-league-2003-2004");
    const leicester = library.sides.find((side) => side.id === "leicester-city-premier-league-2015-2016");
    expect(arsenal).toMatchObject({ matches: 38, competition: "Premier League", season: "2003/2004" });
    expect(leicester?.matches).toBe(38);
  });

  it("matches a flat 4-4-2 to Leicester's title season", () => {
    const template = TEMPLATES.find((item) => item.id === "4-4-2");
    const [nearest] = rankSides(featuresFromPlayers(template!.players), library.sides, 1);
    expect(nearest.side.team).toBe("Leicester City");
    expect(nearest.side.season).toBe("2015/2016");
    expect(nearest.phrase).toBe("Very close in shape");
  });
});
