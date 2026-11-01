import { shotXg } from "./xg";
import type { StyleFingerprint } from "./types";

/**
 * A seeded sample of 600 possessions.
 *
 * The opponent is anchored to the recorded fingerprint before the situation
 * is applied: their pass length is the recorded pass length, and their PPDA
 * is the recorded PPDA. The situation then moves press height, shot volume,
 * rest defence, or the shot's depth.
 *
 * Model xG is TacticTester's geometric sketch (`shotXg`) times shot volume,
 * summed over the 600 possessions. A volume of 1 is 12 shots in that window.
 * It is not a StatsBomb model and it is not a goal tally. The same seed
 * replays the same possessions.
 */

export type Situation =
  | "level"
  | "protect-lead"
  | "chase"
  | "they-have-ten"
  | "you-have-ten"
  | "goal-kicks"
  | "settled-attack";

export type SampleSide = {
  passLength: number;
  passRisk: number;
  width: number;
  pressHeight: number;
  shotVolume: number;
  shotX: number;
  shotY: number;
  restDefence: number; // players behind the ball, 0 to 10
};

export type SampleReport = {
  seed: number;
  possessions: number;
  modelXgFor: number;
  modelXgAgainst: number;
  passLength: number;
  ppda: number;
  tilt: number;
  restDefence: number;
  lines: string[];
};

const POSSESSIONS = 600;

/** A shot volume of 1 produces this many shots across the 600 possessions. */
const SHOTS_AT_UNIT_VOLUME = 12;

/** Pass lengths jitter by at most half of this, so the mean stays inside 2 yards. */
const PASS_NOISE_YARDS = 3;

/**
 * The user's chance is worth less when the opponent's press is at least
 * this far above the user's. A sketch factor, not a fitted model.
 */
const PRESS_GAP = 8;
const PRESSED_XG_FACTOR = 0.85;

/** Chances against are worth more when fewer than this many stay behind the ball. */
const OPEN_REST = 3;
const OPEN_REST_XG_FACTOR = 1.25;

/** Opponent shots use a central spot on the edge of the area, not a StatsBomb xG. */
const OPPONENT_SHOT_X = 50;
const OPPONENT_SHOT_Y = 78;

/** A normal rest defence for the recorded side, before a situation changes it. */
const OPPONENT_REST = 3;

const TILT_MIN = 0.15;
const TILT_MAX = 0.85;

type OpponentLive = {
  passLength: number;
  pressHeight: number;
  shotVolume: number;
  shotX: number;
  shotY: number;
  restDefence: number;
  ppda: number;
};

export function runSample(
  user: SampleSide,
  opponent: StyleFingerprint,
  situation: Situation,
  seed: number,
): SampleReport {
  const anchoredPass = opponent.passLength;
  const anchoredPpda = opponent.ppda;
  const you = { ...user };
  const them: OpponentLive = {
    passLength: anchoredPass,
    pressHeight: opponent.pressHeight,
    shotVolume: opponent.shotsPerMatch / SHOTS_AT_UNIT_VOLUME,
    shotX: OPPONENT_SHOT_X,
    shotY: OPPONENT_SHOT_Y,
    restDefence: OPPONENT_REST,
    ppda: anchoredPpda,
  };
  applySituation(situation, you, them);
  you.restDefence = clamp(you.restDefence, 0, 10);
  them.restDefence = clamp(them.restDefence, 0, 10);
  you.shotY = clamp(you.shotY, 0, 100);

  const userXg = userXgPerShot(you, them);
  const oppXg = opponentXgPerShot(you, them);
  const modelXgFor = userXg * you.shotVolume * SHOTS_AT_UNIT_VOLUME;
  const modelXgAgainst = oppXg * them.shotVolume * SHOTS_AT_UNIT_VOLUME;
  const passLength = samplePassLength(you.passLength, seed);

  return {
    seed,
    possessions: POSSESSIONS,
    modelXgFor,
    modelXgAgainst,
    passLength,
    ppda: them.ppda,
    tilt: fieldTilt(you.shotVolume, them.shotVolume),
    restDefence: you.restDefence,
    lines: sampleLines(opponent.team, you, them, passLength, modelXgFor, modelXgAgainst, situation),
  };
}

/**
 * The opponent faces a mirror of their own fingerprint, level, with this seed.
 * True only when that sample's pass length is within 2 yards of the fingerprint
 * and its PPDA is within 2 of the fingerprint.
 */
export function opponentAgrees(opponent: StyleFingerprint, seed: number): boolean {
  const report = runSample(mirrorSide(opponent), opponent, "level", seed);
  return Math.abs(report.passLength - opponent.passLength) <= 2 && Math.abs(report.ppda - opponent.ppda) <= 2;
}

function mirrorSide(opponent: StyleFingerprint): SampleSide {
  return {
    passLength: opponent.passLength,
    passRisk: 0.5,
    width: 36,
    pressHeight: opponent.pressHeight,
    shotVolume: opponent.shotsPerMatch / SHOTS_AT_UNIT_VOLUME,
    shotX: OPPONENT_SHOT_X,
    shotY: OPPONENT_SHOT_Y,
    restDefence: OPPONENT_REST,
  };
}

function applySituation(situation: Situation, you: SampleSide, them: OpponentLive): void {
  switch (situation) {
    case "level":
      return;
    case "protect-lead":
      them.pressHeight += 8;
      them.shotVolume *= 0.8;
      return;
    case "chase":
      you.shotVolume *= 1.25;
      you.pressHeight += 6;
      return;
    case "they-have-ten":
      them.restDefence -= 1;
      them.shotVolume *= 0.85;
      return;
    case "you-have-ten":
      you.restDefence -= 1;
      you.shotVolume *= 0.85;
      return;
    case "goal-kicks":
      you.shotVolume *= 0.4;
      them.shotVolume *= 0.4;
      return;
    case "settled-attack":
      you.shotY = Math.min(100, you.shotY + 8);
      return;
    default: {
      const never: never = situation;
      throw new Error(`Unknown situation ${never}`);
    }
  }
}

function userXgPerShot(you: SampleSide, them: OpponentLive): number {
  const base = shotXg(you.shotX, you.shotY);
  if (them.pressHeight >= you.pressHeight + PRESS_GAP) return base * PRESSED_XG_FACTOR;
  return base;
}

function opponentXgPerShot(you: SampleSide, them: OpponentLive): number {
  const base = shotXg(them.shotX, them.shotY);
  if (you.restDefence < OPEN_REST) return base * OPEN_REST_XG_FACTOR;
  return base;
}

/**
 * One draw per possession from mulberry32. The noise is centred on the
 * user's pass length, and even a run of extreme draws stays inside 1.5 yards.
 * Model xG is not drawn here: each possession's share is `shotXg * volume * 12 / 600`,
 * so the total is the sketch times shot volume over the 600 possessions.
 */
function samplePassLength(passLength: number, seed: number): number {
  const rng = mulberry32(seed);
  let sum = 0;
  for (let i = 0; i < POSSESSIONS; i += 1) {
    sum += passLength + (rng() - 0.5) * PASS_NOISE_YARDS;
  }
  return sum / POSSESSIONS;
}

function fieldTilt(userVolume: number, oppVolume: number): number {
  const sum = userVolume + oppVolume;
  if (sum <= 0) return 0.5;
  return clamp(userVolume / sum, TILT_MIN, TILT_MAX);
}

function sampleLines(
  team: string,
  you: SampleSide,
  them: OpponentLive,
  passLength: number,
  modelXgFor: number,
  modelXgAgainst: number,
  situation: Situation,
): string[] {
  const lines = [
    passLine(team, you, passLength, them.passLength),
    `${team} allow ${formatTenths(them.ppda)} passes the opponent completes before a defensive action.`,
    chanceLine(modelXgFor, modelXgAgainst, fieldTilt(you.shotVolume, them.shotVolume), you.restDefence),
  ];
  const situationText = situationLine(situation, team, them.restDefence);
  if (situationText) lines.push(situationText);
  return lines;
}

function passLine(team: string, you: SampleSide, passLength: number, oppPass: number): string {
  return `Over 600 possessions against ${team}, ${passKind(you)} average ${formatTenths(passLength)} yards while ${team} stay at ${formatTenths(oppPass)} yards.`;
}

function passKind(you: SampleSide): string {
  const width = you.width >= 40 ? "wide" : you.width <= 20 ? "narrow" : "";
  const risk = you.passRisk >= 0.67 ? "risky" : you.passRisk <= 0.33 ? "safe" : "";
  const tone = [width, risk].filter((word) => word.length > 0).join(" ");
  return tone.length > 0 ? `${tone} passes` : "passes";
}

function chanceLine(modelXgFor: number, modelXgAgainst: number, tilt: number, restDefence: number): string {
  const body = `the model's xG is ${modelXgFor.toFixed(2)} for and ${modelXgAgainst.toFixed(2)} against, and field tilt is ${Math.round(tilt * 100)} percent`;
  if (restDefence < OPEN_REST) return `With ${formatTenths(restDefence)} players behind the ball, ${body}.`;
  return `The model's xG is ${modelXgFor.toFixed(2)} for and ${modelXgAgainst.toFixed(2)} against, and field tilt is ${Math.round(tilt * 100)} percent.`;
}

function situationLine(situation: Situation, team: string, oppRest: number): string | null {
  switch (situation) {
    case "level":
      return null;
    case "protect-lead":
      return `${team} press higher and shoot less often to protect the lead.`;
    case "chase":
      return "The press steps up and more shots arrive in the chase.";
    case "they-have-ten":
      return `${team} have ten players, so ${formatTenths(oppRest)} players stay behind the ball and they shoot less often.`;
    case "you-have-ten":
      return "Ten players leave one fewer behind the ball, and the shots come less often.";
    case "goal-kicks":
      return "Both sides shoot less often, and the first pass starts the possession.";
    case "settled-attack":
      return "The attack is settled, so the shots come from closer to the goal.";
    default: {
      const never: never = situation;
      return never;
    }
  }
}

function mulberry32(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function formatTenths(value: number): string {
  const rounded = Math.round(value * 10) / 10;
  return Number.isInteger(rounded) ? String(rounded) : rounded.toFixed(1);
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}
