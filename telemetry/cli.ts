#!/usr/bin/env bun
import { appendFileSync, mkdirSync, readFileSync, existsSync } from "node:fs";
import { homedir } from "node:os";
import { dirname, join } from "node:path";
import { configPath, findProjectRoot } from "../cli/src/lib/config.js";
import { ENCODING_UTF8, TELEMETRY_CLI } from "../constants/paths.js";
import { clearBuffer, bufferSize, snapshotBuffer } from "./collector.js";
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

const action = process.argv[2] ?? TELEMETRY_CLI.ACTIONS.STATUS;

if (action === TELEMETRY_CLI.ACTIONS.STATUS) {
  const root = findProjectRoot(import.meta.dir);
  const cfg = loadTelemetryCfg(root);
  console.log(
    JSON.stringify(
      {
        buffer: bufferSize(),
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
  clearBuffer();
  console.log("buffer cleared");
} else if (action === TELEMETRY_CLI.ACTIONS.FLUSH) {
  const root = findProjectRoot(import.meta.dir);
  const cfg = loadTelemetryCfg(root);
  let endpoint: string | undefined;
  if (cfg.enabled && cfg.endpoint.length > 0) endpoint = cfg.endpoint;
  const events = snapshotBuffer();
  clearBuffer();
  const ok = await sendBatch(endpoint, events);
  console.log(JSON.stringify({ sent: events.length, ok }, null, 2));
} else if (action === TELEMETRY_CLI.ACTIONS.TEST) {
  const root = findProjectRoot(import.meta.dir);
  const cfg = loadTelemetryCfg(root);
  const hash = telemetryInstanceHash16();
  const selftestPath = join(homedir(), ".jstack", "jstack.telemetry.selftest.jsonl");
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
          machine_instance_id_file: join(homedir(), ".jstack", "telemetry-instance-id"),
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
