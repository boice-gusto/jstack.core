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
 *
 * Every process-spawning subject runs through `spawnAsync` (below), not `spawnSync`. A sync
 * spawn blocks the whole event loop for the duration of the child, which is why this file used
 * to make every case in the suite fully serial — with ~90 cases and each agentic/judge call
 * costing 20-90s of nested-session overhead, that added up to 30-60+ minutes end to end. Async
 * spawns let the runner (run.ts) fan multiple cases out concurrently instead.
 */
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import {
  type BackendOptions,
  type ModelBackend,
  invokeBackend,
} from "./backends.js";
import { MAX_BUFFER, spawnAsync, type SpawnAsyncResult } from "./spawn.js";

// Re-exported for existing callers (run.ts, tests) that import these from subjects.ts.
export { MAX_BUFFER, spawnAsync, type SpawnAsyncResult };

export const SUBJECT_KINDS = [
  "cli",
  "hook",
  "file",
  "agentic",
  "script",
] as const;
export type SubjectKind = (typeof SUBJECT_KINDS)[number];

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

/** The subject never ran at all (missing config, missing file, spawn failure never reached). */
function subjectError(message: string): SubjectOutput {
  return { text: "", exitCode: null, stdout: "", stderr: "", error: message };
}

/**
 * Shared by runCli/runHook/runScript: they spawn a real child and just want its combined
 * output as one blob. (runCandidate, the agentic path, is intentionally NOT included here --
 * it wants stdout alone, not stdout+stderr joined, and a different no-output message; folding
 * it in would just relocate its divergence rather than remove any real duplication.)
 */
function toSubjectOutput(r: SpawnAsyncResult): SubjectOutput {
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
 * Run a CLI command through bun so TypeScript entrypoints work without a build step.
 *
 * A MISSING `command:` key is a malformed case and is refused. An explicitly EMPTY `command: []` is
 * a valid subject: the bare invocation. The two were conflated, which made "running `jstack` with no
 * arguments must still exit 0" inexpressible — and that is precisely the case that pins the other
 * half of the unknown-command fix.
 */
export async function runCli(
  pluginRoot: string,
  spec: SubjectSpec,
): Promise<SubjectOutput> {
  if (spec.command === undefined) {
    return subjectError("cli subject has no command");
  }
  const argv = spec.command;
  // The entrypoint must be ABSOLUTE. It was relative, which silently broke the documented
  // `cwd:` option: spawning from a fixture directory left bun looking for cli/src/index.ts
  // there, so the CLI never ran and the case failed with no output rather than a real verdict.
  const r = await spawnAsync(
    "bun",
    ["run", join(pluginRoot, "cli/src/index.ts"), ...argv],
    {
      cwd: spec.cwd ? join(pluginRoot, spec.cwd) : pluginRoot,
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
  return toSubjectOutput(r);
}

/**
 * Run a hook the way Claude Code does: the payload arrives on stdin as JSON, not as argv.
 * Getting this wrong is how a hook in this repo silently never fired for its whole life.
 */
export async function runHook(
  pluginRoot: string,
  spec: SubjectSpec,
): Promise<SubjectOutput> {
  if (!spec.script) {
    return subjectError("hook subject has no script");
  }
  const abs = join(pluginRoot, spec.script);
  if (!existsSync(abs)) {
    return subjectError(`hook script not found: ${spec.script}`);
  }
  const r = await spawnAsync("bash", [abs], {
    cwd: spec.cwd ? join(pluginRoot, spec.cwd) : pluginRoot,
    input: spec.stdin ?? "",
    env: { ...process.env, ...(spec.env ?? {}) },
  });
  return toSubjectOutput(r);
}

/** Read artifacts so assertions and judges can inspect them. */
export function readFiles(
  pluginRoot: string,
  spec: SubjectSpec,
): SubjectOutput {
  const paths = spec.paths ?? [];
  if (paths.length === 0) {
    return subjectError("file subject has no paths");
  }
  const parts: string[] = [];
  for (const rel of paths) {
    const abs = join(pluginRoot, rel);
    if (!existsSync(abs)) {
      return subjectError(`file not found: ${rel}`);
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
 *
 * `backend` selects which model CLI runs the candidate (see backends.ts) -- this is what a
 * multi-model run fans out over, running the SAME prompt through each backend in turn so the
 * case file itself never needs to know which model it's being graded against.
 */
export async function runCandidate(
  pluginRoot: string,
  spec: SubjectSpec,
  backend: ModelBackend,
  backendOpts: BackendOptions,
): Promise<SubjectOutput> {
  const artifacts = readFiles(pluginRoot, spec);
  if (artifacts.error) return artifacts;
  if (!spec.task) {
    return subjectError("agentic subject has no task");
  }

  const prompt = [
    "You are being given project instructions followed by a task. Follow the instructions as",
    "though they were your operating guidance for this turn.",
    "",
    "Answer from the instructions and task below only. Do not read, list, or explore any other",
    "file or directory in this repository (including .git/, .claude/, other skills/ or agents/",
    "files) to inform your answer -- a real user of this artifact would not have handed you the",
    "rest of the repo either, and wandering into it would test what you can discover, not what",
    "this artifact actually does. If a tool call reveals what looks like a real credential,",
    "token, or secret (in a file, an env var, or anywhere else), do not quote or reproduce it in",
    "your reply -- name that a secret-shaped value was encountered without repeating its value.",
    "",
    "## Instructions in scope",
    artifacts.text,
    "",
    "## Task",
    spec.task,
  ].join("\n");

  const r = await invokeBackend(backend, prompt, backendOpts);
  return {
    stdout: r.text,
    stderr: "",
    exitCode: r.exitCode,
    text: r.text,
    error: r.error,
  };
}

/**
 * Run a package.json script and capture its verdict.
 *
 * Validators are the natural subject here: asserting that `validate-chains` exits 0 and prints
 * its success line tests the real gate, whereas re-checking chain references inside the case
 * would only test a copy of the logic.
 */
export async function runScript(
  pluginRoot: string,
  spec: SubjectSpec,
): Promise<SubjectOutput> {
  const name = spec.script;
  if (!name) {
    return subjectError("script subject has no script name");
  }
  const r = await spawnAsync("bun", ["run", name, ...(spec.command ?? [])], {
    cwd: spec.cwd ? join(pluginRoot, spec.cwd) : pluginRoot,
    env: { ...process.env, ...(spec.env ?? {}) },
  });
  return toSubjectOutput(r);
}

export async function exerciseSubject(
  pluginRoot: string,
  spec: SubjectSpec,
  backend: ModelBackend,
  backendOpts: BackendOptions,
): Promise<SubjectOutput> {
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
      return runCandidate(pluginRoot, spec, backend, backendOpts);
    default:
      return subjectError(`unknown subject kind: ${spec.kind}`);
  }
}
