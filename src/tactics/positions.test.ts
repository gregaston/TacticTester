import { describe, expect, it } from "vitest";
import { featuresFromPlayers, formationKey } from "../compare/features";
import { labelSquad } from "./positions";
import { placeStatsBombPosition, STATSBOMB_SLOTS } from "./slots";
import { TEMPLATES } from "./templates";
import type { Player } from "./types";

const expectedKeys: Record<string, string> = {
  "4-4-2": "4-0-4-0-2",
  "4-4-1-1": "4-0-4-1-1",
  "4-3-3": "4-0-3-2-1",
  "4-2-3-1": "4-2-0-3-1",
  "4-1-4-1": "4-1-4-0-1",
  "4-3-1-2": "4-0-3-1-2",
  "4-1-2-1-2": "4-1-2-1-2",
  "4-2-2-2": "4-2-0-2-2",
  "4-5-1": "4-0-5-0-1",
  "4-2-4": "4-0-2-0-4",
  "3-5-2": "3-0-5-0-2",
  "3-4-3": "3-0-4-0-3",
  "3-4-2-1": "3-0-4-2-1",
  "5-3-2": "5-0-3-0-2",
  "5-4-1": "5-0-4-0-1",
  "5-2-3": "5-0-2-0-3",
};

describe("labelSquad", () => {
  it("names every template from its bands and keeps one goalkeeper", () => {
    for (const template of TEMPLATES) {
      const labels = labelSquad(template.players);
      const keepers = template.players.filter((player) => labels.byId[player.id].code === "GK");
      expect(keepers, template.name).toHaveLength(1);
      expect(labels.keeperInferred, template.name).toBe(false);
      expect(formationKey(featuresFromPlayers(template.players)), template.name).toBe(
        expectedKeys[template.id],
      );
    }
  });

  it("tags the outer centre-backs in a back three", () => {
    const template = TEMPLATES.find((item) => item.id === "3-4-2-1")!;
    const labels = labelSquad(template.players);
    const wide = template.players.filter((player) => labels.byId[player.id].code === "WCB");
    const central = template.players.filter((player) => labels.byId[player.id].code === "DC");
    expect(wide.map((player) => player.x).sort((a, b) => a - b)).toEqual([38, 62]);
    expect(central).toHaveLength(1);
  });

  it("keeps a dual label when a player stands between two lines", () => {
    const players: Player[] = [
      { id: "gk", x: 50, y: 8 },
      { id: "between", x: 50, y: 32 },
    ];
    const labels = labelSquad(players);
    expect(labels.byId.between.line).toBe("DEF");
    expect(labels.byId.between.alternateName).toBe("Defensive midfielder");
  });

  it("marks the deepest player in goal when the goalkeeper spot is empty", () => {
    const template = TEMPLATES[0];
    const players = template.players.map((player) =>
      player.y === 8 ? { ...player, y: 86, x: 50 } : player,
    );
    const labels = labelSquad(players);
    expect(labels.keeperInferred).toBe(true);
    const keeper = players.find((player) => labels.byId[player.id].code === "GK");
    expect(keeper?.y).toBe(24);
  });
});

describe("StatsBomb slots", () => {
  it("places every known position name onto the pitch", () => {
    for (const name of Object.keys(STATSBOMB_SLOTS)) {
      const point = placeStatsBombPosition(name);
      expect(point, name).not.toBeNull();
      const labels = labelSquad([
        { id: "gk", x: 50, y: 8 },
        { id: "player", ...point! },
      ]);
      expect(labels.byId.player.code, name).toBeTruthy();
    }
  });
});
