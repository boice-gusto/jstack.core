import { createHash } from "node:crypto";
import { appendFileSync, mkdirSync } from "node:fs";
import { homedir } from "node:os";
import { dirname, join } from "node:path";
import { telemetryInstanceHash16 } from "../telemetry/instance-id.js";
import type { EvalCase } from "./eval-config.js";

export type EvalTelemetryResultShape = {
  status: "completed" | "timeout" | "error";
  elapsed: number;
  tokens: number;
  cost_usd: number;
  skill_triggered: boolean;
};

function telemetryEnabled(): boolean {
  const v = process.env.JSTACK_TELEMETRY?.trim() ?? "";
  return v === "1" || /^true$/i.test(v);
}

function telemetryPath(): string {
  const override = process.env.JSTACK_TELEMETRY_PATH?.trim();
  if (override !== undefined && override.length > 0) {
    return override;
  }
  return join(homedir(), ".jstack", "telemetry.jsonl");
}

function sha256Hex(text: string): string {
  return createHash("sha256").update(text, "utf8").digest("hex");
}

/**
 * Append one JSON line when JSTACK_TELEMETRY=1 (or true). No raw prompts — only prompt_sha256.
 */
export function appendEvalTelemetryIfEnabled(
  skillRelPath: string,
  caseDef: EvalCase,
  result: EvalTelemetryResultShape,
): void {
  if (!telemetryEnabled()) {
    return;
  }
  const path = telemetryPath();
  mkdirSync(dirname(path), { recursive: true });
  const line = {
    ts: new Date().toISOString(),
    telemetry_instance_hash: telemetryInstanceHash16(),
    gate_id: `jstack:${skillRelPath}`,
    case_name: caseDef.name,
    status: result.status,
    elapsed_sec: result.elapsed,
    tokens: result.tokens,
    cost_usd: result.cost_usd,
    skill_triggered: result.skill_triggered,
    prompt_sha256: sha256Hex(caseDef.prompt),
  };
  appendFileSync(path, `${JSON.stringify(line)}\n`, "utf8");
}
