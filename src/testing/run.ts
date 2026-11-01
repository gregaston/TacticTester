import type { StyleFingerprint, TestReport, TestSetup } from "./types";
import { shotXg } from "./xg";

/** Passes longer than this leave the chance less settled. Not a fitted model. */
const UNSETTLED_PASS_YARDS = 25;
const UNSETTLED_XG_FACTOR = 0.92;

const SHOT_CAP = 20;

const PITCH_WIDTH_M = 68;
const PITCH_LENGTH_M = 105;
const YARD_M = 0.9144;
const BOX_DEPTH_YARDS = 18;
const BOX_HALF_WIDTH_M = 20.16;
const EDGE_OF_AREA_YARDS = 30;
const CENTRAL_HALF_M = 10;

type SampleShape = {
  passLength: number;
  xgPerShot: number;
  shotsPerMatch: number;
  pressHeight: number;
};

/**
 * One sample of possessions. The report describes where the shots came
 * from, how long the passes were, and how high the press was. It does
 * not produce a score.
 */
export function runTest(setup: TestSetup, styles: StyleFingerprint[]): TestReport {
  const sample: SampleShape = {
    passLength: setup.passLength,
    xgPerShot: adjustedXg(setup),
    shotsPerMatch: shotsInSample(setup),
    pressHeight: setup.pressHeight,
  };
  const nearest = nearestStyle(sample, styles);
  return {
    ...sample,
    nearestId: nearest?.id ?? null,
    lines: reportLines(setup, sample.xgPerShot, nearest),
  };
}

function adjustedXg(setup: TestSetup): number {
  const base = shotXg(setup.shotX, setup.shotY);
  if (setup.passLength > UNSETTLED_PASS_YARDS) return base * UNSETTLED_XG_FACTOR;
  return base;
}

function shotsInSample(setup: TestSetup): number {
  const raw = 8 * setup.shotVolume * (0.85 + setup.passRisk * 0.3);
  const rounded = Math.round(raw * 10) / 10;
  return Math.min(SHOT_CAP, rounded);
}

/**
 * Each gap is divided by the size of a meaningful difference: 8 yards of
 * passing, 0.05 xG per shot, 4 shots, and 12 on the press scale. The
 * distance is the Euclidean length of those four scaled gaps.
 */
function styleDistance(sample: SampleShape, style: StyleFingerprint): number {
  const pass = (sample.passLength - style.passLength) / 8;
  const xg = (sample.xgPerShot - style.xgPerShot) / 0.05;
  const shots = (sample.shotsPerMatch - style.shotsPerMatch) / 4;
  const press = (sample.pressHeight - style.pressHeight) / 12;
  return Math.hypot(pass, xg, shots, press);
}

function nearestStyle(sample: SampleShape, styles: StyleFingerprint[]): StyleFingerprint | null {
  if (styles.length === 0) return null;
  return [...styles].sort((a, b) => {
    const gap = styleDistance(sample, a) - styleDistance(sample, b);
    if (gap !== 0) return gap;
    return a.team.localeCompare(b.team);
  })[0];
}

function reportLines(setup: TestSetup, xgPerShot: number, nearest: StyleFingerprint | null): string[] {
  const lines = [
    shotSentence(setup.shotX, setup.shotY),
    passSentence(setup.passLength, nearest),
    pressSentence(setup.pressHeight, nearest),
  ];
  const quality = qualitySentence(xgPerShot);
  if (quality) lines.push(quality);
  return lines;
}

function shotSentence(shotX: number, shotY: number): string {
  const yardsOut = ((100 - shotY) / 100) * (PITCH_LENGTH_M / YARD_M);
  const metresWide = (Math.abs(shotX - 50) / 100) * PITCH_WIDTH_M;
  const insideBox = yardsOut <= BOX_DEPTH_YARDS && metresWide <= BOX_HALF_WIDTH_M;
  const depth = insideBox ? "inside the box" : yardsOut <= EDGE_OF_AREA_YARDS ? "the edge of the area" : "range";
  const lane = metresWide <= CENTRAL_HALF_M ? "central" : "wide";
  return `In a sample of possessions, shots are coming from ${depth}, and they are ${lane}.`;
}

function passSentence(passLength: number, nearest: StyleFingerprint | null): string {
  const style = passLength < 16 ? "short" : passLength > 22 ? "direct" : "mixed";
  if (!nearest) return `Passing is ${style}.`;
  const gap = passLength - nearest.passLength;
  if (Math.abs(gap) < 2) return `Passing is ${style}.`;
  const direction = gap > 0 ? "longer" : "shorter";
  return `Passing is ${style}, ${direction} than ${nearest.team} by ${formatTenths(Math.abs(gap))} yards.`;
}

function pressSentence(pressHeight: number, nearest: StyleFingerprint | null): string {
  const band = pressHeight >= 62 ? "high" : pressHeight <= 40 ? "deep" : "in a mid-block";
  if (!nearest) return `The press is ${band}.`;
  const gloss = `${formatTenths(nearest.ppda)} passes the opponent completes before a defensive action`;
  const gap = pressHeight - nearest.pressHeight;
  if (Math.abs(gap) >= 15) {
    const direction = gap > 0 ? "higher" : "deeper";
    return `The press is ${band}, ${formatTenths(Math.abs(gap))} ${direction} than ${nearest.team} (${gloss}).`;
  }
  return `The press is ${band} (${nearest.team}: ${gloss}).`;
}

function qualitySentence(xgPerShot: number): string | null {
  const shown = xgPerShot.toFixed(2);
  if (xgPerShot < 0.08) return `The chances are low quality, at ${shown} xG per shot.`;
  if (xgPerShot > 0.18) return `The chances are high quality, at ${shown} xG per shot.`;
  return null;
}

function formatTenths(value: number): string {
  const rounded = Math.round(value * 10) / 10;
  return Number.isInteger(rounded) ? rounded.toFixed(0) : rounded.toFixed(1);
}
