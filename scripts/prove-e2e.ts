#!/usr/bin/env bun
/**
 * Proof script: setup --ci, doctor, disk KB write, optional semantic (1 case) with ANTHROPIC_API_KEY.
 *
 *   bun run prove
 *   ANTHROPIC_API_KEY=sk-ant-... bun run prove
 *   SKIP_SEMANTIC_PROOF=1 bun run prove   # skip LLM step even if key is set
 *   JSTACK_MOCK_MCP=1 bun run prove       # after setup: set debug.mock_mcp + run `jstack mcp add jstack-mock` before doctor (CI MCP wiring smoke)
 */
import {
  existsSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { ENCODING_UTF8, JSTACK_CONFIG_FILE } from "../constants/paths.js";
import { isRecord, runBun, runStepOrExit } from "./lib/proc-utils.js";

const __dirname = dirname(fileURLToPath(import.meta.url));
const pluginRoot = join(__dirname, "..");
const cliEntry = join(pluginRoot, "cli/src/index.ts");

async function main(): Promise<void> {
  console.log("=== jstack prove-e2e ===\n");

  const tmpProject = mkdtempSync(join(tmpdir(), "jstack-prove-"));
  const diskKb = join(tmpProject, "disk-kb");
  mkdirSync(diskKb, { recursive: true });

  console.log("1) jstack setup --ci (non-interactive fixture)\n");
  runStepOrExit(
    ["run", cliEntry, "setup", "--ci", "--disk-fallback-root", diskKb],
    tmpProject,
    { CLAUDE_PLUGIN_ROOT: pluginRoot },
  );

  if (process.env.JSTACK_MOCK_MCP === "1") {
    console.log(
      "1b) JSTACK_MOCK_MCP=1: debug.mock_mcp + jstack mcp add jstack-mock\n",
    );
    const cfgPath = join(tmpProject, JSTACK_CONFIG_FILE);
    const parsed = JSON.parse(readFileSync(cfgPath, ENCODING_UTF8)) as Record<
      string,
      unknown
    >;
    const prevDbg =
      typeof parsed.debug === "object" &&
      parsed.debug !== null &&
      !Array.isArray(parsed.debug)
        ? (parsed.debug as Record<string, unknown>)
        : {};
    parsed.debug = { ...prevDbg, mock_mcp: true };
    writeFileSync(
      cfgPath,
      JSON.stringify(parsed, null, 2) + "\n",
      ENCODING_UTF8,
    );
    runStepOrExit(["run", cliEntry, "mcp", "add", "jstack-mock"], tmpProject, {
      CLAUDE_PLUGIN_ROOT: pluginRoot,
    });
    console.log("   OK mock MCP preset registered\n");
  }

  const rawCfg: unknown = JSON.parse(
    readFileSync(join(tmpProject, JSTACK_CONFIG_FILE), ENCODING_UTF8),
  );
  const cfg = isRecord(rawCfg) ? rawCfg : {};
  const ks = cfg["knowledge_storage"];
  const ksObj = isRecord(ks) ? ks : {};
  const diskRoot = ksObj["disk_fallback_root"];
  if (diskRoot !== diskKb) {
    console.error(
      "Expected knowledge_storage.disk_fallback_root",
      diskKb,
      ksObj,
    );
    process.exit(1);
  }
  console.log(
    "   OK jstack.config.json knowledge_storage.disk_fallback_root matches\n",
  );

  console.log("2) jstack doctor\n");
  runStepOrExit(["run", cliEntry, "doctor"], tmpProject, {
    CLAUDE_PLUGIN_ROOT: pluginRoot,
  });
  console.log("   OK doctor exit 0\n");

  console.log(
    "3) Disk fallback write (path convention: {root}/team/{category}/{file}.md)\n",
  );
  const proofDir = join(diskKb, "team", "prove");
  mkdirSync(proofDir, { recursive: true });
  const proofFile = join(proofDir, "e2e-proof.md");
  writeFileSync(
    proofFile,
    `# E2E proof\n\ngenerated: ${new Date().toISOString()}\nroot: ${diskKb}\n`,
    ENCODING_UTF8,
  );
  if (!existsSync(proofFile)) {
    console.error("proof file missing");
    process.exit(1);
  }
  console.log("   OK", proofFile, "\n");

  const skipSemantic = process.env.SKIP_SEMANTIC_PROOF === "1";
  const hasKey = Boolean(process.env.ANTHROPIC_API_KEY?.trim());

  console.log("4) Semantic eval (1 case: knowledge/intake)\n");
  if (skipSemantic) {
    console.log("   SKIP (SKIP_SEMANTIC_PROOF=1)\n");
  } else if (!hasKey) {
    console.log(
      "   SKIP (set ANTHROPIC_API_KEY and ensure `claude` is on PATH to run LLM proof)\n",
    );
  } else {
    const e3 = runBun(
      [
        "run",
        join(pluginRoot, "evals/run-evals.ts"),
        "semantic",
        "--skill",
        "knowledge/intake",
        "--max-cases",
        "1",
      ],
      pluginRoot,
      {},
    );
    console.log(e3.out);
    if (e3.status !== 0) {
      console.error("   semantic eval failed (exit " + e3.status + ")");
      process.exit(e3.status);
    }
    console.log("   OK semantic (1 case)\n");
  }

  console.log("=== prove-e2e finished ===");
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
