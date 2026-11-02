import type { CampaignRun } from "./campaign";

/** Test runs kept on this device. Separate from the saved tactic. */
export const TEST_HISTORY_KEY = "tactictester.tests";

const KEEP = 12;

export type HistoryStorage = {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
  removeItem(key: string): void;
};

const listeners = new Set<() => void>();

export function loadTestHistory(storage: HistoryStorage): CampaignRun[] {
  try {
    const raw = storage.getItem(TEST_HISTORY_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as unknown;
    if (!Array.isArray(parsed)) return [];
    return parsed.filter(isRun).slice(0, KEEP);
  } catch {
    return [];
  }
}

export function saveTestHistory(runs: CampaignRun[], storage: HistoryStorage): void {
  try {
    storage.setItem(TEST_HISTORY_KEY, JSON.stringify(runs.slice(0, KEEP)));
  } catch {
    // The test still shows. Storage can be full or blocked.
  }
}

/** Drops the test list and tells this tab. The saved tactic is left alone. */
export function clearTestHistory(storage: HistoryStorage): void {
  try {
    storage.removeItem(TEST_HISTORY_KEY);
  } catch {
    // The list still clears in this tab.
  }
  for (const listener of listeners) listener();
}

export function subscribeTestHistory(listener: () => void): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

function isRun(value: unknown): value is CampaignRun {
  if (!value || typeof value !== "object") return false;
  const run = value as Partial<CampaignRun>;
  return (
    typeof run.id === "string" &&
    typeof run.place === "number" &&
    typeof run.label === "string" &&
    Array.isArray(run.strengths) &&
    Array.isArray(run.weaknesses)
  );
}
