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
import {
  buildSkillRecords,
  buildSkillsPayload,
} from "../../../scripts/docs-data-shared.ts";
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
import {
  checkDistributionUpdate,
  toLegacyUpdateFields,
} from "../lib/update-check.js";
import {
  type DependencyIssue,
  type RepairAction,
  resolveDependencies,
} from "../lib/dependency-resolver.js";
import { REPAIR_CONSENT_DEFAULT } from "../lib/repair-consent.js";
import { resolveWithinRoots, setAt } from "../lib/path-utils.js";
import { JstackConfigSchema } from "../types/config.js";
import type { JstackConfig } from "../types/config.js";
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import {
  serializeRepairs,
  deserializeRepairs,
} from "../lib/repair-serializer.js";

export async function runDoctor(opts: {
  fix?: boolean;
  apply?: boolean;
  strict?: boolean;
  json?: boolean;
  saveRepairs?: string;
  applyRepairs?: string;
}): Promise<void> {
  // Validate flag combinations before any branching below. `fix`, `apply`, `json`,
  // `saveRepairs`, and `applyRepairs` are independently readable from commander, so
  // nonsensical combinations used to silently drop part of the request instead of
  // erroring: the `--json` branch returns before fix/apply/saveRepairs/applyRepairs are
  // ever read; `--apply` and `--save-repairs` were only read inside the `if (opts.fix)`
  // block, so without `--fix` they silently no-op; and `--apply-repairs` hit its own
  // `return` before the `--fix` block was ever reached, silently dropping `--fix`.
  // Reject these loudly instead.
  const fixFamilyRequested =
    opts.fix || opts.apply || opts.saveRepairs || opts.applyRepairs;
  if (opts.json && fixFamilyRequested) {
    console.log(
      chalk.red(
        "--json cannot be combined with --fix/--apply/--save-repairs/--apply-repairs: --json prints a machine-readable report and returns before those run. Re-run `doctor --json` and `doctor --fix` separately.",
      ),
    );
    process.exitCode = 1;
    return;
  }
  if (opts.apply && !opts.fix && !opts.applyRepairs) {
    console.log(
      chalk.red("--apply requires --fix. Re-run with --fix --apply."),
    );
    process.exitCode = 1;
    return;
  }
  if (opts.saveRepairs && !opts.fix) {
    console.log(
      chalk.red(
        "--save-repairs requires --fix. Re-run with --fix --save-repairs <path>.",
      ),
    );
    process.exitCode = 1;
    return;
  }
  if (opts.applyRepairs && opts.fix) {
    console.log(
      chalk.red(
        "--apply-repairs replays a saved repair file and cannot be combined with --fix, which computes fresh repairs instead. Run them separately.",
      ),
    );
    process.exitCode = 1;
    return;
  }
  if (opts.applyRepairs && !opts.apply) {
    console.log(
      chalk.red(
        "--apply-repairs requires --apply to prevent accidental replay. Re-run with --apply.",
      ),
    );
    process.exitCode = 1;
    return;
  }

  const root = findProjectRoot();
  const pluginRoot = findPluginRoot();
  let ok = true;
  const strict = opts.strict === true;

  /**
   * `optional: true` reports the check but never fails the run.
   *
   * Previously every failed check flipped `ok`, including `.mcp.json (optional)` —
   * so plain `jstack doctor` exited 1 in any project without an `.mcp.json`, while
   * `doctor --json` exited 0 for the same state (its `hardFail` never included
   * `mcp_present`). The two output modes disagreed about health. Optional checks now
   * render as a dim advisory in both.
   */
  const check = (
    name: string,
    pass: boolean,
    hint?: string,
    optional = false,
  ) => {
    if (opts.json) return;
    const mark = pass
      ? chalk.green(`✔ ${name}`)
      : optional
        ? chalk.dim(`• ${name}`)
        : chalk.red(`✖ ${name}`);
    console.log(mark);
    if (!pass) {
      if (!optional) ok = false;
      if (hint) console.log(chalk.dim(`  ${hint}`));
    }
  };

  const warn = (msg: string) => {
    if (opts.json) return;
    console.log(chalk.yellow(`⚠ ${msg}`));
    if (strict) ok = false;
  };

  const cfg = readConfigOptional(root);
  const versionUrl = (cfg?.distribution?.version_url ?? "").trim();
  const updateCheck = cfg?.distribution?.update_check !== false;

  let update: Awaited<ReturnType<typeof checkDistributionUpdate>> | null = null;
  if (updateCheck) {
    update = await checkDistributionUpdate(
      pluginRoot,
      versionUrl.length > 0 ? versionUrl : undefined,
    );
  }

  const aliasDrift = validateSkillAliasDrift();

  const defaultsRecord = loadDefaults(pluginRoot);
  // `config/defaults.json` isn't run through `JstackConfigSchema.parse()` here — it's
  // read as raw JSON — but `bun run validate-config` already guarantees it conforms to
  // the schema, so this is a boundary cast at the one place untyped JSON meets typed
  // code, not a re-erasure of an already-typed config.
  const defaultsCfg = defaultsRecord as unknown as JstackConfig;

  if (opts.json) {
    const warnings = cfg
      ? [
          ...collectDoctorConfigWarnings(root, cfg, defaultsCfg),
          ...collectMockMcpDoctorWarnings(root, pluginRoot, cfg),
        ]
      : [];
    const gbrainPlugin = cfg?.cross_plugins?.gbrain;
    const configOk = existsSync(join(root, JSTACK_CONFIG_FILE));
    const pluginOk = existsSync(join(pluginRoot, CONFIG_DIR, DEFAULTS_FILE));
    const skillsOk = existsSync(join(pluginRoot, SKILLS_DIR));
    const hardFail = !configOk || !pluginOk || !skillsOk || !cfg;
    const warnFail = strict && warnings.length > 0;
    const aliasErrFail = aliasDrift.errors.length > 0;
    const aliasWarnFail = strict && aliasDrift.warnings.length > 0;
    const skillsMr = cfg
      ? resolveMachineReadableSettings(
          cfg as unknown as Record<string, unknown>,
          defaultsRecord,
        )
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
            ? toLegacyUpdateFields(update)
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
    if (hardFail || warnFail || aliasErrFail || aliasWarnFail)
      process.exitCode = 1;
    return;
  }

  if (opts.applyRepairs) {
    let savedIssues;
    try {
      savedIssues = deserializeRepairs(readFileSync(opts.applyRepairs, "utf8"));
    } catch (err) {
      console.log(
        chalk.red(
          `Failed to load repairs from ${opts.applyRepairs}: ${err instanceof Error ? err.message : String(err)}`,
        ),
      );
      process.exitCode = 1;
      return;
    }
    const cfg = readConfigOptional(root);
    if (!cfg) {
      console.log(
        chalk.red(
          "Cannot apply repairs: jstack.config.json missing or unparseable. Run `jstack setup --schema` first.",
        ),
      );
      process.exitCode = 1;
      return;
    }
    // `applyRepairsInteractive` refuses in a non-TTY and returns 0, which this branch then reported as
    // "No repairs applied." at exit 0 — a clean success in exactly the CI/automation context the
    // `--apply-repairs` flag exists for. Nothing was written and nothing said so. Fail loudly instead.
    //
    // Deliberately NOT changed: this still requires a TTY. Making a write path prompt-free is a
    // separate decision from fixing the false success, even though `--help` describes the flag as
    // non-interactive. Whoever wants true CI replay should decide that explicitly.
    if (!isInteractive()) {
      console.error(
        chalk.red(
          "Cannot replay repairs: --apply-repairs still requires an interactive terminal for per-group consent.",
        ),
      );
      console.error(
        `Nothing was written. Re-run in a terminal, or inspect the proposals with: jstack doctor --fix --save-repairs ${opts.applyRepairs}`,
      );
      process.exitCode = 1;
      return;
    }

    console.log(
      chalk.bold(`\nReplaying ${savedIssues.length} saved repair proposal(s):`),
    );
    const applied = await applyRepairsInteractive(
      savedIssues,
      root,
      cfg as unknown as Record<string, unknown>,
      pluginRoot,
    );
    if (applied > 0) {
      console.log(chalk.green(`\nApplied ${applied} repair(s).`));
    } else {
      // Reached only in a TTY, where the user declined every group — a real outcome, not a silent no-op.
      console.log(chalk.dim("\nNo repairs applied (all groups declined)."));
    }
    return;
  }

  check(
    "jstack.config.json",
    existsSync(join(root, JSTACK_CONFIG_FILE)),
    "jstack setup",
  );
  check(
    "plugin defaults",
    existsSync(join(pluginRoot, CONFIG_DIR, DEFAULTS_FILE)),
  );
  check("skills/", existsSync(join(pluginRoot, SKILLS_DIR)));
  check("config parseable", !!cfg);
  check(
    ".mcp.json (optional)",
    existsSync(join(root, ".mcp.json")),
    "copy .mcp.json.example if needed",
    true,
  );

  if (update?.status === "upgrade-available") {
    const rawLine = `UPGRADE_AVAILABLE ${update.local_version} ${update.remote_version}`;
    warn(`Plugin update: ${rawLine} — see jstack upgrade or release notes.`);
  }

  if (cfg) {
    for (const msg of [
      ...collectDoctorConfigWarnings(root, cfg, defaultsCfg),
      ...collectMockMcpDoctorWarnings(root, pluginRoot, cfg),
    ]) {
      warn(msg);
    }
  }

  for (const msg of aliasDrift.errors) {
    check(
      `skill alias map: ${msg}`,
      false,
      "see docs/SKILL_ALIAS_MAP.md and config/skill-alias-map.json",
    );
  }
  for (const msg of aliasDrift.warnings) {
    warn(`skill alias drift: ${msg}`);
  }

  if (opts.fix) {
    if (!cfg) {
      console.log(
        chalk.red(
          "Cannot run --fix: jstack.config.json missing or unparseable. Run `jstack setup --schema` first.",
        ),
      );
      process.exitCode = 1;
      return;
    }
    const issues = resolveDependencies({
      cfg,
      projectRoot: root,
      pluginRoot,
    });
    if (opts.saveRepairs) {
      writeFileSync(opts.saveRepairs, serializeRepairs(issues), "utf8");
      console.log(chalk.dim(`Repair proposals written to ${opts.saveRepairs}`));
    }
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
          pluginRoot,
        );
        if (applied > 0) {
          console.log(chalk.green(`\nApplied ${applied} repair(s).`));
        } else {
          console.log(chalk.dim("\nNo repairs applied."));
        }
      } else {
        console.log(
          chalk.dim(
            "\nThis was a dry run. Re-run with --fix --apply to apply (with consent per group).",
          ),
        );
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

export async function applyRepairsInteractive(
  issues: DependencyIssue[],
  projectRoot: string,
  cfg: Record<string, unknown>,
  pluginRoot?: string,
): Promise<number> {
  // Repair paths can come from config values resolved via `absolutize()` (which does
  // no containment check by design — the resolver is read-only) or, for
  // `--apply-repairs <file>`, from an arbitrary JSON file an attacker controls. Either
  // way this is the point where paths actually get written to, so this is where
  // containment must be enforced: every mkdir/write_file target must resolve inside
  // the project root or the plugin root, never outside via `../` or an absolute path.
  const allowedRoots = [projectRoot, ...(pluginRoot ? [pluginRoot] : [])];
  const rejected: string[] = [];
  const contain = (target: string): string | null => {
    const resolved = resolveWithinRoots(target, allowedRoots);
    if (!resolved) rejected.push(target);
    return resolved;
  };

  // Group repairs by kind so we ask for consent per category. Keyed by target so a
  // batch with two repairs aimed at the same path counts (and applies) as one change,
  // not two -- otherwise the consent prompt overcounts vs. what actually gets written.
  const mkdirs = new Set<string>();
  const writes = new Map<string, { path: string; content: string }>();
  const setConfig = new Map<string, { path: string[]; value: unknown }>();
  for (const i of issues) {
    for (const r of i.repairs) {
      if (r.kind === "mkdir") {
        const abs = contain(r.path);
        if (abs) mkdirs.add(abs);
      } else if (r.kind === "write_file") {
        const abs = contain(r.path);
        if (abs) writes.set(abs, { path: abs, content: r.content });
      } else if (r.kind === "set_config")
        setConfig.set(r.path.join("."), { path: r.path, value: r.value });
      // shell_hint is informational; never executed automatically.
    }
  }

  if (rejected.length > 0) {
    console.log(
      chalk.red(
        `Refusing ${rejected.length} repair(s) whose path escapes the project (${projectRoot})` +
          (pluginRoot ? ` or plugin root (${pluginRoot}):` : ":"),
      ),
    );
    for (const r of rejected) console.log(chalk.red(`  ✗ ${r}`));
  }

  if (!isInteractive()) {
    console.log(
      chalk.yellow(
        "Non-interactive shell — refusing to apply automatic repairs. Re-run in a terminal.",
      ),
    );
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

  if (writes.size > 0) {
    const ok = await p.confirm({
      message: `Create ${writes.size} template file(s) where missing?`,
      initialValue: REPAIR_CONSENT_DEFAULT.write_file,
    });
    if (handleCancel(ok)) exitCancelled();
    if (ok) {
      for (const w of writes.values()) {
        if (existsSync(w.path)) continue;
        mkdirSync(join(w.path, ".."), { recursive: true });
        writeFileSync(w.path, w.content, "utf8");
        applied++;
      }
    }
  }

  if (setConfig.size > 0) {
    const ok = await p.confirm({
      message: `Apply ${setConfig.size} config change(s) to jstack.config.json?`,
      initialValue: REPAIR_CONSENT_DEFAULT.set_config,
    });
    if (handleCancel(ok)) exitCancelled();
    if (ok) {
      const draft: Record<string, unknown> = JSON.parse(JSON.stringify(cfg));
      try {
        for (const s of setConfig.values()) setAt(draft, s.path, s.value);
        const parsed = JstackConfigSchema.parse(draft);
        writeConfig(projectRoot, parsed);
        applied += setConfig.size;
      } catch (err) {
        console.log(
          chalk.red(
            `Config patch failed validation; skipping: ${err instanceof Error ? err.message : String(err)}`,
          ),
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
      console.log(
        JSON.stringify(
          { ok: false, error: msg, count: 0, skills: [] },
          null,
          2,
        ),
      );
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
  console.log(
    chalk.bold(`${payload.count} skills`) + chalk.dim(` under ${skillsRoot}`),
  );
  const sample = records.slice(0, 5);
  for (const s of sample) {
    console.log(chalk.dim(`  ${s.gateId}`) + `  ${s.name}`);
  }
  if (records.length > sample.length) {
    console.log(
      chalk.dim(
        `  … and ${records.length - sample.length} more (use --json for full list)`,
      ),
    );
  }
}
