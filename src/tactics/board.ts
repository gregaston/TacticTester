import type { PitchPoint, Player } from "./types";
import { snapPoint } from "./snap";
import { TEMPLATES, templateById, type TacticTemplate } from "./templates";

export type BoardState = {
  players: Player[];
  selectedId: string | null;
  templateId: string | null;
};

export function createBoard(templateId = "4-4-2"): BoardState {
  const template = templateById(templateId);
  return {
    players: template.players.map((player) => ({ ...player })),
    selectedId: null,
    templateId: template.id,
  };
}

export function movePlayer(state: BoardState, id: string, point: PitchPoint): BoardState {
  const others = state.players.filter((player) => player.id !== id);
  const next = snapPoint(point, others);
  return {
    ...state,
    selectedId: id,
    templateId: null,
    players: state.players.map((player) => (player.id === id ? { ...player, ...next } : player)),
  };
}

export function chooseTemplate(state: BoardState, templateId: string): BoardState {
  const template = templateById(templateId);
  return {
    ...state,
    templateId: template.id,
    selectedId: null,
    players: template.players.map((player) => ({ ...player })),
  };
}

export function selectPlayer(state: BoardState, id: string | null): BoardState {
  return { ...state, selectedId: id };
}

export function activeTemplate(state: BoardState): TacticTemplate | null {
  if (!state.templateId) return null;
  return TEMPLATES.find((template) => template.id === state.templateId) ?? null;
}
