import { readFileSync } from "node:fs";
import { join } from "node:path";
import { findPluginRoot } from "../config.js";
import { TtlCache, ttlMsFromEnv } from "../ttl-cache.js";

/**
 * Loads system-prompt templates from `prompts/crew/*.md` (a sibling of `skills/`, same file
 * the rest of this repo already keeps prompt content in) instead of inline TypeScript string
 * literals -- "all prompts should be in a markdown file and not inline in code," from the
 * backlog. Cached per relative path with the same TtlCache/env-override pattern skills/index
 * uses, since re-reading a static file off disk on every worker turn is exactly the kind of IO
 * that pattern exists to avoid.
 */
const PROMPT_CACHE_TTL_ENV = "JSTACK_PROMPT_CACHE_TTL_MINUTES";
const PROMPT_CACHE_TTL_DEFAULT_MINUTES = 5;

const templateCaches = new Map<string, TtlCache<string>>();

function loadTemplate(relPath: string): string {
  // Keyed on (pluginRoot, relPath), not just relPath -- otherwise a cache warmed against one
  // plugin root would keep answering with stale content after CLAUDE_PLUGIN_ROOT/cwd changes
  // (only realistic in tests today, since a real daemon's plugin root never moves mid-process,
  // but keying on the actual inputs rather than assuming that stays honest if it ever does).
  const pluginRoot = findPluginRoot();
  const key = `${pluginRoot}::${relPath}`;
  let cache = templateCaches.get(key);
  if (!cache) {
    cache = new TtlCache(
      () => readFileSync(join(pluginRoot, "prompts", relPath), "utf8"),
      ttlMsFromEnv(PROMPT_CACHE_TTL_ENV, PROMPT_CACHE_TTL_DEFAULT_MINUTES),
    );
    templateCaches.set(key, cache);
  }
  return cache.get();
}

/** `{{KEY}}` -> `vars.KEY`, or "" for a placeholder with no matching var -- a missing var
 * silently disappearing (rather than throwing) matches how the policy-doc `!cat` templates
 * elsewhere in this repo already behave when injected verbatim. */
function fillTemplate(template: string, vars: Record<string, string>): string {
  return template.replace(
    /\{\{(\w+)\}\}/g,
    (_match, key: string) => vars[key] ?? "",
  );
}

export function renderWorkerSystemPrompt(vars: {
  agentName: string;
  /** Empty string for no persona, or the persona text WITH a trailing space -- callers own this
   * formatting decision (whether/how a persona clause is separated from the next sentence),
   * this function only substitutes it in verbatim. */
  personaClause: string;
  nonce: string;
  maxMessageChars: number;
}): string {
  const template = loadTemplate("crew/worker-system.md");
  return fillTemplate(template, {
    AGENT_NAME: vars.agentName,
    PERSONA_CLAUSE: vars.personaClause,
    NONCE: vars.nonce,
    MAX_MESSAGE_CHARS: String(vars.maxMessageChars),
  }).trim();
}
