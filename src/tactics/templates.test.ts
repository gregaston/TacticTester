import { describe, expect, it } from "vitest";
import { TEMPLATES, templatesByBackLine } from "./templates";

describe("templatesByBackLine", () => {
  it("groups every shape into three, four, and five at the back", () => {
    const groups = templatesByBackLine();

    expect(groups.map((group) => group.label)).toEqual([
      "3 at the back",
      "4 at the back",
      "5 at the back",
    ]);
    expect(new Set(groups.flatMap((group) => group.templates.map((template) => template.id))).size).toBe(
      TEMPLATES.length,
    );
    expect(groups[0].templates.map((template) => template.id)).toEqual(["3-5-2", "3-4-3", "3-4-2-1"]);
    expect(groups[2].templates.map((template) => template.id)).toEqual(["5-3-2", "5-4-1", "5-2-3"]);
  });
});
