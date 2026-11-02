import { arrivalPoint } from "../tactics/arrival";
import { defensiveAnchor, engagementAnchor } from "../tactics/block";
import { applyInstructions, type TeamInstructions } from "../tactics/instructions";
import { effectFor } from "../tactics/roles";
import type { ProfilePlayer } from "./profile";
import type { Situation } from "./sample";
import type { StyleFingerprint } from "./types";
import { shotXg } from "./xg";

/**
 * The tactic test's chance price.
 *
 * Your shots are a cloud around each role's arrival, weighted by how much
 * that role shoots. A poacher's share sits closer to goal than a winger's.
 * The value is the average of those shots, not the value of the average spot.
 *
 * An opponent's shots use the same geometric ruler on the centres of their
 * recorded shot map. Their StatsBomb xG per shot is not an input. A narrow
 * back line marks up the shots that landed in the wide channels. A narrow
 * opponent does the same to the shots this tactic takes from the channels,
 * and a wider attack has more of those shots. A high line pays more against
 * direct sides who see less of the final third. The gap between the
 * engagement line and the defensive line marks up chances in the space
 * behind the press. Pass length, risk, and width move the cloud before it
 * is priced. A goalkeeper's pass length moves opponent xG only when the
 * ball starts from a goal kick, and an average keeper leaves that price
 * where it was. Every player is assumed good enough to carry the role.
 */

const CONNECTED_GAP = 46;
const WIDE_X = 30;
const WIDE_Y = 70;
const NORMAL_FULL_BACK = 36;
const TUCKED = 14;
const NORMAL_PASS = 19;

/**
 * Median goalkeeper pass length in the shipped open-data set, in yards.
 * The span is the further extreme from that median, so an average keeper
 * stays at 1 and either extreme moves opponent xG by 15% on goal kicks only.
 * Both numbers are filled from the rebuilt library.
 */
export const KEEPER_PASS_MEDIAN = 48.68;
export const KEEPER_PASS_SPAN = 17.67;

export type ShotSpot = { x: number; y: number; weight: number };

export type ChancePrice = {
  modelXgFor: number;
  modelXgAgainst: number;
  meanShotY: number;
  wideShotShare: number;
  lineGap: number;
};

export function priceChances(input: {
  players: ProfilePlayer[];
  instructions: TeamInstructions;
  opponent: StyleFingerprint & {
    shotGrid?: number[][];
    longPassShare?: number;
    fieldTilt?: number;
    shapeWidth?: number;
    keeperPassLength?: number;
  };
  situation: Situation;
  passLength: number;
  passRisk: number;
  pressHeight: number;
  shotsPerMatch: number;
  restDefence: number;
}): ChancePrice {
  const effect = applyInstructions(input.instructions);
  const engagementY = engagementAnchor(input.instructions.engagement);
  const lineY = defensiveAnchor(input.instructions.defensiveLine);
  const lineGap = engagementY - lineY;
  const rest = adjustedRest(input.restDefence, input.situation);
  const cloud = passCloud(roleShots(input.players), input, effect.width);
  const theirs = gridShots(input.opponent.shotGrid);
  const wideShare = shareWide(theirs);
  const cover = backCover(widestDefender(input.players));
  const wideMark = wideMultiplier(cover);

  const shapeMark = opponentShapeMark(input.opponent.shapeWidth);
  const userQuality = weighted(cloud, (spot) => shotXg(spot.x, spot.y) * (1 + (shapeMark - 1) * channelOpen(spot)));
  const oppQuality = weighted(theirs, (spot) => shotXg(spot.x, spot.y) * (isWide(spot) ? wideMark : 1));

  const userVolume = input.shotsPerMatch * userVolumeFactor(input);
  const oppVolume = input.opponent.shotsPerMatch * opponentVolumeFactor(input.situation);

  return {
    modelXgFor: round4(userQuality * userVolume * userFactor(input, lineGap)),
    modelXgAgainst: round4(oppQuality * oppVolume * opponentFactor(input, lineGap, rest, engagementY, lineY)),
    meanShotY: round4(weighted(cloud, (spot) => spot.y)),
    wideShotShare: round4(wideShare),
    lineGap,
  };
}

/** Shots around each outfield role. Low shooting rates still count, lightly. */
export function roleShots(players: ProfilePlayer[]): ShotSpot[] {
  const spots = players
    .filter((player) => player.line !== "GK")
    .map((player) => {
      const effect = effectFor(player.roleId, player.duty);
      const arrival = arrivalPoint({ x: player.x, y: player.y }, effect);
      const pull = 8 + (1 - effect.shooting) * 10;
      return {
        x: arrival.x,
        y: clamp(arrival.y - pull, 0, 100),
        weight: Math.max(effect.shooting, 0.02),
      };
    });
  return spots.length > 0 ? spots : [{ x: 50, y: 50, weight: 1 }];
}

/** Cell centres of a 4×6 attacking shot map, on the 0–100 pitch. */
export function gridShots(grid: number[][] | undefined): ShotSpot[] {
  if (!grid || grid.length === 0) return [{ x: 50, y: 78, weight: 1 }];
  const spots: ShotSpot[] = [];
  for (let row = 0; row < grid.length; row += 1) {
    for (let col = 0; col < grid[row].length; col += 1) {
      const weight = grid[row][col];
      if (weight <= 0) continue;
      const length = grid[row].length;
      const across = (row + 0.5) / grid.length;
      const along = (col + 0.5) / length;
      spots.push({ x: across * 100, y: along * 100, weight });
    }
  }
  return spots.length > 0 ? spots : [{ x: 50, y: 78, weight: 1 }];
}

function passCloud(
  spots: ShotSpot[],
  input: { passLength: number; passRisk: number; situation: Situation; instructions: TeamInstructions; opponent: StyleFingerprint },
  width: number,
): ShotSpot[] {
  const direct = clamp((input.passLength - NORMAL_PASS) / 12, -1.2, 1.2);
  const risk = input.passRisk;
  let dy = direct * 7 + (risk - 0.35) * 6;
  // Width is the instruction's yardage, not a 36-based sample width.
  // The shift is what lets a wider attack meet a narrow or wide opponent.
  const dxScale = width * 0.9;
  if (input.situation === "settled-attack") dy += input.passLength < 21 && risk < 0.45 ? 8 : 2;
  if (input.situation === "goal-kicks") {
    if (input.instructions.distribution === "play out") dy -= 4;
    if (input.instructions.distribution === "go long") dy += 6;
  }
  return spots.map((spot) => {
    const outward = spot.x === 50 ? 0 : spot.x > 50 ? 1 : -1;
    const dx = outward * (dxScale + (risk - 0.35) * 4);
    return { ...spot, x: clamp(spot.x + dx, 0, 100), y: clamp(spot.y + dy, 0, 100) };
  });
}

function userVolumeFactor(input: { situation: Situation; shotsPerMatch: number }): number {
  switch (input.situation) {
    case "chase": {
      const above = input.shotsPerMatch / 12 - 1;
      return 1.12 + Math.max(0, above) * 0.5;
    }
    case "you-have-ten":
      return 0.9;
    case "goal-kicks":
      return 0.55;
    default:
      return 1;
  }
}

function opponentVolumeFactor(situation: Situation): number {
  switch (situation) {
    case "protect-lead":
      return 0.85;
    case "they-have-ten":
      return 0.85;
    case "goal-kicks":
      return 0.55;
    default:
      return 1;
  }
}

function userFactor(
  input: { situation: Situation; passLength: number; passRisk: number; pressHeight: number; instructions: TeamInstructions; opponent: StyleFingerprint },
  lineGap: number,
): number {
  let factor = 1;
  const pressGap = input.opponent.pressHeight - input.pressHeight;
  const gap = input.situation === "protect-lead" ? pressGap + 8 : input.situation === "chase" ? pressGap - 4 : pressGap;
  if (gap >= 8 && input.passLength <= 17.2 && input.passRisk <= 0.4) factor *= 0.8;
  else if (gap >= 8 && input.passLength >= 21.2) factor *= 0.94;
  else if (gap >= 8) factor *= 0.9;
  if (input.situation === "goal-kicks" && input.instructions.distribution === "play out" && gap >= 6) factor *= 0.7;
  if (input.situation === "settled-attack" && lineGap > CONNECTED_GAP + 12) factor *= 0.95;
  return factor;
}

function opponentFactor(
  input: {
    situation: Situation;
    instructions: TeamInstructions;
    opponent: { longPassShare?: number; fieldTilt?: number; keeperPassLength?: number };
  },
  lineGap: number,
  rest: number,
  engagementY: number,
  lineY: number,
): number {
  const space = Math.max(0, lineGap - CONNECTED_GAP);
  let factor = 1 + space / 60;
  factor *= clamp(1 + (4 - rest) * 0.1, 0.8, 1.6);
  if (lineY >= 38 && engagementY <= 56) factor *= 1.45;
  if (input.instructions.engagement === "higher" && space <= 8 && rest >= 3) factor *= 0.92;
  if (input.situation === "protect-lead") factor *= space > 12 ? 1.22 : 0.94;
  if (input.situation === "they-have-ten") factor *= 0.95;
  factor *= directMark(input.opponent, lineY, rest);
  factor *= keeperMark(input.opponent.keeperPassLength, input.situation);
  return factor;
}

function keeperMark(length: number | undefined, situation: Situation): number {
  if (situation !== "goal-kicks" || length == null || !Number.isFinite(length) || KEEPER_PASS_SPAN <= 0) return 1;
  const tilt = clamp((length - KEEPER_PASS_MEDIAN) / KEEPER_PASS_SPAN, -1, 1);
  return 1 + tilt * 0.15;
}

/** A typical starting width in this set, mean distance from the centre. */
const TYPICAL_SHAPE = 19.5;

function opponentShapeMark(shapeWidth: number | undefined): number {
  if (shapeWidth == null || !Number.isFinite(shapeWidth)) return 1;
  const narrowness = clamp((TYPICAL_SHAPE - shapeWidth) / 5, -1, 1);
  return 1 + narrowness * 0.4;
}

/**
 * How much a shot sits in the channel a narrow block leaves open.
 * A flat 4-4-2's strikers sit 12 off centre. The line starts further out,
 * so that small nudge does not turn a central attack into a wide one.
 * Wider instructions push the same shots out, and the opponent's shape counts.
 */
function channelOpen(spot: ShotSpot): number {
  return clamp((Math.abs(spot.x - 50) - 14) / 12, 0, 1);
}

function directMark(
  opponent: { longPassShare?: number; fieldTilt?: number },
  lineY: number,
  rest: number,
): number {
  if (opponent.longPassShare == null || opponent.fieldTilt == null) return 1;
  if (lineY < 38 || rest > 4) return 1;
  const direct = clamp((opponent.longPassShare - 0.14) / 0.06, 0, 1);
  const lessTilt = clamp((0.55 - opponent.fieldTilt) / 0.2, 0, 1);
  return 1 + ((direct + lessTilt) / 2) * 0.3;
}

function adjustedRest(rest: number, situation: Situation): number {
  if (situation === "you-have-ten") return Math.max(0, rest - 1);
  return rest;
}

export function widestDefender(players: ProfilePlayer[]): number | null {
  const block = players.filter((player) => player.line === "DEF" || (player.wide && player.y < 45));
  if (block.length === 0) return null;
  return Math.max(...block.map((player) => Math.abs(player.x - 50)));
}

function backCover(widest: number | null): number {
  if (widest == null) return 1;
  return clamp((widest - TUCKED) / (NORMAL_FULL_BACK - TUCKED), 0, 1.5);
}

function wideMultiplier(cover: number): number {
  return clamp(1 + (1 - cover) * 0.55, 0.75, 1.6);
}

function isWide(spot: ShotSpot): boolean {
  return spot.y >= WIDE_Y && Math.abs(spot.x - 50) >= WIDE_X;
}

function shareWide(spots: ShotSpot[]): number {
  return shareWhere(spots, isWide);
}

function shareWhere(spots: ShotSpot[], pick: (spot: ShotSpot) => boolean): number {
  let picked = 0;
  let total = 0;
  for (const spot of spots) {
    total += spot.weight;
    if (pick(spot)) picked += spot.weight;
  }
  return total === 0 ? 0 : picked / total;
}

function weighted(spots: ShotSpot[], value: (spot: ShotSpot) => number): number {
  let weight = 0;
  let sum = 0;
  for (const spot of spots) {
    if (spot.weight <= 0) continue;
    weight += spot.weight;
    sum += spot.weight * value(spot);
  }
  return weight === 0 ? 0 : sum / weight;
}

function round4(value: number): number {
  return Math.round(value * 10000) / 10000;
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}
