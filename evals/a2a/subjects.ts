/**
 * Subjects under test — how each surface gets exercised so a judge has something real to read.
 *
 * The surfaces differ in how much can be decided without a model:
 *
 *   cli    — spawn the real command. Exit code and stdout are facts; assert them directly.
 *   hook   — spawn with a stdin JSON payload, as Claude Code does. Also fact-checkable.
 *   file   — assert on an artifact's contents. No model needed at all.
 *   script — run a package script (a validator, a gate) and assert its exit code and output.
 *            Lets a validator be tested by its observable verdict rather than by re-implementing
 *            its logic inside the test.
 *   agentic — hand an artifact (persona, policy, agent, skill) plus a task to a CANDIDATE
 *             agent, capture what it produces, then let a separate JUDGE agent assess it.
 *             This is the only mode that needs two model calls, and the only one where a
 *             verdict is a judgement rather than a measurement.
 *
 * Deterministic modes exist so the suite is not hostage to model availability: `cli`, `hook`,
 * and `file` cases run in CI with no API key and still prove real behavior.
 */
import { spawnSync } from "node:child_process";
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";

export type SubjectKind = "cli" | "hook" | "file" | "agentic" | "script";

export interface SubjectSpec {
  kind: SubjectKind;
  /** cli: argv after the binary. hook: path to the hook script. file/agentic: repo-relative paths. */
  command?: string[];
  script?: string;
  stdin?: string;
  paths?: string[];
  /** agentic: the task handed to the candidate agent. */
  task?: string;
  /** cli/hook: environment overrides for the child process. */
  env?: Record<string, string>;
  /** cli/hook: run from this repo-relative cwd instead of the plugin root. */
  cwd?: string;
}

export interface SubjectOutput {
  /** Combined stdout+stderr, or artifact contents, as the judge will see it. */
  text: string;
  exitCode: number | null;
  stdout: string;
  stderr: string;
  /** Set when the subject could not be exercised at all (missing file, spawn failure). */
  error?: string;
}

/**
 * 120s is comfortable for a raw-API judge but marginal when the subject is exercised through a
 * nested Claude Code CLI session (JSTACK_ALLOW_CLI_JUDGE), which carries startup and tool-loading
 * overhead an API call does not. A subject that times out reports as a hard assertion failure
 * ("subject could not be exercised"), which is indistinguishable at a glance from the subject
 * actually behaving wrongly — so make the budget tunable rather than letting infrastructure
 * latency masquerade as a behavioral finding.
 */
const TIMEOUT_MS = Number(process.env.JSTACK_EVAL_TIMEOUT_MS ?? 120_000);

/**
 * Run a CLI command through bun so TypeScript entrypoints work without a build step.
 *
 * A MISSING `command:` key is a malformed case and is refused. An explicitly EMPTY `command: []` is
 * a valid subject: the bare invocation. The two were conflated, which made "running `jstack` with no
 * arguments must still exit 0" inexpressible — and that is precisely the case that pins the other
 * half of the unknown-command fix.
 */
export function runCli(pluginRoot: string, spec: SubjectSpec): SubjectOutput {
  if (spec.command === undefined) {
    return {
      text: "",
      exitCode: null,
      stdout: "",
      stderr: "",
      error: "cli subject has no command",
    };
  }
  const argv = spec.command;
  // The entrypoint must be ABSOLUTE. It was relative, which silently broke the documented
  // `cwd:` option: spawning from a fixture directory left bun looking for cli/src/index.ts
  // there, so the CLI never ran and the case failed with no output rather than a real verdict.
  const r = spawnSync(
    "bun",
    ["run", join(pluginRoot, "cli/src/index.ts"), ...argv],
    {
      cwd: spec.cwd ? join(pluginRoot, spec.cwd) : pluginRoot,
      encoding: "utf8",
      maxBuffer: 8 * 1024 * 1024,
      timeout: TIMEOUT_MS,
      // JSTACK_INTROSPECT is a test-only flag that makes the CLI register commands WITHOUT parsing
      // argv. It must never reach a child here: the harness spawns real CLIs and would otherwise
      // capture empty output and a 0 exit, which reads as a pass. Stripped explicitly rather than
      // trusting the parent's environment to be clean.
      env: {
        ...process.env,
        JSTACK_INTROSPECT: undefined,
        ...(spec.env ?? {}),
      } as NodeJS.ProcessEnv,
    },
  );
  const stdout = r.stdout ?? "";
  const stderr = r.stderr ?? "";
  return {
    stdout,
    stderr,
    exitCode: r.status,
    text: [stdout, stderr].filter(Boolean).join("\n").trim(),
    error: r.error ? String(r.error.message ?? r.error) : undefined,
  };
}

/**
 * Run a hook the way Claude Code does: the payload arrives on stdin as JSON, not as argv.
 * Getting this wrong is how a hook in this repo silently never fired for its whole life.
 */
export function runHook(pluginRoot: string, spec: SubjectSpec): SubjectOutput {
  if (!spec.script) {
    return {
      text: "",
      exitCode: null,
      stdout: "",
      stderr: "",
      error: "hook subject has no script",
    };
  }
  const abs = join(pluginRoot, spec.script);
  if (!existsSync(abs)) {
    return {
      text: "",
      exitCode: null,
      stdout: "",
      stderr: "",
      error: `hook script not found: ${spec.script}`,
    };
  }
  const r = spawnSync("bash", [abs], {
    cwd: spec.cwd ? join(pluginRoot, spec.cwd) : pluginRoot,
    input: spec.stdin ?? "",
    encoding: "utf8",
    maxBuffer: 4 * 1024 * 1024,
    timeout: TIMEOUT_MS,
    env: { ...process.env, ...(spec.env ?? {}) },
  });
  const stdout = r.stdout ?? "";
  const stderr = r.stderr ?? "";
  return {
    stdout,
    stderr,
    exitCode: r.status,
    text: [stdout, stderr].filter(Boolean).join("\n").trim(),
    error: r.error ? String(r.error.message ?? r.error) : undefined,
  };
}

/** Read artifacts so assertions and judges can inspect them. */
export function readFiles(
  pluginRoot: string,
  spec: SubjectSpec,
): SubjectOutput {
  const paths = spec.paths ?? [];
  if (paths.length === 0) {
    return {
      text: "",
      exitCode: null,
      stdout: "",
      stderr: "",
      error: "file subject has no paths",
    };
  }
  const parts: string[] = [];
  for (const rel of paths) {
    const abs = join(pluginRoot, rel);
    if (!existsSync(abs)) {
      return {
        text: "",
        exitCode: null,
        stdout: "",
        stderr: "",
        error: `file not found: ${rel}`,
      };
    }
    parts.push(`===== ${rel} =====\n${readFileSync(abs, "utf8")}`);
  }
  const text = parts.join("\n\n");
  return { text, exitCode: 0, stdout: text, stderr: "" };
}

/**
 * Ask a CANDIDATE agent to perform a task with the given artifacts in context.
 *
 * The artifacts are injected verbatim, which is the point: a persona or policy file only
 * matters if it actually changes what a model does, and this is the only way to observe that.
 */
export function runCandidate(
  pluginRoot: string,
  spec: SubjectSpec,
  claudeBin: string,
  apiKey: string | undefined,
): SubjectOutput {
  const artifacts = readFiles(pluginRoot, spec);
  if (artifacts.error) return artifacts;
  if (!spec.task) {
    return {
      text: "",
      exitCode: null,
      stdout: "",
      stderr: "",
      error: "agentic subject has no task",
    };
  }

  const prompt = [
    "You are being given project instructions followed by a task. Follow the instructions as",
    "though they were your operating guidance for this turn.",
    "",
    "## Instructions in scope",
    artifacts.text,
    "",
    "## Task",
    spec.task,
  ].join("\n");

  const r = spawnSync(claudeBin, ["-p", prompt, "--output-format", "text"], {
    cwd: pluginRoot,
    encoding: "utf8",
    maxBuffer: 8 * 1024 * 1024,
    timeout: TIMEOUT_MS,
    env: {
      ...process.env,
      ANTHROPIC_API_KEY: apiKey ?? process.env.ANTHROPIC_API_KEY ?? "",
    },
  });
  const stdout = (r.stdout ?? "").trim();
  const stderr = (r.stderr ?? "").trim();
  return {
    stdout,
    stderr,
    exitCode: r.status,
    text: stdout,
    error: r.error
      ? String(r.error.message ?? r.error)
      : stdout === ""
        ? "candidate produced no output"
        : undefined,
  };
}

/**
 * Run a package.json script and capture its verdict.
 *
 * Validators are the natural subject here: asserting that `validate-chains` exits 0 and prints
 * its success line tests the real gate, whereas re-checking chain references inside the case
 * would only test a copy of the logic.
 */
export function runScript(
  pluginRoot: string,
  spec: SubjectSpec,
): SubjectOutput {
  const name = spec.script;
  if (!name) {
    return {
      text: "",
      exitCode: null,
      stdout: "",
      stderr: "",
      error: "script subject has no script name",
    };
  }
  const r = spawnSync("bun", ["run", name, ...(spec.command ?? [])], {
    cwd: spec.cwd ? join(pluginRoot, spec.cwd) : pluginRoot,
    encoding: "utf8",
    maxBuffer: 8 * 1024 * 1024,
    timeout: TIMEOUT_MS,
    env: { ...process.env, ...(spec.env ?? {}) },
  });
  const stdout = r.stdout ?? "";
  const stderr = r.stderr ?? "";
  return {
    stdout,
    stderr,
    exitCode: r.status,
    text: [stdout, stderr].filter(Boolean).join("\n").trim(),
    error: r.error ? String(r.error.message ?? r.error) : undefined,
  };
}

export function exerciseSubject(
  pluginRoot: string,
  spec: SubjectSpec,
  claudeBin: string,
  apiKey: string | undefined,
): SubjectOutput {
  switch (spec.kind) {
    case "cli":
      return runCli(pluginRoot, spec);
    case "hook":
      return runHook(pluginRoot, spec);
    case "file":
      return readFiles(pluginRoot, spec);
    case "script":
      return runScript(pluginRoot, spec);
    case "agentic":
      return runCandidate(pluginRoot, spec, claudeBin, apiKey);
    default:
      return {
        text: "",
        exitCode: null,
        stdout: "",
        stderr: "",
        error: `unknown subject kind: ${spec.kind}`,
      };
  }
}
