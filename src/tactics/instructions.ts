export type PassingDirectness = "shorter" | "standard" | "more direct";
export type Tempo = "lower" | "standard" | "higher";
export type WidthSetting = "narrower" | "standard" | "wider";
export type LineHeight = "deeper" | "standard" | "higher";
export type Engagement = "lower" | "standard" | "higher";
export type Pressing = "less" | "standard" | "more";

export type TeamInstructions = {
  passing: PassingDirectness;
  tempo: Tempo;
  width: WidthSetting;
  defensiveLine: LineHeight;
  engagement: Engagement;
  pressing: Pressing;
};

export const DEFAULT_INSTRUCTIONS: TeamInstructions = {
  passing: "standard",
  tempo: "standard",
  width: "standard",
  defensiveLine: "standard",
  engagement: "standard",
  pressing: "standard",
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

export function applyInstructions(instructions: TeamInstructions): InstructionEffect {
  const defensiveLine = LINE_SHIFT[instructions.defensiveLine];
  return {
    passLength: PASS_LENGTH[instructions.passing],
    tempo: TEMPO[instructions.tempo],
    width: WIDTH[instructions.width],
    defensiveLine,
    pressHeight:
      ENGAGEMENT_HEIGHT[instructions.engagement] + defensiveLine + PRESS_SHIFT[instructions.pressing],
    shotVolume: 1 + TEMPO_SHOTS[instructions.tempo],
  };
}

const PRESS_LEAVES_A_GAP =
  "The press steps up and the defence sits, so the gap between them is large.";
const BALLS_OVER_THE_TOP =
  "The defence is high and the press is passive, so balls over the top are easier.";
const LONG_THROUGH_A_CROWD =
  "The side is trying to play long through a crowded middle.";

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
  return notes;
}
