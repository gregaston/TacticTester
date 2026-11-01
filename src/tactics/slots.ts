import type { PitchPoint } from "./types";

/** Named points on the 0–100 pitch. Attack is +y. Left is low x. */
export const SLOTS = {
  GK: { x: 50, y: 8 },
  DL: { x: 14, y: 24 },
  DR: { x: 86, y: 24 },
  LCB: { x: 38, y: 24 },
  CB: { x: 50, y: 24 },
  RCB: { x: 62, y: 24 },
  LWB: { x: 12, y: 28 },
  RWB: { x: 88, y: 28 },
  LDM: { x: 36, y: 40 },
  CDM: { x: 50, y: 40 },
  RDM: { x: 64, y: 40 },
  LM: { x: 14, y: 54 },
  LCM: { x: 38, y: 54 },
  CM: { x: 50, y: 54 },
  RCM: { x: 62, y: 54 },
  RM: { x: 86, y: 54 },
  LW: { x: 14, y: 72 },
  LAM: { x: 28, y: 69 },
  CAM: { x: 50, y: 69 },
  RAM: { x: 72, y: 69 },
  RW: { x: 86, y: 72 },
  LCF: { x: 38, y: 86 },
  CF: { x: 50, y: 86 },
  RCF: { x: 62, y: 86 },
  LWF: { x: 14, y: 86 },
  RWF: { x: 86, y: 86 },
} as const satisfies Record<string, PitchPoint>;

export type SlotName = keyof typeof SLOTS;

/** StatsBomb starting-position names, mapped onto the same slots as the templates. */
export const STATSBOMB_SLOTS: Record<string, SlotName> = {
  Goalkeeper: "GK",
  "Left Back": "DL",
  "Right Back": "DR",
  "Left Center Back": "LCB",
  "Center Back": "CB",
  "Right Center Back": "RCB",
  "Left Wing Back": "LWB",
  "Right Wing Back": "RWB",
  "Left Defensive Midfield": "LDM",
  "Center Defensive Midfield": "CDM",
  "Right Defensive Midfield": "RDM",
  "Left Midfield": "LM",
  "Left Center Midfield": "LCM",
  "Center Midfield": "CM",
  "Right Center Midfield": "RCM",
  "Right Midfield": "RM",
  "Left Wing": "LW",
  "Left Attacking Midfield": "LAM",
  "Center Attacking Midfield": "CAM",
  "Right Attacking Midfield": "RAM",
  "Right Wing": "RW",
  "Left Center Forward": "LCF",
  "Center Forward": "CF",
  "Right Center Forward": "RCF",
};

export function placeStatsBombPosition(name: string): PitchPoint | null {
  const slot = STATSBOMB_SLOTS[name];
  return slot ? SLOTS[slot] : null;
}
