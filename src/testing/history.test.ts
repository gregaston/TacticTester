import { describe, expect, it } from "vitest";
import {
  TEST_HISTORY_KEY,
  clearTestHistory,
  loadTestHistory,
  saveTestHistory,
  subscribeTestHistory,
  type HistoryStorage,
} from "./history";

function memory(): HistoryStorage & { items: Map<string, string> } {
  const items = new Map<string, string>();
  return {
    items,
    getItem(key) {
      return items.get(key) ?? null;
    },
    setItem(key, value) {
      items.set(key, value);
    },
    removeItem(key) {
      items.delete(key);
    },
  };
}

function run(id: string) {
  return {
    id,
    createdAt: 1,
    label: "4-4-2 · balanced",
    tacticKey: "k",
    place: 13,
    meanFor: 1.2,
    meanAgainst: 1.1,
    tested: 133,
    situations: 7,
    strengths: ["The shot count is ordinary."],
    weaknesses: ["Shots come through the middle."],
    comparison: null,
    worst: [],
    best: [],
  };
}

describe("test history", () => {
  it("keeps the newest runs under tactictester.tests", () => {
    const storage = memory();
    const runs = Array.from({ length: 14 }, (_, index) => run(`r${index}`));

    saveTestHistory(runs, storage);

    expect([...storage.items.keys()]).toEqual([TEST_HISTORY_KEY]);
    expect(loadTestHistory(storage).map((item) => item.id)).toEqual(runs.slice(0, 12).map((item) => item.id));
  });

  it("returns nothing when the stored value is missing or not a list of runs", () => {
    expect(loadTestHistory(memory())).toEqual([]);

    const broken = memory();
    broken.setItem(TEST_HISTORY_KEY, "{");
    expect(loadTestHistory(broken)).toEqual([]);

    const odd = memory();
    odd.setItem(TEST_HISTORY_KEY, JSON.stringify([{ id: "a" }, run("b")]));
    expect(loadTestHistory(odd).map((item) => item.id)).toEqual(["b"]);
  });

  it("clears the test list, tells this tab, and leaves the tactic in place", () => {
    const storage = memory();
    saveTestHistory([run("a")], storage);
    storage.setItem("tactic-tester", "{\"version\":1}");
    let heard = 0;
    const stop = subscribeTestHistory(() => {
      heard += 1;
    });

    clearTestHistory(storage);

    expect(loadTestHistory(storage)).toEqual([]);
    expect(storage.getItem("tactic-tester")).toBe("{\"version\":1}");
    expect(heard).toBe(1);
    stop();
    clearTestHistory(storage);
    expect(heard).toBe(1);
  });
});
