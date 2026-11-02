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

export type RoleId =
  | "goalkeeper"
  | "sweeper-keeper"
  | "centre-back"
  | "ball-playing-defender"
  | "no-nonsense-centre-back"
  | "covering-centre-back"
  | "stopper"
  | "full-back"
  | "wing-back"
  | "inverted-wing-back"
  | "defensive-midfielder"
  | "deep-lying-playmaker"
  | "ball-winning-midfielder"
  | "half-back"
  | "regista"
  | "segundo-volante"
  | "central-midfielder"
  | "box-to-box"
  | "mezzala"
  | "attacking-midfielder"
  | "advanced-playmaker"
  | "shadow-striker"
  | "enganche"
  | "winger"
  | "inverted-winger"
  | "inside-forward"
  | "raumdeuter"
  | "advanced-forward"
  | "deep-lying-forward"
  | "pressing-forward"
  | "target-forward"
  | "poacher"
  | "false-nine";

export type RoleDefinition = {
  id: RoleId;
  name: string;
  lines: Line[];
  wide: "any" | "wide" | "central";
  /** One sentence a fan would recognise: the job with the ball, and without it. */
  summary: string;
  /** Where this role arrives from the slot, and how it passes, shoots, presses, and tackles. */
  effect: RoleEffect;
};

const CATALOG: RoleDefinition[] = [
  {
    id: "goalkeeper",
    name: "Goalkeeper",
    lines: ["GK"],
    wide: "any",
    summary: "With the ball, plays short and safe; without it, stays on the line.",
    effect: { x: 0, y: 0, passLength: -4, passRisk: 0.12, shooting: 0.02, pressing: 0.08, tackling: 0.25 },
  },
  {
    id: "sweeper-keeper",
    name: "Sweeper Keeper",
    lines: ["GK"],
    wide: "any",
    summary:
      "With the ball, takes more risk from a higher spot; without it, sweeps behind the defence.",
    effect: { x: 0, y: 6, passLength: 10, passRisk: 0.48, shooting: 0.05, pressing: 0.4, tackling: 0.35 },
  },
  {
    id: "centre-back",
    name: "Centre-Back",
    lines: ["DEF"],
    wide: "central",
    summary: "With the ball, clears first and keeps the pass safe; without it, tackles in the back line.",
    effect: { x: 0, y: 0, passLength: 0, passRisk: 0.16, shooting: 0.06, pressing: 0.22, tackling: 0.72 },
  },
  {
    id: "ball-playing-defender",
    name: "Ball-Playing Defender",
    lines: ["DEF"],
    wide: "central",
    summary:
      "With the ball, looks for the pass that breaks the first line; without it, still defends as a centre-back.",
    effect: { x: 0, y: 1, passLength: 12, passRisk: 0.52, shooting: 0.08, pressing: 0.28, tackling: 0.6 },
  },
  {
    id: "no-nonsense-centre-back",
    name: "No-Nonsense Centre-Back",
    lines: ["DEF"],
    wide: "central",
    summary:
      "With the ball, clears first with a short safe pass; without it, throws a body into the tackle.",
    effect: { x: 0, y: 0, passLength: -8, passRisk: 0.06, shooting: 0.04, pressing: 0.16, tackling: 0.92 },
  },
  {
    id: "covering-centre-back",
    name: "Covering Centre-Back",
    lines: ["DEF"],
    wide: "central",
    summary:
      "With the ball, plays from a spot off the defensive line; without it, covers the space behind the other centre-back.",
    effect:
      // Sitting off the line is the job, so y stays negative.
      { x: 0, y: -4, passLength: 2, passRisk: 0.2, shooting: 0.05, pressing: 0.16, tackling: 0.68 },
  },
  {
    id: "stopper",
    name: "Stopper",
    lines: ["DEF"],
    wide: "central",
    summary:
      "With the ball, steps up onto the striker and moves it on; without it, jumps out of the line to engage that forward.",
    effect: { x: 0, y: 6, passLength: 0, passRisk: 0.24, shooting: 0.12, pressing: 0.55, tackling: 0.8 },
  },
  {
    id: "full-back",
    name: "Full-Back",
    // The same flank jobs apply one line higher, where a wide drop lands.
    lines: ["DEF", "DM"],
    wide: "wide",
    summary: "With the ball, offers a short option beside the centre-back; without it, tucks narrower and deeper.",
    effect: { x: 3, y: 2, passLength: 2, passRisk: 0.28, shooting: 0.14, pressing: 0.38, tackling: 0.58 },
  },
  {
    id: "wing-back",
    name: "Wing-Back",
    lines: ["DEF", "DM", "CM"],
    wide: "wide",
    summary: "With the ball, stretches the game high and wide; without it, still has the flank to cover.",
    effect: { x: 10, y: 8, passLength: 6, passRisk: 0.4, shooting: 0.3, pressing: 0.5, tackling: 0.45 },
  },
  {
    id: "inverted-wing-back",
    name: "Inverted Wing-Back",
    lines: ["DEF", "DM", "CM"],
    wide: "wide",
    summary: "With the ball, tucks into midfield to pass; without it, defends the full-back zone.",
    effect: { x: -8, y: 4, passLength: 10, passRisk: 0.5, shooting: 0.16, pressing: 0.36, tackling: 0.48 },
  },
  {
    id: "defensive-midfielder",
    name: "Defensive Midfielder",
    lines: ["DM"],
    wide: "central",
    summary: "With the ball, keeps the pass simple; without it, screens the space in front of the centre-backs.",
    effect: { x: 0, y: -2, passLength: -2, passRisk: 0.2, shooting: 0.1, pressing: 0.42, tackling: 0.68 },
  },
  {
    id: "deep-lying-playmaker",
    name: "Deep-Lying Playmaker",
    lines: ["DM"],
    wide: "central",
    summary: "With the ball, tries longer, riskier passes from deep; without it, tackles less than a holder.",
    effect: { x: 0, y: 0, passLength: 16, passRisk: 0.64, shooting: 0.14, pressing: 0.2, tackling: 0.26 },
  },
  {
    id: "ball-winning-midfielder",
    name: "Ball-Winning Midfielder",
    lines: ["DM", "CM"],
    wide: "any",
    summary: "With the ball, plays a safe short pass; without it, presses and tackles the midfield.",
    effect: { x: 0, y: 2, passLength: -6, passRisk: 0.14, shooting: 0.1, pressing: 0.84, tackling: 0.86 },
  },
  {
    id: "half-back",
    name: "Half-Back",
    lines: ["DM"],
    wide: "central",
    summary: "With the ball, drops toward the centre-backs to help them play; without it, fills the gap between them.",
    effect:
      // The drop toward the centre-backs is the job, so y stays negative.
      { x: 0, y: -8, passLength: 2, passRisk: 0.26, shooting: 0.06, pressing: 0.22, tackling: 0.7 },
  },
  {
    id: "regista",
    name: "Regista",
    lines: ["DM"],
    wide: "central",
    summary:
      "With the ball, attempts a longer and riskier pass from deep; without it, organises more than it tackles.",
    effect: { x: 0, y: 0, passLength: 22, passRisk: 0.78, shooting: 0.18, pressing: 0.12, tackling: 0.16 },
  },
  {
    id: "segundo-volante",
    name: "Segundo Volante",
    lines: ["DM"],
    wide: "central",
    summary:
      "With the ball, arrives late from a deep start to shoot; without it, begins in front of the back line before breaking on.",
    effect:
      // The slot is the deep start. This offset is the late run into the shot.
      { x: 0, y: 14, passLength: 4, passRisk: 0.44, shooting: 0.74, pressing: 0.55, tackling: 0.34 },
  },
  {
    id: "central-midfielder",
    name: "Central Midfielder",
    lines: ["CM"],
    wide: "any",
    summary: "With the ball, links the side from the middle; without it, shares the pressing and the tackles.",
    effect: { x: 0, y: 0, passLength: 4, passRisk: 0.34, shooting: 0.26, pressing: 0.45, tackling: 0.5 },
  },
  {
    id: "box-to-box",
    name: "Box-to-Box Midfielder",
    lines: ["CM"],
    wide: "any",
    summary: "With the ball, arrives to shoot; without it, presses higher than the holder.",
    effect: { x: 0, y: 4, passLength: 2, passRisk: 0.36, shooting: 0.42, pressing: 0.7, tackling: 0.6 },
  },
  {
    id: "mezzala",
    name: "Mezzala",
    lines: ["CM"],
    wide: "central",
    summary: "With the ball, drifts wide of the central lane and into the box; without it, presses from that half-space.",
    effect:
      // Positive x leaves the central lane. A fan who wants them glued to x = 0 wants a central midfielder.
      { x: 8, y: 4, passLength: 4, passRisk: 0.4, shooting: 0.4, pressing: 0.48, tackling: 0.38 },
  },
  {
    id: "attacking-midfielder",
    name: "Attacking Midfielder",
    lines: ["AM"],
    wide: "central",
    summary: "With the ball, creates and shoots from between the lines; without it, presses the deep midfielders.",
    effect: { x: 0, y: 2, passLength: 6, passRisk: 0.46, shooting: 0.5, pressing: 0.42, tackling: 0.26 },
  },
  {
    id: "advanced-playmaker",
    name: "Advanced Playmaker",
    lines: ["AM"],
    wide: "central",
    summary: "With the ball, attempts the difficult pass; without it, leaves the tackling to others.",
    effect: { x: 0, y: 0, passLength: 12, passRisk: 0.74, shooting: 0.3, pressing: 0.22, tackling: 0.14 },
  },
  {
    id: "shadow-striker",
    name: "Shadow Striker",
    lines: ["AM"],
    wide: "central",
    summary: "With the ball, runs in behind to shoot; without it, stays high on the last defender.",
    effect: { x: 0, y: 10, passLength: 0, passRisk: 0.38, shooting: 0.76, pressing: 0.4, tackling: 0.18 },
  },
  {
    id: "enganche",
    name: "Enganche",
    lines: ["AM"],
    wide: "central",
    summary:
      "With the ball, tries a risky pass while staying in the pocket; without it, holds that pocket and leaves the pressing to others.",
    effect:
      // The pocket is the job, so y stays near 0.
      { x: 0, y: 0, passLength: 8, passRisk: 0.82, shooting: 0.32, pressing: 0.08, tackling: 0.12 },
  },
  {
    id: "winger",
    name: "Winger",
    lines: ["AM", "CM"],
    wide: "wide",
    summary: "With the ball, stays wide and crosses; without it, tracks the opposing full-back.",
    effect: { x: 12, y: 0, passLength: 8, passRisk: 0.38, shooting: 0.2, pressing: 0.38, tackling: 0.28 },
  },
  {
    id: "inverted-winger",
    name: "Inverted Winger",
    lines: ["AM", "CM"],
    wide: "wide",
    summary: "With the ball, tucks inside to combine; without it, starts wide and squeezes the play inward.",
    effect: { x: -6, y: 2, passLength: 8, passRisk: 0.55, shooting: 0.38, pressing: 0.36, tackling: 0.22 },
  },
  {
    id: "inside-forward",
    name: "Inside Forward",
    lines: ["AM"],
    wide: "wide",
    summary: "With the ball, narrows the run and shoots; without it, presses from that higher inside channel.",
    effect: { x: -4, y: 6, passLength: 2, passRisk: 0.42, shooting: 0.68, pressing: 0.4, tackling: 0.2 },
  },
  {
    id: "raumdeuter",
    name: "Raumdeuter",
    lines: ["AM"],
    wide: "wide",
    summary:
      "With the ball, attacks space and plays few passes; without it, drifts off the marker to find the next gap.",
    effect: { x: -4, y: 8, passLength: -6, passRisk: 0.28, shooting: 0.8, pressing: 0.26, tackling: 0.16 },
  },
  {
    id: "advanced-forward",
    name: "Advanced Forward",
    lines: ["ST"],
    wide: "any",
    summary: "With the ball, attacks the box to finish; without it, presses the centre-backs.",
    effect: { x: 0, y: 6, passLength: 0, passRisk: 0.4, shooting: 0.74, pressing: 0.55, tackling: 0.22 },
  },
  {
    id: "deep-lying-forward",
    name: "Deep-Lying Forward",
    lines: ["ST"],
    wide: "any",
    summary: "With the ball, drops off the front to link play; without it, offers a pass more than a shot.",
    effect: { x: 0, y: -6, passLength: 8, passRisk: 0.48, shooting: 0.3, pressing: 0.32, tackling: 0.28 },
  },
  {
    id: "pressing-forward",
    name: "Pressing Forward",
    lines: ["ST"],
    wide: "any",
    summary: "With the ball, can finish the move; without it, hunts the ball from the front.",
    effect: { x: 0, y: 2, passLength: -2, passRisk: 0.3, shooting: 0.52, pressing: 0.88, tackling: 0.5 },
  },
  {
    id: "target-forward",
    name: "Target Forward",
    lines: ["ST"],
    wide: "any",
    summary: "With the ball, stays central and lays the first ball off; without it, occupies the centre-backs.",
    effect:
      // Shooting stays modest. The job is winning the first ball, not leading the shot count.
      { x: 0, y: 0, passLength: -2, passRisk: 0.16, shooting: 0.38, pressing: 0.3, tackling: 0.42 },
  },
  {
    id: "poacher",
    name: "Poacher",
    lines: ["ST"],
    wide: "any",
    summary: "With the ball, shoots and does little else; without it, stays on the last shoulder.",
    effect: { x: 0, y: 8, passLength: -8, passRisk: 0.12, shooting: 0.9, pressing: 0.25, tackling: 0.12 },
  },
  {
    id: "false-nine",
    name: "False Nine",
    lines: ["ST"],
    wide: "any",
    summary:
      "With the ball, drops in to combine rather than finish; without it, comes toward midfield instead of pinning the centre-backs.",
    effect:
      // The drop is the job, so y stays negative.
      { x: 0, y: -6, passLength: 10, passRisk: 0.5, shooting: 0.38, pressing: 0.34, tackling: 0.24 },
  },
];

const BY_ID = new Map(CATALOG.map((role) => [role.id, role]));

export const ROLES: RoleDefinition[] = CATALOG;

export function rolesFor(line: Line, wide: boolean): RoleDefinition[] {
  const band = wide ? "wide" : "central";
  return ROLES.filter(
    (role) => role.lines.includes(line) && (role.wide === "any" || role.wide === band),
  );
}

const MARKS: Record<RoleId, string> = {
  goalkeeper: "GK",
  "sweeper-keeper": "SK",
  "centre-back": "CB",
  "ball-playing-defender": "BPD",
  "no-nonsense-centre-back": "NCB",
  "covering-centre-back": "CCD",
  stopper: "STP",
  "full-back": "FB",
  "wing-back": "WB",
  "inverted-wing-back": "IWB",
  "defensive-midfielder": "DM",
  "deep-lying-playmaker": "DLP",
  "ball-winning-midfielder": "BWM",
  "half-back": "HB",
  regista: "REG",
  "segundo-volante": "SV",
  "central-midfielder": "CM",
  "box-to-box": "B2B",
  mezzala: "MEZ",
  "attacking-midfielder": "AM",
  "advanced-playmaker": "AP",
  "shadow-striker": "SS",
  enganche: "ENG",
  winger: "W",
  "inverted-winger": "IW",
  "inside-forward": "IF",
  raumdeuter: "RMD",
  "advanced-forward": "AF",
  "deep-lying-forward": "DLF",
  "pressing-forward": "PF",
  "target-forward": "TF",
  poacher: "P",
  "false-nine": "F9",
};

export function roleName(roleId: RoleId): string {
  return BY_ID.get(roleId)?.name ?? roleId;
}

export function roleMark(roleId: RoleId): string {
  return MARKS[roleId];
}

export function effectFor(roleId: RoleId): RoleEffect {
  const role = BY_ID.get(roleId);
  if (!role) throw new Error(`Unknown role: ${roleId}`);
  return { ...role.effect };
}
