import { describe, expect, it } from "vitest";
import { TEMPLATES } from "../tactics/templates";
import { featuresFromPlayers, formationKey, type ShapeFeatures } from "./features";
import { rankSides, type RankedSide } from "./nearest";
import type { SideSummary } from "./types";

function side(id: string, features: ShapeFeatures): SideSummary {
  return {
    id,
    team: id,
    season: "2015/2016",
    competition: "Premier League",
    matches: 38,
    formationKey: formationKey(features),
    formationShare: 1,
    features,
  };
}

const flat442: ShapeFeatures = {
  backLine: 24,
  forwardLine: 86,
  width: 28,
  def: 4,
  dm: 0,
  cm: 4,
  am: 0,
  st: 2,
};

describe("rankSides", () => {
  it("prefers the recorded side with the same band counts", () => {
    const user = featuresFromPlayers(TEMPLATES[0].players);
    const ranked = rankSides(user, [
      side("other", { ...flat442, def: 3, cm: 5 }),
      side("match", user),
    ]);
    expect(ranked[0].side.id).toBe("match");
    expect(ranked[0].phrase).toBe("Very close in shape");
  });

  it("names the band that separates two shapes", () => {
    const library = [side("one", { ...flat442, st: 1 }), side("two", { ...flat442, st: 3 })];
    const ranked: RankedSide[] = rankSides({ ...flat442, st: 2 }, library);
    expect(ranked.find((item) => item.side.id === "one")?.phrase).toBe("More forwards");
    expect(ranked.find((item) => item.side.id === "two")?.phrase).toBe("Fewer forwards");
  });

  it("does not let a shared line height explode the distance", () => {
    const shared = { ...flat442 };
    const ranked = rankSides(shared, [side("a", shared), side("b", shared)]);
    expect(ranked[0].distance).toBe(0);
  });
});
