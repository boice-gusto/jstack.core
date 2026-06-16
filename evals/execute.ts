import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { spawnSync } from "node:child_process";
import { tmpdir } from "node:os";
import type { EvalCase } from "./eval-config.js";
import type { GlobalEvalEnv } from "./eval-config.js";
import { appendEvalTelemetryIfEnabled } from "./eval-telemetry.js";

export interface ExecuteResult {
  name: string;
  status: "completed" | "timeout" | "error";
  elapsed: number;
  tokens: number;
  cost_usd: number;
  skill_triggered: boolean;
  response: string;
  error?: string;
  returncode?: number;
}

function sleepSync(ms: number) {
  const end = Date.now() + ms;
  while (Date.now() < end) {}
}

function parseStreamJson(stdout: string, skillNameHint: string): {
  response_text: string;
  total_tokens: number;
  cost_usd: number;
  skill_triggered: boolean;
} {
  let responseText = "";
  let totalTokens = 0;
  let costUsd = 0;
  let skillTriggered = false;

  for (const line of stdout.split("\n")) {
    const trimmed = line.trim();
    if (!trimmed) continue;
    let event: Record<string, unknown>;
    try {
      event = JSON.parse(trimmed) as Record<string, unknown>;
    } catch {
      continue;
    }
    if (event.type === "assistant") {
      const message = event.message as Record<string, unknown> | undefined;
      const content = (message?.content as unknown[]) ?? [];
      for (const block of content) {
        const b = block as Record<string, unknown>;
        if (b.type === "text") {
          responseText += String(b.text ?? "");
        } else if (b.type === "tool_use") {
          const name = String(b.name ?? "");
          const inputStr = JSON.stringify(b.input ?? {});
          if (name === "Skill" && inputStr.includes(skillNameHint)) {
            skillTriggered = true;
          }
        }
      }
    } else if (event.type === "result") {
      const usage = (event.usage as Record<string, number>) ?? {};
      totalTokens =
        (usage.input_tokens ?? 0) +
        (usage.output_tokens ?? 0) +
        (usage.cache_creation_input_tokens ?? 0) +
        (usage.cache_read_input_tokens ?? 0);
      costUsd = Number(event.total_cost_usd ?? 0);
      if (!responseText) {
        responseText = String(event.result ?? "");
      }
    }
  }

  return {
    response_text: responseText,
    total_tokens: totalTokens,
    cost_usd: costUsd,
    skill_triggered: skillTriggered,
  };
}

function runClaude(
  env: GlobalEvalEnv,
  args: string[],
  workDir: string,
  timeoutSec: number,
): { stdout: string; stderr: string; status: number | null; error?: Error } {
  let last: { stdout: string; stderr: string; status: number | null; error?: Error } = {
    stdout: "",
    stderr: "",
    status: 1,
  };
  for (let attempt = 1; attempt <= env.maxRetries; attempt++) {
    const childEnv: NodeJS.ProcessEnv = {
      ...process.env,
      ANTHROPIC_API_KEY: env.anthropicApiKey ?? process.env.ANTHROPIC_API_KEY ?? "",
    };
    const scenario = env.mcpScenario?.trim();
    if (scenario !== undefined && scenario.length > 0) {
      childEnv.JSTACK_MCP_SCENARIO = scenario;
    }
    const r = spawnSync(env.claudeBin, args, {
      cwd: workDir,
      env: childEnv,
      encoding: "utf8",
      maxBuffer: 64 * 1024 * 1024,
      timeout: timeoutSec * 1000,
    });
    if (r.error) {
      last = { stdout: r.stdout ?? "", stderr: r.stderr ?? "", status: null, error: r.error };
      if (attempt < env.maxRetries) {
        sleepSync(env.retryDelaySec * 1000 * attempt);
        continue;
      }
      return last;
    }
    const status = r.status ?? 1;
    const stdout = r.stdout ?? "";
    const stderr = r.stderr ?? "";
    if (status !== 0 && attempt < env.maxRetries) {
      sleepSync(env.retryDelaySec * 1000 * attempt);
      last = { stdout, stderr, status };
      continue;
    }
    return { stdout, stderr, status };
  }
  return last;
}

export function executeCase(
  env: GlobalEvalEnv,
  skillRelPath: string,
  skillContent: string,
  caseDef: EvalCase,
  workspaceCaseDir: string,
): ExecuteResult {
  const start = Date.now();
  const workDir = mkdtempSync(join(tmpdir(), `jstack-eval-${caseDef.name.replace(/\s+/g, "-")}-`));
  try {
    for (const f of caseDef.files) {
      const fp = join(workDir, f.path);
      mkdirSync(dirname(fp), { recursive: true });
      writeFileSync(fp, f.content ?? "", "utf8");
    }
  } catch (e) {
    rmSync(workDir, { recursive: true, force: true });
    const errResult: ExecuteResult = {
      name: caseDef.name,
      status: "error",
      elapsed: 0,
      tokens: 0,
      cost_usd: 0,
      skill_triggered: false,
      response: "",
      error: e instanceof Error ? e.message : String(e),
    };
    appendEvalTelemetryIfEnabled(skillRelPath, caseDef, {
      status: errResult.status,
      elapsed: errResult.elapsed,
      tokens: errResult.tokens,
      cost_usd: errResult.cost_usd,
      skill_triggered: errResult.skill_triggered,
    });
    return errResult;
  }

  let telemetryOut: ExecuteResult | undefined;
  try {
    const rawPrompt = caseDef.prompt;
    const prompt =
      skillContent && caseDef.expect_skill
        ? `Follow these skill instructions when responding:\n\n<skill-instructions>\n${skillContent}\n</skill-instructions>\n\nUser request: ${rawPrompt}`
        : rawPrompt;

    const args = ["-p", prompt, "--output-format", "stream-json"];
    const r = runClaude(env, args, workDir, caseDef.timeout);
    const elapsed = (Date.now() - start) / 1000;

    if (r.error && r.error.name === "ETIMEDOUT") {
      telemetryOut = {
        name: caseDef.name,
        status: "timeout",
        elapsed: Math.round(elapsed * 10) / 10,
        tokens: 0,
        cost_usd: 0,
        skill_triggered: false,
        response: "",
      };
      return telemetryOut;
    }

    const parsed = parseStreamJson(r.stdout, skillRelPath);
    writeFileSync(join(workspaceCaseDir, "response.md"), parsed.response_text, "utf8");
    writeFileSync(
      join(workspaceCaseDir, "timing.json"),
      JSON.stringify(
        { total_tokens: parsed.total_tokens, duration_seconds: Math.round(elapsed * 10) / 10 },
        null,
        2,
      ),
      "utf8",
    );
    writeFileSync(
      join(workspaceCaseDir, "eval_metadata.json"),
      JSON.stringify(
        {
          prompt: rawPrompt,
          criteria: caseDef.criteria,
          expect_skill: caseDef.expect_skill,
          skill_triggered: parsed.skill_triggered,
        },
        null,
        2,
      ),
      "utf8",
    );

    telemetryOut = {
      name: caseDef.name,
      status: "completed",
      elapsed: Math.round(elapsed * 10) / 10,
      tokens: parsed.total_tokens,
      cost_usd: parsed.cost_usd,
      skill_triggered: parsed.skill_triggered,
      response: parsed.response_text,
      returncode: r.status ?? undefined,
    };
    return telemetryOut;
  } catch (e) {
    telemetryOut = {
      name: caseDef.name,
      status: "error",
      elapsed: Math.round(((Date.now() - start) / 1000) * 10) / 10,
      tokens: 0,
      cost_usd: 0,
      skill_triggered: false,
      response: "",
      error: e instanceof Error ? e.message : String(e),
    };
    return telemetryOut;
  } finally {
    if (telemetryOut !== undefined) {
      appendEvalTelemetryIfEnabled(skillRelPath, caseDef, {
        status: telemetryOut.status,
        elapsed: telemetryOut.elapsed,
        tokens: telemetryOut.tokens,
        cost_usd: telemetryOut.cost_usd,
        skill_triggered: telemetryOut.skill_triggered,
      });
    }
    rmSync(workDir, { recursive: true, force: true });
  }
}

/** Load SKILL.md body for a skill relative path */
export function readSkillMd(pluginRoot: string, skillRelPath: string): string {
  const p = join(pluginRoot, "skills", ...skillRelPath.split("/"), "SKILL.md");
  return readFileSync(p, "utf8");
}
