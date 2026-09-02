import React from "react";
import ReactDOM from "react-dom/client";
import "./index.css";
import App from "./App";
import {
  applyTheme,
  applyThemeMode,
  loadStoredThemeId,
  loadStoredThemeMode,
  watchSystemThemeMode,
} from "./lib/theme";

// Applied before the first render, not inside App's effects, so there's no flash of the
// default accent color/light-vs-dark while React mounts.
applyTheme(loadStoredThemeId());
applyThemeMode(loadStoredThemeMode());
watchSystemThemeMode();

ReactDOM.createRoot(document.getElementById("root") as HTMLElement).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
);
