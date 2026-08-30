#!/usr/bin/env bun
/**
 * Fail when an `agents/*.md` persona's own "## Configuration read order and unset behavior"
 * section disagrees with its row in `docs/agents-config-matrix.md`.
 *
 * The two are independently hand-maintained, and a 2026-08 review found 12 of 24 agents had
 * drifted: a namespace the file actually reads but the matrix never lists (so a reader trusting
 * the matrix undercounts what the persona touches), or a namespace the matrix claims but the
 * file's own read-order section never mentions (so the matrix documents a config surface that
 * doesn't back it up, or -- as happened for `staff-engineer`'s `policies.review` -- names a
 * namespace that actually belongs to a *different* agent per that key's real schema fields).
 * Nothing else in `bun run check` reads prose content across these two files, so this drift
 * went undetected until someone manually cross-referenced 24 files by hand.
 *
 * Heuristic, not exact: extracts backtick-quoted tokens inside `**bold**` spans from each file's
 * read-order section (the house style for naming a config key there), takes each token's base
 * segment before the first `.`, and checks that base segment appears somewhere in the matrix
 * row's combined "namespaces" + "prompts/policies" column text for that agent, and vice versa.
 * A token that legitimately isn't a config namespace (a file path, an env var, a bolded label in
 * an unrelated bullet) is filtered by the extraction pattern requiring both backticks AND bold --
 * verified against all 24 files before this script was written; see the commit that added it.
 *
 * `--strict` (wired into `bun run check`) exits 1 on any drift. Plain invocation reports and
 * exits 0, for a quick local look without blocking on it.
 *
 * Usage:
 *   bun run scripts/check-agent-config-matrix.ts
 *   bun run scripts/check-agent-config-matrix.ts --strict
 */
import { readdirSync, readFileSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const agentsDir = join(root, "agents");
const matrixPath = join(root, "docs", "agents-config-matrix.md");
const strict = process.argv.includes("--strict");

/** Env vars and file paths that look like backtick+bold tokens but aren't config namespaces
 * to reconcile against the matrix's "config namespace" framing. */
const NON_NAMESPACE = /^[A-Z_]+$/; // e.g. JSTACK_EVAL_COVERAGE_MIN
const FILE_PATH_LIKE = /\.(json|md)$|^config\/|^prompts\//;

/** Extracts the "## Configuration read order and unset behavior" section body (up to the next
 * `## ` heading, or end of file). */
function extractReadOrderSection(body: string): string {
  const start = body.indexOf("## Configuration read order");
  if (start === -1) return "";
  const rest = body.slice(start + 1);
  const nextHeading = rest.indexOf("\n## ");
  return nextHeading === -1 ? rest : rest.slice(0, nextHeading);
}

/** Backtick-quoted token(s) inside a `**bold**` span, e.g. `**\`a\` / \`b\`**` -> ["a", "b"]. */
const BOLD_BACKTICK_RE = /\*\*(`[^`]+`(?:\s*[/,]\s*`[^`]+`)*)\*\*/g;
const BACKTICK_TOKEN_RE = /`([^`]+)`/g;

function extractNamespaceTokens(section: string): Set<string> {
  const bases = new Set<string>();
  for (const boldMatch of section.matchAll(BOLD_BACKTICK_RE)) {
    for (const tokenMatch of boldMatch[1].matchAll(BACKTICK_TOKEN_RE)) {
      const token = tokenMatch[1];
      if (NON_NAMESPACE.test(token) || FILE_PATH_LIKE.test(token)) continue;
      const base = token.replace(/^\./, "").split(".")[0];
      if (base && /^[a-zA-Z_]/.test(base)) bases.add(base);
    }
  }
  return bases;
}

/** The matrix row uses plain backtick-quoted namespaces with no surrounding `**bold**` (unlike
 * the agent files' read-order section) -- so this extracts every backtick token directly,
 * rather than requiring the bold wrapper `extractNamespaceTokens` looks for. */
function extractMatrixTokens(row: string): Set<string> {
  const bases = new Set<string>();
  for (const tokenMatch of row.matchAll(BACKTICK_TOKEN_RE)) {
    const token = tokenMatch[1];
    if (NON_NAMESPACE.test(token) || FILE_PATH_LIKE.test(token)) continue;
    const base = token.replace(/^\./, "").split(".")[0];
    if (base && /^[a-zA-Z_]/.test(base)) bases.add(base);
  }
  return bases;
}

type MatrixRow = {
  /** Column 2 ("Primary config namespaces") alone -- the only column whose tokens are
   * comparable to the file's read-order namespaces. Column 3 ("Key prompts / policies")
   * legitimately names prompt files and other agents by their bare name (e.g.
   * `report-generator`, `skill-conventions`), which the read-order section has no reason to
   * mention, so it is used for the forward (file -> row) check only, never the reverse. */
  namespaceCol: string;
  fullText: string;
};

/** Parses `| \`agent-id\` | col2 | col3 | col4 |` rows. */
function parseMatrixRows(md: string): Map<string, MatrixRow> {
  const rows = new Map<string, MatrixRow>();
  for (const line of md.split("\n")) {
    const m = line.match(/^\|\s*`([a-z0-9-]+)`\s*\|(.+)\|(.+)\|(.+)\|\s*$/);
    if (!m) continue;
    rows.set(m[1], { namespaceCol: m[2], fullText: `${m[2]} ${m[3]}` });
  }
  return rows;
}

const matrixRows = parseMatrixRows(readFileSync(matrixPath, "utf8"));
const errors: string[] = [];
let checked = 0;

for (const file of readdirSync(agentsDir).sort()) {
  if (!file.endsWith(".md")) continue;
  const agentId = file.replace(/\.md$/, "");
  const body = readFileSync(join(agentsDir, file), "utf8");
  const section = extractReadOrderSection(body);
  if (!section) continue; // no read-order section to check (not every agent needs one)

  const row = matrixRows.get(agentId);
  if (row === undefined) {
    errors.push(
      `${file}: has a Configuration read order section but no row in ${matrixPath}`,
    );
    continue;
  }
  checked++;

  const fileBases = extractNamespaceTokens(section);
  const rowLower = row.fullText.toLowerCase();
  for (const base of fileBases) {
    if (!rowLower.includes(base.toLowerCase())) {
      errors.push(
        `${file}: reads \`${base}\` in its own read-order section, but the matrix row for \`${agentId}\` never mentions it`,
      );
    }
  }

  const rowBases = extractMatrixTokens(row.namespaceCol);
  const sectionLower = section.toLowerCase();
  for (const base of rowBases) {
    if (!sectionLower.includes(base.toLowerCase())) {
      errors.push(
        `${file}: the matrix row for \`${agentId}\` names \`${base}\`, but the file's own read-order section never mentions it`,
      );
    }
  }
}

if (errors.length > 0) {
  console.error(
    `check-agent-config-matrix found ${errors.length} drift issue(s):\n`,
  );
  for (const e of errors) console.error(`  - ${e}`);
  console.error(
    `\nReconcile docs/agents-config-matrix.md against each named agent file.`,
  );
  if (strict) process.exit(1);
} else {
  console.log(
    `check-agent-config-matrix OK (${checked} agents cross-checked against the matrix)`,
  );
}
