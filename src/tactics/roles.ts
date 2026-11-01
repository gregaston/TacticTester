import type { Line } from "./types";

/**
 * Offsets from the player's slot, plus how they pass, shoot, press, and tackle.
 * Positive y is toward the opponent goal. Positive x is toward the right
 * touchline; the caller mirrors x for a left-sided player. A role that tucks
 * inside uses a negative x, which is toward the centre when the player is on
 * the right.
 * passLength is yards added to the team baseline. The four rates run from 0 to 1.
 */
export type RoleEffect = {
  x: number;
  y: number;
  passLength: number;
  passRisk: number;
  shooting: number;
  pressing: number;
  tackling: number;
};

export type Duty = "defend" | "support" | "attack";

export type RoleId =
  | "goalkeeper"
  | "sweeper-keeper"
  | "centre-back"
  | "ball-playing-defender"
  | "full-back"
  | "wing-back"
  | "inverted-wing-back"
  | "defensive-midfielder"
  | "deep-lying-playmaker"
  | "ball-winning-midfielder"
  | "half-back"
  | "central-midfielder"
  | "box-to-box"
  | "mezzala"
  | "attacking-midfielder"
  | "advanced-playmaker"
  | "shadow-striker"
  | "winger"
  | "inverted-winger"
  | "inside-forward"
  | "advanced-forward"
  | "deep-lying-forward"
  | "pressing-forward"
  | "target-forward"
  | "poacher";

export type RoleDefinition = {
  id: RoleId;
  name: string;
  lines: Line[];
  wide: "any" | "wide" | "central";
  /** One sentence a fan would recognise: the job with the ball, and without it. */
  summary: string;
  /** Support duty. Defend sits deeper; attack steps on. */
  effect: RoleEffect;
};

type DutyEffects = Record<Duty, RoleEffect>;

type CatalogRole = {
  id: RoleId;
  name: string;
  lines: Line[];
  wide: RoleDefinition["wide"];
  summary: string;
  duties: DutyEffects;
};

const CATALOG: CatalogRole[] = [
  {
    id: "goalkeeper",
    name: "Goalkeeper",
    lines: ["GK"],
    wide: "any",
    summary: "With the ball, plays short and safe; without it, stays on the line.",
    duties: {
      support: { x: 0, y: 0, passLength: -4, passRisk: 0.12, shooting: 0.02, pressing: 0.08, tackling: 0.25 },
      defend: { x: 0, y: -3, passLength: -6, passRisk: 0.06, shooting: 0.01, pressing: 0.05, tackling: 0.4 },
      attack: { x: 0, y: 3, passLength: 2, passRisk: 0.28, shooting: 0.04, pressing: 0.15, tackling: 0.18 },
    },
  },
  {
    id: "sweeper-keeper",
    name: "Sweeper Keeper",
    lines: ["GK"],
    wide: "any",
    summary:
      "With the ball, takes more risk from a higher spot; without it, sweeps behind the defence.",
    duties: {
      support: { x: 0, y: 6, passLength: 10, passRisk: 0.48, shooting: 0.05, pressing: 0.4, tackling: 0.35 },
      defend: { x: 0, y: 2, passLength: 4, passRisk: 0.28, shooting: 0.02, pressing: 0.25, tackling: 0.5 },
      attack: { x: 0, y: 10, passLength: 16, passRisk: 0.68, shooting: 0.08, pressing: 0.55, tackling: 0.22 },
    },
  },
  {
    id: "centre-back",
    name: "Centre-Back",
    lines: ["DEF"],
    wide: "central",
    summary: "With the ball, clears first and keeps the pass safe; without it, tackles in the back line.",
    duties: {
      support: { x: 0, y: 0, passLength: 0, passRisk: 0.16, shooting: 0.06, pressing: 0.22, tackling: 0.72 },
      defend: { x: 0, y: -6, passLength: -4, passRisk: 0.08, shooting: 0.02, pressing: 0.12, tackling: 0.88 },
      // Stays in the back line. Stepping further would walk a centre-back toward midfield.
      attack: { x: 0, y: 2, passLength: 4, passRisk: 0.24, shooting: 0.1, pressing: 0.35, tackling: 0.58 },
    },
  },
  {
    id: "ball-playing-defender",
    name: "Ball-Playing Defender",
    lines: ["DEF"],
    wide: "central",
    summary:
      "With the ball, looks for the pass that breaks the first line; without it, still defends as a centre-back.",
    duties: {
      support: { x: 0, y: 1, passLength: 12, passRisk: 0.52, shooting: 0.08, pressing: 0.28, tackling: 0.6 },
      defend: { x: 0, y: -5, passLength: 6, passRisk: 0.3, shooting: 0.03, pressing: 0.16, tackling: 0.78 },
      // About +6 is as far as a centre-back steps. From a back-line slot that is still short of midfield.
      attack: { x: 0, y: 6, passLength: 18, passRisk: 0.7, shooting: 0.12, pressing: 0.4, tackling: 0.45 },
    },
  },
  {
    id: "full-back",
    name: "Full-Back",
    lines: ["DEF"],
    wide: "wide",
    summary: "With the ball, offers a short option beside the centre-back; without it, tucks narrower and deeper.",
    duties: {
      support: { x: 3, y: 2, passLength: 2, passRisk: 0.28, shooting: 0.14, pressing: 0.38, tackling: 0.58 },
      defend: { x: -2, y: -6, passLength: -2, passRisk: 0.12, shooting: 0.05, pressing: 0.22, tackling: 0.76 },
      attack: { x: 6, y: 8, passLength: 6, passRisk: 0.4, shooting: 0.28, pressing: 0.48, tackling: 0.4 },
    },
  },
  {
    id: "wing-back",
    name: "Wing-Back",
    lines: ["DEF"],
    wide: "wide",
    summary: "With the ball, stretches the game high and wide; without it, still has the flank to cover.",
    duties: {
      support: { x: 10, y: 8, passLength: 6, passRisk: 0.4, shooting: 0.3, pressing: 0.5, tackling: 0.45 },
      defend: { x: 6, y: 2, passLength: 2, passRisk: 0.22, shooting: 0.14, pressing: 0.35, tackling: 0.62 },
      attack: { x: 14, y: 16, passLength: 8, passRisk: 0.52, shooting: 0.48, pressing: 0.58, tackling: 0.28 },
    },
  },
  {
    id: "inverted-wing-back",
    name: "Inverted Wing-Back",
    lines: ["DEF"],
    wide: "wide",
    summary: "With the ball, tucks into midfield to pass; without it, defends the full-back zone.",
    duties: {
      support: { x: -8, y: 4, passLength: 10, passRisk: 0.5, shooting: 0.16, pressing: 0.36, tackling: 0.48 },
      defend: { x: -5, y: -2, passLength: 4, passRisk: 0.28, shooting: 0.06, pressing: 0.24, tackling: 0.66 },
      attack: { x: -12, y: 10, passLength: 14, passRisk: 0.66, shooting: 0.22, pressing: 0.42, tackling: 0.32 },
    },
  },
  {
    id: "defensive-midfielder",
    name: "Defensive Midfielder",
    lines: ["DM"],
    wide: "central",
    summary: "With the ball, keeps the pass simple; without it, screens the space in front of the centre-backs.",
    duties: {
      support: { x: 0, y: -2, passLength: -2, passRisk: 0.2, shooting: 0.1, pressing: 0.42, tackling: 0.68 },
      defend: { x: 0, y: -8, passLength: -6, passRisk: 0.1, shooting: 0.04, pressing: 0.3, tackling: 0.84 },
      attack: { x: 0, y: 4, passLength: 2, passRisk: 0.3, shooting: 0.18, pressing: 0.5, tackling: 0.52 },
    },
  },
  {
    id: "deep-lying-playmaker",
    name: "Deep-Lying Playmaker",
    lines: ["DM"],
    wide: "central",
    summary: "With the ball, tries longer, riskier passes from deep; without it, tackles less than a holder.",
    duties: {
      support: { x: 0, y: 0, passLength: 16, passRisk: 0.64, shooting: 0.14, pressing: 0.2, tackling: 0.26 },
      defend: { x: 0, y: -6, passLength: 10, passRisk: 0.42, shooting: 0.06, pressing: 0.12, tackling: 0.4 },
      attack: { x: 0, y: 4, passLength: 20, passRisk: 0.8, shooting: 0.2, pressing: 0.28, tackling: 0.16 },
    },
  },
  {
    id: "ball-winning-midfielder",
    name: "Ball-Winning Midfielder",
    lines: ["DM"],
    wide: "central",
    summary: "With the ball, plays a safe short pass; without it, presses and tackles the midfield.",
    duties: {
      support: { x: 0, y: 2, passLength: -6, passRisk: 0.14, shooting: 0.1, pressing: 0.84, tackling: 0.86 },
      defend: { x: 0, y: -4, passLength: -8, passRisk: 0.08, shooting: 0.04, pressing: 0.7, tackling: 0.94 },
      attack: { x: 0, y: 8, passLength: -2, passRisk: 0.22, shooting: 0.22, pressing: 0.92, tackling: 0.7 },
    },
  },
  {
    id: "half-back",
    name: "Half-Back",
    lines: ["DM"],
    wide: "central",
    summary: "With the ball, drops toward the centre-backs to help them play; without it, fills the gap between them.",
    duties: {
      // The drop toward the centre-backs is the job, so y stays negative even on support.
      support: { x: 0, y: -8, passLength: 2, passRisk: 0.26, shooting: 0.06, pressing: 0.22, tackling: 0.7 },
      defend: { x: 0, y: -14, passLength: -2, passRisk: 0.14, shooting: 0.02, pressing: 0.12, tackling: 0.84 },
      attack: { x: 0, y: -2, passLength: 6, passRisk: 0.38, shooting: 0.12, pressing: 0.32, tackling: 0.52 },
    },
  },
  {
    id: "central-midfielder",
    name: "Central Midfielder",
    lines: ["CM"],
    wide: "any",
    summary: "With the ball, links the side from the middle; without it, shares the pressing and the tackles.",
    duties: {
      support: { x: 0, y: 0, passLength: 4, passRisk: 0.34, shooting: 0.26, pressing: 0.45, tackling: 0.5 },
      defend: { x: 0, y: -6, passLength: 0, passRisk: 0.18, shooting: 0.12, pressing: 0.38, tackling: 0.66 },
      attack: { x: 0, y: 6, passLength: 8, passRisk: 0.48, shooting: 0.4, pressing: 0.52, tackling: 0.34 },
    },
  },
  {
    id: "box-to-box",
    name: "Box-to-Box Midfielder",
    lines: ["CM"],
    wide: "any",
    summary: "With the ball, arrives to shoot; without it, presses higher than the holder.",
    duties: {
      support: { x: 0, y: 4, passLength: 2, passRisk: 0.36, shooting: 0.42, pressing: 0.7, tackling: 0.6 },
      defend: { x: 0, y: -2, passLength: -2, passRisk: 0.2, shooting: 0.22, pressing: 0.58, tackling: 0.76 },
      attack: { x: 0, y: 12, passLength: 4, passRisk: 0.46, shooting: 0.6, pressing: 0.82, tackling: 0.42 },
    },
  },
  {
    id: "mezzala",
    name: "Mezzala",
    lines: ["CM"],
    wide: "central",
    summary: "With the ball, drifts wide of the central lane and into the box; without it, presses from that half-space.",
    duties: {
      // Positive x leaves the central lane. A fan who wants them glued to x = 0 wants a central midfielder.
      support: { x: 8, y: 4, passLength: 4, passRisk: 0.4, shooting: 0.4, pressing: 0.48, tackling: 0.38 },
      defend: { x: 4, y: -2, passLength: 0, passRisk: 0.22, shooting: 0.18, pressing: 0.36, tackling: 0.55 },
      attack: { x: 12, y: 12, passLength: 6, passRisk: 0.52, shooting: 0.66, pressing: 0.55, tackling: 0.22 },
    },
  },
  {
    id: "attacking-midfielder",
    name: "Attacking Midfielder",
    lines: ["AM"],
    wide: "central",
    summary: "With the ball, creates and shoots from between the lines; without it, presses the deep midfielders.",
    duties: {
      support: { x: 0, y: 2, passLength: 6, passRisk: 0.46, shooting: 0.5, pressing: 0.42, tackling: 0.26 },
      defend: { x: 0, y: -4, passLength: 2, passRisk: 0.26, shooting: 0.28, pressing: 0.5, tackling: 0.42 },
      attack: { x: 0, y: 8, passLength: 8, passRisk: 0.58, shooting: 0.68, pressing: 0.48, tackling: 0.14 },
    },
  },
  {
    id: "advanced-playmaker",
    name: "Advanced Playmaker",
    lines: ["AM"],
    wide: "central",
    summary: "With the ball, attempts the difficult pass; without it, leaves the tackling to others.",
    duties: {
      support: { x: 0, y: 0, passLength: 12, passRisk: 0.74, shooting: 0.3, pressing: 0.22, tackling: 0.14 },
      defend: { x: 0, y: -6, passLength: 8, passRisk: 0.5, shooting: 0.14, pressing: 0.18, tackling: 0.3 },
      attack: { x: 0, y: 5, passLength: 16, passRisk: 0.88, shooting: 0.4, pressing: 0.28, tackling: 0.08 },
    },
  },
  {
    id: "shadow-striker",
    name: "Shadow Striker",
    lines: ["AM"],
    wide: "central",
    summary: "With the ball, runs in behind to shoot; without it, stays high on the last defender.",
    duties: {
      support: { x: 0, y: 10, passLength: 0, passRisk: 0.38, shooting: 0.76, pressing: 0.4, tackling: 0.18 },
      defend: { x: 0, y: 4, passLength: -2, passRisk: 0.2, shooting: 0.48, pressing: 0.32, tackling: 0.34 },
      attack: { x: 0, y: 16, passLength: 2, passRisk: 0.48, shooting: 0.9, pressing: 0.48, tackling: 0.08 },
    },
  },
  {
    id: "winger",
    name: "Winger",
    lines: ["AM"],
    wide: "wide",
    summary: "With the ball, stays wide and crosses; without it, tracks the opposing full-back.",
    duties: {
      support: { x: 12, y: 0, passLength: 8, passRisk: 0.38, shooting: 0.2, pressing: 0.38, tackling: 0.28 },
      defend: { x: 8, y: -6, passLength: 4, passRisk: 0.2, shooting: 0.08, pressing: 0.28, tackling: 0.46 },
      attack: { x: 15, y: 5, passLength: 10, passRisk: 0.5, shooting: 0.34, pressing: 0.45, tackling: 0.16 },
    },
  },
  {
    id: "inverted-winger",
    name: "Inverted Winger",
    lines: ["AM"],
    wide: "wide",
    summary: "With the ball, tucks inside to combine; without it, starts wide and squeezes the play inward.",
    duties: {
      support: { x: -6, y: 2, passLength: 8, passRisk: 0.55, shooting: 0.38, pressing: 0.36, tackling: 0.22 },
      defend: { x: -3, y: -4, passLength: 4, passRisk: 0.32, shooting: 0.18, pressing: 0.28, tackling: 0.4 },
      attack: { x: -9, y: 7, passLength: 12, passRisk: 0.7, shooting: 0.5, pressing: 0.4, tackling: 0.12 },
    },
  },
  {
    id: "inside-forward",
    name: "Inside Forward",
    lines: ["AM"],
    wide: "wide",
    summary: "With the ball, narrows the run and shoots; without it, presses from that higher inside channel.",
    duties: {
      support: { x: -4, y: 6, passLength: 2, passRisk: 0.42, shooting: 0.68, pressing: 0.4, tackling: 0.2 },
      defend: { x: -2, y: 0, passLength: 0, passRisk: 0.24, shooting: 0.4, pressing: 0.3, tackling: 0.36 },
      attack: { x: -8, y: 12, passLength: 4, passRisk: 0.52, shooting: 0.86, pressing: 0.48, tackling: 0.1 },
    },
  },
  {
    id: "advanced-forward",
    name: "Advanced Forward",
    lines: ["ST"],
    wide: "any",
    summary: "With the ball, attacks the box to finish; without it, presses the centre-backs.",
    duties: {
      support: { x: 0, y: 6, passLength: 0, passRisk: 0.4, shooting: 0.74, pressing: 0.55, tackling: 0.22 },
      defend: { x: 0, y: 0, passLength: -2, passRisk: 0.22, shooting: 0.46, pressing: 0.48, tackling: 0.4 },
      attack: { x: 0, y: 12, passLength: 2, passRisk: 0.5, shooting: 0.9, pressing: 0.62, tackling: 0.12 },
    },
  },
  {
    id: "deep-lying-forward",
    name: "Deep-Lying Forward",
    lines: ["ST"],
    wide: "any",
    summary: "With the ball, drops off the front to link play; without it, offers a pass more than a shot.",
    duties: {
      support: { x: 0, y: -6, passLength: 8, passRisk: 0.48, shooting: 0.3, pressing: 0.32, tackling: 0.28 },
      defend: { x: 0, y: -12, passLength: 4, passRisk: 0.28, shooting: 0.14, pressing: 0.22, tackling: 0.44 },
      attack: { x: 0, y: 0, passLength: 12, passRisk: 0.62, shooting: 0.42, pressing: 0.4, tackling: 0.16 },
    },
  },
  {
    id: "pressing-forward",
    name: "Pressing Forward",
    lines: ["ST"],
    wide: "any",
    summary: "With the ball, can finish the move; without it, hunts the ball from the front.",
    duties: {
      support: { x: 0, y: 2, passLength: -2, passRisk: 0.3, shooting: 0.52, pressing: 0.88, tackling: 0.5 },
      defend: { x: 0, y: -4, passLength: -4, passRisk: 0.16, shooting: 0.3, pressing: 0.72, tackling: 0.66 },
      attack: { x: 0, y: 8, passLength: 0, passRisk: 0.4, shooting: 0.68, pressing: 0.96, tackling: 0.34 },
    },
  },
  {
    id: "target-forward",
    name: "Target Forward",
    lines: ["ST"],
    wide: "any",
    summary: "With the ball, stays central and lays the first ball off; without it, occupies the centre-backs.",
    duties: {
      // Shooting stays modest. The job is winning the first ball, not leading the shot count.
      support: { x: 0, y: 0, passLength: -2, passRisk: 0.16, shooting: 0.38, pressing: 0.3, tackling: 0.42 },
      defend: { x: 0, y: -5, passLength: -4, passRisk: 0.08, shooting: 0.2, pressing: 0.2, tackling: 0.58 },
      attack: { x: 0, y: 4, passLength: 0, passRisk: 0.24, shooting: 0.52, pressing: 0.38, tackling: 0.28 },
    },
  },
  {
    id: "poacher",
    name: "Poacher",
    lines: ["ST"],
    wide: "any",
    summary: "With the ball, shoots and does little else; without it, stays on the last shoulder.",
    duties: {
      support: { x: 0, y: 8, passLength: -8, passRisk: 0.12, shooting: 0.9, pressing: 0.25, tackling: 0.12 },
      defend: { x: 0, y: 2, passLength: -10, passRisk: 0.06, shooting: 0.68, pressing: 0.18, tackling: 0.24 },
      attack: { x: 0, y: 14, passLength: -6, passRisk: 0.18, shooting: 0.97, pressing: 0.3, tackling: 0.06 },
    },
  },
];

const BY_ID = new Map(CATALOG.map((role) => [role.id, role]));

export const ROLES: RoleDefinition[] = CATALOG.map((role) => ({
  id: role.id,
  name: role.name,
  lines: role.lines,
  wide: role.wide,
  summary: role.summary,
  effect: { ...role.duties.support },
}));

export function rolesFor(line: Line, wide: boolean): RoleDefinition[] {
  const band = wide ? "wide" : "central";
  return ROLES.filter(
    (role) => role.lines.includes(line) && (role.wide === "any" || role.wide === band),
  );
}

export function effectFor(roleId: RoleId, duty: Duty): RoleEffect {
  const role = BY_ID.get(roleId);
  if (!role) throw new Error(`Unknown role: ${roleId}`);
  return { ...role.duties[duty] };
}
