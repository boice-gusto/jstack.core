/**
 * Canonical filesystem and layout literals for jstack.core and consumers.
 * Prefer importing from here instead of duplicating raw strings.
 */

export const JSTACK_CONFIG_FILE = "jstack.config.json" as const;

export const CONFIG_DIR = "config" as const;

export const DEFAULTS_FILE = "defaults.json" as const;

export const SKILLS_DIR = "skills" as const;

/** Nested package dir when resolving plugin root inside a monorepo checkout. */
export const JSTACK_CORE_PKG_DIR = "jstack.core" as const;

export const JSTACK_GUSTO_PKG_DIR = "jstack.gusto" as const;

export const ENCODING_UTF8 = "utf8" as const;

export const ENV = {
  CLAUDE_PLUGIN_ROOT: "CLAUDE_PLUGIN_ROOT",
} as const;

/** Max parent-directory steps when walking the tree. */
export const WALK_LIMITS = {
  /** findProjectRoot / config discovery from cwd */
  PROJECT_ROOT_MAX_STEPS: 20,
  /** findPluginRoot (deeper monorepos / overlays) */
  PLUGIN_ROOT_MAX_STEPS: 30,
} as const;

export const TELEMETRY_CLI = {
  ACTIONS: {
    STATUS: "status",
    RESET: "reset",
    FLUSH: "flush",
    TEST: "test",
  },
  USAGE_LINE: "usage: bun telemetry/cli.ts status|flush|reset|test",
} as const;

/** Default raw URL for distribution VERSION when `distribution.version_url` is unset. */
export const DISTRIBUTION_VERSION_DEFAULT_URL =
  "https://raw.githubusercontent.com/gusto/jstack.core/main/VERSION" as const;

export type TelemetryCliAction =
  (typeof TELEMETRY_CLI.ACTIONS)[keyof typeof TELEMETRY_CLI.ACTIONS];
