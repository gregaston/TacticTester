import { arrivalPoint } from "../tactics/arrival";
import { applyInstructions, type TeamInstructions } from "../tactics/instructions";
import { effectFor } from "../tactics/roles";
import type { StyleFingerprint } from "./types";
import { readStyle, resolveRole, type ProfilePlayer, type StyleProfile } from "./profile";
import { runSample, type SampleReport, type Situation } from "./sample";

/**
 * The phone's match sample.
 *
 * Roles and team instructions are already on the recorded scale via
 * `readStyle`. Shot volume of 1 is 12 shots across the 600 possessions, so
 * dividing the profile's shots per match by 12 puts that count straight
 * through. Rest defence counts outfield players who arrive in their own
 * half. The user's PPDA is a sketch beside the recorded one: the same press
 * height keeps the recorded PPDA, and a higher press allows fewer passes.
 * It is not a Hudl figure.
 */

const SHOTS_AT_UNIT_VOLUME = 12;
const PPDA_PER_PRESS = 0.7;
const PPDA_MIN = 3;
const PPDA_MAX = 20;
const OWN_HALF = 50;
const PRESS_LEAVES_SPACE = 8;
const OPEN_REST = 3;
const HIGH_TILT = 0.65;
const HALF_SPACE_NEAR = 14;
const HALF_SPACE_FAR = 22;
const HALF_SPACE_DEPTH = 70;

export type LiveMatch = {
  report: SampleReport;
  yourPpda: number;
  notes: string[];
};

export function liveSample(input: {
  players: ProfilePlayer[];
  instructions: TeamInstructions;
  opponent: StyleFingerprint;
  situation: Situation;
  styles: StyleFingerprint[];
  seed?: number;
}): LiveMatch {
  const profile = readStyle(input.players, input.instructions, input.styles).profile;
  const effect = applyInstructions(input.instructions);
  const restDefence = restDefenceCount(input.players);
  const report = runSample(
    {
      passLength: profile.passLength,
      passRisk: clamp(
        0.5 +
          mean(
            input.players.map((player) => {
              const chosen = effectFor(player.roleId, player.duty).passRisk;
              const base = effectFor(resolveRole(player.line, player.wide).roleId, "support").passRisk;
              return chosen - base;
            }),
          ),
        0,
        1,
      ),
      // The sample calls 36 a normal width and 20 a narrow one. A real
      // squad's average distance from the centre sits near 18, so that
      // number would mark every shape narrow. Start at the sample's normal
      // and let the width instruction move it.
      width: clamp(36 + effect.width, 0, 50),
      pressHeight: profile.pressHeight,
      shotVolume: profile.shotsPerMatch / SHOTS_AT_UNIT_VOLUME,
      shotX: profile.shotX,
      shotY: profile.shotY,
      restDefence,
    },
    input.opponent,
    input.situation,
    input.seed ?? 1,
  );
  return {
    report,
    yourPpda: sketchPpda(profile.pressHeight, input.opponent.pressHeight, input.opponent.ppda),
    notes: causeNotes(profile, report, input.opponent.pressHeight),
  };
}

/** Outfield players who arrive short of the halfway line. */
export function restDefenceCount(players: ProfilePlayer[]): number {
  return players.filter((player) => player.line !== "GK" && arrivedY(player) < OWN_HALF).length;
}

export function sketchPpda(userPress: number, opponentPress: number, opponentPpda: number): number {
  const shifted = opponentPpda + (opponentPress - userPress) * PPDA_PER_PRESS;
  return round1(clamp(shifted, PPDA_MIN, PPDA_MAX));
}

export function causeNotes(profile: StyleProfile, report: SampleReport, opponentPress: number): string[] {
  const notes: string[] = [];
  if (report.tilt >= HIGH_TILT && report.modelXgFor < report.modelXgAgainst) {
    notes.push("The side has the territory and not the chances.");
  }
  if (profile.pressHeight >= opponentPress + PRESS_LEAVES_SPACE && report.restDefence < 4) {
    notes.push("The press steps up and leaves space behind it.");
  }
  if (report.restDefence < OPEN_REST) {
    notes.push("Fewer than three players stay behind the ball.");
  }
  const fromCentre = Math.abs(profile.shotX - 50);
  if (fromCentre >= HALF_SPACE_NEAR && fromCentre <= HALF_SPACE_FAR && profile.shotY >= HALF_SPACE_DEPTH) {
    notes.push("The shots come from the half-space.");
  }
  return notes;
}

export function styleShiftNote(roleChanged: boolean, before: string | null, after: string | null): string | null {
  if (!roleChanged || before == null || before === after) return null;
  return "The nearest side changed after that role.";
}

function arrivedY(player: ProfilePlayer): number {
  return arrivalPoint({ x: player.x, y: player.y }, effectFor(player.roleId, player.duty)).y;
}

function mean(values: number[]): number {
  if (values.length === 0) return 0;
  return values.reduce((sum, value) => sum + value, 0) / values.length;
}

function round1(value: number): number {
  return Math.round(value * 10) / 10;
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}
