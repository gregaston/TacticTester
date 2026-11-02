import { formatSeason } from "../compare/format";
import { applyInstructions, DEFAULT_INSTRUCTIONS, type TeamInstructions } from "../tactics/instructions";
import { ROLES, effectFor, rolesFor, type Duty, type RoleId } from "../tactics/roles";
import type { SquadLabels } from "../tactics/positions";
import type { Line, Player, PositionCode } from "../tactics/types";
import { shotSentence } from "./run";
import type { StyleFingerprint } from "./types";

/**
 * Places a user's roles and team instructions on the same scale as the
 * recorded seasons.
 *
 * Pass length starts at the median completed pass in the set. The team
 * passing instruction adds its yards. A role adds the yards it differs by
 * from that position's usual support role, so an untouched side stays in
 * the middle. Shorter, on its own, lands on the shortest side in the set.
 * More direct, on its own, lands on the longest. Go long or Play out on
 * top of those can step just past the set, and the instruction note says so.
 *
 * Press height starts at the median height of defensive actions. The
 * instruction model counts engagement in its own units. A higher line,
 * a higher engagement, and pressing more, together, land on the highest
 * side. The deep passive block lands on the deepest. Anything stacked
 * past that steps just beyond the set. Role pressing nudges the same
 * number. Each sentence names the side closest on that one measure, so
 * a change of passing does not rewrite the press.
 *
 * Shots start at the median shot count and move with tempo and with how
 * often the attackers shoot. The place those shots come from is the
 * attackers' slots plus their role movement. It is a sketch of the roles,
 * not a tracked shot map, and it is not compared with StatsBomb xG.
 */

export const WIDE_CODES = new Set<PositionCode>(["DL", "DR", "WBL", "WBR", "ML", "MR", "AML", "AMR"]);

const PRESS_PER_ROLE = 18;
const STANDARD_PRESS_EFFECT = applyInstructions(DEFAULT_INSTRUCTIONS).pressHeight;
const HIGH_PRESS_EFFECT = applyInstructions({
  ...DEFAULT_INSTRUCTIONS,
  defensiveLine: "higher",
  engagement: "higher",
  pressing: "more",
}).pressHeight;
const DEEP_PRESS_EFFECT = applyInstructions({
  ...DEFAULT_INSTRUCTIONS,
  defensiveLine: "deeper",
  engagement: "lower",
  pressing: "less",
}).pressHeight;
const DIRECT_PASS_EFFECT = applyInstructions({ ...DEFAULT_INSTRUCTIONS, passing: "more direct" }).passLength;
const SHORT_PASS_EFFECT = Math.abs(applyInstructions({ ...DEFAULT_INSTRUCTIONS, passing: "shorter" }).passLength);
const SHOT_FROM_ROLE = 0.5;

const FALLBACK_PASS = 19;
const FALLBACK_PRESS = 40;
const FALLBACK_SHOTS = 12;

/** Cells in reading order, opponent's goal along the first row. */
export function shotMapCells(grid: number[][]): number[] {
  if (grid.length === 0 || grid[0].length === 0) return [];
  const cells: number[] = [];
  for (let x = grid[0].length - 1; x >= 0; x -= 1) {
    for (let y = 0; y < grid.length; y += 1) cells.push(grid[y][x]);
  }
  return cells;
}

export const STYLE_NOTE =
  "Pass length, shots, and the height of defensive actions use the same scale as these StatsBomb seasons. Where the shots come from is read off the roles, not from a tracked shot map.";

export type Assignment = { roleId: string; duty: Duty };

export type ProfilePlayer = {
  x: number;
  y: number;
  line: Line;
  wide: boolean;
  left: boolean;
  roleId: RoleId;
  duty: Duty;
};

export type StyleProfile = {
  passLength: number;
  shotsPerMatch: number;
  pressHeight: number;
  shotX: number;
  shotY: number;
};

export type StyleReading = {
  profile: StyleProfile;
  nearestId: string | null;
  lines: string[];
};

export function resolveRole(line: Line, wide: boolean, stored?: Assignment): { roleId: RoleId; duty: Duty } {
  const preferred = rolesFor(line, wide);
  const choices = preferred.length > 0 ? preferred : rolesFor(line, !wide);
  const duty = stored?.duty ?? "support";
  const chosen =
    choices.find((role) => role.id === stored?.roleId) ??
    choices[0] ??
    ROLES.find((role) => role.lines.includes(line)) ??
    ROLES[0];
  return { roleId: chosen.id, duty };
}

export function playersFromBoard(
  players: Player[],
  labels: SquadLabels,
  setups: Record<string, Assignment>,
): ProfilePlayer[] {
  return players.map((player) => {
    const label = labels.byId[player.id];
    const choice = resolveRole(label.line, WIDE_CODES.has(label.code), setups[player.id]);
    return {
      x: player.x,
      y: player.y,
      line: label.line,
      wide: WIDE_CODES.has(label.code),
      left: player.x < 50,
      roleId: choice.roleId,
      duty: choice.duty,
    };
  });
}

export function readStyle(
  players: ProfilePlayer[],
  instructions: TeamInstructions,
  styles: StyleFingerprint[],
): StyleReading {
  const profile = buildProfile(players, instructions, styles);
  const nearest = nearestStyle(profile, styles);
  return {
    profile,
    nearestId: nearest?.id ?? null,
    lines: readingLines(profile, styles),
  };
}

export type StyleBand = { mid: number; low: number; high: number };

export type StyleSpread = {
  passLength: StyleBand;
  shotsPerMatch: StyleBand;
  pressHeight: StyleBand;
};

export function recordedSpread(styles: { passLength: number; shotsPerMatch: number; pressHeight: number }[]): StyleSpread {
  return {
    passLength: band(styles.map((side) => side.passLength), FALLBACK_PASS),
    shotsPerMatch: band(styles.map((side) => side.shotsPerMatch), FALLBACK_SHOTS),
    pressHeight: band(styles.map((side) => side.pressHeight), FALLBACK_PRESS),
  };
}

export type StyleControl = { name: string; amount: number };

/**
 * The instruction or the roles that add the most on one measure, in the
 * same units as the profile. Amount is signed: positive lengthens the
 * pass, raises the press, or adds shots.
 */
export function styleControl(
  players: ProfilePlayer[],
  instructions: TeamInstructions,
  styles: { passLength: number; shotsPerMatch: number; pressHeight: number }[],
  metric: "passLength" | "shotsPerMatch" | "pressHeight",
): StyleControl | null {
  const spread = recordedSpread(styles);
  const pieces = controls(players, instructions, spread).filter((piece) => piece[metric] !== 0);
  if (pieces.length === 0) return null;
  const best = [...pieces].sort((a, b) => Math.abs(b[metric]) - Math.abs(a[metric]))[0];
  return { name: best.name, amount: best[metric] };
}

export function passingStackNote(instructions: TeamInstructions): string | null {
  if (instructions.passing === "more direct" && instructions.distribution === "go long") {
    return "Go long is added on top of more direct.";
  }
  if (instructions.passing === "shorter" && instructions.distribution === "play out") {
    return "Play out is added on top of shorter passing.";
  }
  return null;
}

function buildProfile(
  players: ProfilePlayer[],
  instructions: TeamInstructions,
  styles: StyleFingerprint[],
): StyleProfile {
  const effect = applyInstructions(instructions);
  const attackers = players.filter((player) => player.line === "ST" || player.line === "AM");
  const shotGroup = attackers.length > 0 ? attackers : players;
  const spot = shotSpot(shotGroup, effect.width);
  const spread = recordedSpread(styles);
  const rolePass = mean(players.map((player) => delta(player, "passLength")));
  const rolePress = mean(players.map((player) => delta(player, "pressing"))) * PRESS_PER_ROLE;
  const roleShots = 1 + SHOT_FROM_ROLE * mean(shotGroup.map((player) => delta(player, "shooting")));
  return {
    passLength: round1(spread.passLength.mid + scaledPass(effect.passLength, spread.passLength) + rolePass),
    shotsPerMatch: round1(spread.shotsPerMatch.mid * effect.shotVolume * roleShots),
    pressHeight: round1(spread.pressHeight.mid + scaledPress(effect.pressHeight, spread.pressHeight) + rolePress),
    shotX: round1(spot.x),
    shotY: round1(spot.y),
  };
}

function band(values: number[], fallback: number): StyleBand {
  if (values.length === 0) return { mid: fallback, low: fallback, high: fallback };
  return { mid: centre(values, fallback), low: Math.min(...values), high: Math.max(...values) };
}

/** Positive instruction yards stretch across the long half of the set. Negative yards stretch across the short half. */
function scaledPass(effectPass: number, range: StyleBand): number {
  if (effectPass >= 0) return ((range.high - range.mid) * effectPass) / (DIRECT_PASS_EFFECT || 1);
  return ((range.mid - range.low) * effectPass) / (SHORT_PASS_EFFECT || 1);
}

/** The named high press lands on the top of the set. The named deep block lands on the bottom. */
function scaledPress(effectPress: number, range: StyleBand): number {
  const delta = effectPress - STANDARD_PRESS_EFFECT;
  if (delta >= 0) {
    const span = HIGH_PRESS_EFFECT - STANDARD_PRESS_EFFECT || 1;
    return ((range.high - range.mid) * delta) / span;
  }
  const span = STANDARD_PRESS_EFFECT - DEEP_PRESS_EFFECT || 1;
  return ((range.mid - range.low) * delta) / span;
}

type ControlPiece = { name: string; passLength: number; shotsPerMatch: number; pressHeight: number };

function controls(players: ProfilePlayer[], instructions: TeamInstructions, spread: StyleSpread): ControlPiece[] {
  const pieces: ControlPiece[] = [];
  const passFields: { field: "passing" | "mentality" | "distribution"; neutral: TeamInstructions["passing"] | TeamInstructions["mentality"] | TeamInstructions["distribution"] }[] = [
    { field: "passing", neutral: "standard" },
    { field: "mentality", neutral: "balanced" },
    { field: "distribution", neutral: "mixed" },
  ];
  for (const item of passFields) {
    const name = controlName(item.field, instructions[item.field]);
    if (!name) continue;
    const delta = applyInstructions(instructions).passLength - applyInstructions({ ...instructions, [item.field]: item.neutral }).passLength;
    pieces.push({ name, passLength: scaledPass(delta, spread.passLength), shotsPerMatch: 0, pressHeight: 0 });
  }
  const pressFields: { field: "defensiveLine" | "engagement" | "pressing" | "mentality" | "transition"; neutral: string }[] = [
    { field: "defensiveLine", neutral: "standard" },
    { field: "engagement", neutral: "standard" },
    { field: "pressing", neutral: "standard" },
    { field: "mentality", neutral: "balanced" },
    { field: "transition", neutral: "standard" },
  ];
  for (const item of pressFields) {
    const name = controlName(item.field, instructions[item.field]);
    if (!name) continue;
    const delta =
      applyInstructions(instructions).pressHeight -
      applyInstructions({ ...instructions, [item.field]: item.neutral }).pressHeight;
    const existing = pieces.find((piece) => piece.name === name);
    const amount = scaledPress(STANDARD_PRESS_EFFECT + delta, spread.pressHeight);
    if (existing) existing.pressHeight = amount;
    else pieces.push({ name, passLength: 0, shotsPerMatch: 0, pressHeight: amount });
  }
  const shotFields: { field: "tempo" | "mentality" | "shooting"; neutral: string }[] = [
    { field: "tempo", neutral: "standard" },
    { field: "mentality", neutral: "balanced" },
    { field: "shooting", neutral: "standard" },
  ];
  const attackers = players.filter((player) => player.line === "ST" || player.line === "AM");
  const shotGroup = attackers.length > 0 ? attackers : players;
  const roleShots = 1 + SHOT_FROM_ROLE * mean(shotGroup.map((player) => delta(player, "shooting")));
  for (const item of shotFields) {
    const name = controlName(item.field, instructions[item.field]);
    if (!name) continue;
    const full = applyInstructions(instructions).shotVolume;
    const without = applyInstructions({ ...instructions, [item.field]: item.neutral }).shotVolume;
    const amount = spread.shotsPerMatch.mid * (full - without) * roleShots;
    const existing = pieces.find((piece) => piece.name === name);
    if (existing) existing.shotsPerMatch = amount;
    else pieces.push({ name, passLength: 0, shotsPerMatch: amount, pressHeight: 0 });
  }
  const rolePass = mean(players.map((player) => delta(player, "passLength")));
  const rolePress = mean(players.map((player) => delta(player, "pressing"))) * PRESS_PER_ROLE;
  const roleShotAmount = spread.shotsPerMatch.mid * applyInstructions(instructions).shotVolume * (roleShots - 1);
  if (rolePass !== 0 || rolePress !== 0 || roleShotAmount !== 0) {
    pieces.push({ name: "The roles", passLength: rolePass, shotsPerMatch: roleShotAmount, pressHeight: rolePress });
  }
  return pieces;
}

function controlName(field: string, value: string): string | null {
  const names: Record<string, Record<string, string>> = {
    passing: { shorter: "Shorter passing", "more direct": "More direct" },
    mentality: { defensive: "Defensive mentality", attacking: "Attacking mentality" },
    distribution: { "play out": "Play out", "go long": "Go long" },
    defensiveLine: { deeper: "The deeper line", higher: "The higher line" },
    engagement: { lower: "Lower engagement", higher: "Higher engagement" },
    pressing: { less: "Pressing less", more: "Pressing more" },
    transition: { regroup: "Regroup", "counter-press": "Counter-press" },
    tempo: { lower: "Lower tempo", higher: "Higher tempo" },
    shooting: { "work the ball": "Work the ball", "shoot on sight": "Shoot on sight" },
  };
  return names[field]?.[value] ?? null;
}

function delta(player: ProfilePlayer, key: "passLength" | "pressing" | "shooting"): number {
  const chosen = effectFor(player.roleId, player.duty);
  const base = effectFor(resolveRole(player.line, player.wide).roleId, "support");
  return chosen[key] - base[key];
}

function shotSpot(players: ProfilePlayer[], width: number): { x: number; y: number } {
  let x = 0;
  let y = 0;
  for (const player of players) {
    const effect = effectFor(player.roleId, player.duty);
    const dx = player.left ? -effect.x : effect.x;
    const away = player.x === 50 ? 0 : player.x > 50 ? 1 : -1;
    x += clamp(player.x + dx + away * width, 0, 100);
    y += clamp(player.y + effect.y, 0, 100);
  }
  return { x: x / players.length, y: y / players.length };
}

function nearestStyle(profile: StyleProfile, styles: StyleFingerprint[]): StyleFingerprint | null {
  if (styles.length === 0) return null;
  return [...styles].sort((a, b) => {
    const gap = styleDistance(profile, a) - styleDistance(profile, b);
    if (gap !== 0) return gap;
    return a.team.localeCompare(b.team);
  })[0];
}

export function styleDistance(
  profile: StyleProfile,
  style: Pick<StyleFingerprint, "passLength" | "shotsPerMatch" | "pressHeight">,
): number {
  return Math.hypot(
    (profile.passLength - style.passLength) / 1.2,
    (profile.shotsPerMatch - style.shotsPerMatch) / 1.5,
    (profile.pressHeight - style.pressHeight) / 1.5,
  );
}

function readingLines(profile: StyleProfile, styles: StyleFingerprint[]): string[] {
  const lines = [shotSentence(profile.shotX, profile.shotY), passLine(profile, styles)];
  if (styles.length > 0) lines.push(pressLine(profile, styles), shotCountLine(profile, styles));
  return lines;
}

function passLine(profile: StyleProfile, styles: StyleFingerprint[]): string {
  const yards = `${formatTenths(profile.passLength)} yards`;
  if (styles.length === 0) return `Passes average ${yards}.`;
  const match = nearestOn(styles, (side) => side.passLength, profile.passLength);
  const longest = extreme(styles, (side) => side.passLength, 1);
  const shortest = extreme(styles, (side) => side.passLength, -1);
  if (profile.passLength > longest.passLength + 0.4) {
    const gap = formatTenths(profile.passLength - longest.passLength);
    return `Passes average ${yards}, ${gap} longer than ${label(longest)}, the most direct side in this set.`;
  }
  if (profile.passLength < shortest.passLength - 0.4) {
    const gap = formatTenths(shortest.passLength - profile.passLength);
    return `Passes average ${yards}, ${gap} shorter than ${label(shortest)}, the shortest-passing side in this set.`;
  }
  const gap = profile.passLength - match.passLength;
  if (Math.abs(gap) < 0.8) return `Passes average ${yards}, close to ${label(match)}.`;
  const direction = gap > 0 ? "longer" : "shorter";
  return `Passes average ${yards}, ${formatTenths(Math.abs(gap))} ${direction} than ${label(match)}.`;
}

function pressLine(profile: StyleProfile, styles: StyleFingerprint[]): string {
  const match = nearestOn(styles, (side) => side.pressHeight, profile.pressHeight);
  const highest = extreme(styles, (side) => side.pressHeight, 1);
  const deepest = extreme(styles, (side) => side.pressHeight, -1);
  if (profile.pressHeight > highest.pressHeight + 0.4) {
    return `The press is higher than ${label(highest)}, the highest side in this set. There, ${gloss(highest)}`;
  }
  if (profile.pressHeight < deepest.pressHeight - 0.4) {
    return `The press is deeper than ${label(deepest)}, the deepest side in this set. There, ${gloss(deepest)}`;
  }
  const gap = profile.pressHeight - match.pressHeight;
  if (Math.abs(gap) < 1.5) return `The press sits at a similar height to ${label(match)}. There, ${gloss(match)}`;
  const direction = gap > 0 ? "higher" : "deeper";
  return `The press is ${direction} than ${label(match)}. There, ${gloss(match)}`;
}

function shotCountLine(profile: StyleProfile, styles: StyleFingerprint[]): string {
  const count = formatTenths(profile.shotsPerMatch);
  const match = nearestOn(styles, (side) => side.shotsPerMatch, profile.shotsPerMatch);
  const most = extreme(styles, (side) => side.shotsPerMatch, 1);
  const least = extreme(styles, (side) => side.shotsPerMatch, -1);
  if (profile.shotsPerMatch > most.shotsPerMatch + 0.4) {
    return `The sample puts up ${count} shots a match, more than ${label(most)}, the side with the most shots in this set.`;
  }
  if (profile.shotsPerMatch < least.shotsPerMatch - 0.4) {
    return `The sample puts up ${count} shots a match, fewer than ${label(least)}, the quietest side in this set.`;
  }
  const gap = profile.shotsPerMatch - match.shotsPerMatch;
  if (Math.abs(gap) < 1) return `About ${count} shots a match, close to ${label(match)}.`;
  const direction = gap > 0 ? "more" : "fewer";
  return `${count} shots a match, ${direction} than ${label(match)}.`;
}

function nearestOn(
  styles: StyleFingerprint[],
  value: (side: StyleFingerprint) => number,
  target: number,
): StyleFingerprint {
  return [...styles].sort((a, b) => {
    const gap = Math.abs(value(a) - target) - Math.abs(value(b) - target);
    if (gap !== 0) return gap;
    return a.team.localeCompare(b.team);
  })[0];
}

function gloss(side: StyleFingerprint): string {
  return `${formatTenths(side.ppda)} passes the opponent completes before a defensive action.`;
}

function label(side: StyleFingerprint): string {
  return `${side.team} ${formatSeason(side.season)}`;
}

function extreme(
  styles: StyleFingerprint[],
  value: (side: StyleFingerprint) => number,
  direction: 1 | -1,
): StyleFingerprint {
  return [...styles].sort((a, b) => {
    const gap = (value(a) - value(b)) * direction;
    if (gap !== 0) return -gap;
    return a.team.localeCompare(b.team);
  })[0];
}

function centre(values: number[], fallback: number): number {
  if (values.length === 0) return fallback;
  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  if (sorted.length % 2 === 1) return sorted[mid];
  return (sorted[mid - 1] + sorted[mid]) / 2;
}

function mean(values: number[]): number {
  if (values.length === 0) return 0;
  return values.reduce((sum, value) => sum + value, 0) / values.length;
}

function round1(value: number): number {
  return Math.round(value * 10) / 10;
}

function formatTenths(value: number): string {
  const rounded = round1(value);
  return Number.isInteger(rounded) ? String(rounded) : rounded.toFixed(1);
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}
