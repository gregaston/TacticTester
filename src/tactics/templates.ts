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

export const TEMPLATES: TacticTemplate[] = [
  {
    id: "4-4-2",
    name: "4-4-2",
    players: players(["GK", "DL", "LCB", "RCB", "DR", "LM", "LCM", "RCM", "RM", "LCF", "RCF"]),
  },
  {
    id: "4-3-3",
    name: "4-3-3",
    players: players(["GK", "DL", "LCB", "RCB", "DR", "LCM", "CM", "RCM", "LW", "CF", "RW"]),
  },
  {
    id: "4-2-3-1",
    name: "4-2-3-1",
    players: players(["GK", "DL", "LCB", "RCB", "DR", "LDM", "RDM", "LW", "CAM", "RW", "CF"]),
  },
  {
    id: "3-4-2-1",
    name: "3-4-2-1",
    players: players(["GK", "LCB", "CB", "RCB", "LM", "LCM", "RCM", "RM", "LAM", "RAM", "CF"]),
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
