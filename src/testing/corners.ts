import type { StyleFingerprint } from "./types";

export type Corners = {
  deepest: StyleFingerprint;
  hardestPress: StyleFingerprint;
  shortestPass: StyleFingerprint;
  mostDirect: StyleFingerprint;
};

export const SITUATIONS = [
  { id: "level", label: "Level" },
  { id: "protect-lead", label: "Protect a lead" },
  { id: "chase", label: "Chase the game" },
  { id: "they-have-ten", label: "They have ten" },
  { id: "you-have-ten", label: "You have ten" },
  { id: "goal-kicks", label: "Goal kicks" },
  { id: "settled-attack", label: "Settled attack" },
] as const;

export function pickCorners(sides: StyleFingerprint[]): Corners {
  if (sides.length === 0) throw new Error("sides is empty");
  return {
    deepest: pick(sides, (side) => side.pressHeight, "lowest"),
    hardestPress: pick(sides, (side) => side.ppda, "lowest"),
    shortestPass: pick(sides, (side) => side.passLength, "lowest"),
    mostDirect: pick(sides, (side) => side.xgPerShot, "highest"),
  };
}

function pick(
  sides: StyleFingerprint[],
  value: (side: StyleFingerprint) => number,
  extreme: "lowest" | "highest",
): StyleFingerprint {
  let best = sides[0];
  for (const side of sides) {
    const gap = value(side) - value(best);
    if (gap === 0) {
      if (side.team.localeCompare(best.team) < 0) best = side;
      continue;
    }
    if (extreme === "lowest" ? gap < 0 : gap > 0) best = side;
  }
  return best;
}
