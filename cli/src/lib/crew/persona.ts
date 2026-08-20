import { existsSync, readFileSync } from "node:fs";
import { isAbsolute, join } from "node:path";
import { expandHome } from "./store.js";
import type { AgentConfig } from "./types.js";

/**
 * The "soul file" convention: an agent's persona can live in a markdown file at the root of
 * its own workspace instead of (or as well as) the inline `persona` string in config. This
 * keeps a long, hand-written persona out of `jstack.config.json` and versioned alongside the
 * agent's own repo, where it can be reviewed and diffed like any other document.
 *
 * Convention: `SOUL.md`. `crew agents add --persona-file SOUL.md` (or any other filename,
 * or an absolute path) writes the reference; nothing requires the file to already exist at
 * add-time, but it must exist by the time the agent actually runs.
 */
export const SOUL_FILE_NAME = "SOUL.md";

/**
 * Resolve the persona text runWorker() should use.
 *
 * Precedence: `persona_file`, when set, wins outright -- its file content becomes the
 * persona and the inline `persona` string is ignored, even if both are set. `persona_file`
 * unset falls back to the inline `persona` string (which itself defaults to `""`).
 *
 * A `persona_file` that is set but unreadable throws rather than resolving to `""`. Silently
 * falling back would make a typo'd path indistinguishable from "no persona configured",
 * which is a worse failure than refusing to run: the agent would answer with the wrong
 * personality and nothing would say so.
 */
export function resolvePersona(
  agent: Pick<AgentConfig, "persona" | "persona_file" | "workspace">,
): string {
  if (!agent.persona_file) return agent.persona;

  const path = isAbsolute(agent.persona_file)
    ? expandHome(agent.persona_file)
    : join(expandHome(agent.workspace), agent.persona_file);

  if (!existsSync(path)) {
    throw new Error(
      `persona_file "${agent.persona_file}" not found at ${path} ` +
        `(resolved against workspace "${agent.workspace}")`,
    );
  }

  return readFileSync(path, "utf8").trim();
}
