import { describe, expect, it } from "vitest";
import { featuresFromPlayers } from "../compare/features";
import { rankSides } from "../compare/nearest";
import { TEMPLATES } from "../tactics/templates";
import { loadShapeLibrary } from "./shape-library";

describe("shape library", () => {
  const library = loadShapeLibrary();

  it("keeps a full sample for every side and credits StatsBomb", () => {
    expect(library.source).toBe("StatsBomb open data");
    expect(library.sides.length).toBe(83);
    expect(new Set(library.sides.map((side) => side.id)).size).toBe(83);
    expect([...new Set(library.sides.map((side) => side.competition))].sort()).toEqual([
      "1. Bundesliga",
      "La Liga",
      "Ligue 1",
      "Premier League",
      "Serie A",
    ]);
    for (const side of library.sides) {
      expect(side.matches).toBeGreaterThanOrEqual(15);
      expect(side.formationKey.split("-")).toHaveLength(5);
      expect(side.shiftShare ?? 0).toBeGreaterThanOrEqual(0);
      expect(side.shiftShare ?? 0).toBeLessThanOrEqual(1);
      if (side.shiftKey) expect(side.shiftKey.split("-")).toHaveLength(5);
    }
  });

  it("keeps an in-game shape when that shape is common and different from the start", () => {
    const changed = library.sides.filter(
      (side) => side.shiftKey && side.shiftKey !== side.formationKey && (side.shiftShare ?? 0) >= 0.3,
    );
    expect(changed.length).toBeGreaterThan(0);
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
    expect(nearest.phrase).toBe("Same shape in 45% of matches");
  });

  it("keeps a 4-2-3-1 with the side that used it most, even if the width shifts", () => {
    const template = TEMPLATES.find((item) => item.id === "4-2-3-1");
    const features = featuresFromPlayers(template!.players);
    const [nearest] = rankSides(features, library.sides, 1);
    const [shifted] = rankSides({ ...features, width: features.width + 4 }, library.sides, 1);
    expect(nearest.side.team).toBe("Athletic Club");
    expect(nearest.phrase).toBe("Same shape");
    expect(shifted.side.id).toBe(nearest.side.id);
    expect(shifted.phrase).toBe("Wider than their usual shape");
  });
});
