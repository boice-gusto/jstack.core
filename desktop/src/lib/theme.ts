/**
 * Accent-color theming. Overrides the same CSS custom properties shadcn's `--primary`/`--ring`
 * tokens already resolve to (see index.css's `:root` block) rather than swapping in a second
 * theme system, so every existing component that uses `bg-primary`/`ring-primary`/etc. picks up
 * the change for free. Persisted in localStorage, applied as early as possible (before React
 * renders, from main.tsx) so there's no flash of the default color on launch.
 */

export interface ThemeColor {
  id: string;
  name: string;
  /** Undefined for "default": that swatch means "no accent override" -- :root/.dark already
   * define a correct primary+foreground pair for each mode on their own, and a light-mode-shaped
   * fixed value here would stomp dark mode's (or vice versa). Real bug found this way: "default"
   * used to hardcode the *light-mode* near-black primary as an inline override, which also won in
   * dark mode (inline styles beat the .dark class), while --primary-foreground stayed at dark
   * mode's near-black -- producing a near-invisible dark-icon-on-dark-button Send button. */
  primary?: string;
  ring?: string;
  /** Foreground color for content sitting on `primary` (button/icon text). Only meaningful
   * alongside `primary`/`ring` -- see the note above. */
  foreground?: string;
  /** Display-only color for the picker swatch itself in SettingsDialog -- independent of
   * `primary` since "default" has no fixed `primary` (it's mode-dependent), but the swatch still
   * needs *some* fixed color to render as a clickable dot in the picker. */
  swatch: string;
}

const WHITE = "oklch(0.985 0 0)";
const BLACK = "oklch(0.205 0 0)";

export const THEME_COLORS: ThemeColor[] = [
  { id: "default", name: "Graphite", swatch: "oklch(0.5 0 0)" },
  { id: "blue", name: "Blue", primary: "oklch(0.55 0.18 260)", ring: "oklch(0.72 0.12 260)", foreground: WHITE, swatch: "oklch(0.55 0.18 260)" },
  { id: "green", name: "Green", primary: "oklch(0.55 0.15 150)", ring: "oklch(0.74 0.12 150)", foreground: WHITE, swatch: "oklch(0.55 0.15 150)" },
  { id: "orange", name: "Orange", primary: "oklch(0.68 0.17 55)", ring: "oklch(0.8 0.12 55)", foreground: BLACK, swatch: "oklch(0.68 0.17 55)" },
  { id: "purple", name: "Purple", primary: "oklch(0.5 0.2 300)", ring: "oklch(0.74 0.12 300)", foreground: WHITE, swatch: "oklch(0.5 0.2 300)" },
  { id: "pink", name: "Pink", primary: "oklch(0.62 0.2 340)", ring: "oklch(0.8 0.12 340)", foreground: BLACK, swatch: "oklch(0.62 0.2 340)" },
];

const THEME_KEY = "jstack.themeColor";

export function loadStoredThemeId(): string {
  const id = localStorage.getItem(THEME_KEY);
  return THEME_COLORS.some((t) => t.id === id) ? id! : "default";
}

export function applyTheme(id: string): void {
  const theme = THEME_COLORS.find((t) => t.id === id) ?? THEME_COLORS[0]!;
  const root = document.documentElement.style;
  const props = [
    ["--primary", theme.primary],
    ["--ring", theme.ring],
    ["--sidebar-primary", theme.primary],
    ["--sidebar-ring", theme.ring],
    ["--primary-foreground", theme.foreground],
    ["--sidebar-primary-foreground", theme.foreground],
  ] as const;
  for (const [prop, value] of props) {
    if (value) root.setProperty(prop, value);
    else root.removeProperty(prop);
  }
}

export function setStoredThemeId(id: string): void {
  localStorage.setItem(THEME_KEY, id);
  applyTheme(id);
}

/**
 * Appearance mode -- Light/Dark/System. A separate axis from the accent color above: this
 * toggles the `.dark` class that index.css's `:root`/`.dark` blocks already define full palettes
 * for (they just were never wired to anything before now). "System" follows the OS setting live
 * via matchMedia, same as any other app's "match system" option.
 */
export type ThemeMode = "light" | "dark" | "system";

const MODE_KEY = "jstack.themeMode";

export function loadStoredThemeMode(): ThemeMode {
  const mode = localStorage.getItem(MODE_KEY);
  return mode === "light" || mode === "dark" || mode === "system" ? mode : "system";
}

function systemPrefersDark(): boolean {
  return window.matchMedia?.("(prefers-color-scheme: dark)").matches ?? false;
}

export function applyThemeMode(mode: ThemeMode): void {
  const isDark = mode === "system" ? systemPrefersDark() : mode === "dark";
  document.documentElement.classList.toggle("dark", isDark);
}

export function setStoredThemeMode(mode: ThemeMode): void {
  localStorage.setItem(MODE_KEY, mode);
  applyThemeMode(mode);
}

/** Called once at startup (see main.tsx) so "System" stays in sync if the OS theme changes
 * while the app is open, not just at launch. */
export function watchSystemThemeMode(): () => void {
  const mq = window.matchMedia?.("(prefers-color-scheme: dark)");
  if (!mq) return () => {};
  const onChange = () => {
    if (loadStoredThemeMode() === "system") applyThemeMode("system");
  };
  mq.addEventListener("change", onChange);
  return () => mq.removeEventListener("change", onChange);
}
