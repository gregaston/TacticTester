import { describe, expect, it } from "vitest";
import { decodeTactic, encodeTactic, loadTactic, saveTactic, type SavedTactic } from "./persist";

function memoryStorage() {
  const items = new Map<string, string>();
  return {
    items,
    getItem(key: string) {
      return items.get(key) ?? null;
    },
    setItem(key: string, value: string) {
      items.set(key, value);
    },
  };
}

function tactic(): SavedTactic {
  return {
    version: 1,
    players: [{ id: "st", x: 50, y: 86 }],
    templateId: null,
    freePlacement: false,
    setups: {
      st: { roleId: "poacher", duty: "attack" },
    },
    instructions: {
      passing: "more direct",
      tempo: "standard",
      width: "wider",
      defensiveLine: "higher",
      engagement: "standard",
      pressing: "more",
    },
  };
}

function base64Url(value: string): string {
  const bytes = new TextEncoder().encode(value);
  let binary = "";
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary).replaceAll("+", "-").replaceAll("/", "_").replaceAll("=", "");
}

describe("loadTactic", () => {
  it("saves the board, a role, and the instructions under tactic-tester", () => {
    const storage = memoryStorage();
    const saved = tactic();

    saveTactic(storage, saved);

    expect([...storage.items.keys()]).toEqual(["tactic-tester"]);
    expect(storage.items.get("tactic-tester")).toBe(JSON.stringify(saved));
    expect(loadTactic(storage)).toEqual(saved);
    expect(loadTactic(storage)?.setups.st).toEqual({ roleId: "poacher", duty: "attack" });
    expect(loadTactic(storage)?.instructions.passing).toBe("more direct");
  });

  it("returns null when the key is missing, the JSON is bad, or the version is not 1", () => {
    expect(loadTactic(memoryStorage())).toBeNull();

    const otherKey = memoryStorage();
    otherKey.setItem("tactics", JSON.stringify(tactic()));
    expect(loadTactic(otherKey)).toBeNull();

    const broken = memoryStorage();
    broken.setItem("tactic-tester", "{");
    expect(loadTactic(broken)).toBeNull();

    const stale = memoryStorage();
    stale.setItem("tactic-tester", JSON.stringify({ ...tactic(), version: 2 }));
    expect(loadTactic(stale)).toBeNull();

    const named = memoryStorage();
    named.setItem("tactic-tester", JSON.stringify({ ...tactic(), version: "1" }));
    expect(loadTactic(named)).toBeNull();
  });
});

describe("decodeTactic", () => {
  it("round-trips a tactic with a role and an instruction", () => {
    const saved = tactic();
    const json = JSON.stringify(saved);
    const hash = encodeTactic(saved);
    let binary = "";
    for (const byte of new TextEncoder().encode(json)) binary += String.fromCharCode(byte);

    expect(btoa(binary).endsWith("=")).toBe(true);
    expect(hash).toBe(`t=${base64Url(json)}`);
    expect(hash.endsWith("=")).toBe(false);
    expect(decodeTactic(hash)).toEqual(saved);
    expect(decodeTactic(`#${hash}`)).toEqual(saved);
    expect(decodeTactic(hash)?.setups.st).toEqual({ roleId: "poacher", duty: "attack" });
    expect(decodeTactic(`#${hash}`)?.instructions.pressing).toBe("more");
  });

  it("keeps mentality on the link and still opens a tactic saved before it existed", () => {
    const withMentality = tactic();
    withMentality.instructions.mentality = "attacking";
    withMentality.instructions.transition = "regroup";
    expect(decodeTactic(encodeTactic(withMentality))?.instructions.mentality).toBe("attacking");
    expect(decodeTactic(encodeTactic(withMentality))?.instructions.transition).toBe("regroup");

    const older = tactic();
    const loaded = decodeTactic(encodeTactic(older));
    expect(loaded?.instructions.passing).toBe("more direct");
    expect(loaded?.instructions.mentality).toBeUndefined();
  });

  it("rejects a hash that is not version 1", () => {
    const json = JSON.stringify({ ...tactic(), version: 2 });
    const payload = base64Url(json);

    expect(decodeTactic(`t=${payload}`)).toBeNull();
    expect(decodeTactic(`#t=${payload}`)).toBeNull();
    expect(decodeTactic("t=@@@")).toBeNull();
  });
});
