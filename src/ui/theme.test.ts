import { describe, expect, it } from "vitest";
import { loadTheme, saveTheme, THEME_KEY } from "./theme";

function memoryStorage() {
  const items = new Map<string, string>();
  return {
    getItem(key: string) {
      return items.get(key) ?? null;
    },
    setItem(key: string, value: string) {
      items.set(key, value);
    },
  };
}

describe("theme", () => {
  it("starts on day and keeps night on this device", () => {
    const storage = memoryStorage();
    expect(loadTheme(storage)).toBe("day");
    storage.setItem(THEME_KEY, "later");
    expect(loadTheme(storage)).toBe("day");
    saveTheme("night", storage);
    expect(loadTheme(storage)).toBe("night");
    saveTheme("day", storage);
    expect(storage.getItem(THEME_KEY)).toBe("day");
  });
});
