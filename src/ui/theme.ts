/** Device preference. It is not part of a shared tactic. */
export const THEME_KEY = "tactictester.theme";

export type ThemeName = "day" | "night";

export type ThemeStorage = {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
};

const THEME_COLOR: Record<ThemeName, string> = {
  day: "#1d0a30",
  night: "#000000",
};

export function loadTheme(storage: ThemeStorage): ThemeName {
  return storage.getItem(THEME_KEY) === "night" ? "night" : "day";
}

export function saveTheme(theme: ThemeName, storage: ThemeStorage): void {
  storage.setItem(THEME_KEY, theme);
}

export function applyTheme(theme: ThemeName): void {
  document.documentElement.dataset.theme = theme;
  document.querySelector('meta[name="theme-color"]')?.setAttribute("content", THEME_COLOR[theme]);
}
