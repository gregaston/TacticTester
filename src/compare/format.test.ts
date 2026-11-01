import { describe, expect, it } from "vitest";
import { formatSeason, shapeSummary, usualShape } from "./format";
import type { SideSummary } from "./types";

describe("format", () => {
  it("shortens a four-digit season and describes bands without empty lines", () => {
    expect(formatSeason("2003/2004")).toBe("2003/04");
    expect(formatSeason("2022")).toBe("2022");
    expect(
      shapeSummary({
        backLine: 24,
        forwardLine: 86,
        width: 20,
        def: 4,
        dm: 0,
        cm: 4,
        am: 0,
        st: 2,
      }),
    ).toBe("4 at the back, 4 in midfield, 2 up front");
  });

  it("says when a side did not use one shape all season", () => {
    const side: SideSummary = {
      id: "example",
      team: "Arsenal",
      season: "2015/2016",
      competition: "Premier League",
      matches: 38,
      formationKey: "4-0-3-2-1",
      formationShare: 0.62,
      features: {
        backLine: 24,
        forwardLine: 86,
        width: 20,
        def: 4,
        dm: 0,
        cm: 3,
        am: 2,
        st: 1,
      },
    };
    expect(usualShape(side)).toBe(
      "Usually 4 at the back, 3 in midfield, 2 in attacking midfield, 1 up front (62% of matches)",
    );
  });
});
