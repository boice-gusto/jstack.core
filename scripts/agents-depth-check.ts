#!/usr/bin/env bun
/**
 * Agent quality gate — the pressure test `agents-check.ts` cannot do.
 *
 * `agents-check.ts` proves an agent file PARSES and that its `jstack:*` tokens resolve.
 * It cannot tell a domain expert from generic filler: an agent whose entire expertise is
 * "prefer existing components and flag accessibility gaps" passes it cleanly.
 *
 * This adds two things:
 *
 *   CORRECTNESS (always fatal) — frontmatter keys restricted to what plugin-shipped agents
 *   actually support, valid `name`/`model`, required house sections, and no fabricated
 *   organization data.
 *
 *   DEPTH (advisory by default, fatal under --strict) — the signals that separate a
 *   specialist from a router: absolute directives, applicable thresholds, named
 *   anti-patterns, worked examples, and an explicit ownership boundary so dispatch between
 *   neighbouring agents stays unambiguous.
 *
 * Run `--strict` once every agent is upgraded, then wire that into `check`.
 */
import { readFileSync, readdirSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import yaml from "js-yaml";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const agentsDir = join(root, "agents");
const strict = process.argv.includes("--strict");
const asJson = process.argv.includes("--json");

/**
 * Plugin-shipped agents support a narrower set than personal/project agents:
 * `hooks`, `mcpServers`, and `permissionMode` are rejected for plugin agents, so
 * declaring them here is silently inert and misleading.
 */
const ALLOWED_KEYS = new Set([
  "name",
  "description",
  "model",
  "effort",
  "maxTurns",
  "tools",
  "disallowedTools",
  "skills",
  "memory",
  "background",
  "isolation",
  "color",
]);
const FORBIDDEN_KEYS = new Set(["hooks", "mcpServers", "permissionMode"]);

const VALID_MODELS = new Set(["inherit", "opus", "sonnet", "haiku", "fable"]);
const VALID_EFFORT = new Set(["low", "medium", "high", "xhigh", "max"]);

const REQUIRED_SECTIONS = [
  "## Role",
  "## Specialty",
  "## Configuration read order and unset behavior",
  "## Evidence chain (internal)",
  "## Failure modes",
];

/** Fabricated org data previously shipped into prompts; must never come back. */
const FICTION = [
  /\bAcme\b/,
  /\bContoso\b/,
  /\bCompetitor X\b/,
  /SOC2 audit in \w+/i,
  /\bFoo Corp\b/,
  /\bLorem ipsum\b/i,
];

/** Depth signal → how to satisfy it. */
interface DepthRule {
  id: string;
  test: (body: string) => boolean;
  hint: string;
}

const DEPTH_RULES: DepthRule[] = [
  {
    id: "prime-directives",
    test: (b) => /^##+ .*(Prime Directives|Non-negotiables)/im.test(b),
    hint: "add a '## Prime Directives' section: numbered, absolute rules naming concrete failure conditions",
  },
  {
    id: "thresholds",
    // A specialist states applicable numbers (budgets, ratios, limits), not just adjectives.
    test: (b) => {
      // Trailing \b must NOT be applied to non-word-character units: `%\b` and `:1\b`
      // can never match, which previously undercounted agents whose thresholds are
      // percentages or contrast ratios. Split word-units from symbol-units.
      const wordUnits =
        b.match(
          /\b\d+(\.\d+)?\s*(ms|kb|mb|gb|px|rows?|req|rps|qps|days?|chars?|nodes?|items?|lines?|words?|steps?|attempts?|workers?|s)\b/gi,
        ) ?? [];
      const symbolUnits = b.match(/\b\d+(\.\d+)?\s*(%|:1|×|x(?=\s|$))/gi) ?? [];
      // A comparison against a number is itself a threshold, unit or not — orchestration and
      // review domains express limits as counts (≤3 retries, >400 LOC) rather than units.
      const comparisons = b.match(/[<>≤≥]=?\s*\d+/g) ?? [];
      return wordUnits.length + symbolUnits.length + comparisons.length >= 3;
    },
    hint: "state applicable thresholds with units (e.g. 200ms, 4.5:1, 250KB) — a reviewer must be able to judge, not just opine",
  },
  {
    id: "anti-patterns",
    test: (b) => /^##+ .*(Anti-pattern|Antipattern)/im.test(b),
    hint: "add a named anti-patterns table: anti-pattern | why it's wrong | what to do instead",
  },
  {
    id: "worked-examples",
    // The window has to be generous: a thorough weak-example block (numbered steps plus a
    // "why this is wrong" paragraph) easily runs past 400 chars before the sharp version
    // appears. A tight window perversely penalised the most detailed examples.
    test: (b) =>
      /^##+ .*(Worked example|Examples?)\b/im.test(b) &&
      /(weak|bad|vague|before)\b[\s\S]{0,2000}?(sharp|good|better|after)\b/i.test(
        b,
      ),
    hint: "add worked examples contrasting a weak finding with a sharp one (name the mechanism and the fix)",
  },
  {
    id: "ownership-boundary",
    test: (b) =>
      /does\s+NOT\s+own|not\s+own\b|out of scope for this agent/i.test(b),
    hint: "declare what this agent does NOT own, naming the neighbouring agents, so dispatch is unambiguous",
  },
  {
    id: "determinism",
    test: (b) => /determinis|reproducib|idempoten/i.test(b),
    hint: "state how to make this agent's tool calls deterministic/reproducible (machine-readable output, read-before-write, idempotent calls)",
  },
  {
    id: "substance",
    test: (b) => b.split("\n").length >= 110,
    hint: "body is short for a specialist — real domain depth needs room (>=110 lines)",
  },
];

interface Finding {
  file: string;
  kind: "correctness" | "depth" | "dispatch";
  id: string;
  message: string;
}

const findings: Finding[] = [];
const files = readdirSync(agentsDir)
  .filter((f) => f.endsWith(".md"))
  .sort();
if (files.length === 0) {
  console.error("No agents found in agents/");
  process.exit(1);
}

const descriptions = new Map<string, string>();
const depthScores = new Map<string, number>();

for (const file of files) {
  const raw = readFileSync(join(agentsDir, file), "utf8");
  const fm = raw.match(/^---\n([\s\S]*?)\n---\n/);
  if (!fm) {
    findings.push({
      file,
      kind: "correctness",
      id: "frontmatter",
      message: "missing YAML frontmatter",
    });
    continue;
  }
  const body = raw.slice(fm[0].length);

  let meta: Record<string, unknown>;
  try {
    meta = (yaml.load(fm[1]) ?? {}) as Record<string, unknown>;
  } catch (err) {
    findings.push({
      file,
      kind: "correctness",
      id: "frontmatter",
      message: `invalid YAML: ${err instanceof Error ? err.message : String(err)}`,
    });
    continue;
  }

  // --- correctness ---
  for (const key of Object.keys(meta)) {
    if (FORBIDDEN_KEYS.has(key)) {
      findings.push({
        file,
        kind: "correctness",
        id: "forbidden-key",
        message: `'${key}' is not supported for plugin-shipped agents — it is silently ignored. Remove it.`,
      });
    } else if (!ALLOWED_KEYS.has(key)) {
      findings.push({
        file,
        kind: "correctness",
        id: "unknown-key",
        message: `unrecognized frontmatter key '${key}' (allowed: ${[...ALLOWED_KEYS].join(", ")})`,
      });
    }
  }

  const name = typeof meta.name === "string" ? meta.name : "";
  if (!/^jstack-[a-z0-9-]+$/.test(name)) {
    findings.push({
      file,
      kind: "correctness",
      id: "name",
      message: `name must match jstack-<kebab-case>, got '${name}'`,
    });
  }

  const description =
    typeof meta.description === "string" ? meta.description.trim() : "";
  if (description.length < 80) {
    findings.push({
      file,
      kind: "correctness",
      id: "description",
      message: `description is ${description.length} chars — too thin to route on. State what it does AND when to prefer it over a neighbour.`,
    });
  }
  descriptions.set(file, description);

  if (meta.model !== undefined && !VALID_MODELS.has(String(meta.model))) {
    findings.push({
      file,
      kind: "correctness",
      id: "model",
      message: `model '${meta.model}' not in ${[...VALID_MODELS].join(", ")}`,
    });
  }
  if (meta.effort !== undefined && !VALID_EFFORT.has(String(meta.effort))) {
    findings.push({
      file,
      kind: "correctness",
      id: "effort",
      message: `effort '${meta.effort}' not in ${[...VALID_EFFORT].join(", ")}`,
    });
  }

  for (const section of REQUIRED_SECTIONS) {
    if (!body.includes(section)) {
      findings.push({
        file,
        kind: "correctness",
        id: "section",
        message: `missing required section '${section}'`,
      });
    }
  }

  for (const pattern of FICTION) {
    const hit = body.match(pattern);
    if (hit) {
      findings.push({
        file,
        kind: "correctness",
        id: "fiction",
        message: `fabricated organization data '${hit[0]}' — agents must not assert invented facts`,
      });
    }
  }

  // --- depth ---
  let passed = 0;
  for (const rule of DEPTH_RULES) {
    if (rule.test(body)) {
      passed++;
    } else {
      findings.push({ file, kind: "depth", id: rule.id, message: rule.hint });
    }
  }
  depthScores.set(file, passed);
}

// --- dispatch ambiguity: near-duplicate descriptions route unpredictably ---
const STOP = new Set(
  "the a an and or of to for with when use uses using this that in on at by from as is are be it its user users ask asks".split(
    " ",
  ),
);
const tokenize = (s: string) =>
  new Set(
    s
      .toLowerCase()
      .replace(/[^a-z0-9\s]/g, " ")
      .split(/\s+/)
      .filter((w) => w.length > 3 && !STOP.has(w)),
  );

/**
 * Sharing a #1 primary skill is a sharper ambiguity signal than description overlap:
 * two agents whose top route is identical will compete for the same request even when
 * their prose differs. Allowed only if each description says when to prefer it.
 */
const primaryRoutes = new Map<string, string[]>();
for (const file of files) {
  const raw = readFileSync(join(agentsDir, file), "utf8");
  const section = raw.match(/^##+ Primary skills[^\n]*\n([\s\S]{0,400})/m);
  const first = section?.[1]?.match(/jstack:[a-z0-9-]+/)?.[0];
  if (!first) continue;
  primaryRoutes.set(first, [...(primaryRoutes.get(first) ?? []), file]);
}
for (const [route, owners] of primaryRoutes) {
  if (owners.length < 2) continue;
  // A description is "differentiated" when it says when NOT to pick this agent, however
  // that's phrased. `not when …` and `only when …` are as explicit as `prefer` — an
  // earlier, narrower pattern flagged well-differentiated descriptions as ambiguous.
  const CUE =
    /\bprefer\b|\binstead\b|\brather than\b|\bnot for\b|\bnot when\b|\bonly when\b|\bunlike\b|\bnot the right fit\b/;
  const differentiated = owners.every((f) =>
    CUE.test((descriptions.get(f) ?? "").toLowerCase()),
  );
  if (differentiated) continue;
  findings.push({
    file: owners.join(" ~ "),
    kind: "dispatch",
    id: "shared-primary-route",
    message: `all claim '${route}' as their first primary skill — requests will route unpredictably. Either differentiate the top route, or state in each description when to prefer it over the other(s).`,
  });
}

const entries = [...descriptions.entries()];
for (let i = 0; i < entries.length; i++) {
  for (let j = i + 1; j < entries.length; j++) {
    const [fa, da] = entries[i]!;
    const [fb, db] = entries[j]!;
    const ta = tokenize(da);
    const tb = tokenize(db);
    if (ta.size === 0 || tb.size === 0) continue;
    const shared = [...ta].filter((t) => tb.has(t));
    const jaccard = shared.length / new Set([...ta, ...tb]).size;
    if (jaccard >= 0.42) {
      findings.push({
        file: `${fa} ~ ${fb}`,
        kind: "dispatch",
        id: "ambiguous",
        message: `descriptions overlap ${(jaccard * 100).toFixed(0)}% (shared: ${shared.slice(0, 6).join(", ")}) — a request matching both routes unpredictably. Differentiate, and state when to prefer each.`,
      });
    }
  }
}

// --- report ---
const correctness = findings.filter((f) => f.kind === "correctness");
const depth = findings.filter((f) => f.kind === "depth");
const dispatch = findings.filter((f) => f.kind === "dispatch");

if (asJson) {
  console.log(
    JSON.stringify(
      {
        agents: files.length,
        correctness_errors: correctness.length,
        depth_warnings: depth.length,
        dispatch_warnings: dispatch.length,
        depth_scores: Object.fromEntries(
          [...depthScores.entries()].map(([f, s]) => [
            f,
            `${s}/${DEPTH_RULES.length}`,
          ]),
        ),
        findings,
      },
      null,
      2,
    ),
  );
} else {
  const group = (label: string, items: Finding[]) => {
    if (items.length === 0) return;
    console.log(`\n${label}`);
    const byFile = new Map<string, Finding[]>();
    for (const f of items)
      (byFile.get(f.file) ?? byFile.set(f.file, []).get(f.file)!).push(f);
    for (const [file, fs] of byFile) {
      console.log(`  ${file}`);
      for (const f of fs) console.log(`    [${f.id}] ${f.message}`);
    }
  };

  group(`CORRECTNESS (${correctness.length}) — always fatal`, correctness);
  group(
    `DISPATCH (${dispatch.length}) — ${strict ? "fatal" : "advisory"}`,
    dispatch,
  );
  group(`DEPTH (${depth.length}) — ${strict ? "fatal" : "advisory"}`, depth);

  console.log("\nDepth score by agent (higher is more specialist):");
  for (const [file, score] of [...depthScores.entries()].sort(
    (a, b) => a[1] - b[1],
  )) {
    const bar = "█".repeat(score) + "·".repeat(DEPTH_RULES.length - score);
    console.log(`  ${bar}  ${score}/${DEPTH_RULES.length}  ${file}`);
  }
}

const fatal =
  correctness.length > 0 ||
  (strict && (depth.length > 0 || dispatch.length > 0));

// In --json mode stdout must contain ONLY the JSON payload so it stays machine-parseable
// (CLAUDE.md: never interleave prose into a JSON output mode). Diagnostics go to stderr.
if (fatal) {
  const summary = `agents-depth-check FAILED (${correctness.length} correctness, ${depth.length} depth, ${dispatch.length} dispatch)`;
  console.error(asJson ? summary : `\n${summary}`);
  process.exit(1);
}
const okSummary = `agents-depth-check OK (${files.length} agents; ${depth.length} depth + ${dispatch.length} dispatch advisories)${strict ? "" : " — run with --strict to enforce depth"}`;
if (asJson) console.error(okSummary);
else console.log(`\n${okSummary}`);
