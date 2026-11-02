import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import "@fontsource/big-shoulders-text/latin-700";
import "@fontsource/big-shoulders-text/latin-800";
import "@fontsource/big-shoulders-text/latin-ext-700";
import "@fontsource/big-shoulders-text/latin-ext-800";
import "@fontsource/lora/latin-400";
import "@fontsource/lora/latin-700";
import "@fontsource/lora/latin-ext-400";
import "@fontsource/lora/latin-ext-700";
import { App } from "./App";
import { applyTheme, loadTheme } from "./ui/theme";

try {
  applyTheme(loadTheme(window.localStorage));
} catch {
  applyTheme("day");
}

const root = document.getElementById("root");
if (!root) throw new Error("Missing root element");

createRoot(root).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
