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

export type ParsedLine = { line_number: number; text: string };
export type ParsedSection = { heading: string; line_start: number; lines: ParsedLine[] };
export type ParsedClaudeMd = { lines: ParsedLine[]; sections: ParsedSection[] };

export function parseClaudeMd(input: string): ParsedClaudeMd {
  const rawLines = input.split(/\r?\n/);
  // Drop a single trailing empty string produced by a final newline
  if (rawLines.length > 0 && rawLines[rawLines.length - 1] === "") rawLines.pop();
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

import { mkdirSync, readFileSync, writeFileSync } from "node:fs";

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

const LOCKFILE_TO_MANAGER: Record<string, string> = {
  "package-lock.json": "npm",
  "yarn.lock": "yarn",
  "pnpm-lock.yaml": "pnpm",
  "bun.lock": "bun",
};
const MANAGER_RE = /\b(yarn|npm|pnpm|bun)\b/i;

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
  return levenshtein(a.toLowerCase(), b.toLowerCase()) / longer <= 0.3;
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

const MINUTES_PER_CORRECTION = 2.5;
const WEEKS_PER_MONTH = 4;

export function confidenceWeight(c: Confidence): number {
  return c === "high" ? 1.0 : c === "medium" ? 0.7 : 0.4;
}

export function scoreIssue(issue: Issue): number {
  const monthly = issue.estimated_corrections_avoided_per_week * MINUTES_PER_CORRECTION * WEEKS_PER_MONTH;
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
  const rawIssues: Issue[] = [
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
  const filteredIssues = rawIssues.filter((i) => !isDeclined(collected.project_root, i));
  const scored: ScoredIssue[] = filteredIssues
    .map((i) => ({
      ...i,
      time_saved_min_per_week: i.estimated_corrections_avoided_per_week * MINUTES_PER_CORRECTION,
      monthly_savings_min: i.estimated_corrections_avoided_per_week * MINUTES_PER_CORRECTION * WEEKS_PER_MONTH,
      priority_score: scoreIssue(i),
    }))
    .sort((a, b) => b.priority_score - a.priority_score);
  return { issues: filteredIssues, scored };
}

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
