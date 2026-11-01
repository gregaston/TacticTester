import { describe, expect, it } from "vitest";
import {
  DEFAULT_INSTRUCTIONS,
  applyInstructions,
  dutyNudge,
  instructionNotes,
  type TeamInstructions,
} from "./instructions";

function instructions(patch: Partial<TeamInstructions> = {}): TeamInstructions {
  return { ...DEFAULT_INSTRUCTIONS, ...patch };
}

describe("applyInstructions", () => {
  it("keeps the default instructions neutral", () => {
    expect(DEFAULT_INSTRUCTIONS).toEqual({
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
    });
    expect(applyInstructions(DEFAULT_INSTRUCTIONS)).toEqual({
      passLength: 0,
      tempo: 0,
      width: 0,
      defensiveLine: 0,
      pressHeight: 50,
      shotVolume: 1,
    });
  });

  it("raises pass length when passing is more direct", () => {
    const standard = applyInstructions(DEFAULT_INSTRUCTIONS);
    const direct = applyInstructions(instructions({ passing: "more direct" }));
    const shorter = applyInstructions(instructions({ passing: "shorter" }));
    expect(direct.passLength).toBeGreaterThan(standard.passLength);
    expect(direct.passLength).toBe(10);
    expect(shorter.passLength).toBe(-8);
  });

  it("raises the press when a higher line is joined by more pressing", () => {
    const higherLine = applyInstructions(instructions({ defensiveLine: "higher" }));
    const higherLineAndPress = applyInstructions(
      instructions({ defensiveLine: "higher", pressing: "more" }),
    );
    expect(higherLineAndPress.pressHeight).toBeGreaterThan(higherLine.pressHeight);
    expect(higherLine.pressHeight).toBe(58);
    expect(higherLineAndPress.pressHeight).toBe(66);
  });

  it("stacks a high line into the press, and a deep line does not cancel a high press", () => {
    const highPress = applyInstructions(
      instructions({ engagement: "higher", defensiveLine: "higher", pressing: "more" }),
    );
    const deepLineHighPress = applyInstructions(
      instructions({ engagement: "higher", defensiveLine: "deeper" }),
    );
    expect(highPress.pressHeight).toBe(86);
    expect(deepLineHighPress.pressHeight).toBe(62);
  });

  it("shifts tempo, width, and the defensive line on the published scales", () => {
    expect(applyInstructions(instructions({ tempo: "lower" }))).toMatchObject({
      tempo: -0.35,
      shotVolume: 0.95,
    });
    expect(applyInstructions(instructions({ tempo: "higher" }))).toMatchObject({
      tempo: 0.35,
      shotVolume: 1.08,
    });
    expect(applyInstructions(instructions({ tempo: "higher", pressing: "less" })).shotVolume).toBe(1.08);
    expect(applyInstructions(instructions({ width: "narrower" })).width).toBe(-6);
    expect(applyInstructions(instructions({ width: "wider" })).width).toBe(6);
    expect(applyInstructions(instructions({ defensiveLine: "deeper" })).defensiveLine).toBe(-8);
    expect(applyInstructions(instructions({ engagement: "lower", pressing: "less" })).pressHeight).toBe(24);
  });

  it("adds mentality on top of the existing six", () => {
    expect(applyInstructions(instructions({ mentality: "defensive" }))).toMatchObject({
      passLength: -2,
      pressHeight: 46,
      shotVolume: 0.94,
    });
    expect(applyInstructions(instructions({ mentality: "attacking" }))).toMatchObject({
      passLength: 2,
      pressHeight: 54,
      shotVolume: 1.08,
    });
    expect(applyInstructions(instructions({ mentality: "balanced" }))).toMatchObject({
      passLength: 0,
      pressHeight: 50,
      shotVolume: 1,
    });
    expect(
      applyInstructions(instructions({ passing: "more direct", mentality: "attacking" })).passLength,
    ).toBe(12);
    expect(
      applyInstructions(
        instructions({ defensiveLine: "higher", pressing: "more", mentality: "defensive" }),
      ).pressHeight,
    ).toBe(62);
    expect(applyInstructions(instructions({ tempo: "higher", mentality: "attacking" })).shotVolume).toBeCloseTo(1.16);
  });

  it("adds transition, distribution, width intention, and shooting on top", () => {
    expect(applyInstructions(instructions({ transition: "counter-press" })).pressHeight).toBe(56);
    expect(applyInstructions(instructions({ transition: "regroup" })).pressHeight).toBe(44);
    expect(applyInstructions(instructions({ transition: "standard" })).pressHeight).toBe(50);
    expect(
      applyInstructions(instructions({ mentality: "attacking", transition: "counter-press" })).pressHeight,
    ).toBe(60);
    expect(applyInstructions(instructions({ distribution: "play out" })).passLength).toBe(-4);
    expect(applyInstructions(instructions({ distribution: "go long" })).passLength).toBe(6);
    expect(applyInstructions(instructions({ distribution: "mixed" })).passLength).toBe(0);
    expect(
      applyInstructions(instructions({ passing: "shorter", distribution: "play out", mentality: "defensive" }))
        .passLength,
    ).toBe(-14);
    expect(applyInstructions(instructions({ widthIntention: "underlap" })).width).toBe(-3);
    expect(applyInstructions(instructions({ widthIntention: "overlap" })).width).toBe(4);
    expect(applyInstructions(instructions({ widthIntention: "balanced" })).width).toBe(0);
    expect(applyInstructions(instructions({ width: "wider", widthIntention: "overlap" })).width).toBe(10);
    expect(applyInstructions(instructions({ shooting: "work the ball" })).shotVolume).toBeCloseTo(0.92);
    expect(applyInstructions(instructions({ shooting: "shoot on sight" })).shotVolume).toBeCloseTo(1.1);
    expect(
      applyInstructions(
        instructions({ tempo: "lower", mentality: "defensive", shooting: "work the ball" }),
      ).shotVolume,
    ).toBeCloseTo(0.81);
    expect(
      applyInstructions(
        instructions({ tempo: "higher", mentality: "attacking", shooting: "shoot on sight" }),
      ).shotVolume,
    ).toBeCloseTo(1.26);
  });
});

describe("dutyNudge", () => {
  it("returns the duty unchanged when mentality is balanced", () => {
    expect(dutyNudge("defend", "balanced")).toBe("defend");
    expect(dutyNudge("support", "balanced")).toBe("support");
    expect(dutyNudge("attack", "balanced")).toBe("attack");
  });

  it("holds the duty back when mentality is defensive, and leaves defend", () => {
    expect(dutyNudge("attack", "defensive")).toBe("support");
    expect(dutyNudge("support", "defensive")).toBe("defend");
    expect(dutyNudge("defend", "defensive")).toBe("defend");
  });

  it("pushes the duty on when mentality is attacking, and leaves attack", () => {
    expect(dutyNudge("defend", "attacking")).toBe("support");
    expect(dutyNudge("support", "attacking")).toBe("attack");
    expect(dutyNudge("attack", "attacking")).toBe("attack");
  });
});

describe("instructionNotes", () => {
  it("warns only for the mismatched press and line pairs", () => {
    expect(instructionNotes(instructions({ engagement: "higher", defensiveLine: "deeper" }))).toEqual([
      "The press steps up and the defence sits, so the gap between them is large.",
    ]);
    expect(instructionNotes(instructions({ engagement: "lower", defensiveLine: "higher" }))).toEqual([
      "The defence is high and the press is passive, so balls over the top are easier.",
    ]);

    const quiet: TeamInstructions[] = [
      DEFAULT_INSTRUCTIONS,
      instructions({ engagement: "higher", defensiveLine: "higher" }),
      instructions({ engagement: "lower", defensiveLine: "deeper" }),
      instructions({ engagement: "higher", defensiveLine: "standard" }),
      instructions({ engagement: "lower", defensiveLine: "standard" }),
      instructions({ engagement: "standard", defensiveLine: "higher" }),
      instructions({ engagement: "standard", defensiveLine: "deeper" }),
      instructions({ passing: "more direct", width: "wider" }),
      instructions({ passing: "shorter", width: "narrower" }),
    ];
    for (const choice of quiet) {
      const notes = instructionNotes(choice);
      expect(notes.some((note) => note.includes("gap"))).toBe(false);
      expect(notes.some((note) => note.includes("over the top"))).toBe(false);
    }
  });

  it("stays quiet for a coherent high press", () => {
    expect(
      instructionNotes(
        instructions({
          engagement: "higher",
          defensiveLine: "higher",
          pressing: "more",
        }),
      ),
    ).toEqual([]);
  });

  it("notes direct passing into a narrow side", () => {
    expect(instructionNotes(instructions({ passing: "more direct", width: "narrower" }))).toEqual([
      "The side is trying to play long through a crowded middle.",
    ]);
    expect(
      instructionNotes(
        instructions({
          passing: "more direct",
          width: "narrower",
          engagement: "higher",
          defensiveLine: "deeper",
        }),
      ),
    ).toEqual([
      "The press steps up and the defence sits, so the gap between them is large.",
      "The side is trying to play long through a crowded middle.",
    ]);
  });

  it("notes an attacking side that regroups, and a deep side playing long", () => {
    expect(instructionNotes(instructions({ mentality: "attacking", transition: "regroup" }))).toEqual([
      "The side attacks, then drops off when the ball is lost.",
    ]);
    expect(instructionNotes(instructions({ mentality: "defensive", passing: "more direct" }))).toEqual([
      "A deep side is trying to play long.",
    ]);
    expect(
      instructionNotes(
        instructions({
          mentality: "attacking",
          transition: "regroup",
          engagement: "higher",
          defensiveLine: "deeper",
        }),
      ),
    ).toEqual([
      "The press steps up and the defence sits, so the gap between them is large.",
      "The side attacks, then drops off when the ball is lost.",
    ]);
    expect(
      instructionNotes(
        instructions({
          mentality: "defensive",
          passing: "more direct",
          width: "narrower",
        }),
      ),
    ).toEqual([
      "The side is trying to play long through a crowded middle.",
      "A deep side is trying to play long.",
    ]);

    const quiet: TeamInstructions[] = [
      instructions({ mentality: "attacking", transition: "standard" }),
      instructions({ mentality: "attacking", transition: "counter-press" }),
      instructions({ mentality: "defensive", transition: "regroup" }),
      instructions({ mentality: "balanced", transition: "regroup" }),
      instructions({ mentality: "defensive", passing: "standard" }),
      instructions({ mentality: "defensive", passing: "shorter" }),
      instructions({ mentality: "attacking", passing: "more direct" }),
      instructions({ mentality: "balanced", passing: "more direct" }),
    ];
    for (const choice of quiet) {
      const notes = instructionNotes(choice);
      expect(notes.some((note) => note.includes("drops off"))).toBe(false);
      expect(notes.some((note) => note.includes("deep side"))).toBe(false);
    }
  });
});
