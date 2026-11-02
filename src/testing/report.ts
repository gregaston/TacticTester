import { defensiveAnchor, engagementAnchor } from "../tactics/block";
import type { TeamInstructions } from "../tactics/instructions";

/**
 * How a report figure moved against the test before it.
 *
 * Green is an improvement and red is a regression. The words carry the
 * same fact, so the colour is not the only signal. A lower table place is
 * an improvement. More xG for is an improvement. Less xG against is an
 * improvement.
 */

export type FigureMove = {
  tone: "gain" | "drop" | "flat" | "first";
  text: string;
  label: string;
};

export type ReportDot = { x: number; y: number };

export type ReportMark = {
  id: string;
  label: string;
  x: number;
  y: number;
  r: number;
};

const MARK_LIMIT = 4;

export type ReportPage = {
  id: "grade" | "pitch" | "reading" | "sides";
  title: string;
};

/** The analyst report, one phone screen at a time. Empty parts are left out. */
export function reportPages(run: { shape?: { x: number; y: number }[]; worst: unknown[]; best: unknown[] }): ReportPage[] {
  const pages: ReportPage[] = [{ id: "grade", title: "Grade" }];
  if (run.shape && run.shape.length > 0) pages.push({ id: "pitch", title: "Where it hurts" });
  pages.push({ id: "reading", title: "Strengths and weaknesses" });
  if (run.worst.length > 0 || run.best.length > 0) pages.push({ id: "sides", title: "The sides" });
  return pages;
}

export function placeMove(place: number, previous: number | null): FigureMove {
  if (previous == null) return { tone: "first", text: "First test", label: "First test." };
  const delta = previous - place;
  if (delta === 0) return { tone: "flat", text: "Same", label: "Same grade as the test before it." };
  const places = Math.abs(delta) === 1 ? "place" : "places";
  const way = delta > 0 ? "higher" : "lower";
  const text = `${Math.abs(delta)} ${places} ${way}`;
  return { tone: delta > 0 ? "gain" : "drop", text, label: `${text} than the test before it.` };
}

export function countMove(current: number, previous: number | null, better: "higher" | "lower", digits: number): FigureMove {
  if (previous == null) return { tone: "first", text: "First test", label: "First test." };
  const amount = current - previous;
  const shown = round(Math.abs(amount), digits);
  if (shown === 0) return { tone: "flat", text: "Same", label: "Same as the test before it." };
  const more = amount > 0;
  const word = more ? "more" : "less";
  const sign = more ? "+" : "−";
  const text = `${sign}${shown.toFixed(digits)} ${word}`;
  const improved = better === "higher" ? more : !more;
  return { tone: improved ? "gain" : "drop", text, label: `${shown.toFixed(digits)} ${word} than the test before it.` };
}

/**
 * Places on the 0–100 pitch for the weaknesses this run actually named.
 * Attack is +y. A sentence with no place on the pitch adds nothing.
 */
export function problemMarks(instructions: TeamInstructions, weaknesses: string[]): ReportMark[] {
  const lineY = defensiveAnchor(instructions.defensiveLine);
  const engageY = engagementAnchor(instructions.engagement);
  const marks: ReportMark[] = [];
  const seen = new Set<string>();
  for (const text of weaknesses) {
    for (const rule of RULES) {
      if (!rule.test.test(text)) continue;
      if (rule.unless?.test(text)) continue;
      const next = rule.marks(lineY, engageY).filter((mark) => !seen.has(mark.id));
      if (next.length === 0 || marks.length + next.length > MARK_LIMIT) continue;
      for (const mark of next) seen.add(mark.id);
      marks.push(...next);
    }
  }
  return marks;
}

const RULES: { test: RegExp; unless?: RegExp; marks: (lineY: number, engageY: number) => ReportMark[] }[] = [
  {
    test: /balls over the top|space behind the ball|Direct sides who see less of the final third/,
    marks: (lineY) => [{ id: "behind", label: "Space behind the line", x: 50, y: clamp(lineY - 10, 12, 34), r: 12 }],
  },
  {
    test: /gap between them|gap shows in xG against/,
    marks: (lineY, engageY) => [{ id: "gap", label: "Gap between the lines", x: 50, y: (lineY + engageY) / 2, r: 11 }],
  },
  {
    test: /stay behind the ball/,
    marks: () => [{ id: "rest", label: "Too few behind the ball", x: 50, y: 14, r: 10 }],
  },
  {
    test: /full-backs sit inside/,
    marks: (lineY) => [
      { id: "narrow-left", label: "Left full-back", x: 32, y: lineY, r: 8 },
      { id: "narrow-right", label: "Right full-back", x: 68, y: lineY, r: 8 },
    ],
  },
  {
    test: /yards past|longer than the most direct/,
    marks: () => [{ id: "long-passes", label: "Long passes", x: 50, y: 62, r: 11 }],
  },
  {
    test: /shot count is low|shot count is lower/,
    marks: () => [{ id: "few-shots", label: "Few shots", x: 50, y: 82, r: 9 }],
  },
  {
    test: /press is higher than most|High press/,
    marks: (lineY, engageY) => {
      void lineY;
      return [{ id: "high-press", label: "High press", x: 50, y: engageY, r: 10 }];
    },
  },
  {
    test: /Wide starting shapes|from crosses|wide areas/,
    unless: /full-backs sit inside/,
    marks: (lineY) => [
      { id: "wide-left", label: "Left channel", x: 14, y: clamp(lineY, 16, 42), r: 8 },
      { id: "wide-right", label: "Right channel", x: 86, y: clamp(lineY, 16, 42), r: 8 },
    ],
  },
  {
    test: /shoot through the middle|Narrow starting shapes/,
    marks: () => [{ id: "central", label: "Central shots", x: 50, y: 18, r: 10 }],
  },
  {
    test: /Ease Shorter passing|Short passes run into|higher presses cost more/,
    marks: () => [{ id: "press", label: "Pressed in the build-up", x: 50, y: 48, r: 10 }],
  },
  {
    test: /deeper block/,
    marks: (lineY) => [{ id: "deep", label: "Deep block", x: 50, y: clamp(lineY + 4, 14, 28), r: 14 }],
  },
];

function round(value: number, digits: number): number {
  const scale = 10 ** digits;
  return Math.round(value * scale) / scale;
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}
