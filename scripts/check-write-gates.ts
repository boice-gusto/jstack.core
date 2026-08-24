#!/usr/bin/env bun
/**
 * Enforce that every skill which mutates external state declares `disable-model-invocation: true`.
 *
 * Why a manifest and not a heuristic: I tried to derive the write set from body prose first and
 * measured it. Across the 48 gated and 89 ungated skills, the best candidate phrase reached 67%
 * precision on three samples, and most were near 50% — because skill bodies are generated from shared
 * templates, so "publish", "transition", and "mutate" appear at similar rates on both sides. A
 * low-precision gate produces noise and then gets ignored, so the signal has to be declared.
 *
 * What this buys over a one-time audit: adding a skill now forces a decision. A new skill that is
 * gated but absent from `WRITES` fails, and a skill listed in `WRITES` that loses its gate fails.
 * Neither can drift silently, which is how eight unguarded write skills reached main in the first
 * place — including `gusto-jira/working-with-jira-acli`, which documented six `--yes` bulk Jira
 * mutations with no gate while its own sibling was gated correctly.
 *
 * Usage: bun run scripts/check-write-gates.ts [--json]
 */
import { readFileSync, existsSync } from "node:fs";
import { join, dirname, relative } from "node:path";
import { fileURLToPath } from "node:url";
import { discoverAllSkillRelativePaths } from "../evals/discover.js";
import { isWriteGated, parseYamlFrontmatter } from "./lib/parse-frontmatter.js";

// `JSTACK_CHECK_ROOT` lets a test point this gate at a synthetic fixture tree. Production runs
// never set it, so behaviour is unchanged; without it these gates could only be verified by
// mutating the real repo, which is how earlier verification work destroyed uncommitted files.
const root =
  process.env.JSTACK_CHECK_ROOT ??
  join(dirname(fileURLToPath(import.meta.url)), "..");
const skillsRoot = join(root, "skills");
const asJson = process.argv.includes("--json");

/**
 * Skills that mutate state outside this repo — an external system (Jira, Notion, Slack, GitHub,
 * Google), a durable store (gbrain), a live machine, or the user's own config. Every entry here MUST
 * carry `disable-model-invocation: true` so Claude cannot trigger it from conversational context.
 *
 * Adding a skill that writes? Add it here in the same change. Deliberately alphabetical, not grouped,
 * so a diff shows exactly one line per decision.
 */
const WRITES = new Set<string>([
  // Comms: drafts only, but gated by policy — an announcement Claude decides to send on its own is
  // the failure mode, so the draft step is user-invoked too.
  "announcements",
  "meetings/post-slack",
  // Live machine / sandbox control.
  "computer-use/cua",
  // Jira writes. NOTE: `jira/intake` is deliberately absent — it converts text into Jira-ready fields
  // and its own Out-of-scope says "Filing the issue — hand off to jstack:jira-create".
  "jira/append",
  "jira/create",
  "jira/notify",
  "jira/transition",
  "jira/update",
  // Durable knowledge stores (gbrain / Notion).
  "knowledge/ingest-all",
  "knowledge/intake",
  "knowledge/process",
  "knowledge/self-knowledge",
  "knowledge/team-knowledge",
  "meetings/notion-highlights",
  "meetings/one-on-one-transcript",
  "meetings/store-note/personal",
  "meetings/store-note/team",
  "meetings/transcripts-ingest",
  "self/brag",
  "self/diary",
  "self/impact-prep",
  "self/remember",
  "session/end",
  // Notion page writes.
  "notion/adr",
  "notion/article",
  "notion/one-on-one",
  "notion/performance",
  "notion/planning",
  "notion/project",
  "notion/report",
  "notion/setup",
  "notion/sprint",
  "notion/standup",
  "notion/team-note",
  "notion/team-report",
  "notion/update",
  // Repo / config / artifact writes.
  "plugin",
  "reports/eval-report",
  "reports/report-design",
  "reports/share-html-publish",
  "routines/sprint-close",
  "scaffold",
  "setup/onboarding",
  "skill-creator",
  "update-config",
  "sprint/planning",
  "sprint/refinement",
  "engineering/silo-scan",
  // Workflow definitions and browser execution.
  "workflows/builder",
  "workflows/execute",
  "workflows/recorder",
  // Background Slack agents — can post as the user when switched to live mode.
  "crew",
]);

/**
 * Skills whose write behaviour is UNDECIDED and awaiting an owner call.
 *
 * These describe conditional writes ("suggest sprint scope, not a silent bulk edit"; "read-only
 * unless user approves comments") where it is genuinely unclear from the body whether the skill calls
 * a write tool or only renders a proposal for a human. Listing them keeps the question visible
 * instead of letting an ambiguous skill sit un-gated and unexamined. Resolve each by moving it into
 * `WRITES` or deleting the line.
 */
const UNDECIDED = new Map<string, string>([
  // Empty. The three former entries (sprint/planning, sprint/refinement, engineering/silo-scan) were
  // resolved INTO `WRITES`: each declares in its own Out-of-scope clause that the write is in scope
  // with confirmation ("Bulk-moving Jira issues ... without user confirmation", "Posting comments ...
  // without explicit user approval"). Core skills never name an `mcp__*` tool by design, so tool
  // references cannot discriminate here — the declared behaviour is the evidence. `jira/update` set
  // the precedent: confirm-gated and flagged, because the flag stops Claude auto-triggering while the
  // confirmation stops acting without the user.
]);

interface Row {
  rel: string;
  gated: boolean;
  forked: boolean;
}

const rows: Row[] = [];
for (const rel of discoverAllSkillRelativePaths(skillsRoot)) {
  const abs = join(skillsRoot, rel, "SKILL.md");
  const raw = readFileSync(abs, "utf8");
  const { meta, error, frontmatterText } = parseYamlFrontmatter(raw);
  if (frontmatterText === undefined) continue; // no --- delimiters at all
  if (!error) {
    rows.push({
      rel,
      gated: isWriteGated(meta),
      forked: meta["agent"] === "Explore",
    });
  } else {
    // Malformed YAML elsewhere in the frontmatter must not hide a real gate/fork declaration
    // from this security-relevant check -- fall back to literal text matching on the raw
    // frontmatter block, same as this file always did before adopting the shared parser.
    rows.push({
      rel,
      gated: /^disable-model-invocation:\s*true\s*$/m.test(frontmatterText),
      forked: /^agent:\s*Explore\s*$/m.test(frontmatterText),
    });
  }
}

const errors: string[] = [];
const byRel = new Map(rows.map((r) => [r.rel, r]));

// 1. Declared writer without the gate.
for (const w of WRITES) {
  const r = byRel.get(w);
  if (!r) {
    errors.push(
      `WRITES lists "${w}" but skills/${w}/SKILL.md does not exist — stale manifest entry.`,
    );
    continue;
  }
  if (!r.gated) {
    errors.push(
      `skills/${w} mutates external state but is missing 'disable-model-invocation: true' — ` +
        `Claude can auto-trigger it from conversation.`,
    );
  }
  // `agent: Explore` has no Write or Edit tool, so a write skill running under it cannot do its job.
  // Three knowledge skills shipped in exactly that state.
  if (r.forked) {
    errors.push(
      `skills/${w} writes but declares 'agent: Explore', which has no Write/Edit tool — the write ` +
        `would fail at runtime. Remove the forked read-only agent.`,
    );
  }
}

// 2. Gated but undeclared — either a real writer missing from the manifest, or over-gating that
//    removes a harmless skill's description from context for no reason.
for (const r of rows) {
  if (!r.gated) continue;
  if (WRITES.has(r.rel) || UNDECIDED.has(r.rel)) continue;
  errors.push(
    `skills/${r.rel} is gated with 'disable-model-invocation: true' but is not in the WRITES manifest. ` +
      `If it writes, add it to WRITES in scripts/check-write-gates.ts. If it does not, remove the gate — ` +
      `gating a read-only skill hides its description from Claude for no benefit.`,
  );
}

// 3. Undecided entries must still exist, so the question cannot be lost to a rename.
for (const [u, why] of UNDECIDED) {
  if (!byRel.has(u))
    errors.push(`UNDECIDED lists "${u}" which no longer exists (${why}).`);
}

if (asJson) {
  console.log(
    JSON.stringify(
      {
        ok: errors.length === 0,
        skills: rows.length,
        declared_writes: WRITES.size,
        undecided: UNDECIDED.size,
        errors,
      },
      null,
      2,
    ),
  );
  process.exit(errors.length === 0 ? 0 : 1);
}

if (errors.length > 0) {
  console.error(`check-write-gates FAILED — ${errors.length} issue(s):\n`);
  for (const e of errors) console.error(`  ${e}`);
  process.exit(1);
}
console.log(
  `check-write-gates OK (${rows.length} skills; ${WRITES.size} declared writers all gated; ` +
    `${UNDECIDED.size} awaiting an owner decision)`,
);
if (UNDECIDED.size > 0) {
  for (const [u, why] of UNDECIDED) console.log(`  undecided: ${u} — ${why}`);
}
void existsSync;
void relative;
