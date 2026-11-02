import { SLOTS } from "./slots";
import type { Player } from "./types";

export type TacticTemplate = {
  id: string;
  name: string;
  players: Player[];
};

const ids = ["p1", "p2", "p3", "p4", "p5", "p6", "p7", "p8", "p9", "p10", "p11"] as const;

function players(points: Array<keyof typeof SLOTS>): Player[] {
  return points.map((slot, index) => ({ id: ids[index], ...SLOTS[slot] }));
}

/** Common league shapes. Wide players sit on the line their name implies, so a 4-3-3 with wingers reads 4-3-2-1. */
export const TEMPLATES: TacticTemplate[] = [
  {
    id: "4-4-2",
    name: "4-4-2",
    players: players(["GK", "DL", "LCB", "RCB", "DR", "LM", "LCM", "RCM", "RM", "LCF", "RCF"]),
  },
  {
    id: "4-4-1-1",
    name: "4-4-1-1",
    players: players(["GK", "DL", "LCB", "RCB", "DR", "LM", "LCM", "RCM", "RM", "CAM", "CF"]),
  },
  {
    id: "4-3-3",
    name: "4-3-3",
    players: players(["GK", "DL", "LCB", "RCB", "DR", "LCM", "CM", "RCM", "LW", "CF", "RW"]),
  },
  {
    id: "4-1-2-3",
    name: "4-1-2-3",
    players: players(["GK", "DL", "LCB", "RCB", "DR", "CDM", "LCM", "RCM", "LW", "CF", "RW"]),
  },
  {
    id: "4-2-3-1",
    name: "4-2-3-1",
    players: players(["GK", "DL", "LCB", "RCB", "DR", "LDM", "RDM", "LW", "CAM", "RW", "CF"]),
  },
  {
    id: "4-1-4-1",
    name: "4-1-4-1",
    players: players(["GK", "DL", "LCB", "RCB", "DR", "CDM", "LM", "LCM", "RCM", "RM", "CF"]),
  },
  {
    id: "4-3-1-2",
    name: "4-3-1-2",
    players: players(["GK", "DL", "LCB", "RCB", "DR", "LCM", "CM", "RCM", "CAM", "LCF", "RCF"]),
  },
  {
    id: "4-1-2-1-2",
    name: "4-1-2-1-2",
    players: players(["GK", "DL", "LCB", "RCB", "DR", "CDM", "LCM", "RCM", "CAM", "LCF", "RCF"]),
  },
  {
    id: "4-2-2-2",
    name: "4-2-2-2",
    players: players(["GK", "DL", "LCB", "RCB", "DR", "LDM", "RDM", "LAM", "RAM", "LCF", "RCF"]),
  },
  {
    id: "4-5-1",
    name: "4-5-1",
    players: players(["GK", "DL", "LCB", "RCB", "DR", "LM", "LCM", "CM", "RCM", "RM", "CF"]),
  },
  {
    id: "4-2-4",
    name: "4-2-4",
    players: players(["GK", "DL", "LCB", "RCB", "DR", "LCM", "RCM", "LWF", "LCF", "RCF", "RWF"]),
  },
  {
    id: "3-5-2",
    name: "3-5-2",
    // Wide midfielders can take Wing-Back. The seat stays in the midfield band.
    players: players(["GK", "LCB", "CB", "RCB", "LM", "LCM", "CM", "RCM", "RM", "LCF", "RCF"]),
  },
  {
    id: "3-4-3",
    name: "3-4-3",
    players: players(["GK", "LCB", "CB", "RCB", "LM", "LCM", "RCM", "RM", "LWF", "CF", "RWF"]),
  },
  {
    id: "3-4-2-1",
    name: "3-4-2-1",
    players: players(["GK", "LCB", "CB", "RCB", "LM", "LCM", "RCM", "RM", "LAM", "RAM", "CF"]),
  },
  {
    id: "5-3-2",
    name: "5-3-2",
    players: players(["GK", "LWB", "LCB", "CB", "RCB", "RWB", "LCM", "CM", "RCM", "LCF", "RCF"]),
  },
  {
    id: "5-1-2-2",
    name: "5-1-2-2",
    players: players(["GK", "LWB", "LCB", "CB", "RCB", "RWB", "CDM", "LCM", "RCM", "LCF", "RCF"]),
  },
  {
    id: "5-4-1",
    name: "5-4-1",
    players: players(["GK", "LWB", "LCB", "CB", "RCB", "RWB", "LM", "LCM", "RCM", "RM", "CF"]),
  },
  {
    id: "5-2-3",
    name: "5-2-3",
    players: players(["GK", "LWB", "LCB", "CB", "RCB", "RWB", "LCM", "RCM", "LWF", "CF", "RWF"]),
  },
];

export function templateById(id: string): TacticTemplate {
  return TEMPLATES.find((template) => template.id === id) ?? TEMPLATES[0];
}

const BACK_LINES = [3, 4, 5] as const;

export function templatesByBackLine(): { label: string; templates: TacticTemplate[] }[] {
  return BACK_LINES.map((count) => ({
    label: `${count} at the back`,
    templates: TEMPLATES.filter((template) => Number(template.name.split("-")[0]) === count),
  })).filter((group) => group.templates.length > 0);
}
