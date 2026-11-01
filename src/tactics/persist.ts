const STORAGE_KEY = "tactic-tester";

export type SavedTactic = {
  version: 1;
  players: { id: string; x: number; y: number }[];
  templateId: string | null;
  freePlacement: boolean;
  setups: Record<string, { roleId: string; duty: "defend" | "support" | "attack" }>;
  instructions: {
    passing: string;
    tempo: string;
    width: string;
    defensiveLine: string;
    engagement: string;
    pressing: string;
    mentality?: string;
    transition?: string;
    distribution?: string;
    widthIntention?: string;
    shooting?: string;
  };
};

export type TacticStorage = {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
};

const INSTRUCTION_FIELDS = [
  "passing",
  "tempo",
  "width",
  "defensiveLine",
  "engagement",
  "pressing",
] as const;

export function saveTactic(storage: TacticStorage, tactic: SavedTactic): void {
  storage.setItem(STORAGE_KEY, JSON.stringify(tactic));
}

export function loadTactic(storage: TacticStorage): SavedTactic | null {
  const raw = storage.getItem(STORAGE_KEY);
  if (raw == null) return null;
  return parseTactic(raw);
}

/** Fragment after `#`: `t=` plus unpadded base64url of the tactic JSON. */
export function encodeTactic(tactic: SavedTactic): string {
  return `t=${encodeBase64Url(JSON.stringify(tactic))}`;
}

export function decodeTactic(hash: string): SavedTactic | null {
  const fragment = hash.startsWith("#") ? hash.slice(1) : hash;
  if (!fragment.startsWith("t=")) return null;
  const json = decodeBase64Url(fragment.slice(2));
  if (json == null) return null;
  return parseTactic(json);
}

function parseTactic(raw: string): SavedTactic | null {
  try {
    const value: unknown = JSON.parse(raw);
    return isSavedTactic(value) ? value : null;
  } catch {
    return null;
  }
}

function isSavedTactic(value: unknown): value is SavedTactic {
  if (!isRecord(value) || value.version !== 1) return false;
  if (!Array.isArray(value.players) || !value.players.every(isPlayer)) return false;
  if (value.templateId !== null && typeof value.templateId !== "string") return false;
  if (typeof value.freePlacement !== "boolean") return false;
  if (!isSetups(value.setups) || !isInstructions(value.instructions)) return false;
  return true;
}

function isPlayer(value: unknown): value is SavedTactic["players"][number] {
  return (
    isRecord(value) &&
    typeof value.id === "string" &&
    typeof value.x === "number" &&
    Number.isFinite(value.x) &&
    typeof value.y === "number" &&
    Number.isFinite(value.y)
  );
}

function isSetups(value: unknown): value is SavedTactic["setups"] {
  if (!isRecord(value)) return false;
  return Object.values(value).every(
    (setup) =>
      isRecord(setup) &&
      typeof setup.roleId === "string" &&
      (setup.duty === "defend" || setup.duty === "support" || setup.duty === "attack"),
  );
}

function isInstructions(value: unknown): value is SavedTactic["instructions"] {
  if (!isRecord(value)) return false;
  return INSTRUCTION_FIELDS.every((field) => typeof value[field] === "string");
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function encodeBase64Url(text: string): string {
  const bytes = new TextEncoder().encode(text);
  let binary = "";
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary).replaceAll("+", "-").replaceAll("/", "_").replaceAll("=", "");
}

function decodeBase64Url(encoded: string): string | null {
  const body = encoded.replace(/=+$/, "");
  if (body.length === 0 || !/^[A-Za-z0-9_-]+$/.test(body)) return null;
  const remainder = body.length % 4;
  if (remainder === 1) return null;
  const padded = body.replaceAll("-", "+").replaceAll("_", "/") + "=".repeat((4 - remainder) % 4);
  try {
    const binary = atob(padded);
    const bytes = new Uint8Array(binary.length);
    for (let index = 0; index < binary.length; index += 1) {
      bytes[index] = binary.charCodeAt(index);
    }
    return new TextDecoder().decode(bytes);
  } catch {
    return null;
  }
}
