import { describe, expect, it } from "vitest";
import {
  DEFAULT_INSTRUCTIONS,
  applyInstructions,
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
});
