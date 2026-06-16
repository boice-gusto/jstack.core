#!/usr/bin/env bun
/**
 * Integration gate: hooks JSON + SessionStart commands smoke, CLI --help-json,
 * fixture project + read-only CLI matrix, then full `bun run check`.
 *
 *   bun run verify
 *   SKIP_VERIFY_CHECK=1 bun run verify   # skip final check (hooks + CLI smoke only)
 */
import { existsSync, mkdirSync, mkdtempSync, readFileSync } from "node:fs";
import { spawnSync } from "node:child_process";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { ENCODING_UTF8, JSTACK_CONFIG_FILE } from "../constants/paths.js";

const __dirname = dirname(fileURLToPath(import.meta.url));
const pluginRoot = join(__dirname, "..");
const cliEntry = join(pluginRoot, "cli/src/index.ts");
const hooksPath = join(pluginRoot, "hooks/hooks.json");

function runBun(args: string[], cwd: string, env: Record<string, string | undefined>): {
  status: number;
  out: string;
} {
  const r = spawnSync("bun", args, {
    cwd,
    env: { ...process.env, ...env },
    encoding: ENCODING_UTF8,
    maxBuffer: 32 * 1024 * 1024,
  });
  return { status: r.status ?? 1, out: (r.stdout ?? "") + (r.stderr ?? "") };
}

function isRecord(x: unknown): x is Record<string, unknown> {
  return typeof x === "object" && x !== null && !Array.isArray(x);
}

function extractSessionStartCommands(raw: unknown): string[] {
  if (!isRecord(raw)) throw new Error("hooks.json: root must be an object");
  const hooks = raw["hooks"];
  if (!isRecord(hooks)) throw new Error('hooks.json: missing "hooks" object');
  const sessionStart = hooks["SessionStart"];
  if (!Array.isArray(sessionStart)) throw new Error('hooks.json: "SessionStart" must be an array');
  const out: string[] = [];
  for (const bundle of sessionStart) {
    if (!isRecord(bundle)) continue;
    const inner = bundle["hooks"];
    if (!Array.isArray(inner)) continue;
    for (const h of inner) {
      if (!isRecord(h)) continue;
      if (h["type"] !== "command") continue;
      const cmd = h["command"];
      if (typeof cmd !== "string" || cmd.trim().length === 0) {
        throw new Error('hooks.json: command hook missing non-empty "command"');
      }
      out.push(cmd);
    }
  }
  if (out.length === 0) throw new Error("hooks.json: no SessionStart command hooks found");
  return out;
}

function validateHooksJson(): void {
  const raw: unknown = JSON.parse(readFileSync(hooksPath, ENCODING_UTF8));
  extractSessionStartCommands(raw);
  console.log("   OK hooks/hooks.json structure\n");
}

function smokeHookCommandsFromEmptyProject(commands: string[]): void {
  const tmpEmpty = mkdtempSync(join(tmpdir(), "jstack-hook-smoke-"));
  let i = 0;
  for (const cmd of commands) {
    i += 1;
    const r = spawnSync(cmd, {
      shell: "/bin/bash",
      cwd: tmpEmpty,
      encoding: ENCODING_UTF8,
      env: process.env,
    });
    const status = r.status ?? 1;
    if (status !== 0) {
      console.error(`Hook command ${i} failed (exit ${status}):\n${cmd}\n${r.stdout ?? ""}${r.stderr ?? ""}`);
      process.exit(1);
    }
  }
  console.log(`   OK ${commands.length} SessionStart hook command(s) smoke (empty project)\n`);
}

function verifyHelpJson(): void {
  const r = runBun(["run", cliEntry, "--help-json"], pluginRoot, {
    CLAUDE_PLUGIN_ROOT: pluginRoot,
  });
  if (r.status !== 0) {
    console.error(r.out);
    process.exit(1);
  }
  let parsed: unknown;
  try {
    parsed = JSON.parse(r.out.trim());
  } catch (e) {
    console.error("--help-json: invalid JSON", e);
    process.exit(1);
  }
  if (!isRecord(parsed)) {
    console.error("--help-json: root must be object");
    process.exit(1);
  }
  const cmds = parsed["commands"];
  if (!Array.isArray(cmds) || cmds.length < 5) {
    console.error("--help-json: expected commands array with length >= 5");
    process.exit(1);
  }
  console.log(`   OK --help-json (${cmds.length} catalog commands)\n`);
}

type MatrixStep = { label: string; args: string[] };

function cliMatrixAfterSetup(): MatrixStep[] {
  return [
    { label: "doctor", args: [cliEntry, "doctor"] },
    { label: "config", args: [cliEntry, "config"] },
    { label: "status", args: [cliEntry, "status"] },
    { label: "skills index --json", args: [cliEntry, "skills", "index", "--json"] },
    { label: "skills show intake", args: [cliEntry, "skills", "show", "intake"] },
    { label: "workflow list", args: [cliEntry, "workflow", "list"] },
    { label: "transcripts status", args: [cliEntry, "transcripts", "status"] },
    { label: "schedule list", args: [cliEntry, "schedule", "list"] },
    { label: "schedule enable standup", args: [cliEntry, "schedule", "enable", "standup"] },
    { label: "schedule disable standup", args: [cliEntry, "schedule", "disable", "standup"] },
    { label: "mcp list", args: [cliEntry, "mcp", "list"] },
    { label: "telemetry status", args: [cliEntry, "telemetry", "status"] },
    { label: "time --format json", args: [cliEntry, "time", "--format", "json"] },
  ];
}

function main(): void {
  console.log("=== jstack verify-integration ===\n");

  console.log("1) hooks/hooks.json\n");
  validateHooksJson();
  const rawHooks: unknown = JSON.parse(readFileSync(hooksPath, ENCODING_UTF8));
  smokeHookCommandsFromEmptyProject(extractSessionStartCommands(rawHooks));

  console.log("2) CLI --help-json (plugin root)\n");
  verifyHelpJson();

  const tmpProject = mkdtempSync(join(tmpdir(), "jstack-verify-"));
  const diskKb = join(tmpProject, "disk-kb");
  mkdirSync(diskKb, { recursive: true });

  console.log("3) Fixture: setup --ci\n");
  const e0 = runBun(
    ["run", cliEntry, "setup", "--ci", "--disk-fallback-root", diskKb],
    tmpProject,
    { CLAUDE_PLUGIN_ROOT: pluginRoot },
  );
  console.log(e0.out);
  if (e0.status !== 0) process.exit(1);
  if (!existsSync(join(tmpProject, JSTACK_CONFIG_FILE))) {
    console.error("Missing jstack.config.json after setup --ci");
    process.exit(1);
  }

  console.log("4) CLI matrix (fixture project, CLAUDE_PLUGIN_ROOT)\n");
  const envFixture = { CLAUDE_PLUGIN_ROOT: pluginRoot };
  for (const step of cliMatrixAfterSetup()) {
    const er = runBun(["run", ...step.args], tmpProject, envFixture);
    if (er.status !== 0) {
      console.error(`FAIL: jstack ${step.label} (exit ${er.status})\n${er.out}`);
      process.exit(1);
    }
    console.log(`   OK ${step.label}`);
  }
  console.log("");

  const skipCheck = process.env.SKIP_VERIFY_CHECK === "1";
  if (skipCheck) {
    console.log("5) SKIP full gate (SKIP_VERIFY_CHECK=1)\n");
  } else {
    console.log("5) bun run check (validate-config, agents-check, eval gates, tests, typecheck)\n");
    const chk = spawnSync("bun", ["run", "check"], {
      cwd: pluginRoot,
      env: process.env,
      encoding: ENCODING_UTF8,
      stdio: "inherit",
    });
    const code = chk.status ?? 1;
    if (code !== 0) {
      console.error(`verify-integration: check failed with exit ${code}`);
      process.exit(code);
    }
    console.log("   OK check\n");
  }

  console.log("=== verify-integration finished ===");
}

try {
  main();
} catch (e: unknown) {
  console.error(e);
  process.exit(1);
}
