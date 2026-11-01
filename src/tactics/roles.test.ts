import { describe, expect, it } from "vitest";
import {
  ROLES,
  effectFor,
  rolesFor,
  type Duty,
  type RoleId,
} from "./roles";
import type { Line } from "./types";

const DUTIES: Duty[] = ["defend", "support", "attack"];
const LINES: Line[] = ["GK", "DEF", "DM", "CM", "AM", "ST"];
const RATES = ["passRisk", "shooting", "pressing", "tackling"] as const;

const EXPECTED_IDS: RoleId[] = [
  "goalkeeper",
  "sweeper-keeper",
  "centre-back",
  "ball-playing-defender",
  "full-back",
  "wing-back",
  "inverted-wing-back",
  "defensive-midfielder",
  "deep-lying-playmaker",
  "ball-winning-midfielder",
  "half-back",
  "central-midfielder",
  "box-to-box",
  "mezzala",
  "attacking-midfielder",
  "advanced-playmaker",
  "shadow-striker",
  "winger",
  "inverted-winger",
  "inside-forward",
  "advanced-forward",
  "deep-lying-forward",
  "pressing-forward",
  "target-forward",
  "poacher",
];

describe("effectFor", () => {
  it("puts a poacher on attack higher and shooting more than a deep-lying forward on defend", () => {
    const poacher = effectFor("poacher", "attack");
    const forward = effectFor("deep-lying-forward", "defend");
    expect(poacher.shooting).toBeGreaterThan(forward.shooting);
    expect(poacher.y).toBeGreaterThan(forward.y);
  });

  it("has a ball-winning midfielder pressing more and passing safer than a deep-lying playmaker", () => {
    for (const duty of DUTIES) {
      const winner = effectFor("ball-winning-midfielder", duty);
      const playmaker = effectFor("deep-lying-playmaker", duty);
      expect(winner.pressing).toBeGreaterThan(playmaker.pressing);
      expect(winner.passRisk).toBeLessThan(playmaker.passRisk);
    }
  });

  it("puts an inside forward on attack narrower and shooting more than a winger on support", () => {
    const inside = effectFor("inside-forward", "attack");
    const winger = effectFor("winger", "support");
    expect(inside.x).toBeLessThan(winger.x);
    expect(inside.shooting).toBeGreaterThan(winger.shooting);
  });

  it("puts a wing-back on attack higher and wider than a full-back on defend", () => {
    const wingBack = effectFor("wing-back", "attack");
    const fullBack = effectFor("full-back", "defend");
    expect(wingBack.y).toBeGreaterThan(fullBack.y);
    expect(wingBack.x).toBeGreaterThan(fullBack.x);
  });

  it("accepts defend, support, and attack on every role", () => {
    expect(ROLES.map((role) => role.id)).toEqual(EXPECTED_IDS);
    for (const role of ROLES) {
      expect(role.summary.endsWith(".")).toBe(true);
      expect(role.summary.slice(0, -1).includes(".")).toBe(false);
      expect(role.summary.includes("With the ball") && role.summary.includes("without it")).toBe(
        true,
      );
      for (const duty of DUTIES) {
        const effect = effectFor(role.id, duty);
        expect(Number.isFinite(effect.x)).toBe(true);
        expect(Number.isFinite(effect.y)).toBe(true);
        expect(Number.isFinite(effect.passLength)).toBe(true);
        for (const rate of RATES) {
          expect(effect[rate]).toBeGreaterThanOrEqual(0);
          expect(effect[rate]).toBeLessThanOrEqual(1);
        }
      }
      expect(effectFor(role.id, "support")).toEqual(role.effect);
    }
  });

  it("drops defend deeper and eases the tackle on attack, with a smaller goalkeeper shift", () => {
    for (const role of ROLES) {
      const support = effectFor(role.id, "support");
      const defend = effectFor(role.id, "defend");
      const attack = effectFor(role.id, "attack");
      expect(defend.y).toBeLessThan(support.y);
      expect(attack.y).toBeGreaterThan(support.y);
      expect(defend.shooting).toBeLessThan(support.shooting);
      expect(defend.passRisk).toBeLessThan(support.passRisk);
      expect(defend.tackling).toBeGreaterThan(support.tackling);
      expect(attack.tackling).toBeLessThan(support.tackling);
      expect(attack.shooting > support.shooting || attack.passRisk > support.passRisk).toBe(true);

      const drop = support.y - defend.y;
      if (role.id === "goalkeeper" || role.id === "sweeper-keeper") {
        expect(drop).toBeLessThanOrEqual(4);
        expect(attack.y - support.y).toBeLessThanOrEqual(4);
      } else {
        expect(drop).toBeGreaterThanOrEqual(4);
        expect(drop).toBeLessThanOrEqual(8);
      }
    }

    expect(effectFor("centre-back", "attack").y).toBeLessThan(6);
    expect(effectFor("ball-playing-defender", "attack").y).toBe(6);
  });
});

describe("rolesFor", () => {
  it("returns only roles for that line", () => {
    for (const line of LINES) {
      const seen = new Set<RoleId>();
      for (const wide of [false, true]) {
        for (const role of rolesFor(line, wide)) {
          expect(role.lines).toContain(line);
          if (role.wide === "wide") expect(wide).toBe(true);
          if (role.wide === "central") expect(wide).toBe(false);
          seen.add(role.id);
        }
      }
      const catalogued = ROLES.filter((role) => role.lines.includes(line)).map((role) => role.id);
      expect([...seen].sort()).toEqual([...catalogued].sort());
    }

    expect(rolesFor("DEF", false).map((role) => role.id)).toEqual([
      "centre-back",
      "ball-playing-defender",
    ]);
    expect(rolesFor("DEF", true).map((role) => role.id)).toEqual([
      "full-back",
      "wing-back",
      "inverted-wing-back",
    ]);
    expect(rolesFor("AM", false).map((role) => role.id)).toEqual([
      "attacking-midfielder",
      "advanced-playmaker",
      "shadow-striker",
    ]);
    expect(rolesFor("AM", true).map((role) => role.id)).toEqual([
      "winger",
      "inverted-winger",
      "inside-forward",
    ]);
    expect(rolesFor("GK", false).map((role) => role.id)).toEqual(["goalkeeper", "sweeper-keeper"]);
    expect(rolesFor("DM", false).map((role) => role.id)).toEqual([
      "defensive-midfielder",
      "deep-lying-playmaker",
      "ball-winning-midfielder",
      "half-back",
    ]);
    expect(rolesFor("ST", true).every((role) => role.lines.includes("ST"))).toBe(true);
    expect(rolesFor("CM", false).some((role) => role.lines.includes("ST"))).toBe(false);
  });
});
