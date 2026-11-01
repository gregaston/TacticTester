import type { Duty } from "./roles";

export type PassingDirectness = "shorter" | "standard" | "more direct";
export type Tempo = "lower" | "standard" | "higher";
export type WidthSetting = "narrower" | "standard" | "wider";
export type LineHeight = "deeper" | "standard" | "higher";
export type Engagement = "lower" | "standard" | "higher";
export type Pressing = "less" | "standard" | "more";
export type Mentality = "defensive" | "balanced" | "attacking";
export type Transition = "regroup" | "standard" | "counter-press";
export type Distribution = "play out" | "mixed" | "go long";
export type WidthIntention = "underlap" | "balanced" | "overlap";
export type Shooting = "work the ball" | "standard" | "shoot on sight";

export type TeamInstructions = {
  passing: PassingDirectness;
  tempo: Tempo;
  width: WidthSetting;
  defensiveLine: LineHeight;
  engagement: Engagement;
  pressing: Pressing;
  mentality: Mentality;
  transition: Transition;
  distribution: Distribution;
  widthIntention: WidthIntention;
  shooting: Shooting;
};

export const DEFAULT_INSTRUCTIONS: TeamInstructions = {
  passing: "standard",
  tempo: "standard",
  width: "standard",
  defensiveLine: "standard",
  engagement: "standard",
  pressing: "standard",
  mentality: "balanced",
  transition: "standard",
  distribution: "mixed",
  widthIntention: "balanced",
  shooting: "standard",
};

export type InstructionEffect = {
  passLength: number; // yards added
  tempo: number; // -1 to 1
  width: number; // pitch units added to average width
  defensiveLine: number; // pitch y added, positive is higher up the pitch
  pressHeight: number; // pitch y of the press
  shotVolume: number; // multiplier around 1
};

const PASS_LENGTH: Record<PassingDirectness, number> = {
  shorter: -8,
  standard: 0,
  "more direct": 10,
};

const TEMPO: Record<Tempo, number> = {
  lower: -0.35,
  standard: 0,
  higher: 0.35,
};

const TEMPO_SHOTS: Record<Tempo, number> = {
  lower: -0.05,
  standard: 0,
  higher: 0.08,
};

const WIDTH: Record<WidthSetting, number> = {
  narrower: -6,
  standard: 0,
  wider: 6,
};

const LINE_SHIFT: Record<LineHeight, number> = {
  deeper: -8,
  standard: 0,
  higher: 8,
};

const ENGAGEMENT_HEIGHT: Record<Engagement, number> = {
  lower: 32,
  standard: 50,
  higher: 70,
};

const PRESS_SHIFT: Record<Pressing, number> = {
  less: -8,
  standard: 0,
  more: 8,
};

const MENTALITY_PASS: Record<Mentality, number> = {
  defensive: -2,
  balanced: 0,
  attacking: 2,
};

const MENTALITY_PRESS: Record<Mentality, number> = {
  defensive: -4,
  balanced: 0,
  attacking: 4,
};

const MENTALITY_SHOTS: Record<Mentality, number> = {
  defensive: -0.06,
  balanced: 0,
  attacking: 0.08,
};

const TRANSITION_PRESS: Record<Transition, number> = {
  regroup: -6,
  standard: 0,
  "counter-press": 6,
};

const DISTRIBUTION_PASS: Record<Distribution, number> = {
  "play out": -4,
  mixed: 0,
  "go long": 6,
};

const WIDTH_INTENTION: Record<WidthIntention, number> = {
  underlap: -3,
  balanced: 0,
  overlap: 4,
};

const SHOOTING_VOLUME: Record<Shooting, number> = {
  "work the ball": -0.08,
  standard: 0,
  "shoot on sight": 0.1,
};

const DUTY_ORDER = ["defend", "support", "attack"] as const;

export function dutyNudge(duty: Duty, mentality: Mentality): Duty {
  if (mentality === "balanced") return duty;
  const index = DUTY_ORDER.indexOf(duty);
  const step = mentality === "attacking" ? 1 : -1;
  const next = Math.min(DUTY_ORDER.length - 1, Math.max(0, index + step));
  return DUTY_ORDER[next];
}

export function applyInstructions(instructions: TeamInstructions): InstructionEffect {
  const defensiveLine = LINE_SHIFT[instructions.defensiveLine];
  return {
    passLength:
      PASS_LENGTH[instructions.passing] +
      MENTALITY_PASS[instructions.mentality] +
      DISTRIBUTION_PASS[instructions.distribution],
    tempo: TEMPO[instructions.tempo],
    width: WIDTH[instructions.width] + WIDTH_INTENTION[instructions.widthIntention],
    defensiveLine,
    pressHeight:
      ENGAGEMENT_HEIGHT[instructions.engagement] +
      defensiveLine +
      PRESS_SHIFT[instructions.pressing] +
      MENTALITY_PRESS[instructions.mentality] +
      TRANSITION_PRESS[instructions.transition],
    shotVolume:
      1 +
      TEMPO_SHOTS[instructions.tempo] +
      MENTALITY_SHOTS[instructions.mentality] +
      SHOOTING_VOLUME[instructions.shooting],
  };
}

const PRESS_LEAVES_A_GAP =
  "The press steps up and the defence sits, so the gap between them is large.";
const BALLS_OVER_THE_TOP =
  "The defence is high and the press is passive, so balls over the top are easier.";
const LONG_THROUGH_A_CROWD =
  "The side is trying to play long through a crowded middle.";
const ATTACK_THEN_DROP = "The side attacks, then drops off when the ball is lost.";
const DEEP_SIDE_LONG = "A deep side is trying to play long.";

export function instructionNotes(instructions: TeamInstructions): string[] {
  const notes: string[] = [];
  if (instructions.engagement === "higher" && instructions.defensiveLine === "deeper") {
    notes.push(PRESS_LEAVES_A_GAP);
  }
  if (instructions.engagement === "lower" && instructions.defensiveLine === "higher") {
    notes.push(BALLS_OVER_THE_TOP);
  }
  if (instructions.passing === "more direct" && instructions.width === "narrower") {
    notes.push(LONG_THROUGH_A_CROWD);
  }
  if (instructions.mentality === "attacking" && instructions.transition === "regroup") {
    notes.push(ATTACK_THEN_DROP);
  }
  if (instructions.mentality === "defensive" && instructions.passing === "more direct") {
    notes.push(DEEP_SIDE_LONG);
  }
  return notes;
}

const PASSING_VALUES = ["shorter", "standard", "more direct"] as const;
const TEMPO_VALUES = ["lower", "standard", "higher"] as const;
const WIDTH_VALUES = ["narrower", "standard", "wider"] as const;
const LINE_VALUES = ["deeper", "standard", "higher"] as const;
const ENGAGEMENT_VALUES = ["lower", "standard", "higher"] as const;
const PRESSING_VALUES = ["less", "standard", "more"] as const;
const MENTALITY_VALUES = ["defensive", "balanced", "attacking"] as const;
const TRANSITION_VALUES = ["regroup", "standard", "counter-press"] as const;
const DISTRIBUTION_VALUES = ["play out", "mixed", "go long"] as const;
const WIDTH_INTENTION_VALUES = ["underlap", "balanced", "overlap"] as const;
const SHOOTING_VALUES = ["work the ball", "standard", "shoot on sight"] as const;

function oneOf<T extends string>(value: unknown, allowed: readonly T[], fallback: T): T {
  return typeof value === "string" && (allowed as readonly string[]).includes(value) ? (value as T) : fallback;
}

/** A saved tactic may predate mentality and the More group. Unknown values fall back. */
export function readInstructions(value: Partial<Record<keyof TeamInstructions, unknown>>): TeamInstructions {
  return {
    passing: oneOf(value.passing, PASSING_VALUES, "standard"),
    tempo: oneOf(value.tempo, TEMPO_VALUES, "standard"),
    width: oneOf(value.width, WIDTH_VALUES, "standard"),
    defensiveLine: oneOf(value.defensiveLine, LINE_VALUES, "standard"),
    engagement: oneOf(value.engagement, ENGAGEMENT_VALUES, "standard"),
    pressing: oneOf(value.pressing, PRESSING_VALUES, "standard"),
    mentality: oneOf(value.mentality, MENTALITY_VALUES, "balanced"),
    transition: oneOf(value.transition, TRANSITION_VALUES, "standard"),
    distribution: oneOf(value.distribution, DISTRIBUTION_VALUES, "mixed"),
    widthIntention: oneOf(value.widthIntention, WIDTH_INTENTION_VALUES, "balanced"),
    shooting: oneOf(value.shooting, SHOOTING_VALUES, "standard"),
  };
}
