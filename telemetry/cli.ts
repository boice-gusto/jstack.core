#!/usr/bin/env bun
import { appendFileSync, mkdirSync, readFileSync, existsSync } from "node:fs";
import { homedir } from "node:os";
import { dirname, join } from "node:path";
import { configPath, findProjectRoot } from "../cli/src/lib/config.js";
import { ENCODING_UTF8, TELEMETRY_CLI } from "../constants/paths.js";
import { clearPersisted, readPersisted, recordEvent } from "./collector.js";
import { telemetryInstanceHash16 } from "./instance-id.js";
import { sendBatch } from "./sender.js";

type TelemetryCfg = { enabled: boolean; endpoint: string };

function loadTelemetryCfg(root: string): TelemetryCfg {
  const cfgPath = configPath(root);
  if (!existsSync(cfgPath)) {
    return { enabled: false, endpoint: "" };
  }
  try {
    const cfg = JSON.parse(readFileSync(cfgPath, ENCODING_UTF8)) as {
      telemetry?: { endpoint?: string; enabled?: boolean };
    };
    const t = cfg.telemetry;
    return {
      enabled: t?.enabled === true,
      endpoint: typeof t?.endpoint === "string" ? t.endpoint.trim() : "",
    };
  } catch {
    return { enabled: false, endpoint: "" };
  }
}

/** Parses `--key value` pairs from argv following the action word. Unknown flags are ignored
 * rather than rejected -- this is an internal, best-effort recorder, not a user-facing surface
 * that needs strict validation (the Zod schema in ./schema.js is the real gate, applied when the
 * event is constructed below). */
function parseFlags(argv: string[]): Record<string, string> {
  const flags: Record<string, string> = {};
  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i];
    if (arg?.startsWith("--")) {
      const key = arg.slice(2);
      const value = argv[i + 1];
      if (value !== undefined && !value.startsWith("--")) {
        flags[key] = value;
        i++;
      }
    }
  }
  return flags;
}

const action = process.argv[2] ?? TELEMETRY_CLI.ACTIONS.STATUS;

// `jstack telemetry record` (below) is the first real caller of recordEvent() in this codebase --
// a skill's own preamble/procedure can `!bun ${CLAUDE_PLUGIN_ROOT}/telemetry/cli.ts record ...` the
// same way it already `!cat`s the setup preamble. No skill does this YET; wiring individual
// skills to call it is a separate follow-up, tracked apart from making the pipe itself real.
const RECORDING_WIRED_UP = true;

if (action === TELEMETRY_CLI.ACTIONS.STATUS) {
  const root = findProjectRoot(import.meta.dir);
  const cfg = loadTelemetryCfg(root);
  console.log(
    JSON.stringify(
      {
        buffer: readPersisted().length,
        recording_wired_up: RECORDING_WIRED_UP,
        cwd: root,
        telemetry_config: {
          enabled: cfg.enabled,
          endpoint_configured: cfg.endpoint.length > 0,
        },
      },
      null,
      2,
    ),
  );
} else if (action === TELEMETRY_CLI.ACTIONS.RESET) {
  clearPersisted();
  console.log("buffer cleared");
} else if (action === TELEMETRY_CLI.ACTIONS.FLUSH) {
  const root = findProjectRoot(import.meta.dir);
  const cfg = loadTelemetryCfg(root);
  let endpoint: string | undefined;
  if (cfg.enabled && cfg.endpoint.length > 0) endpoint = cfg.endpoint;
  const events = readPersisted();
  const ok = await sendBatch(endpoint, events);
  clearPersisted();
  console.log(
    JSON.stringify(
      {
        sent: events.length,
        ok,
        recording_wired_up: RECORDING_WIRED_UP,
      },
      null,
      2,
    ),
  );
} else if (action === TELEMETRY_CLI.ACTIONS.RECORD) {
  const root = findProjectRoot(import.meta.dir);
  const cfg = loadTelemetryCfg(root);
  if (!cfg.enabled) {
    // Opt-in, off by default -- a disabled caller's event is silently dropped, not queued for
    // later, so enabling telemetry never retroactively "finds" events from before it was on.
    console.log(
      JSON.stringify({ recorded: false, reason: "telemetry disabled" }),
    );
  } else {
    const flags = parseFlags(process.argv.slice(3));
    const tokenInput = Number(flags["token-input"] ?? 0);
    const tokenOutput = Number(flags["token-output"] ?? 0);
    recordEvent({
      timestamp: new Date().toISOString(),
      plugin_version: flags["plugin-version"] ?? "unknown",
      skill_name: flags.skill ?? "unknown",
      skill_category: flags.category ?? "unknown",
      token_input: Number.isFinite(tokenInput) ? tokenInput : 0,
      token_output: Number.isFinite(tokenOutput) ? tokenOutput : 0,
      token_total: Number.isFinite(tokenInput + tokenOutput)
        ? tokenInput + tokenOutput
        : 0,
      latency_ms: Number(flags["latency-ms"] ?? 0) || 0,
      success: flags.success !== "false",
      error_type: flags["error-type"],
    });
    console.log(JSON.stringify({ recorded: true }));
  }
} else if (action === TELEMETRY_CLI.ACTIONS.TEST) {
  const root = findProjectRoot(import.meta.dir);
  const cfg = loadTelemetryCfg(root);
  const hash = telemetryInstanceHash16();
  const selftestPath = join(
    homedir(),
    ".jstack",
    "jstack.telemetry.selftest.jsonl",
  );
  mkdirSync(dirname(selftestPath), { recursive: true });
  const line = {
    kind: "jstack_telemetry_selftest",
    ts: new Date().toISOString(),
    telemetry_instance_hash: hash,
    plugin_telemetry_enabled: cfg.enabled,
    endpoint_configured: cfg.endpoint.length > 0,
  };
  appendFileSync(selftestPath, `${JSON.stringify(line)}\n`, "utf8");
  console.log(
    JSON.stringify(
      {
        ok: true,
        message:
          "Wrote one anonymous self-test line (no PII). Eval JSONL default is ~/.jstack/telemetry.jsonl when JSTACK_TELEMETRY=1.",
        paths: {
          machine_instance_id_file: join(
            homedir(),
            ".jstack",
            "telemetry-instance-id",
          ),
          selftest_append_only_log: selftestPath,
          eval_jsonl_default: join(homedir(), ".jstack", "telemetry.jsonl"),
        },
        config: {
          plugin_telemetry_enabled: cfg.enabled,
          endpoint_configured: cfg.endpoint.length > 0,
        },
      },
      null,
      2,
    ),
  );
} else {
  console.error(TELEMETRY_CLI.USAGE_LINE);
  process.exit(1);
}
