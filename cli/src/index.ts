#!/usr/bin/env bun
import { Command } from "commander";
import chalk from "chalk";
import { runSetup, runSetupCi } from "./commands/setup.js";
import { runSetupSchema } from "./commands/setup-schema.js";
import { runConfigShow } from "./commands/config.js";
import { runStatus } from "./commands/status.js";
import { runDoctor, runDoctorSkills } from "./commands/doctor.js";
import { runScheduleDisable, runScheduleEnable, runScheduleList } from "./commands/schedule.js";
import {
  runWorkflowCreate,
  runWorkflowDelete,
  runWorkflowEdit,
  runWorkflowExport,
  runWorkflowImport,
  runWorkflowList,
  runWorkflowRun,
  runWorkflowShow,
} from "./commands/workflow.js";
import { runTranscriptsIngest, runTranscriptsStatus } from "./commands/transcripts.js";
import { runUpgrade } from "./commands/upgrade.js";
import {
  runMcpAdd,
  runMcpHealth,
  runMcpList,
  runMcpRefresh,
  runMcpRemove,
} from "./commands/mcp.js";
import { runTime } from "./commands/time.js";
import { runEval } from "./commands/eval.js";
import { runDocs } from "./commands/docs.js";
import { runTelemetry } from "./commands/telemetry.js";
import {
  runSkillsBrowse,
  runSkillsIndex,
  runSkillsPick,
  runSkillsShow,
} from "./commands/skills.js";
import { runReportRender } from "./commands/report.js";
import { cliRegistryJson } from "./types/cli-registry.js";
import { registerClaudeMdCommand } from "./commands/claude-md.js";

const program = new Command();
program.name("jstack").description("jstack Team Operations CLI").version("0.1.0");

if (process.argv.includes("--help-json")) {
  console.log(cliRegistryJson());
  process.exit(0);
}

registerClaudeMdCommand(program);

program
  .command("setup")
  .description("Interactive setup wizard")
  .option("--reconfigure", "overwrite existing config", false)
  .option("--with-gbrain-kb", "always prompt for GBrain + knowledge_base roots (skip the extra confirm)", false)
  .option("--pe", "also configure PE / team management keys (pe.*)", false)
  .option("--ci", "non-interactive fixture (proof/CI): writes jstack.config.json + docs/ + .mcp.json", false)
  .option(
    "--disk-fallback-root <path>",
    "with --ci: knowledge_storage.disk_fallback_root (default /tmp/knowledgebase)",
    "/tmp/knowledgebase",
  )
  .option("--schema", "schema-driven wizard with Default/Custom/Skip/Example/Discuss per question", false)
  .option("--section <prefix>", "with --schema: only ask questions whose section starts with this prefix")
  .option("--non-interactive", "with --schema: accept Default for every question (no prompts)", false)
  .action(async (o) => {
    if (o.schema) {
      await runSetupSchema({
        reconfigure: o.reconfigure,
        section: o.section,
        nonInteractive: o.nonInteractive,
      });
      return;
    }
    if (o.ci) {
      await runSetupCi({ diskFallbackRoot: o.diskFallbackRoot });
      return;
    }
    await runSetup({ reconfigure: o.reconfigure, withGbrainKb: o.withGbrainKb, pe: o.pe });
  });

program.command("config").description("Print jstack.config.json").action(() => runConfigShow());

program.command("status").description("Team + plugin status").action(() => runStatus());

const skcmd = program.command("skills").description("List / resolve SKILL.md (for agents)");
skcmd
  .command("index")
  .description("List all skills under skills/")
  .option("--json", "JSON output", false)
  .option("--overlay <path>", "Second plugin root (e.g. jstack.gusto checkout)")
  .action((o: { json?: boolean; overlay?: string }) => {
    runSkillsIndex({ json: o.json, overlay: o.overlay });
  });
skcmd
  .command("show")
  .description("Resolve skill id to path + description")
  .argument("<id>", "Frontmatter name or path fragment")
  .option("--json", "JSON output", false)
  .option("--overlay <path>", "Second plugin root")
  .action((id: string, o: { json?: boolean; overlay?: string }) => {
    runSkillsShow(id, { json: o.json, overlay: o.overlay });
  });
skcmd
  .command("browse")
  .description("Interactive pick from skills index (prints path + hint)")
  .option("--json", "same output as skills index", false)
  .option("--overlay <path>", "Second plugin root")
  .action(async (o: { json?: boolean; overlay?: string }) => {
    await runSkillsBrowse({ json: o.json, overlay: o.overlay });
  });
skcmd
  .command("pick")
  .description("Filter skills by substring then pick one")
  .option("--json", "same output as skills index", false)
  .option("--overlay <path>", "Second plugin root")
  .action(async (o: { json?: boolean; overlay?: string }) => {
    await runSkillsPick({ json: o.json, overlay: o.overlay });
  });

const rep = program.command("report").description("Report HTML helpers");
rep
  .command("render")
  .description("Merge ReportPayload JSON into static shell (Tailwind CDN)")
  .requiredOption("--data <path>", "Path to JSON file")
  .requiredOption("--out <path>", "Output HTML path")
  .option("--shell <path>", "Override shell HTML path")
  .action((o: { data: string; out: string; shell?: string }) => {
    runReportRender({ data: o.data, out: o.out, shell: o.shell });
  });

const doctorCmd = program.command("doctor").description("Validate install");
doctorCmd
  .command("skills")
  .description("List skills from plugin catalog (same parsing as jstack docs generate / docs:generate / skill-catalog.json)")
  .option("--json", "full catalog JSON", false)
  .action(async (o: { json?: boolean }) => {
    await runDoctorSkills({ json: o.json });
  });
doctorCmd
  .option("--fix", "run dependency resolver and print proposed repairs (dry-run)", false)
  .option("--apply", "with --fix: actually apply repairs (mkdir, write template, set_config) with consent per group", false)
  .option("--strict", "treat GBrain/knowledge_base warnings as failures", false)
  .option("--json", "machine-readable report (includes version / upgrade_available)", false)
  .action(async (o) => {
    await runDoctor({ fix: o.fix, apply: o.apply, strict: o.strict, json: o.json });
  });

const sched = program.command("schedule").description("Manage routines");
sched.command("list").action(() => runScheduleList());
sched
  .command("enable")
  .argument("[id]", "routine id (omit for picker when interactive)")
  .action(async (id?: string) => {
    await runScheduleEnable(id);
  });
sched
  .command("disable")
  .argument("[id]", "routine id (omit for picker when interactive)")
  .action(async (id?: string) => {
    await runScheduleDisable(id);
  });

const wf = program.command("workflow").description("Browser workflows (JSON on disk; stub runner)");
wf
  .command("list")
  .option("--json", "machine-readable list", false)
  .action(async (o: { json?: boolean }) => runWorkflowList({ json: o.json }));
wf
  .command("show")
  .argument("<id>", "workflow id")
  .option("--json", "raw definition JSON", false)
  .action(async (id: string, o: { json?: boolean }) => runWorkflowShow(id, { json: o.json }));
wf
  .command("create")
  .argument("<id>", "workflow id")
  .option("--url <url>", "start url (omit to prompt when interactive)")
  .action(async (id: string, o: { url?: string }) => {
    await runWorkflowCreate(id, o.url);
  });
wf
  .command("run")
  .argument("<id>", "workflow id")
  .option("--yes", "execute", false)
  .action(async (id: string, o: { yes: boolean }) => {
    await runWorkflowRun(id, o.yes);
  });
wf
  .command("delete")
  .argument("<id>", "workflow id")
  .option("--force", "confirm delete", false)
  .action(async (id: string, o: { force: boolean }) => {
    await runWorkflowDelete(id, o.force);
  });
wf
  .command("export")
  .argument("<id>", "workflow id")
  .requiredOption("--out <path>", "destination .json path")
  .action((id: string, o: { out: string }) => runWorkflowExport(id, o.out));
wf
  .command("import")
  .requiredOption("--file <path>", "workflow JSON path")
  .action((o: { file: string }) => runWorkflowImport(o.file));
wf
  .command("edit")
  .argument("<id>", "workflow id")
  .option("--url <url>", "new start_url + first goto step")
  .option("--name <name>", "display name")
  .action((id: string, o: { url?: string; name?: string }) => runWorkflowEdit(id, { startUrl: o.url, name: o.name }));

const trx = program.command("transcripts").description("Transcript pipeline pointers (skills do MCP work)");
trx.command("status").action(() => runTranscriptsStatus());
trx.command("ingest").action(() => runTranscriptsIngest());

program.command("upgrade").action(() => runUpgrade());

const mcp = program.command("mcp").description("MCP registry");
mcp.command("list").action(() => runMcpList());
mcp.command("refresh").action(() => runMcpRefresh());
mcp.command("health").action(() => runMcpHealth());
mcp
  .command("add")
  .argument("[server]", "preset id (omit for interactive picker)")
  .action(async (server?: string) => {
    await runMcpAdd(server);
  });
mcp
  .command("remove")
  .argument("[server]", "server id (omit for picker when interactive)")
  .action(async (server?: string) => {
    await runMcpRemove(server);
  });

program
  .command("time")
  .description("Time context for agents")
  .option("--format <f>", "human | iso | unix | json", "human")
  .option("--sprint", "include sprint placeholders", false)
  .action((o: { format: string; sprint: boolean }) => runTime({ format: o.format, sprint: o.sprint }));

const dc = program
  .command("docs")
  .description("Skill catalog + static docs (mirror: bun run docs:generate|build|serve|preview in package.json)");
dc
  .command("generate")
  .description("Regenerate skill-catalog.json, skills-data.js, index.html skills payload (same as docs:generate)")
  .action(() => {
    runDocs("generate");
  });
dc
  .command("build")
  .description("Build landing page bundle (same as docs:build)")
  .action(() => {
    runDocs("build");
  });
dc
  .command("serve")
  .description("Local HTTP server for README + skills (same as docs:serve; blocks)")
  .action(() => {
    runDocs("serve");
  });
dc
  .command("preview")
  .description("docs:build then docs:serve (same as docs:preview)")
  .action(() => {
    runDocs("preview");
  });

const ev = program.command("eval").description("Skill evals (mirror: bun run eval / eval:quick in package.json)");
ev
  .command("run")
  .description("Full local check: structural + chain + validate + coverage (same as default `bun run eval`)")
  .option("--skill <s>", "optional filter for structural listing only")
  .action((o: { skill?: string }) => runEval("quick", { skill: o.skill }));
ev
  .command("quick")
  .description("Alias for: jstack eval run")
  .option("--skill <s>", "optional filter for structural listing only")
  .action((o: { skill?: string }) => runEval("quick", { skill: o.skill }));
ev.command("validate").description("Lint all skills/*/evals/*.yaml").action(() => runEval("validate"));
ev.command("coverage").description("Semantic eval coverage table").action(() => runEval("coverage"));
ev
  .command("structural")
  .description("SKILL.md exists for every discovered skill")
  .option("--skill <s>", "filter")
  .action((o: { skill?: string }) => runEval("structural", { skill: o.skill }));
ev.command("chain").description("Chain steps from evals/chain-evals.json").action(() => runEval("chain"));
ev
  .command("gate")
  .option("--skill <s>", "gate skill id")
  .action((o: { skill?: string }) => runEval("gate", { skill: o.skill }));
ev.command("report").description("JSON inventory (structural_skills_total, chains, coverage)").action(() => runEval("report"));
ev
  .command("semantic")
  .description("LLM evals (needs ANTHROPIC_API_KEY + claude on PATH)")
  .option("--skill <s>", "filter skill path")
  .option("--threshold <n>", "pass threshold % (default JSTACK_EVAL_PASS_THRESHOLD or 80)")
  .option("--viewer", "write HTML report", false)
  .action((o: { skill?: string; threshold?: string; viewer?: boolean }) => {
    const extra: string[] = [];
    if (o.viewer) extra.push("--viewer");
    if (o.threshold != null && String(o.threshold).length > 0) {
      extra.push("--threshold", String(o.threshold));
    }
    runEval("semantic", { skill: o.skill, extra: extra.length ? extra : undefined });
  });

const tel = program.command("telemetry").description("Telemetry buffer (opt-in)");
tel
  .command("status")
  .action(() => runTelemetry("status"));
tel
  .command("flush")
  .action(() => runTelemetry("flush"));
tel
  .command("reset")
  .action(() => runTelemetry("reset"));
tel
  .command("test")
  .description("Write a local self-test JSONL line + show paths (privacy-safe)")
  .action(() => runTelemetry("test"));

program.action(() => {
  console.log(chalk.bold("jstack") + " — run with --help or jstack setup");
});

await program.parseAsync(process.argv);
