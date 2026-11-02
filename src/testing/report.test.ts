import { describe, expect, it } from "vitest";
import { DEFAULT_INSTRUCTIONS } from "../tactics/instructions";
import { gradeMove } from "./campaign";
import { countMove, placeMove, problemMarks, reportPages } from "./report";

describe("placeMove", () => {
  it("uses the same sentence as the grade, and treats a lower place as a gain", () => {
    const climbed = placeMove(6, 8);
    expect(climbed.tone).toBe("gain");
    expect(climbed.label).toBe(gradeMove(6, 8));
    const dropped = placeMove(9, 8);
    expect(dropped.tone).toBe("drop");
    expect(dropped.label).toBe(gradeMove(9, 8));
    expect(placeMove(8, 8).tone).toBe("flat");
    expect(placeMove(8, null).tone).toBe("first");
  });
});

describe("countMove", () => {
  it("paints more xG for as a gain and more xG against as a drop", () => {
    expect(countMove(1.2, 1.05, "higher", 2)).toMatchObject({ tone: "gain", text: "+0.15 more" });
    expect(countMove(1.4, 1.62, "lower", 2)).toMatchObject({ tone: "gain", text: "−0.22 less" });
    expect(countMove(1.7, 1.62, "lower", 2).tone).toBe("drop");
    expect(countMove(1.2, 1.202, "higher", 2).tone).toBe("flat");
    expect(countMove(1.2, null, "higher", 2).tone).toBe("first");
  });
});

describe("problemMarks", () => {
  it("marks the space behind a high line and the channels a cross attacks", () => {
    const behind = problemMarks(
      { ...DEFAULT_INSTRUCTIONS, defensiveLine: "higher" },
      ["The defence is high and the press is passive, so balls over the top are easier."],
    );
    expect(behind.map((mark) => mark.id)).toEqual(["behind"]);
    expect(behind[0].y).toBeGreaterThan(12);
    expect(behind[0].y).toBeLessThan(38);

    const wide = problemMarks(DEFAULT_INSTRUCTIONS, ["Sides who shoot more often from crosses cost more than their shot count."]);
    expect(wide.map((mark) => mark.label)).toEqual(["Left channel", "Right channel"]);
  });

  it("marks central shots and a low shot count, and stays empty when the sentence has no place", () => {
    const central = problemMarks(DEFAULT_INSTRUCTIONS, ["Sides who shoot through the middle cost more than their shot count."]);
    expect(central.map((mark) => mark.id)).toEqual(["central"]);
    expect(problemMarks(DEFAULT_INSTRUCTIONS, ["The shot count is lower than most sides in this set."])).toMatchObject([
      { id: "few-shots", label: "Few shots", x: 50, y: 82, r: 9 },
    ]);
    expect(problemMarks(DEFAULT_INSTRUCTIONS, ["Ahead against 4 of 10 sides."])).toEqual([]);
  });

  it("keeps a long pass off the channels and tucks narrow full-backs inside", () => {
    const long = problemMarks(DEFAULT_INSTRUCTIONS, ["Ease More direct. Passes are 1.9 yards past Torino."]);
    expect(long.map((mark) => mark.id)).toEqual(["long-passes"]);
    expect(long.some((mark) => mark.id === "wide-left" || mark.x === 14)).toBe(false);

    const narrow = problemMarks(DEFAULT_INSTRUCTIONS, [
      "Widen the full-backs. The full-backs sit inside, and the sides that cause the most trouble take more of their shots from wide areas.",
    ]);
    expect(narrow.map((mark) => mark.x)).toEqual([32, 68]);
    expect(narrow.every((mark) => mark.x !== 14)).toBe(true);
    expect(narrow.map((mark) => mark.label)).toEqual(["Left full-back", "Right full-back"]);
    expect(narrow[0].y).toBe(24);
  });

  it("stops at four marks", () => {
    const marks = problemMarks(
      { ...DEFAULT_INSTRUCTIONS, defensiveLine: "higher", engagement: "lower" },
      [
        "The defence is high and the press is passive, so balls over the top are easier.",
        "Fewer than three players stay behind the ball, so the model's xG against is marked up.",
        "The full-backs sit inside, and the sides that cause the most trouble take more of their shots from wide areas.",
        "Sides who shoot through the middle cost more than their shot count.",
        "The press steps up and the defence sits, so the gap between them shows up in the model's xG against.",
      ],
    );
    expect(marks.length).toBeLessThanOrEqual(4);
  });
});

describe("reportPages", () => {
  it("keeps the grade first and leaves out an empty pitch or an empty side list", () => {
    expect(reportPages({ shape: [{ x: 50, y: 80 }], worst: [{}], best: [] }).map((page) => page.id)).toEqual([
      "grade",
      "pitch",
      "reading",
      "sides",
    ]);
    expect(reportPages({ shape: [], worst: [], best: [] }).map((page) => page.id)).toEqual(["grade", "reading"]);
    expect(reportPages({ worst: [], best: [{}] }).map((page) => page.title)).toEqual([
      "Grade",
      "Strengths and weaknesses",
      "The sides",
    ]);
  });
});
