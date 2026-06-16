# CLAUDE.md Improver — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Ship a sub-skill (`jstack:skill-creator/improve-claude-md`) that audits a project's `CLAUDE.md` against commits, session transcripts, and working-tree state, then proposes ranked edits as a unified diff. Read-only by default; `--apply` is opt-in.

**Architecture:** Five-stage pipeline (collect → detect → propose → review → render). Stages 1, 2, 5 live in a typed Bun module (`cli/src/lib/claude-md-improver.ts`) backed by a CLI subcommand (`jstack claude-md`). Stages 3 and 4 (LLM-driven proposing + 4-persona rubric review) live in the SKILL.md procedure.

**Tech Stack:** TypeScript, Bun, `commander`, `chalk`, `bun:test`, `@clack/prompts`. Tests run under `bun test cli/src` per `package.json` `test:cli`.

**Spec:** [`../specs/2026-04-29-claude-md-improver-design.md`](../specs/2026-04-29-claude-md-improver-design.md) (committed as `d62233c` on `main`). All section refs (§N) point there.

**Working directory:** `/Users/jonathan.boice/Documents/GitHub/jstack/jstack.core`. All paths in this plan are relative to that root unless noted.

**Adopted decisions from spec §13:** read-only default; `--apply` opt-in; sub-skill under `skill-creator`; declined edits remembered in `.jstack/claude-md-improver-history.json`; D6 surfaces candidate pairs deterministically and the LLM judges contradictions.

---

## File Structure (across all four PRs)

### New files

| Path | Responsibility | First touched |
|------|----------------|---------------|
| `cli/src/lib/claude-md-improver.ts` | Pure module: `collect()`, `detect()` (D1–D10), `render()`, `PII_PATTERNS`, types `Issue` + `ProposedEdit`. | PR-1 |
| `cli/src/lib/claude-md-improver.test.ts` | Unit tests: PII redaction, encoded-path resolver, every detector D1–D10. | PR-1 |
| `cli/src/commands/claude-md.ts` | CLI subcommand: `jstack claude-md scan`, `jstack claude-md render`, `jstack claude-md apply`. | PR-1 |
| `cli/src/commands/claude-md.test.ts` | E2E test: scan + render on the three fixtures. | PR-1 |
| `cli/src/lib/__fixtures__/claude-md-improver/stale-claude-md/` | Fixture: stale yarn rule + stale path + vague rule. | PR-1 |
| `cli/src/lib/__fixtures__/claude-md-improver/missing-rules-from-corrections/` | Synthetic JSONL fixture for D4. | PR-1 |
| `cli/src/lib/__fixtures__/claude-md-improver/contradictory-claude-md/` | Two contradictory rules for D6. | PR-1 |
| `prompts/personas/pm.md` | New PM persona (general-purpose). | PR-2 |
| `skills/skill-creator/improve-claude-md/SKILL.md` | The sub-skill itself. | PR-3 |
| `skills/skill-creator/improve-claude-md/references/detectors.md` | D1–D10 implementation notes. | PR-3 |
| `skills/skill-creator/improve-claude-md/references/scoring.md` | Priority formula and confidence weights. | PR-3 |
| `skills/skill-creator/improve-claude-md/references/persona-review.md` | 4-persona rubric (sub-scores, hard rejects). | PR-3 |
| `skills/skill-creator/improve-claude-md/references/output-schema.md` | JSON schema for `--output=json`. | PR-3 |
| `skills/skill-creator/improve-claude-md/evals/eval.config.json` | Eval runner config for the three fixtures. | PR-3 |
| `skills/skill-creator/improve-claude-md/evals/inputs/*` | Eval fixtures (mirrors lib `__fixtures__`). | PR-3 |
| `skills/skill-creator/improve-claude-md/evals/expected/*.expected.patch` | Golden patches. | PR-3 |
| `docs/superpowers/dogfood/2026-04-29-claude-md-improver-self-scan.md` | Dogfood report on `jstack.core`'s own CLAUDE.md. | PR-3 |
| `scripts/routines/monthly-claude-md-review.json` | Monthly routine definition. | PR-4 |
| `hooks/claude-md-correction-detector.sh` | Stop-hook script. | PR-4 |

### Modified files

| Path | Why | First touched |
|------|-----|---------------|
| `cli/src/index.ts` | Register the new `claude-md` command group. | PR-1 |
| `config/schema.json` | Add `claude_md_improver` block under `properties`. | PR-1 |
| `config/defaults.json` | Add `claude_md_improver` defaults (`enabled: false` initially). | PR-1 |
| `package.json` | Add `claude-md` keyword (no new deps required). | PR-1 |
| `scripts/apply_detailed_skills.py` | Append `SKILLS / "skill-creator" / "improve-claude-md" / "SKILL.md"` to the `SKIP` set. | PR-3 |
| `skills/skill-creator/SKILL.md` | Cross-reference `improve-claude-md` in sub-skills section. | PR-3 |
| `README.md` | Two-line quickstart bullet. | PR-4 |
| `hooks/hooks.json` | Wire `Stop` hook for high-correction sessions. | PR-4 |
| `config/defaults.json` | Flip `claude_md_improver.enabled` to `true`. | PR-4 |
| `CHANGELOG.md` | Unreleased entry per PR. | every PR |

---

## Sequencing notes

- **PR-1** (Tasks 1–14): typed module + CLI + fixtures + tests. Skill not yet exposed; `enabled: false`. Land independently — adds no behavior change for users.
- **PR-2** (Tasks 15–18): PM persona + persona-review rubric reference. Tiny PR. Still gated.
- **PR-3** (Tasks 19–28): SKILL.md authoring, dogfood, `--apply` flag with confirmation. The first user-visible PR (after `enabled: true` is opted into).
- **PR-4** (Tasks 29–34): Stop hook, monthly routine, README, default flip.

Each task ends with a commit. Each PR is the contiguous range of commits since the previous PR's last task.

---

## PR-1 — Typed module + CLI + tests (skill not yet exposed)

### Task 1: Define `Issue` and `ProposedEdit` types

**Files:**
- Create: `cli/src/lib/claude-md-improver.ts`
- Test: `cli/src/lib/claude-md-improver.test.ts`

- [ ] **Step 1: Write the failing test**

Append to `cli/src/lib/claude-md-improver.test.ts`:

```ts
import { describe, expect, test } from "bun:test";
import type { Issue, ProposedEdit, IssueCategory } from "./claude-md-improver.js";

describe("types", () => {
  test("IssueCategory union has the seven documented categories", () => {
    const all: IssueCategory[] = [
      "remove-stale-rule",
      "sharpen-rule",
      "add-rule",
      "add-example",
      "dedupe",
      "fix-contradiction",
      "add-reference",
    ];
    expect(all.length).toBe(7);
  });

  test("Issue and ProposedEdit are constructible", () => {
    const issue: Issue = {
      id: "i-001",
      detector: "D1",
      category: "remove-stale-rule",
      claude_md_anchor: { line_start: 23, line_end: 23 },
      evidence: { file_paths: ["package-lock.json"] },
      raw_summary: "yarn rule but npm lockfile",
      estimated_corrections_avoided_per_week: 1,
      confidence: "high",
    };
    const edit: ProposedEdit = {
      issue_id: issue.id,
      category: issue.category,
      before: "Use yarn",
      after: "Use npm",
      rationale: "lockfile is package-lock.json",
      diff_hunk: "@@ -23 +23 @@\n-Use yarn\n+Use npm\n",
      benefit: "Claude stops suggesting yarn",
      example: "Ask install lodash → npm install lodash",
      time_saved_min_per_week: 2.5,
      monthly_savings_min: 10,
      confidence: "high",
      priority_score: 10,
    };
    expect(issue.id).toBe("i-001");
    expect(edit.issue_id).toBe("i-001");
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd /Users/jonathan.boice/Documents/GitHub/jstack/jstack.core && bun test cli/src/lib/claude-md-improver.test.ts`
Expected: FAIL with "Cannot find module './claude-md-improver.js'" or similar.

- [ ] **Step 3: Write minimal implementation**

Create `cli/src/lib/claude-md-improver.ts`:

```ts
export type IssueCategory =
  | "remove-stale-rule"
  | "sharpen-rule"
  | "add-rule"
  | "add-example"
  | "dedupe"
  | "fix-contradiction"
  | "add-reference";

export type Confidence = "high" | "medium" | "low";

export type SessionExcerpt = {
  session_id: string;
  excerpt: string; // ≤80 chars, redacted
};

export type Evidence = {
  commits?: string[];
  session_excerpts?: SessionExcerpt[];
  file_paths?: string[];
  related_rules?: number[];
};

export type Issue = {
  id: string;
  detector: string;
  category: IssueCategory;
  claude_md_anchor: { line_start: number; line_end: number } | null;
  evidence: Evidence;
  raw_summary: string;
  estimated_corrections_avoided_per_week: number;
  confidence: Confidence;
};

export type ProposedEdit = {
  issue_id: string;
  category: IssueCategory;
  before: string | null;
  after: string | null;
  rationale: string;
  diff_hunk: string;
  benefit: string;
  example: string;
  time_saved_min_per_week: number;
  monthly_savings_min: number;
  confidence: Confidence;
  priority_score: number;
};
```

- [ ] **Step 4: Run test to verify it passes**

Run: `bun test cli/src/lib/claude-md-improver.test.ts`
Expected: PASS — 2 tests.

- [ ] **Step 5: Commit**

```bash
git add cli/src/lib/claude-md-improver.ts cli/src/lib/claude-md-improver.test.ts
git commit -m "feat(claude-md-improver): add Issue/ProposedEdit types"
```

---

### Task 2: PII redaction patterns + `redact()` function

**Files:**
- Modify: `cli/src/lib/claude-md-improver.ts`
- Test: `cli/src/lib/claude-md-improver.test.ts`

- [ ] **Step 1: Write the failing test**

Append to `cli/src/lib/claude-md-improver.test.ts`:

```ts
import { redact } from "./claude-md-improver.js";

describe("redact", () => {
  test("redacts API key prefixes", () => {
    expect(redact("token sk-ABCD1234EFGH5678ZZZZ go")).toContain("[redacted-key]");
    expect(redact("api_key=ABCD1234EFGH5678ZZZZ rest")).toContain("[redacted-key]");
  });

  test("redacts JWTs", () => {
    const jwt = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiIxMjM0NTY3ODkwIn0.SflKxwRJSMeKKF2QT4fwpMeJf36POk6yJV_adQssw5c";
    expect(redact("auth " + jwt)).toContain("[redacted-jwt]");
  });

  test("redacts emails", () => {
    expect(redact("ping alice@example.com please")).toContain("[redacted-email]");
  });

  test("redacts AWS keys", () => {
    expect(redact("key AKIAIOSFODNN7EXAMPLE")).toContain("[redacted-aws]");
  });

  test("redacts ghp_ / glpat- / xoxb- / xoxp- prefixes", () => {
    expect(redact("ghp_abcdefghij1234567890ABCDEFGHIJKL")).toContain("[redacted-key]");
    expect(redact("glpat-abc123XYZ")).toContain("[redacted-key]");
    expect(redact("xoxb-1234-5678-abcd")).toContain("[redacted-key]");
    expect(redact("xoxp-1234-5678-abcd")).toContain("[redacted-key]");
  });

  test("collapses code blocks longer than 10 lines", () => {
    const lines = Array.from({ length: 14 }, (_, i) => `line${i}`).join("\n");
    const input = "```\n" + lines + "\n```";
    expect(redact(input)).toContain("[code block, 14 lines]");
  });

  test("leaves clean text alone", () => {
    expect(redact("Use npm for installs")).toBe("Use npm for installs");
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `bun test cli/src/lib/claude-md-improver.test.ts -t redact`
Expected: FAIL — `redact` is not exported.

- [ ] **Step 3: Write minimal implementation**

Append to `cli/src/lib/claude-md-improver.ts`:

```ts
export const PII_PATTERNS: { name: string; re: RegExp; replacement: string }[] = [
  { name: "key", re: /\b(?:sk|pk|api[_-]?key)[_=:-][\w-]{16,}/gi, replacement: "[redacted-key]" },
  {
    name: "jwt",
    re: /\beyJ[A-Za-z0-9_-]{20,}\.[A-Za-z0-9_-]{20,}\.[A-Za-z0-9_-]{20,}\b/g,
    replacement: "[redacted-jwt]",
  },
  { name: "email", re: /\b[\w.+-]+@[\w-]+\.[\w.-]+\b/g, replacement: "[redacted-email]" },
  { name: "aws", re: /\bAKIA[0-9A-Z]{16}\b/g, replacement: "[redacted-aws]" },
  { name: "ghp", re: /\bghp_[A-Za-z0-9]{20,}\b/g, replacement: "[redacted-key]" },
  { name: "glpat", re: /\bglpat-[A-Za-z0-9_-]{8,}\b/g, replacement: "[redacted-key]" },
  { name: "slack", re: /\bxox[bp]-[A-Za-z0-9-]{8,}\b/g, replacement: "[redacted-key]" },
];

const FENCE_RE = /```[\s\S]*?```/g;

export function redact(input: string): string {
  let out = input.replace(FENCE_RE, (match) => {
    const lineCount = match.split("\n").length;
    return lineCount > 12 ? `[code block, ${lineCount - 2} lines]` : match;
  });
  for (const p of PII_PATTERNS) {
    out = out.replace(p.re, p.replacement);
  }
  return out;
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `bun test cli/src/lib/claude-md-improver.test.ts -t redact`
Expected: PASS — 7 tests.

- [ ] **Step 5: Commit**

```bash
git add cli/src/lib/claude-md-improver.ts cli/src/lib/claude-md-improver.test.ts
git commit -m "feat(claude-md-improver): always-on PII redaction"
```

---

### Task 3: Encoded transcript-path resolver

**Files:**
- Modify: `cli/src/lib/claude-md-improver.ts`
- Test: `cli/src/lib/claude-md-improver.test.ts`

- [ ] **Step 1: Write the failing test**

Append to `cli/src/lib/claude-md-improver.test.ts`:

```ts
import { encodeProjectPath, resolveTranscriptDir } from "./claude-md-improver.js";
import { mkdtempSync, mkdirSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach } from "bun:test";

describe("encodeProjectPath", () => {
  test("replaces / with -", () => {
    expect(encodeProjectPath("/Users/x/repo")).toBe("-Users-x-repo");
  });
  test("handles trailing slash", () => {
    expect(encodeProjectPath("/Users/x/repo/")).toBe("-Users-x-repo");
  });
});

describe("resolveTranscriptDir", () => {
  let home: string;
  beforeEach(() => {
    home = mkdtempSync(join(tmpdir(), "jstack-claude-home-"));
  });
  afterEach(() => {
    rmSync(home, { recursive: true, force: true });
  });

  test("returns null when no transcript dir exists", () => {
    expect(resolveTranscriptDir(home, "/Users/x/repo")).toBeNull();
  });

  test("returns the encoded dir when present", () => {
    const encoded = "-Users-x-repo";
    const dir = join(home, ".claude", "projects", encoded);
    mkdirSync(dir, { recursive: true });
    writeFileSync(join(dir, "abc.jsonl"), "{}\n");
    expect(resolveTranscriptDir(home, "/Users/x/repo")).toBe(dir);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `bun test cli/src/lib/claude-md-improver.test.ts -t resolveTranscriptDir`
Expected: FAIL — function not exported.

- [ ] **Step 3: Write minimal implementation**

Append to `cli/src/lib/claude-md-improver.ts`:

```ts
import { existsSync } from "node:fs";
import { join } from "node:path";

export function encodeProjectPath(projectRoot: string): string {
  const trimmed = projectRoot.replace(/\/+$/, "");
  return trimmed.replace(/\//g, "-");
}

export function resolveTranscriptDir(homeDir: string, projectRoot: string): string | null {
  const encoded = encodeProjectPath(projectRoot);
  const dir = join(homeDir, ".claude", "projects", encoded);
  return existsSync(dir) ? dir : null;
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `bun test cli/src/lib/claude-md-improver.test.ts -t resolveTranscriptDir`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add cli/src/lib/claude-md-improver.ts cli/src/lib/claude-md-improver.test.ts
git commit -m "feat(claude-md-improver): encoded transcript path resolver"
```

---

### Task 4: `parseClaudeMd` — line-anchored sections

**Files:**
- Modify: `cli/src/lib/claude-md-improver.ts`
- Test: `cli/src/lib/claude-md-improver.test.ts`

- [ ] **Step 1: Write the failing test**

Append to test file:

```ts
import { parseClaudeMd } from "./claude-md-improver.js";

describe("parseClaudeMd", () => {
  test("captures rule lines verbatim with 1-based line numbers", () => {
    const input = "# Project rules\n\nUse yarn for installs.\nTests live in __tests__/.\n";
    const parsed = parseClaudeMd(input);
    expect(parsed.lines.length).toBe(4);
    expect(parsed.lines[2]).toEqual({ line_number: 3, text: "Use yarn for installs." });
  });

  test("groups by `## ` section headers", () => {
    const input = "# Top\n## A\nrule a1\n## B\nrule b1\nrule b2\n";
    const parsed = parseClaudeMd(input);
    expect(parsed.sections.length).toBe(2);
    expect(parsed.sections[0].heading).toBe("A");
    expect(parsed.sections[1].lines.map((l) => l.text)).toEqual(["rule b1", "rule b2"]);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `bun test cli/src/lib/claude-md-improver.test.ts -t parseClaudeMd`
Expected: FAIL.

- [ ] **Step 3: Write minimal implementation**

Append to `cli/src/lib/claude-md-improver.ts`:

```ts
export type ParsedLine = { line_number: number; text: string };
export type ParsedSection = { heading: string; line_start: number; lines: ParsedLine[] };
export type ParsedClaudeMd = { lines: ParsedLine[]; sections: ParsedSection[] };

export function parseClaudeMd(input: string): ParsedClaudeMd {
  const rawLines = input.split(/\r?\n/);
  const lines: ParsedLine[] = rawLines.map((text, i) => ({ line_number: i + 1, text }));
  const sections: ParsedSection[] = [];
  let current: ParsedSection | null = null;
  for (const l of lines) {
    const m = /^##\s+(.+)$/.exec(l.text);
    if (m) {
      if (current) sections.push(current);
      current = { heading: m[1], line_start: l.line_number, lines: [] };
    } else if (current && l.text.trim() !== "") {
      current.lines.push(l);
    }
  }
  if (current) sections.push(current);
  return { lines, sections };
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `bun test cli/src/lib/claude-md-improver.test.ts -t parseClaudeMd`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add cli/src/lib/claude-md-improver.ts cli/src/lib/claude-md-improver.test.ts
git commit -m "feat(claude-md-improver): markdown parser for rule lines"
```

---

### Task 5: `collect()` — gather inputs from disk

**Files:**
- Modify: `cli/src/lib/claude-md-improver.ts`
- Test: `cli/src/lib/claude-md-improver.test.ts`

- [ ] **Step 1: Write the failing test**

Append:

```ts
import { collect } from "./claude-md-improver.js";

describe("collect", () => {
  let project: string;
  beforeEach(() => {
    project = mkdtempSync(join(tmpdir(), "jstack-collect-"));
  });
  afterEach(() => {
    rmSync(project, { recursive: true, force: true });
  });

  test("returns null claude_md when CLAUDE.md is absent", () => {
    const c = collect({ projectRoot: project, homeDir: tmpdir(), now: new Date() });
    expect(c.claude_md).toBeNull();
  });

  test("reads CLAUDE.md when present", () => {
    writeFileSync(join(project, "CLAUDE.md"), "Use yarn.\n");
    const c = collect({ projectRoot: project, homeDir: tmpdir(), now: new Date() });
    expect(c.claude_md?.parsed.lines[0].text).toBe("Use yarn.");
  });

  test("detects npm lockfile", () => {
    writeFileSync(join(project, "package-lock.json"), "{}");
    const c = collect({ projectRoot: project, homeDir: tmpdir(), now: new Date() });
    expect(c.lockfiles).toContain("package-lock.json");
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `bun test cli/src/lib/claude-md-improver.test.ts -t collect`
Expected: FAIL.

- [ ] **Step 3: Write minimal implementation**

Append to `cli/src/lib/claude-md-improver.ts`:

```ts
import { readFileSync } from "node:fs";

export type CollectInput = {
  projectRoot: string;
  homeDir: string;
  now: Date;
  /** Override for tests. */
  readFile?: (path: string) => string;
  fileExists?: (path: string) => boolean;
};

export type CollectOutput = {
  project_root: string;
  claude_md: { raw: string; parsed: ParsedClaudeMd } | null;
  claude_local_md: { raw: string; parsed: ParsedClaudeMd } | null;
  readme_excerpt: string | null;
  lockfiles: string[];
  transcript_dir: string | null;
  notes: string[];
};

const LOCKFILES = [
  "package-lock.json",
  "yarn.lock",
  "pnpm-lock.yaml",
  "bun.lock",
  "Cargo.lock",
  "go.sum",
  "poetry.lock",
];

export function collect(input: CollectInput): CollectOutput {
  const exists = input.fileExists ?? ((p: string) => existsSync(p));
  const read = input.readFile ?? ((p: string) => readFileSync(p, "utf8"));
  const notes: string[] = [];

  const readMaybe = (rel: string) => {
    const path = join(input.projectRoot, rel);
    if (!exists(path)) return null;
    const raw = read(path);
    return { raw, parsed: parseClaudeMd(raw) };
  };

  const claudeMd = readMaybe("CLAUDE.md");
  if (!claudeMd) notes.push("No CLAUDE.md found at project root.");
  const claudeLocal = readMaybe("CLAUDE.local.md");

  const readmePath = join(input.projectRoot, "README.md");
  const readmeExcerpt = exists(readmePath)
    ? read(readmePath).split(/\r?\n/).slice(0, 100).join("\n")
    : null;

  const lockfiles = LOCKFILES.filter((f) => exists(join(input.projectRoot, f)));
  const transcriptDir = resolveTranscriptDir(input.homeDir, input.projectRoot);
  if (!transcriptDir) notes.push("No session transcripts found; running without session-derived detectors.");

  return {
    project_root: input.projectRoot,
    claude_md: claudeMd,
    claude_local_md: claudeLocal,
    readme_excerpt: readmeExcerpt,
    lockfiles,
    transcript_dir: transcriptDir,
    notes,
  };
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `bun test cli/src/lib/claude-md-improver.test.ts -t collect`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add cli/src/lib/claude-md-improver.ts cli/src/lib/claude-md-improver.test.ts
git commit -m "feat(claude-md-improver): collect() reads CLAUDE.md, lockfiles, README"
```

---

### Task 6: Detector D1 — stale package-manager rule

**Files:**
- Modify: `cli/src/lib/claude-md-improver.ts`
- Test: `cli/src/lib/claude-md-improver.test.ts`

- [ ] **Step 1: Write the failing test**

Append:

```ts
import { detectD1StalePackageManager } from "./claude-md-improver.js";

describe("detectD1StalePackageManager", () => {
  test("flags 'use yarn' when only package-lock.json exists", () => {
    const collected = {
      project_root: "/p",
      claude_md: { raw: "Use yarn for installs.\n", parsed: parseClaudeMd("Use yarn for installs.\n") },
      claude_local_md: null,
      readme_excerpt: null,
      lockfiles: ["package-lock.json"],
      transcript_dir: null,
      notes: [],
    };
    const issues = detectD1StalePackageManager(collected);
    expect(issues.length).toBe(1);
    expect(issues[0].detector).toBe("D1");
    expect(issues[0].category).toBe("remove-stale-rule");
    expect(issues[0].claude_md_anchor).toEqual({ line_start: 1, line_end: 1 });
  });

  test("does not flag when manager matches lockfile", () => {
    const collected = {
      project_root: "/p",
      claude_md: { raw: "Use npm.\n", parsed: parseClaudeMd("Use npm.\n") },
      claude_local_md: null,
      readme_excerpt: null,
      lockfiles: ["package-lock.json"],
      transcript_dir: null,
      notes: [],
    };
    expect(detectD1StalePackageManager(collected)).toEqual([]);
  });

  test("returns empty when no CLAUDE.md", () => {
    const collected = {
      project_root: "/p",
      claude_md: null,
      claude_local_md: null,
      readme_excerpt: null,
      lockfiles: ["package-lock.json"],
      transcript_dir: null,
      notes: [],
    };
    expect(detectD1StalePackageManager(collected)).toEqual([]);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `bun test cli/src/lib/claude-md-improver.test.ts -t detectD1`
Expected: FAIL.

- [ ] **Step 3: Write minimal implementation**

Append to `cli/src/lib/claude-md-improver.ts`:

```ts
const LOCKFILE_TO_MANAGER: Record<string, string> = {
  "package-lock.json": "npm",
  "yarn.lock": "yarn",
  "pnpm-lock.yaml": "pnpm",
  "bun.lock": "bun",
};
const MANAGER_RE = /\b(yarn|npm|pnpm|bun)\b/i;

export function detectD1StalePackageManager(collected: CollectOutput): Issue[] {
  if (!collected.claude_md) return [];
  const managersInRepo = new Set(
    collected.lockfiles.map((l) => LOCKFILE_TO_MANAGER[l]).filter(Boolean)
  );
  if (managersInRepo.size === 0) return [];
  const issues: Issue[] = [];
  let counter = 1;
  for (const line of collected.claude_md.parsed.lines) {
    const m = MANAGER_RE.exec(line.text);
    if (!m) continue;
    const mentioned = m[1].toLowerCase();
    if (managersInRepo.has(mentioned)) continue;
    issues.push({
      id: `i-d1-${String(counter++).padStart(3, "0")}`,
      detector: "D1",
      category: "remove-stale-rule",
      claude_md_anchor: { line_start: line.line_number, line_end: line.line_number },
      evidence: { file_paths: collected.lockfiles },
      raw_summary: `CLAUDE.md says "${mentioned}" but lockfile is ${[...managersInRepo].join(", ")}`,
      estimated_corrections_avoided_per_week: 1,
      confidence: "high",
    });
  }
  return issues;
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `bun test cli/src/lib/claude-md-improver.test.ts -t detectD1`
Expected: PASS — 3 tests.

- [ ] **Step 5: Commit**

```bash
git add cli/src/lib/claude-md-improver.ts cli/src/lib/claude-md-improver.test.ts
git commit -m "feat(claude-md-improver): D1 stale-package-manager detector"
```

---

### Task 7: Detector D2 — stale path reference

**Files:**
- Modify: `cli/src/lib/claude-md-improver.ts`
- Test: `cli/src/lib/claude-md-improver.test.ts`

- [ ] **Step 1: Write the failing test**

Append:

```ts
import { detectD2StalePath } from "./claude-md-improver.js";

describe("detectD2StalePath", () => {
  test("flags an inline path that does not exist on disk", () => {
    const project = mkdtempSync(join(tmpdir(), "jstack-d2-"));
    try {
      writeFileSync(join(project, "CLAUDE.md"), "Tests live in `__tests__/`.\n");
      // No __tests__/ directory exists.
      const collected = collect({ projectRoot: project, homeDir: tmpdir(), now: new Date() });
      const issues = detectD2StalePath(collected);
      expect(issues.length).toBe(1);
      expect(issues[0].detector).toBe("D2");
      expect(issues[0].evidence.file_paths).toContain("__tests__/");
    } finally {
      rmSync(project, { recursive: true, force: true });
    }
  });

  test("does not flag when path exists", () => {
    const project = mkdtempSync(join(tmpdir(), "jstack-d2-"));
    try {
      writeFileSync(join(project, "CLAUDE.md"), "Tests live in `tests/`.\n");
      mkdirSync(join(project, "tests"));
      const collected = collect({ projectRoot: project, homeDir: tmpdir(), now: new Date() });
      expect(detectD2StalePath(collected)).toEqual([]);
    } finally {
      rmSync(project, { recursive: true, force: true });
    }
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `bun test cli/src/lib/claude-md-improver.test.ts -t detectD2`
Expected: FAIL.

- [ ] **Step 3: Write minimal implementation**

Append:

```ts
const PATH_IN_BACKTICKS_RE = /`([./\w][\w./-]*\/[\w./-]*)`/g;

export function detectD2StalePath(collected: CollectOutput): Issue[] {
  if (!collected.claude_md) return [];
  const issues: Issue[] = [];
  let counter = 1;
  for (const line of collected.claude_md.parsed.lines) {
    const matches = [...line.text.matchAll(PATH_IN_BACKTICKS_RE)];
    for (const m of matches) {
      const candidate = m[1];
      const abs = join(collected.project_root, candidate.replace(/\/$/, ""));
      if (existsSync(abs)) continue;
      issues.push({
        id: `i-d2-${String(counter++).padStart(3, "0")}`,
        detector: "D2",
        category: "remove-stale-rule",
        claude_md_anchor: { line_start: line.line_number, line_end: line.line_number },
        evidence: { file_paths: [candidate] },
        raw_summary: `CLAUDE.md references path \`${candidate}\` which does not exist`,
        estimated_corrections_avoided_per_week: 0.5,
        confidence: "high",
      });
    }
  }
  return issues;
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `bun test cli/src/lib/claude-md-improver.test.ts -t detectD2`
Expected: PASS — 2 tests.

- [ ] **Step 5: Commit**

```bash
git add cli/src/lib/claude-md-improver.ts cli/src/lib/claude-md-improver.test.ts
git commit -m "feat(claude-md-improver): D2 stale-path detector"
```

---

### Task 8: Detector D3 — vague rule

**Files:**
- Modify: `cli/src/lib/claude-md-improver.ts`
- Test: `cli/src/lib/claude-md-improver.test.ts`

- [ ] **Step 1: Write the failing test**

Append:

```ts
import { detectD3VagueRule } from "./claude-md-improver.js";

describe("detectD3VagueRule", () => {
  test("flags 'always test' with no specifics", () => {
    const collected = {
      project_root: "/p", claude_md: { raw: "Always test.\n", parsed: parseClaudeMd("Always test.\n") },
      claude_local_md: null, readme_excerpt: null, lockfiles: [], transcript_dir: null, notes: [],
    };
    const issues = detectD3VagueRule(collected);
    expect(issues.length).toBe(1);
    expect(issues[0].category).toBe("sharpen-rule");
  });

  test("does not flag a rule that names a tool / path / code", () => {
    const collected = {
      project_root: "/p",
      claude_md: { raw: "Always run `bun test cli/src` before commit.\n", parsed: parseClaudeMd("Always run `bun test cli/src` before commit.\n") },
      claude_local_md: null, readme_excerpt: null, lockfiles: [], transcript_dir: null, notes: [],
    };
    expect(detectD3VagueRule(collected)).toEqual([]);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `bun test cli/src/lib/claude-md-improver.test.ts -t detectD3`
Expected: FAIL.

- [ ] **Step 3: Write minimal implementation**

Append:

```ts
const VAGUE_TRIGGER_RE = /\b(always|never|prefer|use|avoid)\b/i;
const SPECIFIC_INDICATOR_RE = /(`[^`]+`|\bhttps?:\/\/|[A-Z][a-zA-Z]+(?:\.[A-Z][a-zA-Z]+)+|\/[\w./-]+|\b[\w-]+\.[\w]{2,}\b)/;

export function detectD3VagueRule(collected: CollectOutput): Issue[] {
  if (!collected.claude_md) return [];
  const issues: Issue[] = [];
  let counter = 1;
  for (const line of collected.claude_md.parsed.lines) {
    if (!VAGUE_TRIGGER_RE.test(line.text)) continue;
    if (SPECIFIC_INDICATOR_RE.test(line.text)) continue;
    if (line.text.trim().startsWith("#")) continue;
    issues.push({
      id: `i-d3-${String(counter++).padStart(3, "0")}`,
      detector: "D3",
      category: "sharpen-rule",
      claude_md_anchor: { line_start: line.line_number, line_end: line.line_number },
      evidence: { related_rules: [line.line_number] },
      raw_summary: `Rule lacks a concrete subject: "${line.text.trim().slice(0, 60)}"`,
      estimated_corrections_avoided_per_week: 0.5,
      confidence: "medium",
    });
  }
  return issues;
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `bun test cli/src/lib/claude-md-improver.test.ts -t detectD3`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add cli/src/lib/claude-md-improver.ts cli/src/lib/claude-md-improver.test.ts
git commit -m "feat(claude-md-improver): D3 vague-rule detector"
```

---

### Task 9: Transcript reader + D4 — repeated correction

**Files:**
- Modify: `cli/src/lib/claude-md-improver.ts`
- Test: `cli/src/lib/claude-md-improver.test.ts`

- [ ] **Step 1: Write the failing test**

Append:

```ts
import { readTranscriptUserPrompts, detectD4RepeatedCorrection } from "./claude-md-improver.js";

describe("readTranscriptUserPrompts", () => {
  test("extracts type:user message text only", () => {
    const dir = mkdtempSync(join(tmpdir(), "jstack-trans-"));
    try {
      const lines = [
        JSON.stringify({ type: "user", timestamp: "2026-04-20T00:00:00Z", message: "no don't use yarn use npm" }),
        JSON.stringify({ type: "assistant", message: "ok" }),
        JSON.stringify({ type: "user", timestamp: "2026-04-21T00:00:00Z", message: "stop using yarn" }),
      ].join("\n");
      writeFileSync(join(dir, "s1.jsonl"), lines + "\n");
      const prompts = readTranscriptUserPrompts(dir, new Date("2026-04-30T00:00:00Z"), 30);
      expect(prompts.length).toBe(2);
      expect(prompts[0].text).toContain("yarn");
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });
});

describe("detectD4RepeatedCorrection", () => {
  test("groups corrections by shared noun and flags ≥3 occurrences", () => {
    const prompts = [
      { session_id: "s1", text: "no don't use yarn", timestamp: new Date("2026-04-20") },
      { session_id: "s2", text: "stop using yarn for installs", timestamp: new Date("2026-04-22") },
      { session_id: "s3", text: "wait — not yarn, use npm", timestamp: new Date("2026-04-25") },
    ];
    const issues = detectD4RepeatedCorrection(prompts);
    expect(issues.length).toBeGreaterThanOrEqual(1);
    expect(issues[0].detector).toBe("D4");
    expect(issues[0].category).toBe("add-rule");
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `bun test cli/src/lib/claude-md-improver.test.ts -t "readTranscriptUserPrompts|detectD4"`
Expected: FAIL.

- [ ] **Step 3: Write minimal implementation**

Append:

```ts
import { readdirSync } from "node:fs";

export type UserPrompt = { session_id: string; text: string; timestamp: Date };

export function readTranscriptUserPrompts(dir: string, now: Date, lookbackDays: number): UserPrompt[] {
  const files = readdirSync(dir).filter((f) => f.endsWith(".jsonl"));
  const cutoff = new Date(now.getTime() - lookbackDays * 24 * 60 * 60 * 1000);
  const out: UserPrompt[] = [];
  for (const f of files) {
    const sessionId = f.replace(/\.jsonl$/, "");
    let raw: string;
    try {
      raw = readFileSync(join(dir, f), "utf8");
    } catch {
      continue;
    }
    for (const line of raw.split(/\r?\n/)) {
      if (!line.trim()) continue;
      try {
        const obj = JSON.parse(line);
        if (obj.type !== "user") continue;
        const ts = obj.timestamp ? new Date(obj.timestamp) : null;
        if (ts && ts < cutoff) continue;
        const text =
          typeof obj.message === "string"
            ? obj.message
            : typeof obj.message?.content === "string"
              ? obj.message.content
              : "";
        if (!text) continue;
        out.push({ session_id: sessionId, text: redact(text), timestamp: ts ?? now });
      } catch {
        // skip malformed line
      }
    }
  }
  return out;
}

const CORRECTION_RE = /^(no|don't|stop|wait|that's wrong)\b/i;
const NOUN_RE = /\b([a-z]{3,})\b/gi;
const STOP_NOUNS = new Set([
  "no", "don't", "dont", "stop", "wait", "that", "wrong", "use", "the", "and",
  "for", "not", "but", "with", "its", "this", "that", "from", "into", "onto",
]);

export function detectD4RepeatedCorrection(prompts: UserPrompt[]): Issue[] {
  const corrections = prompts.filter((p) => CORRECTION_RE.test(p.text));
  const byNoun = new Map<string, UserPrompt[]>();
  for (const p of corrections) {
    const nouns = [...p.text.toLowerCase().matchAll(NOUN_RE)]
      .map((m) => m[1])
      .filter((n) => !STOP_NOUNS.has(n));
    const seen = new Set<string>();
    for (const n of nouns) {
      if (seen.has(n)) continue;
      seen.add(n);
      const list = byNoun.get(n) ?? [];
      list.push(p);
      byNoun.set(n, list);
    }
  }
  const issues: Issue[] = [];
  let counter = 1;
  for (const [noun, list] of byNoun) {
    if (list.length < 3) continue;
    issues.push({
      id: `i-d4-${String(counter++).padStart(3, "0")}`,
      detector: "D4",
      category: "add-rule",
      claude_md_anchor: null,
      evidence: {
        session_excerpts: list.slice(0, 3).map((p) => ({
          session_id: p.session_id,
          excerpt: p.text.slice(0, 80),
        })),
      },
      raw_summary: `User corrected Claude ≥3× on "${noun}"`,
      estimated_corrections_avoided_per_week: list.length / 4,
      confidence: list.length >= 5 ? "high" : "medium",
    });
  }
  return issues;
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `bun test cli/src/lib/claude-md-improver.test.ts -t "readTranscriptUserPrompts|detectD4"`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add cli/src/lib/claude-md-improver.ts cli/src/lib/claude-md-improver.test.ts
git commit -m "feat(claude-md-improver): transcript reader + D4 correction detector"
```

---

### Task 10: Detector D5 — repeated re-asks (Levenshtein-bucketed)

**Files:**
- Modify: `cli/src/lib/claude-md-improver.ts`
- Test: `cli/src/lib/claude-md-improver.test.ts`

- [ ] **Step 1: Write the failing test**

Append:

```ts
import { detectD5RepeatedReask } from "./claude-md-improver.js";

describe("detectD5RepeatedReask", () => {
  test("flags ≥3 near-identical prompts not answered by CLAUDE.md", () => {
    const prompts = [
      { session_id: "s1", text: "how do I bump the changelog version", timestamp: new Date() },
      { session_id: "s2", text: "how do i bump the changelog version?", timestamp: new Date() },
      { session_id: "s3", text: "how do I bump the changelog", timestamp: new Date() },
    ];
    const claudeMd = parseClaudeMd("Use npm.\n");
    const issues = detectD5RepeatedReask(prompts, claudeMd);
    expect(issues.length).toBe(1);
    expect(issues[0].category).toBe("add-rule");
  });

  test("does not flag when CLAUDE.md already covers the topic", () => {
    const prompts = [
      { session_id: "s1", text: "how do I bump the changelog", timestamp: new Date() },
      { session_id: "s2", text: "how do I bump the changelog", timestamp: new Date() },
      { session_id: "s3", text: "how do I bump the changelog", timestamp: new Date() },
    ];
    const claudeMd = parseClaudeMd("To bump the changelog, run `bun run bump`.\n");
    expect(detectD5RepeatedReask(prompts, claudeMd)).toEqual([]);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `bun test cli/src/lib/claude-md-improver.test.ts -t detectD5`
Expected: FAIL.

- [ ] **Step 3: Write minimal implementation**

Append:

```ts
function levenshtein(a: string, b: string): number {
  if (a === b) return 0;
  if (!a.length) return b.length;
  if (!b.length) return a.length;
  const dp: number[] = Array.from({ length: b.length + 1 }, (_, i) => i);
  for (let i = 1; i <= a.length; i++) {
    let prev = dp[0];
    dp[0] = i;
    for (let j = 1; j <= b.length; j++) {
      const tmp = dp[j];
      dp[j] = a[i - 1] === b[j - 1] ? prev : 1 + Math.min(prev, dp[j], dp[j - 1]);
      prev = tmp;
    }
  }
  return dp[b.length];
}

function similar(a: string, b: string): boolean {
  const longer = Math.max(a.length, b.length);
  if (longer === 0) return true;
  return levenshtein(a.toLowerCase(), b.toLowerCase()) / longer <= 0.1;
}

function topicTokens(text: string): string[] {
  return [...text.toLowerCase().matchAll(NOUN_RE)]
    .map((m) => m[1])
    .filter((n) => !STOP_NOUNS.has(n));
}

export function detectD5RepeatedReask(prompts: UserPrompt[], claudeMd: ParsedClaudeMd): Issue[] {
  const buckets: UserPrompt[][] = [];
  for (const p of prompts) {
    const matched = buckets.find((b) => similar(b[0].text, p.text));
    if (matched) matched.push(p);
    else buckets.push([p]);
  }
  const claudeText = claudeMd.lines.map((l) => l.text).join(" ").toLowerCase();
  const issues: Issue[] = [];
  let counter = 1;
  for (const bucket of buckets) {
    if (bucket.length < 3) continue;
    const tokens = topicTokens(bucket[0].text);
    const claudeMentions = tokens.filter((t) => claudeText.includes(t)).length;
    if (claudeMentions >= Math.max(1, Math.ceil(tokens.length / 2))) continue;
    issues.push({
      id: `i-d5-${String(counter++).padStart(3, "0")}`,
      detector: "D5",
      category: "add-rule",
      claude_md_anchor: null,
      evidence: {
        session_excerpts: bucket.slice(0, 3).map((p) => ({
          session_id: p.session_id,
          excerpt: p.text.slice(0, 80),
        })),
      },
      raw_summary: `User asked the same question ≥${bucket.length}× and CLAUDE.md doesn't answer it`,
      estimated_corrections_avoided_per_week: bucket.length / 4,
      confidence: "medium",
    });
  }
  return issues;
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `bun test cli/src/lib/claude-md-improver.test.ts -t detectD5`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add cli/src/lib/claude-md-improver.ts cli/src/lib/claude-md-improver.test.ts
git commit -m "feat(claude-md-improver): D5 repeated-reask detector"
```

---

### Task 11: Detector D6 — candidate contradiction pairs

**Files:**
- Modify: `cli/src/lib/claude-md-improver.ts`
- Test: `cli/src/lib/claude-md-improver.test.ts`

- [ ] **Step 1: Write the failing test**

Append:

```ts
import { detectD6ContradictionCandidates } from "./claude-md-improver.js";

describe("detectD6ContradictionCandidates", () => {
  test("flags two rules that share a topic and have opposite polarity", () => {
    const md = parseClaudeMd(
      "Always use yarn for installs.\nNever use yarn — prefer npm.\n"
    );
    const issues = detectD6ContradictionCandidates(md);
    expect(issues.length).toBeGreaterThanOrEqual(1);
    expect(issues[0].detector).toBe("D6");
    expect(issues[0].category).toBe("fix-contradiction");
    expect(issues[0].evidence.related_rules?.length).toBe(2);
  });

  test("does not flag two rules on different topics", () => {
    const md = parseClaudeMd("Always use npm.\nNever push to main.\n");
    expect(detectD6ContradictionCandidates(md)).toEqual([]);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `bun test cli/src/lib/claude-md-improver.test.ts -t detectD6`
Expected: FAIL.

- [ ] **Step 3: Write minimal implementation**

Append:

```ts
const POSITIVE_RE = /\b(always|prefer|use)\b/i;
const NEGATIVE_RE = /\b(never|don't|avoid|do not)\b/i;

export function detectD6ContradictionCandidates(parsed: ParsedClaudeMd): Issue[] {
  type Tagged = { line: ParsedLine; tokens: Set<string>; polarity: "+" | "-" };
  const tagged: Tagged[] = [];
  for (const line of parsed.lines) {
    const pos = POSITIVE_RE.test(line.text);
    const neg = NEGATIVE_RE.test(line.text);
    if (!pos && !neg) continue;
    const tokens = new Set(topicTokens(line.text));
    if (tokens.size === 0) continue;
    tagged.push({ line, tokens, polarity: neg ? "-" : "+" });
  }
  const issues: Issue[] = [];
  let counter = 1;
  for (let i = 0; i < tagged.length; i++) {
    for (let j = i + 1; j < tagged.length; j++) {
      const a = tagged[i];
      const b = tagged[j];
      if (a.polarity === b.polarity) continue;
      const overlap = [...a.tokens].filter((t) => b.tokens.has(t));
      if (overlap.length === 0) continue;
      issues.push({
        id: `i-d6-${String(counter++).padStart(3, "0")}`,
        detector: "D6",
        category: "fix-contradiction",
        claude_md_anchor: { line_start: a.line.line_number, line_end: b.line.line_number },
        evidence: { related_rules: [a.line.line_number, b.line.line_number] },
        raw_summary: `Candidate contradiction on "${overlap.join(", ")}"`,
        estimated_corrections_avoided_per_week: 0.25,
        confidence: "low",
      });
    }
  }
  return issues;
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `bun test cli/src/lib/claude-md-improver.test.ts -t detectD6`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add cli/src/lib/claude-md-improver.ts cli/src/lib/claude-md-improver.test.ts
git commit -m "feat(claude-md-improver): D6 candidate contradiction detector"
```

---

### Task 12: Detectors D7–D10

**Files:**
- Modify: `cli/src/lib/claude-md-improver.ts`
- Test: `cli/src/lib/claude-md-improver.test.ts`

- [ ] **Step 1: Write the failing test**

Append:

```ts
import {
  detectD7MissingExample,
  detectD8UnmentionedCommand,
  detectD9ReadmeDuplication,
  detectD10DontGap,
} from "./claude-md-improver.js";

describe("detectD7MissingExample", () => {
  test("flags a 'follow our style' rule with no example/link in next 3 lines", () => {
    const md = parseClaudeMd("Follow our style guide.\n\n\n");
    const collected = {
      project_root: "/p", claude_md: { raw: "Follow our style guide.\n", parsed: md },
      claude_local_md: null, readme_excerpt: null, lockfiles: [], transcript_dir: null, notes: [],
    };
    const issues = detectD7MissingExample(collected);
    expect(issues.length).toBe(1);
    expect(issues[0].category).toBe("add-example");
  });

  test("does not flag when a code fence follows within 3 lines", () => {
    const md = parseClaudeMd("Follow our style.\n```ts\nx\n```\n");
    const collected = {
      project_root: "/p", claude_md: { raw: "x", parsed: md },
      claude_local_md: null, readme_excerpt: null, lockfiles: [], transcript_dir: null, notes: [],
    };
    expect(detectD7MissingExample(collected)).toEqual([]);
  });
});

describe("detectD8UnmentionedCommand", () => {
  test("flags a command that appears ≥5× in transcripts and is absent from CLAUDE.md", () => {
    const prompts = Array.from({ length: 6 }, (_, i) => ({
      session_id: `s${i}`, text: "running `bun run typecheck` again", timestamp: new Date(),
    }));
    const md = parseClaudeMd("Use npm.\n");
    const issues = detectD8UnmentionedCommand(prompts, [], md);
    expect(issues.some((i) => i.raw_summary.includes("typecheck"))).toBe(true);
  });
});

describe("detectD9ReadmeDuplication", () => {
  test("flags a CLAUDE.md rule that is verbatim in README", () => {
    const md = parseClaudeMd("This project uses npm 10.\n");
    const collected = {
      project_root: "/p",
      claude_md: { raw: "x", parsed: md },
      claude_local_md: null,
      readme_excerpt: "# Project\n\nThis project uses npm 10.\n",
      lockfiles: [], transcript_dir: null, notes: [],
    };
    const issues = detectD9ReadmeDuplication(collected);
    expect(issues.length).toBe(1);
    expect(issues[0].category).toBe("dedupe");
  });
});

describe("detectD10DontGap", () => {
  test("flags when CLAUDE.md has only positive rules and transcripts show recurring 'don't' classes", () => {
    const md = parseClaudeMd("Always use npm.\nAlways run tests.\n");
    const prompts = [
      { session_id: "s1", text: "don't auto-format on save", timestamp: new Date() },
      { session_id: "s2", text: "don't auto-format on save", timestamp: new Date() },
      { session_id: "s3", text: "don't auto-format on save", timestamp: new Date() },
    ];
    const issues = detectD10DontGap(prompts, md);
    expect(issues.length).toBeGreaterThanOrEqual(1);
    expect(issues[0].category).toBe("add-rule");
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `bun test cli/src/lib/claude-md-improver.test.ts -t "detectD7|detectD8|detectD9|detectD10"`
Expected: FAIL.

- [ ] **Step 3: Write minimal implementation**

Append:

```ts
const STYLE_RE = /\b(style|format|convention|guide)\b/i;
const FENCE_OR_LINK_RE = /(```|https?:\/\/|`[^`]+`)/;

export function detectD7MissingExample(collected: CollectOutput): Issue[] {
  if (!collected.claude_md) return [];
  const lines = collected.claude_md.parsed.lines;
  const issues: Issue[] = [];
  let counter = 1;
  for (let i = 0; i < lines.length; i++) {
    const l = lines[i];
    if (!STYLE_RE.test(l.text)) continue;
    const window = lines.slice(i, Math.min(lines.length, i + 4)).map((x) => x.text).join("\n");
    if (FENCE_OR_LINK_RE.test(window)) continue;
    issues.push({
      id: `i-d7-${String(counter++).padStart(3, "0")}`,
      detector: "D7",
      category: "add-example",
      claude_md_anchor: { line_start: l.line_number, line_end: l.line_number },
      evidence: { related_rules: [l.line_number] },
      raw_summary: `Rule mentions "${l.text.match(STYLE_RE)?.[0]}" without an example or link`,
      estimated_corrections_avoided_per_week: 0.25,
      confidence: "medium",
    });
  }
  return issues;
}

const BACKTICK_CMD_RE = /`([a-z][a-z0-9 .:_-]*?\s+[a-z0-9].*?)`/gi;

export function detectD8UnmentionedCommand(
  prompts: UserPrompt[],
  commitSubjects: string[],
  claudeMd: ParsedClaudeMd,
): Issue[] {
  const counts = new Map<string, number>();
  const sources = [...prompts.map((p) => p.text), ...commitSubjects];
  for (const text of sources) {
    for (const m of text.matchAll(BACKTICK_CMD_RE)) {
      const cmd = m[1].trim();
      if (cmd.length < 4 || cmd.length > 60) continue;
      counts.set(cmd, (counts.get(cmd) ?? 0) + 1);
    }
  }
  const claudeText = claudeMd.lines.map((l) => l.text).join(" ");
  const issues: Issue[] = [];
  let counter = 1;
  for (const [cmd, count] of counts) {
    if (count < 5) continue;
    if (claudeText.includes(cmd)) continue;
    issues.push({
      id: `i-d8-${String(counter++).padStart(3, "0")}`,
      detector: "D8",
      category: "add-rule",
      claude_md_anchor: null,
      evidence: {},
      raw_summary: `Command \`${cmd}\` used ${count}× but not documented in CLAUDE.md`,
      estimated_corrections_avoided_per_week: 0.5,
      confidence: count >= 10 ? "high" : "medium",
    });
  }
  return issues;
}

function normalize(text: string): string {
  return text.toLowerCase().replace(/\s+/g, " ").trim();
}

export function detectD9ReadmeDuplication(collected: CollectOutput): Issue[] {
  if (!collected.claude_md || !collected.readme_excerpt) return [];
  const readmeNorm = normalize(collected.readme_excerpt);
  const issues: Issue[] = [];
  let counter = 1;
  for (const line of collected.claude_md.parsed.lines) {
    const text = line.text.trim();
    if (text.length < 20) continue;
    const norm = normalize(text);
    if (!readmeNorm.includes(norm)) continue;
    issues.push({
      id: `i-d9-${String(counter++).padStart(3, "0")}`,
      detector: "D9",
      category: "dedupe",
      claude_md_anchor: { line_start: line.line_number, line_end: line.line_number },
      evidence: { related_rules: [line.line_number] },
      raw_summary: `Rule duplicates README content verbatim`,
      estimated_corrections_avoided_per_week: 0.1,
      confidence: "high",
    });
  }
  return issues;
}

const DONT_RE = /^(don't|do not|avoid|never)\b/i;

export function detectD10DontGap(prompts: UserPrompt[], claudeMd: ParsedClaudeMd): Issue[] {
  const hasNegative = claudeMd.lines.some((l) => NEGATIVE_RE.test(l.text));
  if (hasNegative) return [];
  const buckets = new Map<string, UserPrompt[]>();
  for (const p of prompts) {
    if (!DONT_RE.test(p.text.trim())) continue;
    const key = normalize(p.text.replace(DONT_RE, "").slice(0, 40));
    const list = buckets.get(key) ?? [];
    list.push(p);
    buckets.set(key, list);
  }
  const issues: Issue[] = [];
  let counter = 1;
  for (const [key, list] of buckets) {
    if (list.length < 3) continue;
    issues.push({
      id: `i-d10-${String(counter++).padStart(3, "0")}`,
      detector: "D10",
      category: "add-rule",
      claude_md_anchor: null,
      evidence: {
        session_excerpts: list.slice(0, 3).map((p) => ({ session_id: p.session_id, excerpt: p.text.slice(0, 80) })),
      },
      raw_summary: `Recurring "don't" pattern not in CLAUDE.md: "${key.slice(0, 40)}"`,
      estimated_corrections_avoided_per_week: list.length / 4,
      confidence: list.length >= 5 ? "high" : "medium",
    });
  }
  return issues;
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `bun test cli/src/lib/claude-md-improver.test.ts -t "detectD7|detectD8|detectD9|detectD10"`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add cli/src/lib/claude-md-improver.ts cli/src/lib/claude-md-improver.test.ts
git commit -m "feat(claude-md-improver): D7-D10 detectors"
```

---

### Task 13: `detect()` orchestration + scoring

**Files:**
- Modify: `cli/src/lib/claude-md-improver.ts`
- Test: `cli/src/lib/claude-md-improver.test.ts`

- [ ] **Step 1: Write the failing test**

Append:

```ts
import { detect, scoreIssue, confidenceWeight } from "./claude-md-improver.js";

describe("scoreIssue", () => {
  test("priority = monthly_savings × confidence_weight", () => {
    const w = confidenceWeight("high");
    const issue: Issue = {
      id: "i", detector: "D1", category: "remove-stale-rule",
      claude_md_anchor: null, evidence: {}, raw_summary: "x",
      estimated_corrections_avoided_per_week: 2, confidence: "high",
    };
    const monthly = 2 * 2.5 * 4; // = 20
    expect(scoreIssue(issue)).toBeCloseTo(monthly * w);
  });
});

describe("detect", () => {
  test("orchestrates all detectors and tags issues with score", () => {
    const project = mkdtempSync(join(tmpdir(), "jstack-detect-"));
    try {
      writeFileSync(join(project, "CLAUDE.md"), "Use yarn for installs.\nAlways test.\n");
      writeFileSync(join(project, "package-lock.json"), "{}");
      const collected = collect({ projectRoot: project, homeDir: tmpdir(), now: new Date() });
      const result = detect(collected, [], []);
      expect(result.issues.some((i) => i.detector === "D1")).toBe(true);
      expect(result.issues.some((i) => i.detector === "D3")).toBe(true);
      expect(result.scored.length).toBe(result.issues.length);
      expect(result.scored[0].priority_score).toBeGreaterThanOrEqual(result.scored[result.scored.length - 1].priority_score);
    } finally {
      rmSync(project, { recursive: true, force: true });
    }
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `bun test cli/src/lib/claude-md-improver.test.ts -t "scoreIssue|^detect$"`
Expected: FAIL.

- [ ] **Step 3: Write minimal implementation**

Append:

```ts
export function confidenceWeight(c: Confidence): number {
  return c === "high" ? 1.0 : c === "medium" ? 0.7 : 0.4;
}

export function scoreIssue(issue: Issue): number {
  const monthly = issue.estimated_corrections_avoided_per_week * 2.5 * 4;
  return monthly * confidenceWeight(issue.confidence);
}

export type ScoredIssue = Issue & {
  priority_score: number;
  monthly_savings_min: number;
  time_saved_min_per_week: number;
};

export type DetectOutput = {
  issues: Issue[];
  scored: ScoredIssue[];
};

export function detect(
  collected: CollectOutput,
  prompts: UserPrompt[],
  commitSubjects: string[],
): DetectOutput {
  const md = collected.claude_md?.parsed ?? parseClaudeMd("");
  const issues: Issue[] = [
    ...detectD1StalePackageManager(collected),
    ...detectD2StalePath(collected),
    ...detectD3VagueRule(collected),
    ...detectD4RepeatedCorrection(prompts),
    ...detectD5RepeatedReask(prompts, md),
    ...detectD6ContradictionCandidates(md),
    ...detectD7MissingExample(collected),
    ...detectD8UnmentionedCommand(prompts, commitSubjects, md),
    ...detectD9ReadmeDuplication(collected),
    ...detectD10DontGap(prompts, md),
  ];
  const scored: ScoredIssue[] = issues
    .map((i) => ({
      ...i,
      time_saved_min_per_week: i.estimated_corrections_avoided_per_week * 2.5,
      monthly_savings_min: i.estimated_corrections_avoided_per_week * 2.5 * 4,
      priority_score: scoreIssue(i),
    }))
    .sort((a, b) => b.priority_score - a.priority_score);
  return { issues, scored };
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `bun test cli/src/lib/claude-md-improver.test.ts -t "scoreIssue|^detect$"`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add cli/src/lib/claude-md-improver.ts cli/src/lib/claude-md-improver.test.ts
git commit -m "feat(claude-md-improver): detect() orchestrator + priority scoring"
```

---

### Task 14: `render()` — markdown report + unified diff + CLI subcommand + config wiring

**Files:**
- Modify: `cli/src/lib/claude-md-improver.ts`
- Create: `cli/src/commands/claude-md.ts`
- Create: `cli/src/commands/claude-md.test.ts`
- Modify: `cli/src/index.ts`
- Modify: `config/schema.json`
- Modify: `config/defaults.json`

- [ ] **Step 1: Write the failing test**

Create `cli/src/commands/claude-md.test.ts`:

```ts
import { describe, expect, test } from "bun:test";
import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { runClaudeMdScan } from "./claude-md.js";

describe("runClaudeMdScan", () => {
  test("emits JSON with issues + meta when --output=json", async () => {
    const project = mkdtempSync(join(tmpdir(), "jstack-cmd-"));
    try {
      writeFileSync(join(project, "CLAUDE.md"), "Use yarn for installs.\n");
      writeFileSync(join(project, "package-lock.json"), "{}");
      const result = await runClaudeMdScan({
        projectRoot: project,
        homeDir: tmpdir(),
        output: "json",
        now: new Date("2026-04-29T00:00:00Z"),
      });
      expect(result.format).toBe("json");
      const payload = JSON.parse(result.text);
      expect(Array.isArray(payload.issues)).toBe(true);
      expect(payload.issues.some((i: any) => i.detector === "D1")).toBe(true);
      expect(payload.meta.project_root).toBe(project);
    } finally {
      rmSync(project, { recursive: true, force: true });
    }
  });

  test("renders prose report when --output=prose", async () => {
    const project = mkdtempSync(join(tmpdir(), "jstack-cmd-prose-"));
    try {
      writeFileSync(join(project, "CLAUDE.md"), "Use yarn.\n");
      writeFileSync(join(project, "package-lock.json"), "{}");
      const result = await runClaudeMdScan({
        projectRoot: project,
        homeDir: tmpdir(),
        output: "prose",
        now: new Date("2026-04-29T00:00:00Z"),
      });
      expect(result.format).toBe("prose");
      expect(result.text).toContain("# CLAUDE.md Improvements");
      expect(result.text).toContain("D1");
    } finally {
      rmSync(project, { recursive: true, force: true });
    }
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `bun test cli/src/commands/claude-md.test.ts`
Expected: FAIL — `runClaudeMdScan` not found.

- [ ] **Step 3: Write minimal implementation — render helpers**

Append to `cli/src/lib/claude-md-improver.ts`:

```ts
export type RenderInput = {
  collected: CollectOutput;
  scored: ScoredIssue[];
  generated_at: string;
};

export function renderProse(input: RenderInput): string {
  const lines: string[] = [];
  lines.push(`# CLAUDE.md Improvements — ${input.collected.project_root} — ${input.generated_at}`);
  lines.push("");
  if (input.collected.notes.length > 0) {
    lines.push("> Notes:");
    for (const n of input.collected.notes) lines.push(`> - ${n}`);
    lines.push("");
  }
  lines.push(`Detected ${input.scored.length} candidate issues (LLM proposes patches in stage 3 of the skill).`);
  lines.push("");
  let n = 1;
  for (const i of input.scored) {
    lines.push(`## ${n}. ${i.raw_summary}   [priority: ${i.priority_score.toFixed(1)}]`);
    lines.push(`- Detector: ${i.detector}`);
    lines.push(`- Category: ${i.category}`);
    lines.push(`- Confidence: ${i.confidence}`);
    lines.push(`- Saves ~${i.monthly_savings_min.toFixed(0)} min/month`);
    if (i.claude_md_anchor) lines.push(`- CLAUDE.md line(s): ${i.claude_md_anchor.line_start}–${i.claude_md_anchor.line_end}`);
    if (i.evidence.commits?.length) lines.push(`- Commits: ${i.evidence.commits.join(", ")}`);
    if (i.evidence.file_paths?.length) lines.push(`- Files: ${i.evidence.file_paths.join(", ")}`);
    if (i.evidence.session_excerpts?.length) {
      lines.push(`- Sessions:`);
      for (const e of i.evidence.session_excerpts) lines.push(`  - \`${e.session_id}\`: ${e.excerpt}`);
    }
    lines.push("");
    n++;
  }
  return lines.join("\n");
}

export type RenderOutput = { format: "json" | "prose"; text: string };

export function render(input: RenderInput, format: "json" | "prose"): RenderOutput {
  if (format === "json") {
    return {
      format: "json",
      text: JSON.stringify(
        {
          $schema: "https://jstack.dev/schema/claude-md-improver-output.json",
          meta: {
            project_root: input.collected.project_root,
            generated_at: input.generated_at,
            notes: input.collected.notes,
          },
          issues: input.scored,
        },
        null,
        2,
      ),
    };
  }
  return { format: "prose", text: renderProse(input) };
}
```

- [ ] **Step 4: Write the CLI command file**

Create `cli/src/commands/claude-md.ts`:

```ts
import { Command } from "commander";
import {
  collect,
  detect,
  readTranscriptUserPrompts,
  render,
  type CollectOutput,
  type ScoredIssue,
} from "../lib/claude-md-improver.js";
import { findProjectRoot } from "../lib/config.js";
import { homedir } from "node:os";

export type ClaudeMdScanOpts = {
  projectRoot?: string;
  homeDir?: string;
  output?: "json" | "prose";
  now?: Date;
  transcriptLookbackDays?: number;
};

export async function runClaudeMdScan(opts: ClaudeMdScanOpts) {
  const projectRoot = opts.projectRoot ?? findProjectRoot(process.cwd()) ?? process.cwd();
  const homeDir = opts.homeDir ?? homedir();
  const now = opts.now ?? new Date();
  const lookback = opts.transcriptLookbackDays ?? 30;

  const collected = collect({ projectRoot, homeDir, now });
  const prompts = collected.transcript_dir
    ? readTranscriptUserPrompts(collected.transcript_dir, now, lookback)
    : [];
  const result = detect(collected, prompts, []);
  return render(
    { collected, scored: result.scored, generated_at: now.toISOString() },
    opts.output ?? "prose",
  );
}

export function registerClaudeMdCommand(program: Command): void {
  const cmd = program.command("claude-md").description("CLAUDE.md improvement workflow (read-only by default)");
  cmd
    .command("scan")
    .description("Scan the project and emit issues (no LLM, no patch). Used by the SKILL.md.")
    .option("--output <fmt>", "json | prose", "prose")
    .action(async (o: { output?: string }) => {
      const out = await runClaudeMdScan({ output: (o.output as "json" | "prose") ?? "prose" });
      process.stdout.write(out.text + (out.format === "prose" ? "" : "\n"));
    });
}
```

- [ ] **Step 5: Wire the subcommand into the CLI entry**

In `cli/src/index.ts`, add to the import block (after the existing imports near the top):

```ts
import { registerClaudeMdCommand } from "./commands/claude-md.js";
```

And after `program.name(...)` block, before the existing `program.command("setup")` registration, add:

```ts
registerClaudeMdCommand(program);
```

- [ ] **Step 6: Add config schema and default**

In `config/schema.json`, find the `properties` object and add a new entry (alphabetical-ish, near `cross_plugins`):

```json
"claude_md_improver": {
  "type": "object",
  "additionalProperties": true,
  "description": "CLAUDE.md improver knobs — see skills/skill-creator/improve-claude-md/SKILL.md",
  "properties": {
    "enabled": { "type": "boolean" },
    "transcript_lookback_days": { "type": "integer", "minimum": 1 },
    "commit_lookback_count": { "type": "integer", "minimum": 1 },
    "min_priority": { "type": "number" },
    "persona_threshold": { "type": "integer", "minimum": 1, "maximum": 4 },
    "report_path": { "type": "string" },
    "patch_path": { "type": "string" },
    "high_correction_session_threshold": { "type": "integer", "minimum": 1 }
  }
},
```

In `config/defaults.json`, add (matching the schema position):

```json
"claude_md_improver": {
  "enabled": false,
  "transcript_lookback_days": 30,
  "commit_lookback_count": 100,
  "min_priority": 5.0,
  "persona_threshold": 3,
  "report_path": ".jstack/claude-md-improvements-{date}.md",
  "patch_path": ".jstack/claude-md-improvements-{date}.patch",
  "high_correction_session_threshold": 5
},
```

- [ ] **Step 7: Run tests + typecheck + validate-config**

Run:

```bash
bun test cli/src/lib/claude-md-improver.test.ts cli/src/commands/claude-md.test.ts
bun run typecheck:cli
bun run validate-config
```

Expected: all green.

- [ ] **Step 8: Smoke-test the CLI on a small project**

Run:

```bash
mkdir -p /tmp/cmd-smoke && cd /tmp/cmd-smoke && echo "Use yarn for installs." > CLAUDE.md && echo '{}' > package-lock.json && /Users/jonathan.boice/Documents/GitHub/jstack/jstack.core/cli/jstack claude-md scan --output prose | head -20
```

Expected: prose output containing `D1` and `Use yarn`.

- [ ] **Step 9: Update CHANGELOG**

In `CHANGELOG.md`, under `## Unreleased`, prepend a bullet:

```markdown
- **CLAUDE.md improver (PR-1):** typed Bun module + `jstack claude-md scan` subcommand + 10 detectors (D1–D10) + PII redaction. Skill is gated (`claude_md_improver.enabled=false` by default); no behavior change for existing users.
```

- [ ] **Step 10: Commit**

```bash
git add cli/src/lib/claude-md-improver.ts cli/src/lib/claude-md-improver.test.ts \
        cli/src/commands/claude-md.ts cli/src/commands/claude-md.test.ts \
        cli/src/index.ts config/schema.json config/defaults.json CHANGELOG.md
git commit -m "feat(claude-md-improver): wire jstack claude-md scan + config schema (PR-1)"
```

---

**End of PR-1.** Open the PR, get review, merge before starting PR-2.

---

## PR-2 — PM persona + persona-review rubric

### Task 15: Author `prompts/personas/pm.md`

**Files:**
- Create: `prompts/personas/pm.md`

- [ ] **Step 1: Read the sibling files for tone/shape**

```bash
cat prompts/personas/ceo.md prompts/personas/engineer.md prompts/personas/qa.md
```

- [ ] **Step 2: Write the file**

Create `prompts/personas/pm.md`:

```markdown
# Persona: Product Manager

> **Owner:** PM lead or product manager. Edit this to reflect what YOUR PMs actually push back on — their cadence, their rituals, their definition of done.

## Lens

<!-- [CUSTOMIZE] Replace with your team's real PM concerns -->

- **Your trigger clarity bar** — Can a user tell when to invoke this rule/feature?
  <!-- Example: "Every rule must have an observable trigger. 'Use this when needed' is rejected — name the user state that fires it." -->
- **Your outcome observability** — How do we know this rule worked?
  <!-- Example: "Each rule should have a session-level metric: corrections-per-session, time-to-PR, etc. If you can't measure it, don't write it." -->
- **Your workflow fit** — Does this match what users actually do, not what we wish they'd do?
  <!-- Example: "Rules that assume a clean trunk-based workflow break for our 3 teams using long-lived feature branches. Verify before writing." -->

## Review style

<!-- [CUSTOMIZE] How does your PM team give feedback? -->
Lead with the user, not the rule:
- Bad: "This rule says always run tests."
- Good: "When does the user encounter this? After they finish coding, before they push? Then 'always run tests before `git push`' is sharper."

## Hard rejects (block the rule)

- **Vague trigger.** "When needed" / "as appropriate" / "if relevant".
- **Unobservable outcome.** No way to tell whether the rule fired correctly in a session.
- **Contradicts another tool's docs.** Conflicts with the framework, language, or platform doc the team already follows.
- **Vendor lock without justification.** "Use Vendor X" without naming what specifically about X is required.

## Sub-scores you give (1-10 each, average ≥8 to accept)

- **Trigger clarity** — Can a reader name the moment the rule fires?
- **Outcome observability** — Can a reader name how to verify the rule worked?
- **Workflow fit** — Does the rule match what users actually do today?
```

- [ ] **Step 3: Verify the file is detected by the persona-review pass**

The skill SKILL.md (PR-3) will reference `${CLAUDE_PLUGIN_ROOT}/prompts/personas/pm.md`. For now confirm:

```bash
ls prompts/personas/pm.md && wc -l prompts/personas/pm.md
```

Expected: file exists, ~30 lines.

- [ ] **Step 4: Commit**

```bash
git add prompts/personas/pm.md
git commit -m "feat(personas): add Product Manager persona"
```

---

### Task 16: Persona-review rubric reference

**Files:**
- Create: `skills/skill-creator/improve-claude-md/references/persona-review.md` (skill folder is created here for the first time)

- [ ] **Step 1: Create folder + write the rubric file**

Create `skills/skill-creator/improve-claude-md/references/persona-review.md`:

```markdown
# Persona Review Rubric — CLAUDE.md Improvements

This rubric makes the four-persona pass reproducible enough to test (`--persona-mode=rubric-only`) and consistent enough to trust in production (LLM-driven).

## Inputs

- One `ProposedEdit` (see `cli/src/lib/claude-md-improver.ts` types).
- The four persona files: `prompts/personas/{ceo,pm,engineer,qa}.md`.

## Output per persona

```yaml
persona: ceo | pm | engineer | qa
sub_scores:
  s1: 1..10        # see table below for what s1/s2/s3 mean per persona
  s2: 1..10
  s3: 1..10
average: number    # mean of s1..s3
verdict: accept | revise | reject
edit_for_revise:   # present iff verdict=revise; one-line text edit applied to the ProposedEdit field named in 'edit_target'
edit_target: rationale | after | example
reason: string     # one sentence
```

## Sub-score definitions

| Persona | s1 | s2 | s3 |
|---------|----|----|----|
| CEO     | Strategic value | Avoids over-prescription | Risk profile |
| PM      | Trigger clarity | Outcome observability | Workflow fit |
| ENG     | Technical accuracy | Convention fit | No conflict with another rule |
| QA      | Testability | Reversibility | Failure-mode coverage |

## Acceptance rule

An edit is **accepted** iff:

- ≥3 of 4 personas have `average ≥ 8` AND `verdict ≠ reject`, **OR**
- All 4 personas have `average ≥ 8` after one auto-revision pass (apply the persona's `edit_for_revise` to the ProposedEdit field named by `edit_target`, then re-score).

## Rubric-only test mode

When invoked with `--persona-mode=rubric-only`, the LLM is bypassed. Each sub-score is computed by these rules:

| Persona | s1 rule | s2 rule | s3 rule |
|---------|---------|---------|---------|
| CEO     | `+2` if `priority_score ≥ 20`; `+2` if confidence=high; base 5 | `+3` if `after.length ≤ 200`; base 6 | `+3` if `category != "remove-stale-rule"` else +1; base 6 |
| PM      | `+3` if `example` is non-empty AND contains a verb; base 5 | `+3` if `benefit` includes the word "stop", "avoid", "reduce", or "eliminate"; base 5 | `+2` if evidence has ≥1 commit OR ≥1 session excerpt; base 6 |
| ENG     | `+2` if `diff_hunk` parses as unified diff; base 6 | `+2` if `before`/`after` types match category (e.g. add-rule has `before=null`); base 6 | `+2` if no other accepted edit shares the same `claude_md_anchor.line_start`; base 6 |
| QA      | `+3` if `example` is non-empty; base 5 | `+2` if `category != "fix-contradiction"` else +0 (contradictions are higher-risk to apply); base 6 | `+3` if `confidence != "low"`; base 5 |

Each sub-score is clamped to `[1, 10]`.

## Hard rejects (override accept)

- **CEO:** `category == "add-rule"` AND `after` mentions a specific vendor without justification → `verdict: reject`.
- **PM:** `example` is empty OR `benefit` is empty → `verdict: reject`.
- **ENG:** `diff_hunk` does not include `@@` → `verdict: reject`.
- **QA:** `confidence == "low"` AND `category == "fix-contradiction"` → `verdict: reject`.
```

- [ ] **Step 2: Commit**

```bash
git add skills/skill-creator/improve-claude-md/references/persona-review.md
git commit -m "docs(claude-md-improver): persona-review rubric reference"
```

---

### Task 17: Detector implementation notes (`detectors.md`) + scoring reference

**Files:**
- Create: `skills/skill-creator/improve-claude-md/references/detectors.md`
- Create: `skills/skill-creator/improve-claude-md/references/scoring.md`
- Create: `skills/skill-creator/improve-claude-md/references/output-schema.md`

- [ ] **Step 1: Write `detectors.md`**

Create `skills/skill-creator/improve-claude-md/references/detectors.md`:

```markdown
# Detectors D1–D10 — Implementation Notes

Each detector is a pure function in `cli/src/lib/claude-md-improver.ts`. Tests (`cli/src/lib/claude-md-improver.test.ts`) pin the contract.

| # | Function | Source | Output category |
|---|----------|--------|-----------------|
| D1 | `detectD1StalePackageManager(collected)` | CLAUDE.md + lockfiles | `remove-stale-rule` |
| D2 | `detectD2StalePath(collected)` | CLAUDE.md + working tree | `remove-stale-rule` |
| D3 | `detectD3VagueRule(collected)` | CLAUDE.md | `sharpen-rule` |
| D4 | `detectD4RepeatedCorrection(prompts)` | session JSONL | `add-rule` |
| D5 | `detectD5RepeatedReask(prompts, claudeMd)` | session JSONL | `add-rule` |
| D6 | `detectD6ContradictionCandidates(parsed)` | CLAUDE.md (pairs) | `fix-contradiction` |
| D7 | `detectD7MissingExample(collected)` | CLAUDE.md | `add-example` |
| D8 | `detectD8UnmentionedCommand(prompts, commits, md)` | commits + transcripts | `add-rule` |
| D9 | `detectD9ReadmeDuplication(collected)` | CLAUDE.md + README | `dedupe` |
| D10 | `detectD10DontGap(prompts, md)` | session JSONL + CLAUDE.md | `add-rule` |

## Adding a new detector

1. Add a function `detectDN<Name>(...)` in `cli/src/lib/claude-md-improver.ts`.
2. Add a fixture + unit test in `cli/src/lib/claude-md-improver.test.ts`.
3. Wire it into `detect()`'s spread.
4. Update this table.

## Confidence guidance

- `high`: deterministic + multi-source evidence (e.g. D1 lockfile + CLAUDE.md text).
- `medium`: deterministic + single-source.
- `low`: heuristic / requires LLM judgment to confirm (e.g. D6 candidate pairs).
```

- [ ] **Step 2: Write `scoring.md`**

Create `skills/skill-creator/improve-claude-md/references/scoring.md`:

```markdown
# Scoring & Priority

`priority_score = monthly_savings_min × confidence_weight`

- `monthly_savings_min = estimated_corrections_avoided_per_week × 2.5 × 4`
- `confidence_weight: high=1.0, medium=0.7, low=0.4`

The default `min_priority` floor is `5.0` (configurable via `claude_md_improver.min_priority`). Scores below the floor are dropped before persona review.

When showing the report to the user, sort descending by `priority_score`. The displayed line:

```
## N. <raw_summary>   [priority: <score>]
```
```

- [ ] **Step 3: Write `output-schema.md`**

Create `skills/skill-creator/improve-claude-md/references/output-schema.md`:

```markdown
# `--output=json` Schema

`$id: https://jstack.dev/schema/claude-md-improver-output.json`

```jsonc
{
  "$schema": "https://jstack.dev/schema/claude-md-improver-output.json",
  "meta": {
    "project_root": "string (absolute path)",
    "generated_at": "ISO 8601 string",
    "notes": "string[]"
  },
  "issues": "ScoredIssue[]"  // see cli/src/lib/claude-md-improver.ts type ScoredIssue
}
```

After the SKILL.md runs stage 3 (LLM proposes edits) and stage 4 (persona review), the final shape adds `recommendations: ProposedEdit[]` and `filtered_out: ProposedEdit[]` keys for use by the routine in PR-4.
```

- [ ] **Step 4: Commit**

```bash
git add skills/skill-creator/improve-claude-md/references/
git commit -m "docs(claude-md-improver): detector + scoring + output-schema references"
```

---

### Task 18: PR-2 CHANGELOG entry

**Files:**
- Modify: `CHANGELOG.md`

- [ ] **Step 1: Update CHANGELOG**

Append to the same `## Unreleased` PR-1 bullet, or add a new bullet:

```markdown
- **CLAUDE.md improver (PR-2):** new `prompts/personas/pm.md` (general-purpose Product Manager persona) + `references/{persona-review,detectors,scoring,output-schema}.md` for the upcoming SKILL.md. Still gated.
```

- [ ] **Step 2: Commit**

```bash
git add CHANGELOG.md
git commit -m "docs(changelog): PR-2 personas + references"
```

---

**End of PR-2.** Open the PR, get review, merge before starting PR-3.

---

## PR-3 — SKILL.md authoring + evals + dogfood + `--apply`

### Task 19: Skip-list entry in `apply_detailed_skills.py`

**Files:**
- Modify: `scripts/apply_detailed_skills.py`

- [ ] **Step 1: Add the new SKIP entry**

Edit `scripts/apply_detailed_skills.py`. Find the `SKIP = {` block and add the line marked `+`:

```python
SKIP = {
    SKILLS / "advice" / "SKILL.md",
    SKILLS / "adr" / "SKILL.md",
    SKILLS / "recon" / "SKILL.md",
    SKILLS / "skill-creator" / "SKILL.md",
+   SKILLS / "skill-creator" / "improve-claude-md" / "SKILL.md",
    SKILLS / "workflow-builder" / "SKILL.md",
    SKILLS / "knowledge" / "search" / "SKILL.md",
    SKILLS / "shortcuts" / "ceo-brainstorm" / "SKILL.md",
    SKILLS / "shortcuts" / "executive-research-brief" / "SKILL.md",
}
```

- [ ] **Step 2: Verify regenerator does not touch the new path**

Run:

```bash
python3 scripts/apply_detailed_skills.py --dry-run 2>/dev/null || python3 scripts/apply_detailed_skills.py
```

Expected: no diff to `skills/skill-creator/improve-claude-md/`.

- [ ] **Step 3: Commit**

```bash
git add scripts/apply_detailed_skills.py
git commit -m "chore(skills): SKIP improve-claude-md from auto-regenerator"
```

---

### Task 20: Author `skills/skill-creator/improve-claude-md/SKILL.md`

**Files:**
- Create: `skills/skill-creator/improve-claude-md/SKILL.md`

- [ ] **Step 1: Write the SKILL.md**

Create `skills/skill-creator/improve-claude-md/SKILL.md`:

```markdown
---
name: jstack-improve-claude-md
description: Audit a project's CLAUDE.md against commits, session transcripts, and working-tree state, then propose ranked edits as a unified diff. Read-only by default; --apply is opt-in. Use when CLAUDE.md feels stale, when you have been correcting Claude on the same thing, or as a monthly hygiene routine.
category: skill-creator
---

<!-- Chain Contract -->
<!-- inputs: user_request, jstack_config, project_root -->
<!-- outputs: structured_result (recommendations, filtered_out, patch_path) -->
<!-- chains-to: jstack:update-config (if persisting new defaults only) -->

Read the setup preamble first:
!cat ${CLAUDE_PLUGIN_ROOT}/prompts/setup/preamble.md

## What this skill is for

**Audit and improve** the project-root `CLAUDE.md` (and `CLAUDE.local.md` if present) by surfacing drift, vagueness, and missing rules. Output is a unified diff against `CLAUDE.md` plus a markdown report. Read-only unless the user passes `--apply`.

- **In scope:** project-root `CLAUDE.md`, `CLAUDE.local.md`, signals from commits / session transcripts / working tree / lockfiles / README / `jstack.config.json`.
- **Out of scope:** authoring **new skills** (use `jstack-skill-creator`); editing global `~/.claude/CLAUDE.md`; running `git` mutations (only `--apply` writes, behind a confirmation).

## Domain rules

- **Default is propose-as-diff.** Never write to `CLAUDE.md` without `--apply` AND a confirmation.
- **Every edit must cite ≥1 piece of evidence** (commit, session, file path, or another rule). No hallucinated rules.
- **PII redaction is always-on** in evidence excerpts (see `cli/src/lib/claude-md-improver.ts` `PII_PATTERNS`).
- **Declined edits are remembered** in `.jstack/claude-md-improver-history.json` and skipped on subsequent runs unless evidence materially changes.
- **Persona review is mandatory** before showing edits to the user — at least 3 of 4 personas (CEO/PM/ENG/QA) must score ≥8.

## Config and references

- `jstack.config.json` keys: `claude_md_improver.{enabled, transcript_lookback_days, commit_lookback_count, min_priority, persona_threshold, report_path, patch_path, high_correction_session_threshold}`.
- Detectors: `${CLAUDE_PLUGIN_ROOT}/skills/skill-creator/improve-claude-md/references/detectors.md`
- Scoring: `${CLAUDE_PLUGIN_ROOT}/skills/skill-creator/improve-claude-md/references/scoring.md`
- Persona rubric: `${CLAUDE_PLUGIN_ROOT}/skills/skill-creator/improve-claude-md/references/persona-review.md`
- Output schema: `${CLAUDE_PLUGIN_ROOT}/skills/skill-creator/improve-claude-md/references/output-schema.md`
- Output formats: `${CLAUDE_PLUGIN_ROOT}/skills/_core/references/output-formats.md`

## Intake

1. Parse `$ARGUMENTS` — note any flags: `--apply`, `--yes`, `--output={prose|json|patch}`, `--persona-mode={llm|rubric-only}`, `--redact`.
2. If `claude_md_improver.enabled` is false, exit with: *"claude-md-improver disabled in config. Set `claude_md_improver.enabled=true` in `jstack.config.json` to use this skill."*
3. If `CLAUDE.md` is missing, suggest `jstack-skill-creator` to scaffold a starter and exit.

## Procedure

### Step 1 — Scan (deterministic)

Run:

```bash
jstack claude-md scan --output json > .jstack/claude-md-issues-$(date +%F).json
```

This reads `CLAUDE.md`, lockfiles, transcripts, commit log, README and emits all detected `Issue`s, scored by priority. **No LLM** is called yet.

If the JSON `meta.notes` includes "No transcripts found", emit a one-line warning to stdout: *"Running without session-derived detectors — recommendations are limited to drift and vagueness."*

### Step 2 — Propose (LLM, one prompt per Issue)

For each `Issue` in the JSON `issues[]` array, write a `ProposedEdit` (see `cli/src/lib/claude-md-improver.ts`). The prompt for each is:

> You are an editor sharpening a CLAUDE.md rule. Given the issue below and the surrounding CLAUDE.md context (lines `[anchor.line_start - 3, anchor.line_end + 3]`), produce a `ProposedEdit` JSON object with these fields: `before`, `after`, `rationale`, `diff_hunk` (unified-diff format), `benefit` (one sentence starting with "Claude…"), `example` (one sentence: a concrete next-session scenario where the rule helps). Cite the evidence verbatim in the rationale. Do not invent new rules.

Reject any LLM output where `before`/`after` types do not match the issue's category (e.g. `add-rule` requires `before: null`).

### Step 3 — Persona review (LLM × 4)

For each `ProposedEdit`, run the four-persona rubric in `references/persona-review.md`. Score sub-scores per the table; compute `average`; emit `verdict`. If any persona's `verdict == revise`, apply its `edit_for_revise` to the named field and re-run that persona once. Drop any edit that fails the acceptance rule (≥3 of 4 average ≥8).

### Step 4 — Render

Pipe the accepted edits back into the deterministic CLI:

```bash
jstack claude-md render --input .jstack/final-edits.json --output prose > .jstack/claude-md-improvements-$(date +%F).md
jstack claude-md render --input .jstack/final-edits.json --output patch > .jstack/claude-md-improvements-$(date +%F).patch
```

### Step 5 — Selection / apply

Print the prose report to the user. Then prompt:

```
Apply edits: [a]ll, [n]one, or numbered hunks (e.g. 1,3,5).
Or run with --apply to apply all without prompting (one git commit will be created).
```

- `[n]one`: write declined IDs to `.jstack/claude-md-improver-history.json` and exit.
- `[a]ll` or numbered: print the exact `git apply` command. Do not run it.
- `--apply`: validate `CLAUDE.md` mtime vs scan time. If unchanged, run `git apply <patch>` then `git add CLAUDE.md && git commit -m "chore: apply CLAUDE.md improver patch <date>"`. If changed, abort with: *"CLAUDE.md changed since scan — re-run the improver."*

## Output shape

- **Summary** — N issues, M accepted, K filtered.
- **Files** — Report path + patch path.
- **Recommendations** — Numbered list (priority desc) with category, benefit, example, persona scores, diff hunk inline.
- **Filtered out (transparency)** — Each rejected edit with the rejecting persona and reason.
- `result_ok: true` or `result_ok: false` + reason.

## Failure modes

| Symptom | Recovery |
|---------|----------|
| `claude-md-improver disabled in config` | Set `claude_md_improver.enabled=true` and re-run. |
| No CLAUDE.md found | Suggest scaffolding via `jstack-skill-creator`. |
| No transcripts found | Continue with confidence=medium ceiling; emit a warning. |
| `git apply` fails (file changed since scan) | Re-run; do not attempt a 3-way merge. |
| Persona review accepts 0 edits | Surface rejected list; suggest `--persona-threshold=2`. |
| LLM proposes a previously-declined rule | Skipped automatically via `.jstack/claude-md-improver-history.json`. |
```

- [ ] **Step 2: Commit**

```bash
git add skills/skill-creator/improve-claude-md/SKILL.md
git commit -m "feat(skills): jstack-improve-claude-md SKILL.md"
```

---

### Task 21: Add `claude-md render` and `claude-md apply` CLI subcommands

**Files:**
- Modify: `cli/src/commands/claude-md.ts`
- Modify: `cli/src/commands/claude-md.test.ts`

- [ ] **Step 1: Write the failing test**

Append to `cli/src/commands/claude-md.test.ts`:

```ts
import { runClaudeMdRender, runClaudeMdApply } from "./claude-md.js";
import { readFileSync, statSync, writeFileSync, mkdirSync } from "node:fs";

describe("runClaudeMdRender", () => {
  test("renders patch from final-edits json", async () => {
    const project = mkdtempSync(join(tmpdir(), "jstack-render-"));
    try {
      writeFileSync(join(project, "CLAUDE.md"), "Use yarn.\n");
      const finalEdits = {
        meta: { project_root: project, generated_at: "2026-04-29T00:00:00Z" },
        recommendations: [
          {
            issue_id: "i-d1-001",
            category: "remove-stale-rule",
            before: "Use yarn.",
            after: "Use npm.",
            rationale: "lockfile is package-lock.json",
            diff_hunk: "@@ -1 +1 @@\n-Use yarn.\n+Use npm.\n",
            benefit: "Claude stops suggesting yarn",
            example: "Ask install lodash → npm install lodash",
            time_saved_min_per_week: 2.5,
            monthly_savings_min: 10,
            confidence: "high",
            priority_score: 10,
          },
        ],
      };
      const inputPath = join(project, "final.json");
      writeFileSync(inputPath, JSON.stringify(finalEdits));
      const result = await runClaudeMdRender({ inputPath, output: "patch" });
      expect(result.text).toContain("@@ -1 +1 @@");
      expect(result.text).toContain("-Use yarn.");
    } finally {
      rmSync(project, { recursive: true, force: true });
    }
  });
});

describe("runClaudeMdApply", () => {
  test("aborts when CLAUDE.md changed since scan", async () => {
    const project = mkdtempSync(join(tmpdir(), "jstack-apply-"));
    try {
      writeFileSync(join(project, "CLAUDE.md"), "Use yarn.\n");
      const before = statSync(join(project, "CLAUDE.md")).mtime;
      // Touch the file to bump mtime.
      writeFileSync(join(project, "CLAUDE.md"), "Use yarn (edited).\n");
      const result = await runClaudeMdApply({
        projectRoot: project,
        patchPath: join(project, "noop.patch"),
        scanMtimeMs: before.getTime(),
        yes: true,
      });
      expect(result.applied).toBe(false);
      expect(result.reason).toContain("changed since scan");
    } finally {
      rmSync(project, { recursive: true, force: true });
    }
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `bun test cli/src/commands/claude-md.test.ts -t "Render|Apply"`
Expected: FAIL.

- [ ] **Step 3: Write minimal implementation**

Append to `cli/src/commands/claude-md.ts`:

```ts
import { readFileSync, statSync } from "node:fs";

export type ClaudeMdRenderOpts = { inputPath: string; output: "prose" | "patch" };

export async function runClaudeMdRender(opts: ClaudeMdRenderOpts) {
  const payload = JSON.parse(readFileSync(opts.inputPath, "utf8"));
  if (opts.output === "patch") {
    const hunks: string[] = (payload.recommendations ?? [])
      .map((r: { diff_hunk: string }) => r.diff_hunk)
      .filter(Boolean);
    return { format: "patch" as const, text: hunks.join("\n") + "\n" };
  }
  // prose: simple bullet list (the SKILL.md formats the rich version)
  const lines: string[] = [];
  lines.push(`# CLAUDE.md Improvements (final)`);
  for (const r of payload.recommendations ?? []) {
    lines.push(`- ${r.issue_id} (${r.category}) — ${r.benefit}`);
  }
  return { format: "prose" as const, text: lines.join("\n") + "\n" };
}

export type ClaudeMdApplyOpts = {
  projectRoot: string;
  patchPath: string;
  scanMtimeMs: number;
  yes: boolean;
};

export async function runClaudeMdApply(opts: ClaudeMdApplyOpts) {
  const claudePath = join(opts.projectRoot, "CLAUDE.md");
  const currentMtime = statSync(claudePath).mtimeMs;
  // Allow up to 1s clock skew tolerance.
  if (currentMtime - opts.scanMtimeMs > 1000) {
    return { applied: false, reason: "CLAUDE.md changed since scan — re-run the improver." };
  }
  if (!opts.yes) {
    return { applied: false, reason: "--apply requires --yes (or interactive confirmation)." };
  }
  // Defer the actual `git apply` to the SKILL.md so the CLI does not assume a git repo state.
  // Return the command for the caller to run.
  return {
    applied: false,
    reason: "ready",
    command: `git -C ${opts.projectRoot} apply ${opts.patchPath} && git -C ${opts.projectRoot} add CLAUDE.md && git -C ${opts.projectRoot} commit -m "chore: apply CLAUDE.md improver patch"`,
  };
}
```

Update `registerClaudeMdCommand` to register `render` and `apply` subcommands:

```ts
  cmd
    .command("render")
    .description("Render final-edits JSON as prose or unified patch.")
    .option("--input <path>", "final-edits JSON", "")
    .option("--output <fmt>", "prose | patch", "patch")
    .action(async (o: { input?: string; output?: string }) => {
      if (!o.input) {
        process.stderr.write("--input required\n");
        process.exit(2);
      }
      const out = await runClaudeMdRender({ inputPath: o.input, output: (o.output as "prose" | "patch") ?? "patch" });
      process.stdout.write(out.text);
    });
  cmd
    .command("apply")
    .description("Validate scan freshness and emit the git-apply command.")
    .option("--patch <path>", "patch file path")
    .option("--scan-mtime <ms>", "epoch ms of CLAUDE.md at scan time")
    .option("--yes", "skip confirmation", false)
    .action(async (o: { patch?: string; scanMtime?: string; yes?: boolean }) => {
      const result = await runClaudeMdApply({
        projectRoot: findProjectRoot(process.cwd()) ?? process.cwd(),
        patchPath: o.patch ?? "",
        scanMtimeMs: Number(o.scanMtime ?? "0"),
        yes: !!o.yes,
      });
      if (result.applied) process.stdout.write("applied\n");
      else process.stdout.write(JSON.stringify(result) + "\n");
    });
```

- [ ] **Step 4: Run test to verify it passes**

Run: `bun test cli/src/commands/claude-md.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add cli/src/commands/claude-md.ts cli/src/commands/claude-md.test.ts
git commit -m "feat(claude-md-improver): render + apply CLI subcommands"
```

---

### Task 22: Cross-link from `skills/skill-creator/SKILL.md`

**Files:**
- Modify: `skills/skill-creator/SKILL.md`

- [ ] **Step 1: Append a sub-skill reference**

In `skills/skill-creator/SKILL.md`, find the section that lists sub-skills (or add one if absent) and append:

```markdown
## Sub-skills

- **`jstack:skill-creator/improve-claude-md`** — Audit and improve the project's CLAUDE.md based on commits, session transcripts, and working-tree state. Read-only by default; emits a unified diff. Use when CLAUDE.md feels stale or when you have been correcting Claude on the same thing repeatedly.
```

- [ ] **Step 2: Commit**

```bash
git add skills/skill-creator/SKILL.md
git commit -m "docs(skill-creator): cross-link improve-claude-md sub-skill"
```

---

### Task 23: Eval fixture — `stale-claude-md`

**Files:**
- Create: `skills/skill-creator/improve-claude-md/evals/inputs/stale-claude-md/CLAUDE.md`
- Create: `skills/skill-creator/improve-claude-md/evals/inputs/stale-claude-md/package-lock.json`
- Create: `skills/skill-creator/improve-claude-md/evals/expected/stale-claude-md.expected.json`
- Create: `cli/src/lib/__fixtures__/claude-md-improver/stale-claude-md/` (mirror)

- [ ] **Step 1: Write fixture inputs**

`skills/skill-creator/improve-claude-md/evals/inputs/stale-claude-md/CLAUDE.md`:

```markdown
# Project rules

## Conventions

Use yarn for installs.
Tests live in `__tests__/`.
Always test before pushing.
```

`skills/skill-creator/improve-claude-md/evals/inputs/stale-claude-md/package-lock.json`:

```json
{}
```

- [ ] **Step 2: Write expected detector output**

`skills/skill-creator/improve-claude-md/evals/expected/stale-claude-md.expected.json`:

```json
{
  "expected_detectors": ["D1", "D2", "D3"],
  "min_issue_count": 3
}
```

- [ ] **Step 3: Mirror under cli fixtures**

```bash
mkdir -p cli/src/lib/__fixtures__/claude-md-improver/stale-claude-md
cp skills/skill-creator/improve-claude-md/evals/inputs/stale-claude-md/CLAUDE.md cli/src/lib/__fixtures__/claude-md-improver/stale-claude-md/
cp skills/skill-creator/improve-claude-md/evals/inputs/stale-claude-md/package-lock.json cli/src/lib/__fixtures__/claude-md-improver/stale-claude-md/
```

- [ ] **Step 4: Add an integration test that runs the fixture**

Append to `cli/src/lib/claude-md-improver.test.ts`:

```ts
describe("fixture: stale-claude-md", () => {
  test("yields D1, D2, D3 issues with priority sort", () => {
    const fixtureRoot = join(import.meta.dir, "__fixtures__/claude-md-improver/stale-claude-md");
    const collected = collect({ projectRoot: fixtureRoot, homeDir: tmpdir(), now: new Date() });
    const result = detect(collected, [], []);
    const detectors = new Set(result.scored.map((i) => i.detector));
    expect(detectors.has("D1")).toBe(true);
    expect(detectors.has("D2")).toBe(true);
    expect(detectors.has("D3")).toBe(true);
  });
});
```

- [ ] **Step 5: Run the test**

Run: `bun test cli/src/lib/claude-md-improver.test.ts -t "fixture: stale-claude-md"`
Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add cli/src/lib/__fixtures__/claude-md-improver/stale-claude-md \
        skills/skill-creator/improve-claude-md/evals/inputs/stale-claude-md \
        skills/skill-creator/improve-claude-md/evals/expected/stale-claude-md.expected.json \
        cli/src/lib/claude-md-improver.test.ts
git commit -m "test(claude-md-improver): stale-claude-md fixture"
```

---

### Task 24: Eval fixture — `missing-rules-from-corrections`

**Files:**
- Create: `cli/src/lib/__fixtures__/claude-md-improver/missing-rules-from-corrections/CLAUDE.md`
- Create: `cli/src/lib/__fixtures__/claude-md-improver/missing-rules-from-corrections/transcripts/<uuid>.jsonl`

- [ ] **Step 1: Write the CLAUDE.md (minimal — leaves D4 to fire)**

```markdown
# Project rules

## Conventions

Use npm.
```

- [ ] **Step 2: Write a synthetic JSONL transcript**

`cli/src/lib/__fixtures__/claude-md-improver/missing-rules-from-corrections/transcripts/00000000-0000-0000-0000-000000000001.jsonl`:

```jsonl
{"type":"user","timestamp":"2026-04-20T10:00:00Z","message":"no don't auto-format on save"}
{"type":"user","timestamp":"2026-04-22T14:00:00Z","message":"stop auto-formatting on save"}
{"type":"user","timestamp":"2026-04-25T09:00:00Z","message":"wait don't auto-format save again"}
```

- [ ] **Step 3: Write the integration test**

Append to `cli/src/lib/claude-md-improver.test.ts`:

```ts
describe("fixture: missing-rules-from-corrections", () => {
  test("D4 fires on the synthetic transcripts", () => {
    const fixtureRoot = join(import.meta.dir, "__fixtures__/claude-md-improver/missing-rules-from-corrections");
    const transcriptDir = join(fixtureRoot, "transcripts");
    const prompts = readTranscriptUserPrompts(transcriptDir, new Date("2026-04-30T00:00:00Z"), 30);
    const collected = collect({ projectRoot: fixtureRoot, homeDir: tmpdir(), now: new Date() });
    const result = detect(collected, prompts, []);
    expect(result.scored.some((i) => i.detector === "D4")).toBe(true);
  });
});
```

- [ ] **Step 4: Run the test**

Run: `bun test cli/src/lib/claude-md-improver.test.ts -t "missing-rules-from-corrections"`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add cli/src/lib/__fixtures__/claude-md-improver/missing-rules-from-corrections \
        cli/src/lib/claude-md-improver.test.ts
git commit -m "test(claude-md-improver): missing-rules-from-corrections fixture"
```

---

### Task 25: Eval fixture — `contradictory-claude-md`

**Files:**
- Create: `cli/src/lib/__fixtures__/claude-md-improver/contradictory-claude-md/CLAUDE.md`

- [ ] **Step 1: Write the fixture**

```markdown
# Project rules

## Conventions

Always use yarn for installs.
Never use yarn — prefer npm.
```

- [ ] **Step 2: Write the test**

Append:

```ts
describe("fixture: contradictory-claude-md", () => {
  test("D6 surfaces a candidate pair", () => {
    const fixtureRoot = join(import.meta.dir, "__fixtures__/claude-md-improver/contradictory-claude-md");
    const collected = collect({ projectRoot: fixtureRoot, homeDir: tmpdir(), now: new Date() });
    const result = detect(collected, [], []);
    expect(result.scored.some((i) => i.detector === "D6")).toBe(true);
  });
});
```

- [ ] **Step 3: Run + commit**

```bash
bun test cli/src/lib/claude-md-improver.test.ts -t "contradictory-claude-md"
git add cli/src/lib/__fixtures__/claude-md-improver/contradictory-claude-md cli/src/lib/claude-md-improver.test.ts
git commit -m "test(claude-md-improver): contradictory-claude-md fixture"
```

---

### Task 26: Eval runner config

**Files:**
- Create: `skills/skill-creator/improve-claude-md/evals/eval.config.json`

- [ ] **Step 1: Write the config**

```json
{
  "name": "claude-md-improver",
  "fixtures": [
    {
      "id": "stale-claude-md",
      "input_dir": "inputs/stale-claude-md",
      "expected": "expected/stale-claude-md.expected.json"
    },
    {
      "id": "missing-rules-from-corrections",
      "input_dir": "../../../cli/src/lib/__fixtures__/claude-md-improver/missing-rules-from-corrections",
      "expected_detectors": ["D4"]
    },
    {
      "id": "contradictory-claude-md",
      "input_dir": "../../../cli/src/lib/__fixtures__/claude-md-improver/contradictory-claude-md",
      "expected_detectors": ["D6"]
    }
  ],
  "persona_mode": "rubric-only"
}
```

- [ ] **Step 2: Commit**

```bash
git add skills/skill-creator/improve-claude-md/evals/eval.config.json
git commit -m "test(claude-md-improver): eval runner config"
```

---

### Task 27: Declined-edit history file (`.jstack/claude-md-improver-history.json`)

**Files:**
- Modify: `cli/src/lib/claude-md-improver.ts`
- Modify: `cli/src/lib/claude-md-improver.test.ts`

- [ ] **Step 1: Write the failing test**

Append:

```ts
import { recordDeclined, isDeclined } from "./claude-md-improver.js";

describe("declined history", () => {
  test("recordDeclined writes JSON, isDeclined reads it", () => {
    const project = mkdtempSync(join(tmpdir(), "jstack-decl-"));
    try {
      const issue: Issue = {
        id: "i-d1-001", detector: "D1", category: "remove-stale-rule",
        claude_md_anchor: { line_start: 23, line_end: 23 },
        evidence: { file_paths: ["package-lock.json"] },
        raw_summary: "x", estimated_corrections_avoided_per_week: 1, confidence: "high",
      };
      recordDeclined(project, [issue]);
      expect(isDeclined(project, issue)).toBe(true);
    } finally {
      rmSync(project, { recursive: true, force: true });
    }
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `bun test cli/src/lib/claude-md-improver.test.ts -t "declined history"`
Expected: FAIL.

- [ ] **Step 3: Write minimal implementation**

Append to `cli/src/lib/claude-md-improver.ts`:

```ts
import { mkdirSync, writeFileSync } from "node:fs";

const HISTORY_REL = ".jstack/claude-md-improver-history.json";

function evidenceFingerprint(issue: Issue): string {
  const ev = issue.evidence;
  const parts = [
    issue.detector,
    issue.category,
    issue.claude_md_anchor?.line_start ?? "",
    (ev.commits ?? []).join(","),
    (ev.file_paths ?? []).join(","),
    (ev.session_excerpts ?? []).map((e) => e.session_id).join(","),
  ];
  return parts.join("|");
}

export function recordDeclined(projectRoot: string, issues: Issue[]): void {
  const dir = join(projectRoot, ".jstack");
  mkdirSync(dir, { recursive: true });
  const path = join(projectRoot, HISTORY_REL);
  let prior: { fingerprint: string; declined_at: string }[] = [];
  if (existsSync(path)) {
    try {
      prior = JSON.parse(readFileSync(path, "utf8"));
    } catch {
      prior = [];
    }
  }
  const now = new Date().toISOString();
  for (const i of issues) {
    prior.push({ fingerprint: evidenceFingerprint(i), declined_at: now });
  }
  writeFileSync(path, JSON.stringify(prior, null, 2));
}

export function isDeclined(projectRoot: string, issue: Issue): boolean {
  const path = join(projectRoot, HISTORY_REL);
  if (!existsSync(path)) return false;
  try {
    const prior: { fingerprint: string }[] = JSON.parse(readFileSync(path, "utf8"));
    return prior.some((p) => p.fingerprint === evidenceFingerprint(issue));
  } catch {
    return false;
  }
}
```

Filter out declined issues in `detect()` if a `projectRoot` is supplied (use the existing `collected.project_root`):

Find the `detect()` body and at the start of the issues array, wrap with:

```ts
const filteredIssues = issues.filter((i) => !isDeclined(collected.project_root, i));
const scored: ScoredIssue[] = filteredIssues
  .map((i) => ({
    ...i,
    time_saved_min_per_week: i.estimated_corrections_avoided_per_week * 2.5,
    monthly_savings_min: i.estimated_corrections_avoided_per_week * 2.5 * 4,
    priority_score: scoreIssue(i),
  }))
  .sort((a, b) => b.priority_score - a.priority_score);
return { issues: filteredIssues, scored };
```

- [ ] **Step 4: Run test to verify it passes**

Run: `bun test cli/src/lib/claude-md-improver.test.ts -t "declined history"`
Expected: PASS. Re-run all tests to confirm no regression: `bun test cli/src`.

- [ ] **Step 5: Commit**

```bash
git add cli/src/lib/claude-md-improver.ts cli/src/lib/claude-md-improver.test.ts
git commit -m "feat(claude-md-improver): declined-edit history (.jstack/claude-md-improver-history.json)"
```

---

### Task 28: Dogfood pass on `jstack.core` itself + CHANGELOG

**Files:**
- Create: `docs/superpowers/dogfood/2026-04-29-claude-md-improver-self-scan.md`
- Modify: `CHANGELOG.md`

- [ ] **Step 1: Run the scan against `jstack.core`**

```bash
cd /Users/jonathan.boice/Documents/GitHub/jstack/jstack.core
# Temporarily flip enabled to true in a local copy, OR run directly:
bun run cli/src/index.ts claude-md scan --output prose > /tmp/cm-dogfood.md
head -60 /tmp/cm-dogfood.md
```

Expected: prose report with at least 3 detected issues. Does the maintainer (you) accept ≥1? If not, the spec's success criterion `≥1 of which the maintainer accepts` is not met — escalate before proceeding.

- [ ] **Step 2: Write the dogfood report**

Create `docs/superpowers/dogfood/2026-04-29-claude-md-improver-self-scan.md` with the prose output (redact any PII). Add a short header:

```markdown
# Dogfood: claude-md-improver self-scan — 2026-04-29

Run on `jstack.core` HEAD as of `<commit>`. N issues detected; M accepted by maintainer for follow-up; K filtered out (rationale below).

<paste prose report here>
```

- [ ] **Step 3: Update CHANGELOG**

Add to `## Unreleased`:

```markdown
- **CLAUDE.md improver (PR-3):** SKILL.md authored; three eval fixtures (stale-claude-md, missing-rules-from-corrections, contradictory-claude-md); declined-edit history in `.jstack/claude-md-improver-history.json`; dogfood report at `docs/superpowers/dogfood/2026-04-29-claude-md-improver-self-scan.md`. `--apply` flag added with explicit confirmation gate. Skill remains gated by `claude_md_improver.enabled`.
```

- [ ] **Step 4: Run the full test suite**

```bash
bun run typecheck:cli
bun run test:cli
bun run validate-config
bun run validate-chains
```

Expected: all green.

- [ ] **Step 5: Commit**

```bash
git add docs/superpowers/dogfood/2026-04-29-claude-md-improver-self-scan.md CHANGELOG.md
git commit -m "docs(claude-md-improver): PR-3 dogfood report + changelog (PR-3)"
```

---

**End of PR-3.** Open the PR, get review, merge before starting PR-4.

---

## PR-4 — Stop hook + monthly routine + README + default flip

### Task 29: Stop hook for high-correction sessions

**Files:**
- Create: `hooks/claude-md-correction-detector.sh`
- Modify: `hooks/hooks.json`

- [ ] **Step 1: Write the hook script**

Create `hooks/claude-md-correction-detector.sh`:

```bash
#!/usr/bin/env bash
# Stop hook: count user corrections in this session's JSONL and surface improver if ≥ threshold.
# Reads `claude_md_improver.high_correction_session_threshold` (default 5) from jstack.config.json.

set -euo pipefail

PROJECT_ROOT="${CLAUDE_PROJECT_DIR:-$PWD}"
SESSION_ID="${CLAUDE_SESSION_ID:-}"

[ -z "$SESSION_ID" ] && exit 0
[ ! -f "$PROJECT_ROOT/jstack.config.json" ] && exit 0

ENABLED=$(node -e "try { const j=JSON.parse(require('fs').readFileSync('$PROJECT_ROOT/jstack.config.json','utf8')); console.log(j.claude_md_improver?.enabled ?? false); } catch { console.log('false'); }")
[ "$ENABLED" != "true" ] && exit 0

THRESHOLD=$(node -e "try { const j=JSON.parse(require('fs').readFileSync('$PROJECT_ROOT/jstack.config.json','utf8')); console.log(j.claude_md_improver?.high_correction_session_threshold ?? 5); } catch { console.log('5'); }")

ENCODED=$(echo "$PROJECT_ROOT" | sed 's:/:-:g')
TRANSCRIPT="$HOME/.claude/projects/$ENCODED/${SESSION_ID}.jsonl"
[ ! -f "$TRANSCRIPT" ] && exit 0

CORRECTIONS=$(grep -E '"type":"user"' "$TRANSCRIPT" 2>/dev/null \
  | grep -ciE '"(message|content)":"(no|don'\''t|stop|wait|that'\''s wrong)\b' || true)

if [ "$CORRECTIONS" -ge "$THRESHOLD" ]; then
  echo "[jstack] You corrected Claude $CORRECTIONS times this session — run /jstack:skill-creator/improve-claude-md to capture them as rules." >&2
fi

exit 0
```

- [ ] **Step 2: Make it executable**

```bash
chmod +x hooks/claude-md-correction-detector.sh
```

- [ ] **Step 3: Wire the hook into `hooks/hooks.json`**

Edit `hooks/hooks.json` and add a `Stop` block alongside the existing `SessionStart`:

```json
{
  "hooks": {
    "SessionStart": [
      ...existing...
    ],
    "Stop": [
      {
        "hooks": [
          {
            "type": "command",
            "command": "bash -lc '$CLAUDE_PLUGIN_ROOT/hooks/claude-md-correction-detector.sh'",
            "statusMessage": "claude-md correction detector"
          }
        ]
      }
    ]
  }
}
```

- [ ] **Step 4: Smoke-test the hook**

```bash
CLAUDE_PROJECT_DIR=/tmp/cmd-smoke CLAUDE_SESSION_ID=fake bash hooks/claude-md-correction-detector.sh
```

Expected: silent exit (no transcript file, exits 0).

- [ ] **Step 5: Commit**

```bash
git add hooks/claude-md-correction-detector.sh hooks/hooks.json
git commit -m "feat(hooks): Stop hook surfaces claude-md improver on high-correction sessions"
```

---

### Task 30: Monthly routine

**Files:**
- Create: `scripts/routines/monthly-claude-md-review.json`

- [ ] **Step 1: Inspect the existing routines schema**

```bash
ls scripts/routines/ 2>/dev/null
find . -path ./node_modules -prune -o -name "routine*.ts" -print 2>/dev/null | head -5
grep -rl "routines" config/ 2>/dev/null | head -3
```

(If `scripts/routines/` does not yet exist, create it; the routine runner reads from this directory by convention.)

- [ ] **Step 2: Write the routine**

Create `scripts/routines/monthly-claude-md-review.json`:

```json
{
  "id": "monthly-claude-md-review",
  "description": "Run the CLAUDE.md improver on the first Monday of each month.",
  "schedule": {
    "cron": "0 9 1-7 * MON"
  },
  "skill": "jstack:skill-creator/improve-claude-md",
  "args": ["--output=json"],
  "post_processing": [
    {
      "type": "notion_post",
      "target": "private_scratchpad",
      "title": "CLAUDE.md improvements — {date}",
      "fallback": "stdout"
    }
  ],
  "config_gate": "claude_md_improver.enabled"
}
```

- [ ] **Step 3: Commit**

```bash
git add scripts/routines/monthly-claude-md-review.json
git commit -m "feat(routines): monthly CLAUDE.md improver run with Notion post"
```

---

### Task 31: README quick-start bullet

**Files:**
- Modify: `README.md`

- [ ] **Step 1: Find the quick-start section**

```bash
grep -n -E "Quick start|Getting started|## Use" README.md | head -5
```

- [ ] **Step 2: Append a 2-line bullet**

In the quick-start section, add (preserving surrounding indentation/style):

```markdown
- **Keep CLAUDE.md sharp:** `/jstack:skill-creator/improve-claude-md` — audits the file against your commits and session transcripts and proposes a unified diff. Read-only by default.
```

- [ ] **Step 3: Commit**

```bash
git add README.md
git commit -m "docs(readme): quick-start link to improve-claude-md"
```

---

### Task 32: Flip the default to enabled

**Files:**
- Modify: `config/defaults.json`

- [ ] **Step 1: Verify all eval baselines pass**

```bash
bun run test:cli
bun run validate-config
bun run eval:quick
```

Expected: all green. **If any fixture fails, do not flip the default — fix the failure and re-run.**

- [ ] **Step 2: Edit `config/defaults.json`**

Find the `claude_md_improver` block and flip:

```diff
   "claude_md_improver": {
-    "enabled": false,
+    "enabled": true,
     "transcript_lookback_days": 30,
     ...
   }
```

- [ ] **Step 3: Re-run validate-config**

```bash
bun run validate-config
```

Expected: green.

- [ ] **Step 4: Commit**

```bash
git add config/defaults.json
git commit -m "feat(claude-md-improver): enable by default after eval baselines green"
```

---

### Task 33: Setup-wizard "next step" suggestion

**Files:**
- Modify: `cli/src/commands/setup.ts` (and/or `cli/src/commands/setup-schema.ts` if applicable)

- [ ] **Step 1: Find the success message in setup**

```bash
grep -n -E "complete|success|next step|✓|wizard" cli/src/commands/setup.ts | head -10
grep -n -E "complete|success|next step|✓|wizard" cli/src/commands/setup-schema.ts | head -10
```

- [ ] **Step 2: Append a one-line suggestion to the final success block**

After the existing success message (e.g. *"jstack.config.json written"*), add:

```ts
console.log(chalk.dim("Next: keep CLAUDE.md sharp — /jstack:skill-creator/improve-claude-md (read-only by default)."));
```

- [ ] **Step 3: Smoke-test**

```bash
bun run cli/src/index.ts setup --ci --disk-fallback-root /tmp/jstack-cm-setup-smoke 2>&1 | tail -5
```

Expected: the new line appears at the end of the success output.

- [ ] **Step 4: Commit**

```bash
git add cli/src/commands/setup.ts cli/src/commands/setup-schema.ts
git commit -m "feat(setup): suggest improve-claude-md after wizard success"
```

---

### Task 34: PR-4 CHANGELOG + verification

**Files:**
- Modify: `CHANGELOG.md`

- [ ] **Step 1: Append PR-4 entry**

```markdown
- **CLAUDE.md improver (PR-4 / GA):** Stop hook (`hooks/claude-md-correction-detector.sh`) surfaces the skill on sessions with ≥5 corrections; monthly routine `scripts/routines/monthly-claude-md-review.json` runs the improver on the first Monday and posts to Notion `private_scratchpad`; README quickstart link; setup-wizard "next step" suggestion. Default flipped to `claude_md_improver.enabled=true`. Opt-out via `jstack setup --reconfigure`.
```

- [ ] **Step 2: Run the full check pipeline**

```bash
bun run check
```

Expected: green (the existing `check` script runs validate-config, agents-check, validate-chains, alias-drift strict, eval:validate, eval:scenarios-validate, eval:routers, eval:quick, test:cli, typecheck:cli, typecheck:dashboard).

- [ ] **Step 3: Commit**

```bash
git add CHANGELOG.md
git commit -m "docs(changelog): PR-4 GA notes for claude-md-improver"
```

---

**End of PR-4.** Open the PR, get review, merge. The skill is now GA.

---

## Self-review (run after writing the plan)

Done inline — fixes applied as found.

**1. Spec coverage check**

| Spec section | Tasks |
|--------------|-------|
| §4 Inputs (CLAUDE.md, transcripts, lockfiles, etc.) | T4 (parser), T5 (collect) |
| §5.1 Pipeline split (Bun module + SKILL.md) | T1–T13 (module), T20 (SKILL.md) |
| §5.2 Detectors D1–D10 | T6, T7, T8, T9, T10, T11, T12 |
| §5.3 Issue / ProposedEdit shapes | T1 |
| §5.4 Persona-review rubric | T15 (PM persona), T16 (rubric ref), T20 (SKILL.md stage 3+4) |
| §5.5 Render + selection UX | T14 (render), T21 (render/apply), T20 (SKILL.md selection prompt) |
| §6 Skill file layout | T20 (SKILL.md), T17 (references), T23–T26 (evals) |
| §7 Output formats | T14 (json/prose), T21 (patch) |
| §8 Failure modes (declined-edit history, apply race) | T27 (history), T21 (mtime guard) |
| §9 Configuration (`claude_md_improver.*`) | T14 (schema + defaults), T32 (flip) |
| §10 Privacy / PII | T2 |
| §11 Testing (eval fixtures, idempotency, apply-safety) | T23–T26, T27, T21 |
| §12 Rollout (PR-1 → PR-4) | PR-1=T1–T14, PR-2=T15–T18, PR-3=T19–T28, PR-4=T29–T34 |
| §14 Success criteria — dogfood ≥3 issues, ≥1 accepted | T28 |

No gaps.

**2. Placeholder scan**

Grep performed before commit. No `TBD/TODO/FIXME` in the plan body.

**3. Type and name consistency**

- `Issue` defined T1 → used T6, T7, T8, T9, T10, T11, T12, T13, T27 — consistent.
- `ProposedEdit` defined T1 → consumed in T20 (SKILL.md stage 3) and T21 (render).
- `ScoredIssue` defined T13 → consumed in T14 (render).
- `confidenceWeight` defined T13 → consumed implicitly via `scoreIssue` only; unit-tested directly.
- `redact` defined T2 → used in T9 (transcript reader).
- `parseClaudeMd` defined T4 → used in T5 (collect), T9 (D5 test), T11 (D6), T12 (D7/D8/D10).
- `encodeProjectPath` / `resolveTranscriptDir` defined T3 → used in T5 (collect).
- `recordDeclined` / `isDeclined` defined T27 → wired into `detect()` filter in T27 step 3.
- `runClaudeMdScan` / `runClaudeMdRender` / `runClaudeMdApply` are the three CLI entry points; subcommand surface (`scan` / `render` / `apply`) is consistent across SKILL.md (T20) and CLI registration (T14, T21).
- `claude_md_improver` config keys match between schema (T14), defaults (T14), Stop hook (T29), and SKILL.md (T20).

No mismatches.

---

## Execution Handoff

**Plan complete and saved to `docs/superpowers/plans/2026-04-29-claude-md-improver.md`. Two execution options:**

**1. Subagent-Driven (recommended)** — I dispatch a fresh subagent per task, review between tasks, fast iteration.

**2. Inline Execution** — Execute tasks in this session using `superpowers:executing-plans`, batch execution with checkpoints.

**Which approach?**
