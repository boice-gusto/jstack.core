import chalk from "chalk";
import * as p from "@clack/prompts";
import { existsSync } from "node:fs";
import { join } from "node:path";
import {
  CONFIG_DIR,
  DEFAULTS_FILE,
  JSTACK_CONFIG_FILE,
  SKILLS_DIR,
} from "@jstack/constants/paths";
import { buildSkillRecords, buildSkillsPayload } from "../../../scripts/docs-data-shared.ts";
import { validateSkillAliasDrift } from "../../../scripts/validate-skill-alias-drift.ts";
import {
  configPath,
  findPluginRoot,
  findProjectRoot,
  loadDefaults,
  readConfigOptional,
  writeConfig,
} from "../lib/config.js";
import { resolveMachineReadableSettings } from "../lib/machine-readable.js";
import {
  collectDoctorConfigWarnings,
  collectMockMcpDoctorWarnings,
} from "../lib/doctor-warnings.js";
import { exitCancelled, handleCancel, isInteractive } from "../lib/cliUi.js";
import { checkDistributionUpdate } from "../lib/update-check.js";
import {
  type DependencyIssue,
  type RepairAction,
  resolveDependencies,
} from "../lib/dependency-resolver.js";
import { REPAIR_CONSENT_DEFAULT } from "../lib/repair-consent.js";
import { setAt } from "../lib/path-utils.js";
import { JstackConfigSchema } from "../types/config.js";
import { mkdirSync, writeFileSync } from "node:fs";

export async function runDoctor(opts: {
  fix?: boolean;
  apply?: boolean;
  strict?: boolean;
  json?: boolean;
}): Promise<void> {
  const root = findProjectRoot();
  const pluginRoot = findPluginRoot();
  let ok = true;
  const strict = opts.strict === true;

  const check = (name: string, pass: boolean, hint?: string) => {
    if (opts.json) return;
    console.log(pass ? chalk.green(`✔ ${name}`) : chalk.red(`✖ ${name}`));
    if (!pass) {
      ok = false;
      if (hint) console.log(chalk.dim(`  ${hint}`));
    }
  };

  const warn = (msg: string) => {
    if (opts.json) return;
    console.log(chalk.yellow(`⚠ ${msg}`));
    if (strict) ok = false;
  };

  const cfg = readConfigOptional(root);
  const dist = (cfg?.distribution as Record<string, unknown> | undefined) ?? {};
  const versionUrl = String(dist.version_url ?? "").trim();
  const updateCheck = dist.update_check !== false;

  let update: Awaited<ReturnType<typeof checkDistributionUpdate>> | null = null;
  if (updateCheck) {
    update = await checkDistributionUpdate(
      pluginRoot,
      versionUrl.length > 0 ? versionUrl : undefined,
    );
  }

  const aliasDrift = validateSkillAliasDrift();

  const defaultsRecord = loadDefaults(pluginRoot);

  if (opts.json) {
    const cfgObj = cfg as unknown as Record<string, unknown>;
    const warnings = cfg
      ? [
          ...collectDoctorConfigWarnings(root, cfgObj, defaultsRecord),
          ...collectMockMcpDoctorWarnings(root, pluginRoot, cfgObj),
        ]
      : [];
    const cross = (cfg?.cross_plugins as Record<string, unknown> | undefined) ?? {};
    const gbrainPlugin = cross.gbrain as Record<string, unknown> | undefined;
    const configOk = existsSync(join(root, JSTACK_CONFIG_FILE));
    const pluginOk = existsSync(join(pluginRoot, CONFIG_DIR, DEFAULTS_FILE));
    const skillsOk = existsSync(join(pluginRoot, SKILLS_DIR));
    const hardFail = !configOk || !pluginOk || !skillsOk || !cfg;
    const warnFail = strict && warnings.length > 0;
    const aliasErrFail = aliasDrift.errors.length > 0;
    const aliasWarnFail = strict && aliasDrift.warnings.length > 0;
    const skillsMr = cfg
      ? resolveMachineReadableSettings(cfgObj, defaultsRecord)
      : { enabled: true, require_schema_ref: false };
    console.log(
      JSON.stringify(
        {
          ok: !hardFail && !warnFail && !aliasErrFail && !aliasWarnFail,
          jstack_config_present: configOk,
          plugin_defaults_present: pluginOk,
          skills_dir_present: skillsOk,
          config_parseable: !!cfg,
          mcp_present: existsSync(join(root, ".mcp.json")),
          skills_machine_readable: skillsMr,
          warnings,
          skill_alias_drift: {
            errors: aliasDrift.errors,
            warnings: aliasDrift.warnings,
            notes: aliasDrift.notes,
          },
          distribution: update
            ? {
                local_version: update.local_version,
                remote_version: update.remote_version,
                upgrade_available: update.upgrade_available,
                raw_line: update.raw_line,
              }
            : { skipped: true },
          cross_plugins: {
            gbrain: gbrainPlugin
              ? {
                  enabled: gbrainPlugin.enabled === true,
                  skills: gbrainPlugin.skills,
                }
              : null,
          },
        },
        null,
        2,
      ),
    );
    if (hardFail || warnFail || aliasErrFail || aliasWarnFail) process.exitCode = 1;
    return;
  }

  check("jstack.config.json", existsSync(join(root, JSTACK_CONFIG_FILE)), "jstack setup");
  check("plugin defaults", existsSync(join(pluginRoot, CONFIG_DIR, DEFAULTS_FILE)));
  check("skills/", existsSync(join(pluginRoot, SKILLS_DIR)));
  check("config parseable", !!cfg);
  check(".mcp.json (optional)", existsSync(join(root, ".mcp.json")), "copy .mcp.json.example if needed");

  if (update?.upgrade_available && update.raw_line) {
    warn(`Plugin update: ${update.raw_line} — see jstack upgrade or release notes.`);
  }

  if (cfg) {
    const cfgObj = cfg as unknown as Record<string, unknown>;
    for (const msg of [
      ...collectDoctorConfigWarnings(root, cfgObj, defaultsRecord),
      ...collectMockMcpDoctorWarnings(root, pluginRoot, cfgObj),
    ]) {
      warn(msg);
    }
  }

  for (const msg of aliasDrift.errors) {
    check(`skill alias map: ${msg}`, false, "see docs/SKILL_ALIAS_MAP.md and config/skill-alias-map.json");
  }
  for (const msg of aliasDrift.warnings) {
    warn(`skill alias drift: ${msg}`);
  }

  if (opts.fix) {
    if (!cfg) {
      console.log(chalk.red("Cannot run --fix: jstack.config.json missing or unparseable. Run `jstack setup --schema` first."));
      process.exitCode = 1;
      return;
    }
    const issues = resolveDependencies({
      cfg: cfg as unknown as Record<string, unknown>,
      projectRoot: root,
      pluginRoot,
    });
    if (issues.length === 0) {
      console.log(chalk.green("No dependency issues detected."));
    } else {
      console.log(chalk.bold(`\nDependency issues (${issues.length}):`));
      for (const i of issues) {
        const sev = i.severity === "error" ? chalk.red("✗") : chalk.yellow("⚠");
        console.log(`  ${sev} ${chalk.bold(i.id)} — ${i.message}`);
        for (const r of i.repairs) {
          console.log(`      ${chalk.dim("→")} ${formatRepair(r)}`);
        }
      }
      if (opts.apply) {
        const applied = await applyRepairsInteractive(
          issues,
          root,
          cfg as unknown as Record<string, unknown>,
        );
        if (applied > 0) {
          console.log(chalk.green(`\nApplied ${applied} repair(s).`));
        } else {
          console.log(chalk.dim("\nNo repairs applied."));
        }
      } else {
        console.log(chalk.dim("\nThis was a dry run. Re-run with --fix --apply to apply (with consent per group)."));
      }
    }
  }

  if (ok && !opts.json && isInteractive()) {
    const next = await p.select<string>({
      message: "Next step?",
      options: [
        { value: "done", label: "Done" },
        {
          value: "config",
          label: `Show config path (${JSTACK_CONFIG_FILE})`,
        },
        { value: "setup", label: "Hint: re-run setup wizard" },
      ],
    });
    if (handleCancel(next)) exitCancelled();
    const choice = String(next);
    if (choice === "config") {
      console.log(join(root, JSTACK_CONFIG_FILE));
    } else if (choice === "setup") {
      console.log(chalk.dim("Run: jstack setup"));
    }
  }

  if (!ok) process.exitCode = 1;
}

function formatRepair(r: RepairAction): string {
  switch (r.kind) {
    case "mkdir":
      return `mkdir -p ${r.path}`;
    case "write_file":
      return `write file ${r.path} (if missing)`;
    case "set_config":
      return `set jstack.config.json ${r.path.join(".")} = ${JSON.stringify(r.value)}`;
    case "shell_hint":
      return `${chalk.dim("hint:")} ${r.cmd}  (${r.reason})`;
  }
}


async function applyRepairsInteractive(
  issues: DependencyIssue[],
  projectRoot: string,
  cfg: Record<string, unknown>,
): Promise<number> {
  // Group repairs by kind so we ask for consent per category.
  const mkdirs = new Set<string>();
  const writes: Array<{ path: string; content: string }> = [];
  const setConfig: Array<{ path: string[]; value: unknown }> = [];
  for (const i of issues) {
    for (const r of i.repairs) {
      if (r.kind === "mkdir") mkdirs.add(r.path);
      else if (r.kind === "write_file") writes.push({ path: r.path, content: r.content });
      else if (r.kind === "set_config") setConfig.push({ path: r.path, value: r.value });
      // shell_hint is informational; never executed automatically.
    }
  }

  if (!isInteractive()) {
    console.log(chalk.yellow("Non-interactive shell — refusing to apply automatic repairs. Re-run in a terminal."));
    return 0;
  }

  let applied = 0;

  if (mkdirs.size > 0) {
    const ok = await p.confirm({
      message: `Create ${mkdirs.size} missing director${mkdirs.size === 1 ? "y" : "ies"}?`,
      initialValue: REPAIR_CONSENT_DEFAULT.mkdir,
    });
    if (handleCancel(ok)) exitCancelled();
    if (ok) {
      for (const dir of mkdirs) {
        mkdirSync(dir, { recursive: true });
        applied++;
      }
    }
  }

  if (writes.length > 0) {
    const ok = await p.confirm({
      message: `Create ${writes.length} template file(s) where missing?`,
      initialValue: REPAIR_CONSENT_DEFAULT.write_file,
    });
    if (handleCancel(ok)) exitCancelled();
    if (ok) {
      for (const w of writes) {
        if (existsSync(w.path)) continue;
        mkdirSync(join(w.path, ".."), { recursive: true });
        writeFileSync(w.path, w.content, "utf8");
        applied++;
      }
    }
  }

  if (setConfig.length > 0) {
    const ok = await p.confirm({
      message: `Apply ${setConfig.length} config change(s) to jstack.config.json?`,
      initialValue: REPAIR_CONSENT_DEFAULT.set_config,
    });
    if (handleCancel(ok)) exitCancelled();
    if (ok) {
      const draft: Record<string, unknown> = JSON.parse(JSON.stringify(cfg));
      for (const s of setConfig) setAt(draft, s.path, s.value);
      try {
        const parsed = JstackConfigSchema.parse(draft);
        writeConfig(projectRoot, parsed);
        applied += setConfig.length;
      } catch (err) {
        console.log(
          chalk.red(`Config patch failed validation; skipping: ${err instanceof Error ? err.message : String(err)}`),
        );
      }
    }
  }

  // Always print remaining shell_hints (we never run them).
  const hints: Array<{ cmd: string; reason: string }> = [];
  for (const i of issues) {
    for (const r of i.repairs) {
      if (r.kind === "shell_hint") hints.push({ cmd: r.cmd, reason: r.reason });
    }
  }
  if (hints.length > 0) {
    console.log(chalk.dim("\nManual steps you may still want to run:"));
    for (const h of hints) {
      console.log(chalk.dim(`  $ ${h.cmd}    # ${h.reason}`));
    }
  }

  // Reference configPath so the import is used (helps future surfacing of the config file).
  void configPath;

  return applied;
}

/** Same SKILL.md catalog as `docs:generate` / `jstack docs generate` / `skill-catalog.json` (paths relative to plugin root). */
export async function runDoctorSkills(opts: { json?: boolean }): Promise<void> {
  const pluginRoot = findPluginRoot();
  const skillsRoot = join(pluginRoot, SKILLS_DIR);
  if (!existsSync(skillsRoot)) {
    const msg = `skills/ not found under plugin root: ${pluginRoot}`;
    if (opts.json) {
      console.log(JSON.stringify({ ok: false, error: msg, count: 0, skills: [] }, null, 2));
    } else {
      console.error(chalk.red(msg));
    }
    process.exitCode = 1;
    return;
  }
  const records = await buildSkillRecords(pluginRoot, skillsRoot);
  const payload = buildSkillsPayload(records);
  if (opts.json) {
    console.log(
      JSON.stringify(
        {
          ok: true,
          generatedAt: payload.generatedAt,
          count: payload.count,
          skills: records,
        },
        null,
        2,
      ),
    );
    return;
  }
  console.log(chalk.bold(`${payload.count} skills`) + chalk.dim(` under ${skillsRoot}`));
  const sample = records.slice(0, 5);
  for (const s of sample) {
    console.log(chalk.dim(`  ${s.gateId}`) + `  ${s.name}`);
  }
  if (records.length > sample.length) {
    console.log(chalk.dim(`  … and ${records.length - sample.length} more (use --json for full list)`));
  }
}
