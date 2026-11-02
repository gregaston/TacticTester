import { describe, expect, it } from "vitest";
import { loadSeasonRecords } from "../data/records";
import { loadShapeLibrary } from "../data/shape-library";
import { loadStyleLibrary } from "../data/style-library";
import { createBoard } from "../tactics/board";
import { shiftedPoint } from "../tactics/block";
import { DEFAULT_INSTRUCTIONS } from "../tactics/instructions";
import { labelSquad } from "../tactics/positions";
import { playersFromBoard, readStyle, type StyleProfile } from "../testing/profile";
import { closestMatch, differenceSummary, shapePercent, stylePercent } from "./closest";
import { closestShape, featuresFromPlayers, type ShapeFeatures } from "./features";
import { placeLabel } from "./format";
import type { SideSummary } from "./types";
import type { StyleSide } from "../data/style-library";
import type { SeasonRecord } from "../data/records";

const shapes = loadShapeLibrary().sides;
const styles = loadStyleLibrary().sides;
const records = loadSeasonRecords().sides;

function profileFor(board = createBoard()): StyleProfile {
  const players = playersFromBoard(board.players, labelSquad(board.players), {});
  return readStyle(players, DEFAULT_INSTRUCTIONS, styles).profile;
}

describe("placeLabel", () => {
  it("uses the usual endings, including the teens", () => {
    expect(placeLabel(1)).toBe("1st");
    expect(placeLabel(2)).toBe("2nd");
    expect(placeLabel(3)).toBe("3rd");
    expect(placeLabel(4)).toBe("4th");
    expect(placeLabel(11)).toBe("11th");
    expect(placeLabel(12)).toBe("12th");
    expect(placeLabel(13)).toBe("13th");
    expect(placeLabel(21)).toBe("21st");
  });
});

describe("closestMatch", () => {
  it("picks one side and scores style and shape separately", () => {
    const match = closestMatch(featuresFromPlayers(createBoard().players), profileFor(), shapes, styles, records);
    expect(match).not.toBeNull();
    expect(match!.stylePercent).toBeGreaterThanOrEqual(0);
    expect(match!.stylePercent).toBeLessThanOrEqual(100);
    expect(match!.shapePercent).toBeGreaterThanOrEqual(0);
    expect(match!.shapePercent).toBeLessThanOrEqual(100);
    expect(match!.summary.split(".").filter((part) => part.trim()).length).toBeLessThanOrEqual(2);
    expect(match!.summary).not.toMatch(/shot map|xG|where .* shot/i);
    expect(match!.figures.map((figure) => figure.label)).toEqual(["Pass", "Shots", "Press"]);
    expect(match!.figures[0].high).toBeGreaterThan(match!.figures[0].low);
  });

  it("names the passing control by the yards it adds", () => {
    const board = createBoard();
    const labels = labelSquad(board.players);
    const players = playersFromBoard(board.players, labels, {});
    const instructions = { ...DEFAULT_INSTRUCTIONS, passing: "more direct" as const, distribution: "go long" as const };
    const profile = readStyle(players, instructions, styles).profile;
    const match = closestMatch(closestShape(board.players), profile, shapes, styles, records, {
      players,
      instructions,
      styles,
    });
    expect(match?.lever).toMatch(/Go long is added on top of more direct\./);
    expect(match?.lever).toMatch(/lengthens the pass by \d/);
    expect(match?.lever).not.toMatch(/accounts for/);
  });

  it("keeps a higher line from deleting the back four", () => {
    const board = createBoard();
    const labels = labelSquad(board.players);
    const drawn = board.players.map((player) => {
      const line = labels.byId[player.id].line;
      return { ...player, ...shiftedPoint(player, line, 38, 86) };
    });
    expect(closestShape(board.players).def).toBe(4);
    expect(featuresFromPlayers(drawn).def).toBe(0);
  });

  it("rewards the side that matches both, not a perfect shape with a distant style", () => {
    const shape = featuresFromPlayers(createBoard().players);
    const profile = profileFor();
    const twin = shapes.find((side) => side.team === "Leicester City" && side.season === "2015/2016")!;
    const other = shapes.find((side) => side.id !== twin.id)!;
    const twinStyle = styles.find((side) => side.id === twin.id)!;
    const farStyle = { ...twinStyle, id: other.id, passLength: twinStyle.passLength + 8, shotsPerMatch: twinStyle.shotsPerMatch + 6, pressHeight: twinStyle.pressHeight + 12 };
    const nearStyle = { ...twinStyle, id: other.id };
    const record = records.find((side) => side.id === twin.id)!;
    const otherRecord = { ...record, id: other.id };
    const ranked = closestMatch(
      shape,
      profile,
      [twin, other],
      [twinStyle, farStyle],
      [record, otherRecord],
    );
    expect(ranked?.id).toBe(twin.id);
    const flipped = closestMatch(
      { ...shape, def: shape.def + 2, cm: Math.max(0, shape.cm - 2) },
      profile,
      [twin, other],
      [farStyle, { ...nearStyle, id: other.id, passLength: profile.passLength, shotsPerMatch: profile.shotsPerMatch, pressHeight: profile.pressHeight }],
      [record, otherRecord],
    );
    expect(flipped?.id).toBe(other.id);
  });

  it("drops the shape percent when the formation changes and the style percent when the press does", () => {
    const user = featuresFromPlayers(createBoard().players);
    const side = shapes[0];
    const same = shapePercent(user, { ...side, formationKey: "4-0-4-0-2", features: { ...side.features, ...user } });
    const changed = shapePercent(user, {
      ...side,
      formationKey: "3-2-3-0-2",
      features: { ...side.features, ...user, def: 3, dm: 2, cm: 3, am: 0, st: 2 },
    });
    expect(same).toBeGreaterThan(changed);

    const style = styles[0];
    const base = profileFor();
    const close = stylePercent(base, { ...style, passLength: base.passLength, shotsPerMatch: base.shotsPerMatch, pressHeight: base.pressHeight });
    const remote = stylePercent(base, { ...style, pressHeight: base.pressHeight + 15 });
    expect(close).toBe(100);
    expect(remote).toBeLessThan(close);
  });

  it("names one difference, and stays quiet when the two sides agree", () => {
    const user: ShapeFeatures = { backLine: 24, forwardLine: 86, width: 20, def: 4, dm: 0, cm: 4, am: 0, st: 2 };
    const side: SideSummary = {
      id: "sample",
      team: "Sample",
      season: "2015/2016",
      competition: "Premier League",
      matches: 38,
      formationKey: "4-0-4-0-2",
      formationShare: 1,
      features: user,
    };
    const style = {
      id: "sample",
      passLength: 18,
      shotsPerMatch: 12,
      pressHeight: 40,
    } as StyleSide;
    const profile: StyleProfile = { passLength: 18, shotsPerMatch: 12, pressHeight: 40, shotX: 50, shotY: 80 };
    expect(differenceSummary(user, side, profile, style)).toBe("Same shape and a similar style.");
    expect(differenceSummary({ ...user, st: 3 }, side, profile, style)).toBe("More forwards.");
    expect(differenceSummary(user, side, { ...profile, passLength: 22 }, style)).toBe("Passes are longer than theirs.");
  });
});

describe("records join", () => {
  it("gives every comparable side a record the panel can show", () => {
    const match = closestMatch(featuresFromPlayers(createBoard().players), profileFor(), shapes, styles, records);
    const record = records.find((side) => side.id === match?.id) as SeasonRecord;
    expect(record.manager.length).toBeGreaterThan(0);
    expect(record.points).toBeGreaterThan(0);
  });
});
