import type { TeamInstructions } from "../tactics/instructions";
import type { StyleFingerprint } from "./types";
import { readStyle, type ProfilePlayer } from "./profile";
import { liveSample } from "./live";
import type { Situation } from "./sample";

/**
 * A test the user starts.
 *
 * The tactic is sampled against every named side. The weakest matchups are
 * the ones with the highest model's xG against, once a high press has taken
 * value off the chances. The reason names that side's recorded shots, press,
 * or passing. It is not a scoreline.
 */

const PRESS_GAP = 8;
const OPEN_REST = 3;
const SHOW = 3;

export type TestOpponent = StyleFingerprint & {
  season: string;
  competition: string;
  matches: number;
};

export type Matchup = {
  id: string;
  team: string;
  season: string;
  competition: string;
  matches: number;
  modelXgFor: number;
  modelXgAgainst: number;
  margin: number;
  why: string;
};

export type Battery = {
  tested: number;
  behind: number;
  summary: string;
  weakest: Matchup[];
  held: Matchup | null;
};

export function testTactic(input: {
  players: ProfilePlayer[];
  instructions: TeamInstructions;
  opponents: TestOpponent[];
  styles: StyleFingerprint[];
  situation: Situation;
  seed?: number;
}): Battery {
  const profile = readStyle(input.players, input.instructions, input.styles).profile;
  const ranked = input.opponents
    .map((opponent) => {
      const match = liveSample({
        players: input.players,
        instructions: input.instructions,
        opponent,
        situation: input.situation,
        styles: input.styles,
        seed: input.seed ?? 1,
      });
      const margin = match.report.modelXgAgainst - match.report.modelXgFor;
      return {
        id: opponent.id,
        team: opponent.team,
        season: opponent.season,
        competition: opponent.competition,
        matches: opponent.matches,
        modelXgFor: match.report.modelXgFor,
        modelXgAgainst: match.report.modelXgAgainst,
        margin,
        why: whyLine(opponent, profile.pressHeight, profile.passLength, match.report.restDefence, input.opponents),
      };
    })
    .sort((a, b) => b.margin - a.margin || a.team.localeCompare(b.team));

  const behind = ranked.filter((row) => row.margin > 0);
  const weakest = (behind.length > 0 ? behind : ranked).slice(0, SHOW);
  const held = ranked.length > SHOW ? ranked[ranked.length - 1] : null;
  return {
    tested: ranked.length,
    behind: behind.length,
    summary: summaryLine(ranked.length, behind.length, weakest[0]),
    weakest,
    held,
  };
}

export function whyLine(
  opponent: StyleFingerprint,
  userPress: number,
  userPass: number,
  restDefence: number,
  opponents: StyleFingerprint[],
): string {
  const team = opponent.team;
  const shots = formatCount(opponent.shotsPerMatch);
  const pressed = opponent.pressHeight >= userPress + PRESS_GAP;
  const open = restDefence < OPEN_REST;
  if (open && pressed) {
    return `Fewer than three players stay behind the ball, and ${team} press from higher up.`;
  }
  if (pressed) {
    return `${team} allow ${formatCount(opponent.ppda)} passes before a defensive action, and that press takes the value off the chances.`;
  }
  if (open) {
    return `Fewer than three players stay behind the ball, and ${team} attack that space.`;
  }
  const busy = opponent.shotsPerMatch >= quartile(opponents.map((side) => side.shotsPerMatch), 0.75);
  const sharp = opponent.xgPerShot >= quartile(opponents.map((side) => side.xgPerShot), 0.75);
  if (busy && sharp) {
    return `${team} get ${shots} shots a match, and the recorded chances are among the better ones in this set.`;
  }
  if (busy) {
    return `${team} get ${shots} shots a match in the recorded season, and that is where the model's xG against comes from.`;
  }
  if (opponent.passLength + 1 < userPass) {
    return `${team} keep the ball shorter, at ${formatCount(opponent.passLength)} yards, while this side plays longer.`;
  }
  return `${team} get ${shots} shots a match in the recorded season, and that is where the model's xG against comes from.`;
}

function summaryLine(tested: number, behind: number, toughest: Matchup | undefined): string {
  if (!toughest || tested === 0) return "There are no sides in this set to test against.";
  if (behind > 0) {
    const count = behind === 1 ? "1 side" : `${behind} sides`;
    return `Weak against ${count} of ${tested}. The model's chances favour ${toughest.team}.`;
  }
  return `Tested against ${tested} sides. These ask the most of the model's xG.`;
}

function quartile(values: number[], fraction: number): number {
  if (values.length === 0) return 0;
  const sorted = [...values].sort((a, b) => a - b);
  const index = Math.min(sorted.length - 1, Math.floor((sorted.length - 1) * fraction));
  return sorted[index];
}

function formatCount(value: number): string {
  const rounded = Math.round(value * 10) / 10;
  return Number.isInteger(rounded) ? String(rounded) : rounded.toFixed(1);
}
