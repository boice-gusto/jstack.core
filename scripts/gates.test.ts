/**
 * Regression tests for the four gates added during the audit.
 *
 * Why these exist: the gates were each proven non-vacuous by hand — break the thing, watch the gate
 * fail, restore. That is the right verification, but it is not durable, and doing it on the real tree
 * is how an earlier verification pass destroyed an uncommitted file. `agents-depth-check` and
 * `skills-depth-check` already carry test files; these four did not.
 *
 * Every case runs the real gate against a SYNTHETIC repo under `JSTACK_CHECK_ROOT`, so a test can
 * create a broken router, an unguarded write skill, or an orphaned prompt without touching anything
 * real. Each gate is checked in both directions: it passes a well-formed tree, and it fails for the
 * specific reason it exists.
 */
import { describe, expect, test, beforeEach, afterEach } from "bun:test";
import { spawnSync } from "node:child_process";
import { mkdirSync, mkdtempSync, rmSync, writeFileSync, copyFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { tmpdir } from "node:os";

const SCRIPTS = import.meta.dir;
let root: string;

/** Run a gate against the synthetic tree. */
function gate(name: string) {
  const r = spawnSync("bun", ["run", join(SCRIPTS, `${name}.ts`)], {
    encoding: "utf8",
    env: { ...process.env, JSTACK_CHECK_ROOT: root, NO_COLOR: "1" },
  });
  return { code: r.status, out: `${r.stdout ?? ""}${r.stderr ?? ""}` };
}

function skill(rel: string, frontmatter: Record<string, string>, body = "body\n") {
  const p = join(root, "skills", rel, "SKILL.md");
  mkdirSync(dirname(p), { recursive: true });
  const fm = Object.entries(frontmatter)
    .map(([k, v]) => `${k}: ${v}`)
    .join("\n");
  writeFileSync(p, `---\n${fm}\n---\n\n${body}`);
}

function generator(orchestrators: string[], children: Record<string, string>) {
  const p = join(root, "scripts", "apply_detailed_skills.py");
  mkdirSync(dirname(p), { recursive: true });
  const orch = orchestrators.map((o) => `    "${o}",`).join("\n");
  const kids = Object.entries(children)
    .map(([k, v]) => `    "${k}": "${v}",`)
    .join("\n");
  writeFileSync(p, `ORCHESTRATORS = {\n${orch}\n}\nORCH_CHILDREN = {\n${kids}\n}\n`);
}

function prompt(rel: string, text = "policy text\n") {
  const p = join(root, "prompts", rel);
  mkdirSync(dirname(p), { recursive: true });
  writeFileSync(p, text);
}

beforeEach(() => {
  root = mkdtempSync(join(tmpdir(), "jstack-gates-"));
  mkdirSync(join(root, "skills"), { recursive: true });
  mkdirSync(join(root, "agents"), { recursive: true });
  mkdirSync(join(root, "prompts"), { recursive: true });
  mkdirSync(join(root, "scripts"), { recursive: true });
});
afterEach(() => rmSync(root, { recursive: true, force: true }));

// ── check-router-children ─────────────────────────────────────────────────────

describe("check-router-children", () => {
  test("passes when a router's list matches disk", () => {
    skill("jira", { name: "jstack-jira", description: "Route Jira requests to the right sub-skill." });
    skill("jira/create", { name: "jstack-jira-create", description: "Create an issue." });
    generator(["jira"], { jira: "create" });
    const { code, out } = gate("check-router-children");
    expect(code).toBe(0);
    expect(out).toContain("child lists match disk");
  });

  // The real defect: ten of fifteen routers under-listed their children.
  test("fails when a real child is not advertised", () => {
    skill("jira", { name: "jstack-jira", description: "Route Jira requests to the right sub-skill." });
    skill("jira/create", { name: "jstack-jira-create", description: "Create." });
    skill("jira/transition", { name: "jstack-jira-transition", description: "Transition." });
    generator(["jira"], { jira: "create" });
    const { code, out } = gate("check-router-children");
    expect(code).toBe(1);
    expect(out).toContain("does not advertise");
    expect(out).toContain("transition");
  });

  test("fails when a listed child does not exist on disk", () => {
    skill("jira", { name: "jstack-jira", description: "Route Jira requests to the right sub-skill." });
    skill("jira/create", { name: "jstack-jira-create", description: "Create." });
    generator(["jira"], { jira: "create, ghost" });
    const { code, out } = gate("check-router-children");
    expect(code).toBe(1);
    expect(out).toContain("do not exist");
    expect(out).toContain("ghost");
  });

  // `computer-use` shipped in exactly this state.
  test("fails when a skill claims to route but is not registered as an orchestrator", () => {
    skill("computer-use", { name: "jstack-computer-use", description: "Route computer-use requests to the right surface." });
    skill("computer-use/cua", { name: "jstack-cua", description: "Drive the desktop." });
    generator([], {});
    const { code, out } = gate("check-router-children");
    expect(code).toBe(1);
    expect(out).toContain("absent from ORCHESTRATORS");
  });

  test("fails when a router claims to route but has no children", () => {
    skill("lonely", { name: "jstack-lonely", description: "Route lonely requests to the right sub-skill." });
    generator([], {});
    const { code, out } = gate("check-router-children");
    expect(code).toBe(1);
    expect(out).toContain("no child skills on disk");
  });
});

// ── check-write-gates ─────────────────────────────────────────────────────────
//
// This gate reads its WRITES manifest from its own source, so a fixture cannot redefine it. What the
// fixture CAN do is create the skills the real manifest names and verify the gate's verdicts on them.

describe("check-write-gates", () => {
  test("fails when a declared writer is missing its invocation gate", () => {
    // `self/diary` is in the real WRITES manifest.
    skill("self/diary", { name: "jstack-diary", description: "Write a diary entry." });
    const { code, out } = gate("check-write-gates");
    expect(code).toBe(1);
    expect(out).toContain("mutates external state but is missing");
    expect(out).toContain("self/diary");
  });

  // Three knowledge skills shipped writing under a read-only agent, so the write could not work.
  test("fails when a declared writer runs under the read-only Explore agent", () => {
    skill("self/diary", {
      name: "jstack-diary",
      description: "Write a diary entry.",
      "disable-model-invocation": "true",
      agent: "Explore",
    });
    const { code, out } = gate("check-write-gates");
    expect(code).toBe(1);
    expect(out).toContain("has no Write/Edit tool");
  });

  test("fails when a skill is gated but absent from the manifest (over-gating)", () => {
    skill("not-a-writer", {
      name: "jstack-not-a-writer",
      description: "Reads things.",
      "disable-model-invocation": "true",
    });
    const { code, out } = gate("check-write-gates");
    expect(code).toBe(1);
    expect(out).toContain("not in the WRITES manifest");
  });
});

// ── check-name-collisions ─────────────────────────────────────────────────────

describe("check-name-collisions", () => {
  test("passes when near-identical names disambiguate each other", () => {
    skill("a", { name: "jstack-workflow-builder", description: '"Chains. Not jstack-workflows-builder."' });
    skill("b", { name: "jstack-workflows-builder", description: '"Browser. Not jstack-workflow-builder."' });
    const { code, out } = gate("check-name-collisions");
    expect(code).toBe(0);
    expect(out).toContain("near-collisions all disambiguated");
  });

  test("fails when a one-character collision is undisambiguated", () => {
    skill("a", { name: "jstack-workflow-builder", description: "Chains and routines." });
    skill("b", { name: "jstack-workflows-builder", description: "Browser flows." });
    const { code, out } = gate("check-name-collisions");
    expect(code).toBe(1);
    expect(out).toContain("differ by one character");
  });

  test("passes when names are genuinely distinct", () => {
    skill("a", { name: "jstack-recon", description: "Sweep." });
    skill("b", { name: "jstack-announcements", description: "Draft." });
    expect(gate("check-name-collisions").code).toBe(0);
  });

  // One side naming the other is not enough — a reader can land on either.
  test("fails when only one side names the other", () => {
    skill("a", { name: "jstack-alpha-thing", description: '"See jstack-alphas-thing."' });
    skill("b", { name: "jstack-alphas-thing", description: "Unrelated work." });
    const { code, out } = gate("check-name-collisions");
    expect(code).toBe(1);
    expect(out).toContain("must name the other");
  });
});

// ── check-prompt-wiring ───────────────────────────────────────────────────────

describe("check-prompt-wiring", () => {
  test("passes when every prompt is !cat'd by some skill", () => {
    prompt("policies/review-policy.md");
    skill("review", { name: "jstack-review", description: "Review." },
      "!cat ${CLAUDE_PLUGIN_ROOT}/prompts/policies/review-policy.md\n");
    const { code, out } = gate("check-prompt-wiring");
    expect(code).toBe(0);
    expect(out).toContain("all loaded by at least one skill or agent");
  });

  // Seven of twenty prompt files were in this state, including both policy files.
  test("fails when a prompt file is loaded by nothing", () => {
    prompt("policies/review-policy.md");
    skill("review", { name: "jstack-review", description: "Review." });
    const { code, out } = gate("check-prompt-wiring");
    expect(code).toBe(1);
    expect(out).toContain("is loaded by nothing");
  });

  // `sdlc` said "read from prompts/policies/" for a long time while loading nothing.
  test("a generic directory mention does not count as loading", () => {
    prompt("policies/review-policy.md");
    skill("review", { name: "jstack-review", description: "Review." },
      "Read the policy from `prompts/policies/` when available.\n");
    expect(gate("check-prompt-wiring").code).toBe(1);
  });

  // Sharper than the directory case above: a prose mention of the FULL filename must not count either.
  // Without this, loosening the gate's regex from `!cat <path>` to just `<path>` passes every test —
  // verified by making that exact change and watching the suite stay green.
  test("a prose mention of the full .md path does not count as loading", () => {
    prompt("policies/review-policy.md");
    skill("review", { name: "jstack-review", description: "Review." },
      "See `prompts/policies/review-policy.md` for the org policy shape.\n");
    const { code, out } = gate("check-prompt-wiring");
    expect(code).toBe(1);
    expect(out).toContain("is loaded by nothing");
  });

  test("fails when a skill !cats a prompt that does not exist", () => {
    prompt("policies/review-policy.md");
    skill("review", { name: "jstack-review", description: "Review." },
      "!cat ${CLAUDE_PLUGIN_ROOT}/prompts/policies/review-policy.md\n" +
      "!cat ${CLAUDE_PLUGIN_ROOT}/prompts/policies/ghost.md\n");
    const { code, out } = gate("check-prompt-wiring");
    expect(code).toBe(1);
    expect(out).toContain("does not exist");
  });

  test("an agent may satisfy the load requirement", () => {
    prompt("personas/ceo.md");
    writeFileSync(join(root, "agents", "review-counsel.md"),
      "---\nname: x\n---\n!cat ${CLAUDE_PLUGIN_ROOT}/prompts/personas/ceo.md\n");
    expect(gate("check-prompt-wiring").code).toBe(0);
  });
});

// ── the override itself must not leak into production ─────────────────────────

describe("JSTACK_CHECK_ROOT", () => {
  test("gates read the real repo when the override is unset", () => {
    const r = spawnSync("bun", ["run", join(SCRIPTS, "check-prompt-wiring.ts")], {
      encoding: "utf8",
      env: { ...process.env, JSTACK_CHECK_ROOT: "", NO_COLOR: "1" },
    });
    // The real repo has 20 prompt files; a fixture would report far fewer.
    expect(r.status).toBe(0);
    expect(`${r.stdout}`).toContain("20 prompt file(s)");
  });
});

void copyFileSync;
