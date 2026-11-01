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
    expect(ranked[0].phrase).toBe("Same shape");
  });

  it("keeps the side you are matching when only the spacing changes", () => {
    const common = side("common", { ...flat442, width: 28 });
    common.formationShare = 0.82;
    const rare = side("rare", { ...flat442, width: 36 });
    rare.formationShare = 0.41;
    const shifted = rankSides({ ...flat442, width: 35 }, [common, rare])[0];
    const matched = rankSides({ ...flat442, width: 28 }, [common, rare])[0];
    expect(shifted.side.id).toBe("common");
    expect(shifted.phrase).toBe("Wider than their usual shape");
    expect(matched.side.id).toBe("common");
    expect(matched.phrase).toBe("Same shape");
  });

  it("skips a rare exact shape in favour of a side that played a nearby one", () => {
    const rare = side("rare", flat442);
    rare.formationShare = 0.22;
    const common = side("common", { ...flat442, st: 1 });
    common.formationShare = 0.8;
    const ranked = rankSides(flat442, [rare, common]);
    expect(ranked[0].side.id).toBe("common");
    expect(ranked[0].phrase).toBe("More forwards");
  });

  it("stays with a side after the named band gap is closed", () => {
    const target = side("target", { ...flat442, st: 3 });
    target.formationShare = 0.8;
    const other = side("other", { ...flat442, dm: 2, cm: 2 });
    other.formationShare = 0.9;
    const before = rankSides(flat442, [target, other])[0];
    const after = rankSides({ ...flat442, st: 3 }, [target, other])[0];
    expect(before.side.id).toBe("target");
    expect(before.phrase).toBe("Fewer forwards");
    expect(after.side.id).toBe("target");
    expect(after.phrase).toBe("Same shape");
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
