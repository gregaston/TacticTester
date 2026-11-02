import { describe, expect, it } from "vitest";
import { loadShapeLibrary } from "./shape-library";
import { loadStyleLibrary } from "./style-library";

describe("style library", () => {
  const library = loadStyleLibrary();
  const shapeIds = new Set(loadShapeLibrary().sides.map((side) => side.id));

  it("loads StatsBomb open data and credits the source", () => {
    expect(library.source).toBe("StatsBomb open data");
    expect(library.sourceUrl).toBe("https://github.com/statsbomb/open-data");
    expect(library.note).toContain("PPDA-style");
    expect(library.note).toContain("open-data shot xG");
    expect(library.note).toContain("computed from StatsBomb open data");
    expect(library.sides.length).toBeGreaterThan(0);
  });

  it("matches shape-library ids and stays inside broad ranges", () => {
    const ids = library.sides.map((side) => side.id);
    expect(new Set(ids).size).toBe(ids.length);
    expect(library.sides).toHaveLength(133);
    for (const side of library.sides) {
      expect(shapeIds.has(side.id)).toBe(true);
      expect(side.matches).toBeGreaterThanOrEqual(10);
      expect(side.longPassShare).toBeGreaterThanOrEqual(0);
      expect(side.longPassShare).toBeLessThanOrEqual(1);
      expect(side.progressivePerMatch).toBeGreaterThanOrEqual(0);
      expect(side.fieldTilt).toBeGreaterThanOrEqual(0);
      expect(side.fieldTilt).toBeLessThanOrEqual(1);
      expect(side.passLength).toBeGreaterThanOrEqual(8);
      expect(side.passLength).toBeLessThanOrEqual(40);
      expect(side.xgPerShot).toBeGreaterThanOrEqual(0.02);
      expect(side.xgPerShot).toBeLessThanOrEqual(0.4);
      expect(side.ppda).toBeGreaterThanOrEqual(2);
      expect(side.ppda).toBeLessThanOrEqual(40);
      expect(side.pressHeight).toBeGreaterThanOrEqual(0);
      expect(side.pressHeight).toBeLessThanOrEqual(100);
      expect(side.shotGrid).toHaveLength(4);
      const cells = side.shotGrid.flat();
      expect(cells).toHaveLength(24);
      for (const row of side.shotGrid) expect(row).toHaveLength(6);
      for (const cell of cells) expect(cell).toBeGreaterThanOrEqual(0);
    }
  });

  it("includes Arsenal's 2003/04 league season", () => {
    expect(library.sides.some((side) => side.id === "arsenal-premier-league-2003-2004")).toBe(true);
  });
});
