/**
 * Shared `---\n...\n---\n` YAML frontmatter extraction.
 *
 * Three call sites (`agents-depth-check.ts`, `skills-depth-check.ts`,
 * `generate-skill-evals.ts`) each hand-rolled the same "match the delimiters, `yaml.load`
 * the block" logic, and each reacted differently to a parse failure — one dropped the file
 * silently mid-loop, one flagged it and still ran a line-based fallback, and one swallowed
 * the error entirely and returned `{}` with zero indication anything went wrong. That last
 * shape is the same silent-failure pattern that once cost 27 of 137 skill files their
 * frontmatter (an unquoted `: ` inside a description made `yaml.safe_load` return an empty
 * mapping) — see the comment in `skills-depth-check.ts`'s catch block.
 *
 * This module only extracts and classifies; it does not decide what a caller should do
 * about a failure. Each caller keeps its own policy for `error` (skip the file, fall back
 * to a line-based parse, warn and continue, etc.) — see the call sites for their reasoning.
 *
 * NOTE: `scripts/docs-data-shared.ts` has its own, deliberately different `parseFrontmatter`
 * (line-based, fixed 4-key, used for display text). That one is unrelated and must not be
 * merged into this one.
 */
import yaml from "js-yaml";

/**
 * The three real outcomes of parsing frontmatter, as a tag instead of two optional fields a
 * caller had to re-derive the same "which state is this" mapping from (no `---` delimiters at
 * all vs. delimiters present but invalid YAML vs. valid) — see the module comment above for the
 * bug class that ambiguity already caused once.
 */
export type ParsedFrontmatter =
  | { status: "missing"; body: string }
  | { status: "invalid"; body: string; frontmatterText: string; error: string }
  | {
      status: "ok";
      body: string;
      frontmatterText: string;
      meta: Record<string, unknown>;
    };

/** True when a skill's frontmatter declares `disable-model-invocation: true` -- the flag that
 * stops Claude from auto-triggering a write/operational skill from conversation. Shared so
 * every caller tests the same field the same way (check-write-gates.ts,
 * scripts/lib/skill-eval-facts.ts previously each had their own copy of this check). */
export function isWriteGated(meta: Record<string, unknown>): boolean {
  return meta["disable-model-invocation"] === true;
}

/** Parses `---\n...\n---\n` delimited YAML frontmatter from the top of a file's contents. */
export function parseYamlFrontmatter(raw: string): ParsedFrontmatter {
  const fm = raw.match(/^---\n([\s\S]*?)\n---\n/);
  if (!fm) {
    return { status: "missing", body: raw };
  }
  const body = raw.slice(fm[0].length);
  const frontmatterText = fm[1] ?? "";
  try {
    const meta = (yaml.load(frontmatterText) ?? {}) as Record<string, unknown>;
    return { status: "ok", meta, body, frontmatterText };
  } catch (err) {
    return {
      status: "invalid",
      body,
      frontmatterText,
      error: err instanceof Error ? err.message : String(err),
    };
  }
}
