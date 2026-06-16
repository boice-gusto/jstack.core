import { describe, expect, test } from "bun:test";
import type { Issue, ProposedEdit, IssueCategory } from "./claude-md-improver.js";
import { redact } from "./claude-md-improver.js";
import { encodeProjectPath, resolveTranscriptDir } from "./claude-md-improver.js";
import { parseClaudeMd } from "./claude-md-improver.js";
import { collect } from "./claude-md-improver.js";
import { detectD1StalePackageManager } from "./claude-md-improver.js";
import { detectD2StalePath } from "./claude-md-improver.js";
import { detectD3VagueRule } from "./claude-md-improver.js";
import { readTranscriptUserPrompts, detectD4RepeatedCorrection } from "./claude-md-improver.js";
import { detectD5RepeatedReask } from "./claude-md-improver.js";
import { detectD6ContradictionCandidates } from "./claude-md-improver.js";
import {
  detectD7MissingExample,
  detectD8UnmentionedCommand,
  detectD9ReadmeDuplication,
  detectD10DontGap,
} from "./claude-md-improver.js";
import { detect, scoreIssue, confidenceWeight } from "./claude-md-improver.js";
import { recordDeclined, isDeclined } from "./claude-md-improver.js";
import { mkdtempSync, mkdirSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach } from "bun:test";

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

describe("fixture: contradictory-claude-md", () => {
  test("D6 surfaces a candidate pair", () => {
    const fixtureRoot = join(import.meta.dir, "__fixtures__/claude-md-improver/contradictory-claude-md");
    const collected = collect({ projectRoot: fixtureRoot, homeDir: tmpdir(), now: new Date() });
    const result = detect(collected, [], []);
    expect(result.scored.some((i) => i.detector === "D6")).toBe(true);
  });
});

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
