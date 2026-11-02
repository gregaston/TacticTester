import { describe, expect, it } from "vitest";
import {
  ROLES,
  effectFor,
  roleMark,
  roleName,
  rolesFor,
  type RoleId,
} from "./roles";
import type { Line } from "./types";

const LINES: Line[] = ["GK", "DEF", "DM", "CM", "AM", "ST"];
const RATES = ["passRisk", "shooting", "pressing", "tackling"] as const;

const EXPECTED_IDS: RoleId[] = [
  "goalkeeper",
  "sweeper-keeper",
  "centre-back",
  "ball-playing-defender",
  "no-nonsense-centre-back",
  "covering-centre-back",
  "stopper",
  "full-back",
  "wing-back",
  "inverted-wing-back",
  "defensive-midfielder",
  "deep-lying-playmaker",
  "ball-winning-midfielder",
  "half-back",
  "regista",
  "segundo-volante",
  "central-midfielder",
  "box-to-box",
  "mezzala",
  "attacking-midfielder",
  "advanced-playmaker",
  "shadow-striker",
  "enganche",
  "winger",
  "inverted-winger",
  "inside-forward",
  "raumdeuter",
  "advanced-forward",
  "deep-lying-forward",
  "pressing-forward",
  "target-forward",
  "poacher",
  "false-nine",
];

describe("effectFor", () => {
  it("puts a poacher higher and shooting more than a deep-lying forward", () => {
    const poacher = effectFor("poacher");
    const forward = effectFor("deep-lying-forward");
    expect(poacher.shooting).toBeGreaterThan(forward.shooting);
    expect(poacher.y).toBeGreaterThan(forward.y);
  });

  it("has a ball-winning midfielder pressing more and passing safer than a deep-lying playmaker", () => {
    const winner = effectFor("ball-winning-midfielder");
    const playmaker = effectFor("deep-lying-playmaker");
    expect(winner.pressing).toBeGreaterThan(playmaker.pressing);
    expect(winner.passRisk).toBeLessThan(playmaker.passRisk);
  });

  it("puts an inside forward narrower and shooting more than a winger", () => {
    const inside = effectFor("inside-forward");
    const winger = effectFor("winger");
    expect(inside.x).toBeLessThan(winger.x);
    expect(inside.shooting).toBeGreaterThan(winger.shooting);
  });

  it("puts a wing-back higher and wider than a full-back", () => {
    const wingBack = effectFor("wing-back");
    const fullBack = effectFor("full-back");
    expect(wingBack.y).toBeGreaterThan(fullBack.y);
    expect(wingBack.x).toBeGreaterThan(fullBack.x);
  });

  it("gives every role one finite effect", () => {
    expect(ROLES.map((role) => role.id)).toEqual(EXPECTED_IDS);
    for (const role of ROLES) {
      expect(role.summary.endsWith(".")).toBe(true);
      expect(role.summary.slice(0, -1).includes(".")).toBe(false);
      expect(role.summary.includes("With the ball") && role.summary.includes("without it")).toBe(true);
      const effect = effectFor(role.id);
      expect(effect).toEqual(role.effect);
      expect(Number.isFinite(effect.x)).toBe(true);
      expect(Number.isFinite(effect.y)).toBe(true);
      expect(Number.isFinite(effect.passLength)).toBe(true);
      for (const rate of RATES) {
        expect(effect[rate]).toBeGreaterThanOrEqual(0);
        expect(effect[rate]).toBeLessThanOrEqual(1);
      }
    }
  });

  it("clears first with a no-nonsense centre-back: shorter, safer, and a harder tackle", () => {
    const plain = effectFor("centre-back");
    const none = effectFor("no-nonsense-centre-back");
    expect(none.passLength).toBeLessThan(plain.passLength);
    expect(none.passRisk).toBeLessThan(plain.passRisk);
    expect(none.tackling).toBeGreaterThan(plain.tackling);
    expect(none.y).toBeLessThan(6);
  });

  it("sits a covering centre-back off the line", () => {
    expect(effectFor("covering-centre-back").y).toBeLessThan(0);
  });

  it("steps a stopper onto the striker while a centre-back stays at the line", () => {
    expect(effectFor("stopper").y).toBeGreaterThan(effectFor("centre-back").y);
    expect(effectFor("stopper").y).toBeGreaterThan(3);
    expect(effectFor("centre-back").y).toBeLessThan(6);
    expect(effectFor("ball-playing-defender").y).toBeLessThan(6);
  });

  it("makes a regista longer and riskier than a deep-lying playmaker", () => {
    const regista = effectFor("regista");
    const playmaker = effectFor("deep-lying-playmaker");
    expect(regista.passLength).toBeGreaterThan(playmaker.passLength);
    expect(regista.passRisk).toBeGreaterThan(playmaker.passRisk);
  });

  it("sends a segundo volante on from a deep slot to shoot", () => {
    const run = effectFor("segundo-volante");
    expect(rolesFor("DM", false).map((role) => role.id)).toContain("segundo-volante");
    expect(run.y).toBeGreaterThan(10);
    expect(run.shooting).toBeGreaterThan(0.65);
  });

  it("gives a raumdeuter few passes and a high shot", () => {
    const raum = effectFor("raumdeuter");
    expect(raum.passLength).toBeLessThan(effectFor("winger").passLength);
    expect(raum.passLength).toBeLessThan(effectFor("inside-forward").passLength);
    expect(raum.shooting).toBeGreaterThan(0.7);
  });

  it("drops a false nine in, passing more and shooting less than an advanced forward", () => {
    const nine = effectFor("false-nine");
    const advanced = effectFor("advanced-forward");
    expect(nine.y).toBeLessThan(0);
    expect(nine.passLength).toBeGreaterThan(advanced.passLength);
    expect(nine.shooting).toBeLessThan(advanced.shooting);
  });

  it("keeps an enganche in the pocket, risky in possession and quiet out of it", () => {
    const pocket = effectFor("enganche");
    expect(Math.abs(pocket.y)).toBeLessThanOrEqual(1);
    expect(pocket.passRisk).toBeGreaterThan(0.7);
    expect(pocket.pressing).toBeLessThan(0.2);
  });
});

describe("roleMark", () => {
  it("gives every role a short unique mark and its full name", () => {
    const marks = EXPECTED_IDS.map((id) => roleMark(id));
    expect(new Set(marks).size).toBe(marks.length);
    for (const id of EXPECTED_IDS) {
      expect(roleMark(id)).toMatch(/^[A-Z0-9]{1,3}$/);
      expect(roleName(id).length).toBeGreaterThan(roleMark(id).length);
    }
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
      "no-nonsense-centre-back",
      "covering-centre-back",
      "stopper",
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
      "enganche",
    ]);
    expect(rolesFor("AM", true).map((role) => role.id)).toEqual([
      "winger",
      "inverted-winger",
      "inside-forward",
      "raumdeuter",
    ]);
    expect(rolesFor("GK", false).map((role) => role.id)).toEqual(["goalkeeper", "sweeper-keeper"]);
    expect(rolesFor("DM", false).map((role) => role.id)).toEqual([
      "defensive-midfielder",
      "deep-lying-playmaker",
      "ball-winning-midfielder",
      "half-back",
      "regista",
      "segundo-volante",
    ]);
    expect(rolesFor("DM", true).map((role) => role.id)).toEqual([
      "full-back",
      "wing-back",
      "inverted-wing-back",
      "ball-winning-midfielder",
    ]);
    expect(rolesFor("CM", true).map((role) => role.id)).toEqual([
      "wing-back",
      "inverted-wing-back",
      "ball-winning-midfielder",
      "central-midfielder",
      "box-to-box",
      "winger",
      "inverted-winger",
    ]);
    expect(rolesFor("ST", true).every((role) => role.lines.includes("ST"))).toBe(true);
    expect(rolesFor("CM", false).some((role) => role.lines.includes("ST"))).toBe(false);
  });

  it("returns each added role for its line and width and rejects the wrong line", () => {
    const added: { id: RoleId; line: Line; wide: boolean; anyWidth?: boolean }[] = [
      { id: "no-nonsense-centre-back", line: "DEF", wide: false },
      { id: "covering-centre-back", line: "DEF", wide: false },
      { id: "stopper", line: "DEF", wide: false },
      { id: "regista", line: "DM", wide: false },
      { id: "segundo-volante", line: "DM", wide: false },
      { id: "raumdeuter", line: "AM", wide: true },
      { id: "false-nine", line: "ST", wide: true, anyWidth: true },
      { id: "enganche", line: "AM", wide: false },
    ];

    for (const role of added) {
      expect(rolesFor(role.line, role.wide).map((entry) => entry.id)).toContain(role.id);
      if (role.anyWidth) {
        expect(rolesFor(role.line, !role.wide).map((entry) => entry.id)).toContain(role.id);
      } else {
        expect(rolesFor(role.line, !role.wide).map((entry) => entry.id)).not.toContain(role.id);
      }
      for (const line of LINES) {
        if (line === role.line) continue;
        expect(rolesFor(line, false).map((entry) => entry.id), `${role.id} on ${line}`).not.toContain(
          role.id,
        );
        expect(rolesFor(line, true).map((entry) => entry.id), `${role.id} on ${line} wide`).not.toContain(
          role.id,
        );
      }
    }
  });
});
