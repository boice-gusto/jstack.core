import chalk from "chalk";
import {
  existsSync,
  mkdirSync,
  readFileSync,
  unlinkSync,
  writeFileSync,
} from "node:fs";
import { join } from "node:path";
import type { Command } from "commander";
import { CrewConfigSchema, type CrewConfig } from "../lib/crew/types.js";
import { CrewStore, expandHome, snapshotPath } from "../lib/crew/store.js";
import { tick } from "../lib/crew/tick.js";
import {
  ACTIONS,
  BLOCKED_FROM_UI,
  guardRequest,
  mintToken,
  validateParams,
} from "../lib/crew/ui-server.js";
import { renderUiHtml } from "../lib/crew/ui-html.js";
import { runCrewEval as runCrewEval_ } from "../lib/crew/eval.js";
import { CREW_EVAL_CASES } from "../lib/crew/eval-cases.js";
import {
  LABEL,
  binaryLooksCompiled,
  bootout,
  bootstrap,
  installPaths,
  isLoaded,
  isTccProtected,
  removePlist,
  writePlist,
} from "../lib/crew/launchd.js";
import { findProjectRoot } from "../lib/config.js";

const CONFIG_KEY = "crew";

/**
 * Mirror the crew config to a snapshot outside any TCC-protected folder.
 *
 * This is the half of the no-Full-Disk-Access design that lives on the CLI side. The daemon
 * cannot read `jstack.config.json` when the repo is under ~/Documents -- that read blocks
 * forever on a consent prompt launchd cannot display -- but the CLI always runs from a
 * terminal that does have access, so it can hand the daemon a copy it is allowed to read.
 *
 * Written from the LOAD path on purpose: every crew command then refreshes it, so the
 * snapshot cannot quietly drift behind the source. A write failure is non-fatal, because a
 * read-only command must not fail over a cache.
 */
function writeConfigSnapshot(cfg: CrewConfig): void {
  try {
    const p = snapshotPath();
    mkdirSync(join(p, ".."), { recursive: true, mode: 0o700 });
    writeFileSync(p, `${JSON.stringify(cfg, null, 2)}\n`, { mode: 0o600 });
  } catch {
    /* the daemon falls back to the project file; never break a CLI command over this */
  }
}

function loadCrewConfig(): CrewConfig {
  const root = findProjectRoot();
  const path = join(root, "jstack.config.json");
  if (!existsSync(path)) throw new Error(`no jstack.config.json at ${root}`);
  const raw = JSON.parse(readFileSync(path, "utf8")) as Record<string, unknown>;
  if (!raw[CONFIG_KEY]) {
    throw new Error(
      `no "${CONFIG_KEY}" key in jstack.config.json. Run: jstackc crew init`,
    );
  }
  const cfg = CrewConfigSchema.parse(raw[CONFIG_KEY]);
  writeConfigSnapshot(cfg);
  return cfg;
}

export function runCrewInit(
  selfUserId: string,
  dmChannel: string,
  workspace: string,
): void {
  const root = findProjectRoot();
  const path = join(root, "jstack.config.json");
  const raw = JSON.parse(readFileSync(path, "utf8")) as Record<string, unknown>;

  raw[CONFIG_KEY] = {
    enabled: false,
    mode: "dry_run",
    state_dir: "~/.jstack/crew",
    slack: { self_user_id: selfUserId, read_limit: 25 },
    budget: { daily_usd: 20, per_task_usd: 1 },
    agents: {
      ralph: {
        enabled: true,
        name: "Ralph",
        emoji: ":robot_face:",
        description:
          "Generalist desk agent. Answers questions about the workspace.",
        sigils: ["!ralph", "@agent-ralph"],
        model: "claude-sonnet-5",
        workspace,
        tools: ["Read", "Grep", "Glob"],
        max_turns: 30,
        task_timeout_ms: 600000,
        persona: "",
      },
    },
    policy: {
      ingress: {
        channels: [dmChannel],
        authors: [selfUserId],
        require_sigil: true,
        ignore_older_than_ms: 900000,
      },
      egress: {
        channels: [dmChannel],
        require_identity_prefix: true,
        max_message_chars: 3500,
        max_messages_per_task: 6,
      },
    },
  };

  CrewConfigSchema.parse(raw[CONFIG_KEY]); // fail before writing
  writeFileSync(path, `${JSON.stringify(raw, null, 2)}\n`);
  console.log(chalk.green("Wrote crew config (disabled, dry_run)."));
  console.log(`  DM channel : ${dmChannel}`);
  console.log(`  workspace  : ${workspace}`);
  console.log(
    chalk.dim(
      "\nNext: jstackc crew lint, then jstackc crew simulate '!ralph hello'",
    ),
  );
}

export function runCrewLint(json: boolean): void {
  try {
    const cfg = loadCrewConfig();
    const eff = {
      enabled: cfg.enabled,
      mode: cfg.mode,
      reads_from: cfg.policy.ingress.channels,
      answers_only: cfg.policy.ingress.authors,
      posts_to: cfg.policy.egress.channels,
      agents: Object.entries(cfg.agents).map(
        ([id, a]) =>
          `${id}${a.enabled ? "" : " (disabled)"} [${a.sigils.join(" ")}]`,
      ),
      daily_cap_usd: cfg.budget.daily_usd,
    };
    if (json) {
      console.log(JSON.stringify({ ok: true, effective: eff }, null, 2));
      return;
    }
    console.log(chalk.bold("Effective crew policy\n"));
    for (const [k, v] of Object.entries(eff)) {
      console.log(
        `  ${k.padEnd(16)} ${chalk.cyan(Array.isArray(v) ? v.join(", ") : String(v))}`,
      );
    }
    const outside = cfg.policy.egress.channels.filter(
      (c) => !cfg.policy.ingress.channels.includes(c),
    );
    if (outside.length)
      console.log(
        chalk.yellow(
          `\n  ! posts to channels it does not read: ${outside.join(", ")}`,
        ),
      );
    if (cfg.mode === "live")
      console.log(
        chalk.yellow(
          "\n  ! mode is LIVE. Posts are irreversible and appear as you.",
        ),
      );
    console.log(chalk.green("\nOK"));
  } catch (e) {
    console.error(chalk.red(`lint failed: ${(e as Error).message}`));
    process.exitCode = 1;
  }
}

export async function runCrewTick(simulate?: string): Promise<void> {
  try {
    const cfg = loadCrewConfig();
    const s = await tick({ config: cfg, simulate, log: (l) => console.log(l) });
    const bits = [
      `read ${s.read}`,
      `handled ${s.handled}`,
      `dropped ${s.dropped.length}`,
      `$${s.costUsd.toFixed(4)}`,
    ];
    if (s.backlogSkipped) bits.push(chalk.yellow("backlog skipped"));
    console.log(chalk.dim(`\n${bits.join(" · ")}`));
    if (s.halted) {
      console.error(chalk.red(`HALTED: ${s.halted}`));
      process.exitCode = 1;
    }
  } catch (e) {
    console.error(chalk.red(`tick failed: ${(e as Error).message}`));
    process.exitCode = 1;
  }
}

/**
 * The missing piece: something that actually polls. A foreground loop you run in a
 * terminal, deliberately simpler than a LaunchAgent -- no plist, no TCC, no keychain
 * domain, and you can see it working. Ctrl-C stops it.
 */
export async function runCrewWatch(intervalS: number): Promise<void> {
  const cfg = loadCrewConfig();
  console.log(
    chalk.bold(
      `Watching ${cfg.policy.ingress.channels[0]} every ${intervalS}s`,
    ),
  );
  const enabled = Object.entries(cfg.agents).filter(([, a]) => a.enabled);
  console.log(
    `  mode ${cfg.mode === "live" ? chalk.yellow("LIVE") : chalk.green("dry_run")} · agents ${enabled.map(([id]) => id).join(", ") || chalk.yellow("none enabled")}`,
  );
  console.log(chalk.dim("  Ctrl-C to stop\n"));

  let stop = false;
  process.on("SIGINT", () => {
    stop = true;
    console.log(chalk.dim("\nstopping after this tick…"));
  });

  let spent = 0;
  while (!stop) {
    const t0 = Date.now();
    try {
      const s = await tick({
        config: loadCrewConfig(),
        log: (l) => console.log(l),
      });
      spent += s.costUsd;
      const stamp = new Date().toLocaleTimeString();
      if (s.read || s.handled) {
        const extra = s.backlogSkipped
          ? chalk.yellow(" · backlog skipped")
          : "";
        console.log(
          chalk.dim(
            `  ${stamp}  read ${s.read} · handled ${s.handled} · $${spent.toFixed(3)} total`,
          ) + extra,
        );
      } else {
        process.stdout.write(
          chalk.dim(`  ${stamp}  idle ($${spent.toFixed(3)})\r`),
        );
      }
      if (s.halted) {
        console.error(chalk.red(`\nHALTED: ${s.halted}. Stopping.`));
        return;
      }
    } catch (e) {
      console.error(chalk.red(`  tick error: ${(e as Error).message}`));
    }
    const wait = Math.max(0, intervalS * 1000 - (Date.now() - t0));
    await new Promise((r) => setTimeout(r, wait));
  }
}

export function runCrewStatus(json: boolean): void {
  try {
    const cfg = loadCrewConfig();
    const dir = expandHome(cfg.state_dir);
    const halted = existsSync(join(dir, "HALTED"));
    const store = new CrewStore(cfg.state_dir);
    const st = store.stats();
    const wm = store.getWatermark(cfg.policy.ingress.channels[0]!);
    const recentTasks = store.recentTasks();
    const recentEvents = store.recentEvents();
    const lastTick = store.lastTickAt();
    store.close();

    const p = installPaths(cfg.state_dir);
    const out = {
      enabled: cfg.enabled,
      mode: cfg.mode,
      halted,
      watermark: wm,
      ...st,
      // Extras the orchestration UI renders. Cheap local reads, no network.
      recent_tasks: recentTasks,
      recent_events: recentEvents,
      last_tick_at: lastTick,
      scheduler: {
        label: LABEL,
        loaded: isLoaded(),
        interval_s: schedInterval(p.plist),
      },
    };
    if (json) {
      console.log(JSON.stringify(out, null, 2));
      return;
    }
    console.log(chalk.bold("crew status\n"));
    console.log(
      `  enabled     ${cfg.enabled ? chalk.green("yes") : chalk.yellow("no")}`,
    );
    console.log(
      `  mode        ${cfg.mode === "live" ? chalk.yellow("live") : chalk.green("dry_run")}`,
    );
    console.log(`  halted      ${halted ? chalk.red("YES") : "no"}`);
    console.log(`  watermark   ${wm ?? chalk.dim("(none, cold start)")}`);
    console.log(`  tasks       ${st.tasks}`);
    console.log(`  outbox      ${st.outbox}`);
    console.log(
      `  spent today $${st.spentToday.toFixed(4)} / ${cfg.budget.daily_usd}`,
    );
    if (halted)
      console.error(chalk.red("\nHALTED. Clear with: jstackc crew resume"));
  } catch (e) {
    console.error(chalk.red(`status failed: ${(e as Error).message}`));
    process.exitCode = 1;
  }
}

/** StartInterval out of the installed plist, so the UI shows the real cadence. */
function schedInterval(plistPath: string): number | null {
  try {
    const m = readFileSync(plistPath, "utf8").match(
      /<key>StartInterval<\/key>\s*<integer>(\d+)<\/integer>/,
    );
    return m ? Number(m[1]) : null;
  } catch {
    return null;
  }
}

/* ---------------------------------------------------------------- launchd ---- */

export async function runCrewInstall(
  intervalS: number,
  skipBuild: boolean,
): Promise<void> {
  const cfg = loadCrewConfig();
  const root = findProjectRoot();
  const p = installPaths(cfg.state_dir);

  /**
   * Stop the job BEFORE the binary is replaced, and this ordering is load-bearing.
   *
   * A Bun single-file executable reads its bundled payload from its own file at runtime.
   * Overwriting that file under a live tick wedged the process: it finished its work, then
   * hung instead of exiting, with its text mapping pointing at an unrelated file. launchd
   * will not start a second instance of a label, so the daemon stayed dead until killed by
   * hand. Boot out first and the replacement is always cold.
   */
  const wasLoaded = isLoaded();
  if (wasLoaded && !skipBuild) {
    console.log(chalk.dim(`Stopping ${LABEL} before replacing the binary…`));
    bootout();
  }

  if (!skipBuild) {
    console.log(chalk.dim("Compiling crewd…"));
    const b = Bun.spawnSync(
      [
        "bun",
        "build",
        "--compile",
        join(root, "cli/src/crewd.ts"),
        "--outfile",
        p.binary,
      ],
      {
        cwd: root,
      },
    );
    if (b.exitCode !== 0) {
      console.error(
        chalk.red(
          `build failed:\n${new TextDecoder().decode(b.stderr).slice(0, 600)}`,
        ),
      );
      process.exitCode = 1;
      return;
    }
  }
  if (!binaryLooksCompiled(p.binary)) {
    console.error(
      chalk.red(
        `${p.binary} is not a compiled executable. Run without --skip-build.`,
      ),
    );
    process.exitCode = 1;
    return;
  }

  writePlist(p, root, intervalS);
  const r = bootstrap(p);
  if (!r.ok) {
    console.error(chalk.red(`launchctl bootstrap failed: ${r.detail}`));
    process.exitCode = 1;
    return;
  }

  console.log(chalk.green(`Installed ${LABEL}, every ${intervalS}s.`));
  console.log(`  binary  ${p.binary}`);
  console.log(`  logs    ${p.stdout}`);

  /**
   * TCC, stated from measurement rather than folklore.
   *
   * A LaunchAgent running a SHELL SCRIPT is denied ~/Documents, because the responsible
   * executable is /bin/bash and bash holds no grant. A compiled binary gets its own
   * identity and was measured reading ~/Documents and both workspaces fine, with real file
   * reads, with no grant added. So compiling is not just a PATH convenience: it is what
   * makes the TCC-protected case work at all.
   *
   * That is an observation about one machine, not a guarantee, so it is verified rather
   * than assumed: crewd records what it could actually read on each launchd run, and doctor
   * reports that. Do not send anyone to System Settings on a guess.
   */
  const inProtected = Object.values(cfg.agents).filter((a) =>
    isTccProtected(a.workspace),
  );
  if (inProtected.length) {
    console.log(
      chalk.dim(
        "\n  Workspaces are under a TCC-protected folder (~/Documents).",
      ),
    );
    console.log(
      chalk.dim(
        "  No Full Disk Access grant is needed: the daemon reads its config from",
      ),
    );
    console.log(chalk.dim(`  ${snapshotPath()} and delegates all`));
    console.log(
      chalk.dim(
        "  repository reading to its worker child, which has its own access.",
      ),
    );
    console.log(
      `  Verify after the first tick:  ${chalk.cyan("jstackc crew doctor")}`,
    );
    /**
     * If a grant was ever added by hand, it is now dead weight and should be removed.
     *
     * Worth saying explicitly, because a stale grant is confusing rather than harmless: Full
     * Disk Access is keyed to the binary's code identity, so a rebuild silently invalidates it
     * anyway, and an entry that no longer matches anything looks like protection that exists.
     * The daemon needs no grant at all now -- it reads a snapshot outside the protected folder
     * and delegates repository reads to its worker child.
     */
    console.log(
      chalk.dim(
        "\n  If you previously added crewd to Full Disk Access, you can remove it;",
      ),
    );
    console.log(
      chalk.dim(
        "  it is no longer used, and a rebuild invalidates it regardless.",
      ),
    );
  }
}

export function runCrewUninstall(): void {
  const cfg = loadCrewConfig();
  const p = installPaths(cfg.state_dir);
  const r = bootout();
  removePlist(p);
  console.log(
    chalk.green(
      `Uninstalled ${LABEL}.${r.ok ? "" : ` (bootout: ${r.detail})`}`,
    ),
  );
  console.log(chalk.dim(`  The binary and ledger are kept: ${p.binary}`));
  console.log(
    chalk.dim(
      "  Remember to remove it from Full Disk Access if you granted it.",
    ),
  );
}

/* ----------------------------------------------------------------- session ---- */

/**
 * Resolve the handle printed in a Slack reply to the Claude session behind it.
 *
 * Named `session` rather than `resume` because `crew resume` already means "clear the HALTED
 * sentinel", and overloading a word that currently un-halts a stopped system would be a
 * genuinely dangerous ambiguity.
 *
 * Prints the command rather than running it: `claude --resume` is interactive and wants your
 * terminal, and the agent's session store is keyed to the workspace, so the cwd matters.
 */
export function runCrewSession(taskIdArg: string, json: boolean): void {
  const cfg = loadCrewConfig();
  const store = new CrewStore(cfg.state_dir);
  const t = store.findTaskById(taskIdArg.replace(/^#/, "").toLowerCase());
  store.close();

  if (!t) {
    if (json)
      console.log(
        JSON.stringify({ ok: false, error: "no such task" }, null, 2),
      );
    else
      console.error(
        chalk.red(`no task ${taskIdArg}. See: jstackc crew status`),
      );
    process.exitCode = 1;
    return;
  }

  const agent = cfg.agents[t.agentId];
  const workspace = agent ? expandHome(agent.workspace) : null;

  if (json) {
    console.log(JSON.stringify({ ok: true, ...t, workspace }, null, 2));
    return;
  }

  console.log(chalk.bold(`\nSession behind ${t.id}\n`));
  console.log(`  agent      ${t.agentId || chalk.dim("(unknown)")}`);
  console.log(
    `  session    ${t.sessionId || chalk.yellow("(none recorded — not resumable)")}`,
  );
  console.log(`  thread     ${t.threadTs || chalk.dim("(none)")}`);
  if (workspace) console.log(`  workspace  ${workspace}`);
  if (t.sessionId) {
    console.log(chalk.dim("\n  Continue it in your terminal:"));
    console.log(
      `    cd ${workspace ?? "<workspace>"} && claude --resume ${t.sessionId}`,
    );
    console.log(chalk.dim("\n  Or from Slack, to have the agent continue it:"));
    console.log(
      `    ${agent?.sigils[0] ?? "!agent"} #${t.id} <your next question>`,
    );
  }
}

/* -------------------------------------------------------------------- eval ---- */

/**
 * Grade the agent's real answers on hard tasks.
 *
 * Safe to run against a LIVE config, which is the point: every case goes through
 * `tick({ simulate })`, which forces dry_run whatever `mode` says and persists nothing. The
 * artefacts are written to `.tmp/crew-evals/` so a failure can be read rather than guessed at.
 */
export async function runCrewEval(o: {
  json: boolean;
  only?: string;
  deterministic: boolean;
  judgeModel?: string;
}): Promise<void> {
  const cfg = loadCrewConfig();
  const only = o.only
    ?.split(",")
    .map((s) => s.trim())
    .filter(Boolean);
  const cases = only?.length
    ? CREW_EVAL_CASES.filter((c) => only.includes(c.id))
    : CREW_EVAL_CASES;

  if (!cases.length) {
    console.error(
      chalk.red(
        `no cases matched. Available: ${CREW_EVAL_CASES.map((c) => c.id).join(", ")}`,
      ),
    );
    process.exitCode = 1;
    return;
  }

  let report;
  try {
    report = await runCrewEval_({
      config: cfg,
      cases,
      deterministicOnly: o.deterministic,
      ...(o.judgeModel ? { judgeModel: o.judgeModel } : {}),
      log: (l) => {
        if (!o.json) console.log(chalk.dim(l));
      },
    });
  } catch (e) {
    // A blocker (contended lock, HALTED, auth) is not a grade. Fail loudly instead of
    // publishing a report that blames the agent for it.
    console.error(chalk.red(`\neval aborted: ${(e as Error).message}`));
    process.exitCode = 1;
    return;
  }

  const outDir = join(findProjectRoot(), ".tmp", "crew-evals");
  mkdirSync(outDir, { recursive: true });
  const stampName = new Date().toISOString().replace(/[:.]/g, "-");
  writeFileSync(
    join(outDir, `report-${stampName}.json`),
    `${JSON.stringify(report, null, 2)}\n`,
  );

  if (o.json) {
    console.log(JSON.stringify(report, null, 2));
    if (!report.ok) process.exitCode = 1;
    return;
  }

  console.log(chalk.bold("\nCrew eval\n"));
  for (const c of report.cases) {
    const head = c.passed ? chalk.green("PASS") : chalk.red("FAIL");
    console.log(
      `${head}  ${chalk.bold(c.id)}  ${chalk.dim(`$${c.costUsd.toFixed(3)} · ${Math.round(c.ms / 1000)}s`)}`,
    );
    console.log(
      chalk.dim(`      ${c.rationale.replace(/\s+/g, " ").slice(0, 150)}`),
    );
    for (const ck of c.checks) {
      // Passing deterministic checks are the boring majority; show them anyway, because
      // "citations all resolved" is the single most load-bearing line in this report.
      const mark = ck.passed ? chalk.green("✓") : chalk.red("✗");
      const tag =
        ck.kind === "deterministic"
          ? chalk.cyan("[det]")
          : chalk.magenta("[jdg]");
      const label = ck.name.length > 78 ? `${ck.name.slice(0, 78)}…` : ck.name;
      console.log(`      ${mark} ${tag} ${label}`);
      if (!ck.passed)
        console.log(
          chalk.red(
            `            ${ck.detail.replace(/\s+/g, " ").slice(0, 180)}`,
          ),
        );
    }
    console.log();
  }

  const detTotal = report.cases
    .flatMap((c) => c.checks)
    .filter((c) => c.kind === "deterministic");
  const detPass = detTotal.filter((c) => c.passed).length;
  const jdgTotal = report.cases
    .flatMap((c) => c.checks)
    .filter((c) => c.kind === "rubric");
  const jdgPass = jdgTotal.filter((c) => c.passed).length;

  console.log(chalk.bold(`${report.passed}/${report.total} cases passed`));
  console.log(`  deterministic checks  ${detPass}/${detTotal.length}`);
  if (jdgTotal.length)
    console.log(`  judged criteria       ${jdgPass}/${jdgTotal.length}`);

  /**
   * Report harness faults separately. A judge that returned no verdict is not evidence about
   * the agent, and reporting the two identically is how a red run gets misread -- it happened
   * on the first run here, where a good answer showed FAIL for reasons that were entirely the
   * judge's.
   */
  const harnessFaults = jdgTotal.filter(
    (c) => !c.passed && c.detail.includes("judge_incomplete"),
  );
  if (harnessFaults.length) {
    console.log(
      chalk.yellow(
        `  ! ${harnessFaults.length} criteria could not be judged (harness fault, not agent failure)`,
      ),
    );
  }
  console.log(
    chalk.dim(
      `  agent $${report.costUsd.toFixed(3)} · judge $${report.judgeCostUsd.toFixed(3)} · ${Math.round(report.ms / 1000)}s`,
    ),
  );
  console.log(
    chalk.dim(`  artefacts  ${join(outDir, `report-${stampName}.json`)}`),
  );
  console.log(
    chalk.dim(
      "  no Slack calls were made: every case ran through simulate (dry_run, no persistence)",
    ),
  );
  if (!report.ok) process.exitCode = 1;
}

/* ------------------------------------------------------------------ doctor ---- */

export async function runCrewDoctor(json: boolean): Promise<void> {
  type Check = { name: string; ok: boolean; detail: string; fix?: string };
  const checks: Check[] = [];
  const add = (name: string, ok: boolean, detail: string, fix?: string) =>
    checks.push({ name, ok, detail, fix });

  /**
   * Sample the snapshot BEFORE anything loads the config, because loading REFRESHES it.
   *
   * Found by negative-testing this check: a deliberately corrupted snapshot still reported
   * "matches source", since `loadCrewConfig()` had already rewritten it by the time the
   * comparison ran. A check that cannot fail is worse than no check. Reading it first keeps
   * the refresh (which is genuinely self-healing) while still being able to report that the
   * daemon HAD been running a stale policy.
   */
  const snapBefore: string | null = (() => {
    try {
      return existsSync(snapshotPath())
        ? readFileSync(snapshotPath(), "utf8")
        : null;
    } catch {
      return null;
    }
  })();

  let cfg;
  try {
    cfg = loadCrewConfig();
    add("config loads", true, "crew section parses against the strict schema");
  } catch (e) {
    add(
      "config loads",
      false,
      (e as Error).message,
      "jstackc crew init --user <U…> --dm <D…> --workspace <path>",
    );
    report();
    return;
  }

  add(
    "enabled",
    cfg.enabled,
    cfg.enabled ? "crew.enabled is true" : "crew.enabled is false",
    "set crew.enabled to true",
  );

  const on = Object.entries(cfg.agents).filter(([, a]) => a.enabled);
  add(
    "an agent is enabled",
    on.length > 0,
    on.length
      ? `${on.map(([id]) => id).join(", ")}`
      : "every agent is disabled, so nothing can be routed",
    "jstackc crew agents enable <id>",
  );

  // Duplicate sigils would make routing depend on object key order.
  const seen = new Map<string, string>();
  const dupes: string[] = [];
  for (const [id, a] of Object.entries(cfg.agents)) {
    for (const sg of a.sigils) {
      const k = sg.toLowerCase();
      if (seen.has(k)) dupes.push(`${sg} (${seen.get(k)} and ${id})`);
      else seen.set(k, id);
    }
  }
  add(
    "sigils are unique",
    dupes.length === 0,
    dupes.length ? dupes.join("; ") : "no collisions",
  );

  /**
   * This setting is a loop-guard dependency, not cosmetics, so it is checked rather than
   * assumed. G2a recognises our own output by its `<emoji> **<Name>**` opening line, and
   * that is the ONLY content guard that stays active inside a thread we own (G2b is off
   * there because it also fires on the operator's own Claude-in-Slack replies). Turn the
   * prefix off and the in-thread loop guard has nothing left to match on.
   */
  const prefixOn = cfg.policy.egress.require_identity_prefix;
  add(
    "identity prefix required",
    prefixOn,
    prefixOn
      ? "outbound messages open with the agent's prefix, which is what G2a matches"
      : "egress.require_identity_prefix is false, so G2a cannot recognise our own output inside a thread",
    "set crew.policy.egress.require_identity_prefix to true",
  );

  /**
   * The snapshot the daemon actually obeys must match the config you actually edited.
   *
   * This check exists because the snapshot design creates the risk: the daemon cannot read
   * `jstack.config.json` under ~/Documents, so it reads a copy in ~/.jstack. Every crew command
   * refreshes that copy, but a hand-edit of the config followed by no crew command would leave
   * the daemon enforcing yesterday's policy -- silently, and in the direction that matters
   * (channels, authors, enabled agents). Doctor runs from a terminal that can read both, so it
   * is the right place to compare them.
   */
  if (snapBefore === null) {
    add(
      "config snapshot",
      false,
      `the daemon had no snapshot at ${snapshotPath()}; one has just been written`,
      "re-run doctor to confirm",
    );
  } else {
    let matched = false;
    let why = "";
    try {
      matched = JSON.stringify(JSON.parse(snapBefore)) === JSON.stringify(cfg);
      why = matched
        ? "the daemon was already running the config you edited"
        : "the daemon WAS running a stale policy; this command has just refreshed it, " +
          "so ticks before now used the old channels/authors/agents";
    } catch (e) {
      why = `the snapshot was unreadable (${(e as Error).message}); it has just been rewritten`;
    }
    add(
      "config snapshot matches source",
      matched,
      why,
      "any crew command refreshes it; re-run doctor to confirm",
    );
  }

  const egressOutside = cfg.policy.egress.channels.filter(
    (c) => !cfg.policy.ingress.channels.includes(c),
  );
  add(
    "egress ⊆ ingress",
    egressOutside.length === 0,
    egressOutside.length
      ? `posts to channels it does not read: ${egressOutside.join(", ")}`
      : "posts only where it reads",
  );

  const dir = expandHome(cfg.state_dir);
  add("state dir writable", existsSync(dir), dir, "jstackc crew tick");
  add(
    "not halted",
    !existsSync(join(dir, "HALTED")),
    existsSync(join(dir, "HALTED"))
      ? readFileSync(join(dir, "HALTED"), "utf8").trim()
      : "no HALTED sentinel",
    "jstackc crew resume",
  );

  // Workspace reachability, from THIS process. The launchd answer can differ (TCC).
  for (const [id, a] of Object.entries(cfg.agents)) {
    const w = expandHome(a.workspace);
    add(
      `workspace: ${id}`,
      existsSync(w),
      w,
      "jstackc crew agents edit " + id + " --workspace <path>",
    );
  }

  // auth: free, no model call.
  const auth = Bun.spawnSync(["claude", "auth", "status"]);
  const authOk = auth.exitCode === 0;
  add(
    "claude auth",
    authOk,
    authOk
      ? "authenticated"
      : new TextDecoder().decode(auth.stderr).slice(0, 120) || "not logged in",
    "claude /login",
  );

  // launchd + the TCC question, which is the one that silently kills everything.
  const p = installPaths(cfg.state_dir);
  const loaded = isLoaded();
  add(
    "LaunchAgent loaded",
    loaded,
    loaded ? LABEL : "not loaded (foreground `crew watch` only)",
    "jstackc crew install",
  );
  add(
    "crewd compiled",
    binaryLooksCompiled(p.binary),
    p.binary,
    "jstackc crew install",
  );

  /**
   * The Full Disk Access answer can only come from the daemon's own run, because TCC grants
   * follow the responsible process: probing from this terminal inherits Terminal's grants
   * and would report success while the LaunchAgent is denied. So read what crewd recorded.
   */
  const tccBlocked = Object.entries(cfg.agents).filter(([, a]) =>
    isTccProtected(a.workspace),
  );
  if (tccBlocked.length) {
    const healthPath = join(dir, "health.json");
    if (!existsSync(healthPath)) {
      add(
        "Full Disk Access (from launchd)",
        false,
        "crewd has not reported yet; no health.json",
        loaded
          ? "wait one interval, then re-run doctor"
          : "jstackc crew install",
      );
    } else {
      const h = JSON.parse(readFileSync(healthPath, "utf8")) as {
        at: string;
        launchd: boolean;
        workspaces_readable: Record<string, boolean | "delegated">;
      };
      const entries = Object.entries(h.workspaces_readable ?? {});
      const denied = entries.filter(([, v]) => v === false).map(([k]) => k);
      const delegated = entries
        .filter(([, v]) => v === "delegated")
        .map(([k]) => k);
      const ageMin = Math.round((Date.now() - Date.parse(h.at)) / 60000);
      if (!h.launchd) {
        add(
          "workspace access (from launchd)",
          false,
          `last crewd run was NOT under launchd (${ageMin}m ago), so this cannot answer the access question`,
          "wait for a scheduled tick, then re-run doctor",
        );
      } else {
        /**
         * Say "delegated", never "read every workspace".
         *
         * The daemon deliberately does not touch a TCC-protected workspace -- that call would
         * hang -- so claiming it read one would be false. `"delegated"` is a truthy value, so
         * an older version of this check reported a confident green for work that never
         * happened, which is the same flattering-pass this file has had to remove elsewhere.
         * The worker's own success is the real evidence and it lands in the task ledger.
         */
        const detail = [
          denied.length ? `crewd could not read: ${denied.join(", ")}` : null,
          delegated.length
            ? `${delegated.join(", ")} delegated to the worker child (parent never touches it)`
            : null,
          entries.length && !denied.length && !delegated.length
            ? "crewd read every workspace"
            : null,
        ]
          .filter(Boolean)
          .join("; ");
        add(
          "workspace access (from launchd)",
          denied.length === 0,
          `${detail} (as of ${ageMin}m ago, under launchd)`,
          "check the recent tasks in `crew status` -- a worker failure is the real signal here",
        );
      }

      /**
       * Freshness is a SEPARATE check, because a stale pass is the failure it hides.
       *
       * The grant does not survive a rebuild, and a missing grant does not error -- it
       * blocks on a consent prompt launchd cannot show. So the daemon sits at
       * `state = running` forever while health.json keeps reporting the last successful
       * run. Measured: that reads as "Full Disk Access: OK" for as long as you leave it.
       * Judge liveness by whether the report is MOVING, not by what it says.
       */
      // The schedule lives in the plist, not the config, so read the real interval rather
      // than assuming one -- a generous default would make this check never fire.
      const intervalM = Math.max(
        1,
        Math.round((schedInterval(p.plist) ?? 120) / 60),
      );
      const stale = loaded && ageMin > intervalM * 3 + 2;
      add(
        "crewd is still ticking",
        !stale,
        stale
          ? `health.json has not moved in ${ageMin}m while the job is loaded -- crewd is wedged, ` +
              "which is what a rebuilt binary with no Full Disk Access grant looks like"
          : `last report ${ageMin}m ago`,
        `re-grant Full Disk Access to ${p.binary}, then: launchctl kickstart -k gui/$(id -u)/${LABEL}`,
      );
    }
  }

  report();

  function report(): void {
    if (json) {
      console.log(
        JSON.stringify({ ok: checks.every((c) => c.ok), checks }, null, 2),
      );
      return;
    }
    console.log(chalk.bold("crew doctor\n"));
    for (const c of checks) {
      const mark = c.ok ? chalk.green("✓") : chalk.red("✗");
      console.log(
        `  ${mark} ${c.name.padEnd(26)} ${c.ok ? chalk.dim(c.detail) : c.detail}`,
      );
      if (!c.ok && c.fix) console.log(`    ${chalk.cyan(c.fix)}`);
    }
    const bad = checks.filter((c) => !c.ok).length;
    console.log(
      bad
        ? chalk.red(`\n${bad} check(s) failed`)
        : chalk.green("\nAll checks passed"),
    );
    if (bad) process.exitCode = 1;
  }
}

/* ---------------------------------------------------------------------- ui ---- */

export async function runCrewUi(port: number, open: boolean): Promise<void> {
  loadCrewConfig(); // fail fast if the config will not load
  const root = findProjectRoot();
  const token = mintToken();

  /**
   * Actions are dispatched by running the CLI as a child with a fixed argv array. No shell,
   * so nothing in a request can become a command; and the allowlist in ui-server.ts is the
   * only way in.
   */
  const exec = async (
    name: string,
    params: Record<string, string>,
  ): Promise<{ code: number; stdout: string; stderr: string }> => {
    const action = ACTIONS[name]!;
    const argv = [
      "bun",
      "run",
      join(root, "cli/src/index.ts"),
      "crew",
      ...action.argv(params),
    ];
    const proc = Bun.spawn(argv, {
      cwd: root,
      stdin: "ignore",
      stdout: "pipe",
      stderr: "pipe",
    });
    const [o, e] = await Promise.all([
      new Response(proc.stdout).text(),
      new Response(proc.stderr).text(),
    ]);
    await proc.exited;
    return { code: proc.exitCode ?? 1, stdout: o, stderr: e };
  };

  const server = Bun.serve({
    hostname: "127.0.0.1", // never 0.0.0.0: that would expose the control plane to the network
    port,
    idleTimeout: 30,
    async fetch(req) {
      const url = new URL(req.url);

      if (url.pathname === "/" || url.pathname === "/index.html") {
        const g = guardRequest(req, { token, port, mutating: false });
        if (!g.ok)
          return new Response(g.reason ?? "forbidden", {
            status: g.status ?? 403,
          });
        return new Response(renderUiHtml(token, port), {
          headers: {
            "content-type": "text/html; charset=utf-8",
            "cache-control": "no-store",
            "x-content-type-options": "nosniff",
            // The page must never be framed by another origin.
            "x-frame-options": "DENY",
            "referrer-policy": "no-referrer",
          },
        });
      }

      const m = url.pathname.match(/^\/api\/([A-Za-z]+)$/);
      if (!m) return new Response("not found", { status: 404 });
      const name = m[1]!;
      const action = ACTIONS[name];
      if (!action)
        return new Response(`unknown action: ${name}`, { status: 404 });

      const g = guardRequest(req, { token, port, mutating: action.mutating });
      if (!g.ok) {
        console.error(`  refused ${name}: ${g.reason}`);
        return new Response(g.reason ?? "forbidden", {
          status: g.status ?? 403,
        });
      }

      let raw: Record<string, unknown> = {};
      if (action.mutating) {
        try {
          raw = (await req.json()) as Record<string, unknown>;
        } catch {
          raw = {};
        }
      } else {
        raw = Object.fromEntries(url.searchParams.entries());
      }

      const v = validateParams(action, raw);
      if (!v.ok) return new Response(v.reason, { status: 400 });

      const r = await exec(name, v.params);
      console.log(
        `  ${action.mutating ? "POST" : "GET "} ${name} → exit ${r.code}`,
      );
      return Response.json(
        { ok: r.code === 0, stdout: r.stdout, stderr: r.stderr },
        { status: 200 },
      );
    },
  });

  const uiUrl = `http://127.0.0.1:${server.port}/?t=${token}`;
  console.log(chalk.bold("\ncrew orchestration UI\n"));
  console.log(`  ${chalk.cyan(uiUrl)}\n`);
  console.log(
    chalk.dim(
      "  Bound to 127.0.0.1 only. Token is per-run and never written to disk.",
    ),
  );
  console.log(
    chalk.dim(
      "  Blocked from the UI: " +
        BLOCKED_FROM_UI.join(", ") +
        " (terminal-only, by design).",
    ),
  );
  console.log(
    chalk.dim("  Ctrl-C to stop the server and invalidate the token.\n"),
  );

  if (open) Bun.spawn(["open", uiUrl], { stdout: "ignore", stderr: "ignore" });

  await new Promise<void>((resolve) => {
    process.on("SIGINT", () => {
      console.log(chalk.dim("\n  stopped; token invalidated"));
      server.stop(true);
      resolve();
    });
  });
}

/* ------------------------------------------------------------------ agents ---- */

function mutateAgents(
  fn: (agents: Record<string, Record<string, unknown>>) => void,
): void {
  const root = findProjectRoot();
  const path = join(root, "jstack.config.json");
  const raw = JSON.parse(readFileSync(path, "utf8")) as Record<string, unknown>;
  const crew = raw[CONFIG_KEY] as Record<string, unknown> | undefined;
  if (!crew) throw new Error(`no "${CONFIG_KEY}" key. Run: jstackc crew init`);
  const agents = (crew.agents ?? {}) as Record<string, Record<string, unknown>>;
  fn(agents);
  crew.agents = agents;
  CrewConfigSchema.parse(crew); // never write a config that would not load
  writeFileSync(path, `${JSON.stringify(raw, null, 2)}\n`);
}

export function runAgentsList(json: boolean): void {
  const cfg = loadCrewConfig();
  const rows = Object.entries(cfg.agents).map(([id, a]) => ({
    id,
    enabled: a.enabled,
    name: a.name,
    sigils: a.sigils,
    model: a.model,
    tools: a.tools,
    workspace: a.workspace,
    description: a.description,
  }));
  if (json) {
    console.log(JSON.stringify(rows, null, 2));
    return;
  }
  console.log(chalk.bold(`Agents (${rows.length})\n`));
  for (const r of rows) {
    const dot = r.enabled ? chalk.green("●") : chalk.dim("○");
    console.log(
      `  ${dot} ${chalk.bold(r.id.padEnd(12))} ${r.sigils.join(" ")}`,
    );
    console.log(
      `     ${chalk.dim(`${r.model} · ${r.tools.join(", ")} · ${r.workspace}`)}`,
    );
    if (r.description) console.log(`     ${chalk.dim(r.description)}`);
  }
  const off = rows.filter((r) => !r.enabled).length;
  if (off)
    console.log(chalk.dim(`\n  ${off} disabled (defined but out of routing)`));
}

export function runAgentsShow(id: string, json: boolean): void {
  const cfg = loadCrewConfig();
  const a = cfg.agents[id];
  if (!a) {
    console.error(
      chalk.red(
        `no such agent: ${id}. Known: ${Object.keys(cfg.agents).join(", ")}`,
      ),
    );
    process.exitCode = 1;
    return;
  }
  if (json) {
    console.log(JSON.stringify(a, null, 2));
    return;
  }
  console.log(chalk.bold(`${id}\n`));
  for (const [k, v] of Object.entries(a)) {
    console.log(
      `  ${k.padEnd(16)} ${chalk.cyan(Array.isArray(v) ? v.join(", ") : String(v) || chalk.dim("(empty)"))}`,
    );
  }
}

export function runAgentsAdd(o: {
  id: string;
  name?: string;
  sigil?: string[];
  workspace: string;
  model?: string;
  tools?: string[];
  description?: string;
  persona?: string;
}): void {
  const id = o.id.trim();
  if (!/^[a-z][a-z0-9-]{1,23}$/.test(id)) {
    console.error(
      chalk.red("id must be kebab-case, 2-24 chars, starting with a letter"),
    );
    process.exitCode = 1;
    return;
  }
  const name = o.name ?? id.charAt(0).toUpperCase() + id.slice(1);
  const sigils = o.sigil?.length ? o.sigil : [`!${id}`, `@agent-${id}`];

  try {
    mutateAgents((agents) => {
      if (agents[id])
        throw new Error(
          `agent "${id}" already exists. Use: jstackc crew agents edit ${id}`,
        );
      // A shared sigil would make routing depend on object key order, which is not a
      // contract anyone should rely on. Refuse rather than pick a winner.
      const taken = new Map<string, string>();
      for (const [other, a] of Object.entries(agents)) {
        for (const sg of (a.sigils as string[] | undefined) ?? [])
          taken.set(sg.toLowerCase(), other);
      }
      for (const sg of sigils) {
        const owner = taken.get(sg.toLowerCase());
        if (owner)
          throw new Error(`sigil "${sg}" already belongs to "${owner}"`);
      }
      agents[id] = {
        // New agents start DISABLED: adding one should never silently change what
        // answers your messages.
        enabled: false,
        name,
        emoji: ":robot_face:",
        description: o.description ?? "",
        sigils,
        model: o.model ?? "claude-sonnet-5",
        workspace: o.workspace,
        tools: o.tools?.length ? o.tools : ["Read", "Grep", "Glob"],
        max_turns: 30,
        task_timeout_ms: 600000,
        persona: o.persona ?? "",
      };
    });
  } catch (e) {
    console.error(chalk.red((e as Error).message));
    process.exitCode = 1;
    return;
  }
  console.log(chalk.green(`Added "${id}" (disabled).`));
  console.log(`  sigils ${sigils.join(", ")}`);
  console.log(chalk.dim(`\n  Enable with: jstackc crew agents enable ${id}`));
}

export function runAgentsEdit(
  id: string,
  patch: Record<string, unknown>,
): void {
  const keys = Object.keys(patch).filter((k) => patch[k] !== undefined);
  if (!keys.length) {
    console.error(
      chalk.red(
        "nothing to change. Pass at least one of --name --model --workspace --sigil --tool --description --persona",
      ),
    );
    process.exitCode = 1;
    return;
  }
  try {
    mutateAgents((agents) => {
      const a = agents[id];
      if (!a) throw new Error(`no such agent: ${id}`);
      for (const k of keys) a[k] = patch[k];
    });
  } catch (e) {
    console.error(chalk.red((e as Error).message));
    process.exitCode = 1;
    return;
  }
  console.log(chalk.green(`Updated "${id}": ${keys.join(", ")}`));
}

export function runAgentsToggle(id: string, enabled: boolean): void {
  try {
    mutateAgents((agents) => {
      const a = agents[id];
      if (!a) throw new Error(`no such agent: ${id}`);
      a.enabled = enabled;
      if (enabled) {
        const cfgNow = loadCrewConfigRaw();
        if (cfgNow?.mode === "live") {
          console.log(
            chalk.yellow(
              `  note: mode is live, so "${id}" starts answering on the next tick.`,
            ),
          );
        }
      }
    });
  } catch (e) {
    console.error(chalk.red((e as Error).message));
    process.exitCode = 1;
    return;
  }
  console.log(
    enabled
      ? chalk.green(`Enabled "${id}".`)
      : chalk.yellow(`Disabled "${id}" (definition kept).`),
  );
}

export function runAgentsRemove(id: string, confirmed: boolean): void {
  const cfg = loadCrewConfig();
  if (!cfg.agents[id]) {
    console.error(chalk.red(`no such agent: ${id}`));
    process.exitCode = 1;
    return;
  }
  if (Object.keys(cfg.agents).length === 1) {
    console.error(
      chalk.red(
        `"${id}" is the only agent; removing it would leave crew unloadable. Disable it instead.`,
      ),
    );
    process.exitCode = 1;
    return;
  }
  if (!confirmed) {
    console.log(
      chalk.yellow(
        `This deletes the definition of "${id}". Prefer disabling it:`,
      ),
    );
    console.log(`  jstackc crew agents disable ${id}`);
    console.log(
      chalk.dim(`\n  To delete anyway: jstackc crew agents remove ${id} --yes`),
    );
    process.exitCode = 1;
    return;
  }
  mutateAgents((agents) => {
    delete agents[id];
  });
  console.log(
    chalk.green(`Removed "${id}". Its task history is kept in the ledger.`),
  );
}

function loadCrewConfigRaw(): { mode?: string } | null {
  try {
    const raw = JSON.parse(
      readFileSync(join(findProjectRoot(), "jstack.config.json"), "utf8"),
    ) as Record<string, unknown>;
    return (raw[CONFIG_KEY] as { mode?: string }) ?? null;
  } catch {
    return null;
  }
}

/** Leaving dry_run is a one-way door for every message posted after it, so make it deliberate. */
export function runCrewGoLive(confirmChannel: string): void {
  const root = findProjectRoot();
  const path = join(root, "jstack.config.json");
  const raw = JSON.parse(readFileSync(path, "utf8")) as Record<string, unknown>;
  const cfg = CrewConfigSchema.parse(raw[CONFIG_KEY]);

  if (confirmChannel !== cfg.policy.egress.channels[0]) {
    console.error(
      chalk.red(
        `Confirmation mismatch. Expected the egress channel id; got "${confirmChannel}".`,
      ),
    );
    process.exitCode = 1;
    return;
  }
  (raw[CONFIG_KEY] as Record<string, unknown>).mode = "live";
  writeFileSync(path, `${JSON.stringify(raw, null, 2)}\n`);
  console.log(chalk.yellow("mode = live."));
  console.log(
    `  Ralph will post to ${cfg.policy.egress.channels.join(", ")} as you. Posts cannot be edited or deleted.`,
  );
  console.log(chalk.dim("  Back out with: jstackc crew panic"));
}

export function runCrewExplain(ts: string): void {
  const cfg = loadCrewConfig();
  const store = new CrewStore(cfg.state_dir);
  const rows = store.explain(cfg.policy.ingress.channels[0]!, ts);
  store.close();
  if (!rows.length) {
    console.log(
      chalk.yellow(`No trace for ${ts}. Ralph may never have read it.`),
    );
    return;
  }
  console.log(chalk.bold(`Decision trace for ${ts}\n`));
  for (const r of rows) {
    const when = new Date(Number(r.ts)).toISOString();
    console.log(
      `  ${when}  ${chalk.cyan(String(r.kind))}${r.rule_id ? ` ${chalk.yellow(String(r.rule_id))}` : ""}`,
    );
    if (r.detail) console.log(`      ${chalk.dim(String(r.detail))}`);
  }
}

export function runCrewPanic(reason: string): void {
  const cfg = loadCrewConfig();
  const dir = expandHome(cfg.state_dir);
  mkdirSync(dir, { recursive: true, mode: 0o700 });
  writeFileSync(
    join(dir, "HALTED"),
    `${new Date().toISOString()}\n${reason}\n`,
  );
  console.log(
    chalk.red("HALTED written. Ralph will not run or post until you clear it."),
  );
  console.log(chalk.dim("  jstackc crew resume"));
}

export function runCrewResume(): void {
  const cfg = loadCrewConfig();
  const p = join(expandHome(cfg.state_dir), "HALTED");
  if (!existsSync(p)) {
    console.log("Not halted.");
    return;
  }
  console.log(chalk.dim(`Recorded reason:\n${readFileSync(p, "utf8")}`));
  unlinkSync(p);
  console.log(chalk.green("Cleared."));
}

export function registerCrewCommand(program: Command): void {
  const crew = program
    .command("crew")
    .description("Ralph: watch your own Slack DM and answer in it");

  crew
    .command("init")
    .description("Write a disabled, dry_run crew config")
    .requiredOption("--user <U…>", "your Slack user id")
    .requiredOption("--dm <D…>", "your self-DM channel id")
    .requiredOption("--workspace <path>", "repo Ralph may read")
    .action((o: { user: string; dm: string; workspace: string }) =>
      runCrewInit(o.user, o.dm, o.workspace),
    );

  crew
    .command("lint")
    .description("Validate config and print the effective policy")
    .option("--json", "machine-readable", false)
    .action((o: { json: boolean }) => runCrewLint(o.json));

  crew
    .command("tick")
    .description("One poll cycle, then exit")
    .action(async () => runCrewTick());

  crew
    .command("simulate <text>")
    .description(
      "Push a synthetic message through the real pipeline, stopping at Slack",
    )
    .action(async (text: string) => runCrewTick(text));

  crew
    .command("eval")
    .description(
      "Grade real agent answers on hard tasks. Dry-run only; never posts",
    )
    .option("--json", "machine-readable", false)
    .option("--only <ids>", "comma-separated case ids")
    .option(
      "--deterministic",
      "skip the LLM judge (free, offline checks only)",
      false,
    )
    .option("--judge-model <m>", "model for the rubric judge")
    .action(
      async (o: {
        json: boolean;
        only?: string;
        deterministic: boolean;
        judgeModel?: string;
      }) => runCrewEval(o),
    );

  const ag = crew
    .command("agents")
    .description("View, create, modify, disable or remove background agents");

  ag.command("list", { isDefault: true })
    .description("List agents, their sigils and whether they are in routing")
    .option("--json", "machine-readable", false)
    .action((o: { json: boolean }) => runAgentsList(o.json));

  ag.command("show <id>")
    .description("Full effective config for one agent")
    .option("--json", "machine-readable", false)
    .action((id: string, o: { json: boolean }) => runAgentsShow(id, o.json));

  ag.command("add <id>")
    .description(
      "Create an agent. Starts DISABLED so nothing changes until you enable it.",
    )
    .requiredOption("--workspace <path>", "repo this agent may read")
    .option("--name <name>", "display name (defaults from the id)")
    .option(
      "--sigil <s...>",
      "what wakes it (defaults to !<id> and @agent-<id>)",
    )
    .option("--model <m>", "model", "claude-sonnet-5")
    .option("--tool <t...>", "tools (defaults Read Grep Glob)")
    .option("--description <d>", "what it is for")
    .option("--persona <p>", "extra system-prompt guidance")
    .action((id: string, o: Record<string, unknown>) =>
      runAgentsAdd({
        id,
        workspace: String(o.workspace),
        name: o.name as string | undefined,
        sigil: o.sigil as string[] | undefined,
        model: o.model as string | undefined,
        tools: o.tool as string[] | undefined,
        description: o.description as string | undefined,
        persona: o.persona as string | undefined,
      }),
    );

  ag.command("edit <id>")
    .description("Change fields on an existing agent")
    .option("--name <name>")
    .option("--model <m>")
    .option("--workspace <path>")
    .option("--sigil <s...>", "replaces the sigil list")
    .option("--tool <t...>", "replaces the tool list")
    .option("--description <d>")
    .option("--persona <p>")
    .option("--emoji <e>")
    .action((id: string, o: Record<string, unknown>) =>
      runAgentsEdit(id, {
        name: o.name,
        model: o.model,
        workspace: o.workspace,
        sigils: o.sigil,
        tools: o.tool,
        description: o.description,
        persona: o.persona,
        emoji: o.emoji,
      }),
    );

  ag.command("enable <id>")
    .description("Put an agent into routing")
    .action((id: string) => runAgentsToggle(id, true));
  ag.command("disable <id>")
    .description("Take an agent out of routing, keeping its definition")
    .action((id: string) => runAgentsToggle(id, false));
  ag.command("remove <id>")
    .description("Delete an agent definition (prefer disable)")
    .option("--yes", "skip the confirmation", false)
    .action((id: string, o: { yes: boolean }) => runAgentsRemove(id, o.yes));

  crew
    .command("ui")
    .description(
      "Orchestration page: agents, tasks, logs, scheduler. Ephemeral local server.",
    )
    .option("--port <p>", "port on 127.0.0.1", "7391")
    .option("--no-open", "do not open a browser")
    .action(async (o: { port: string; open: boolean }) =>
      runCrewUi(Number(o.port), o.open),
    );

  crew
    .command("install")
    .description(
      "Compile crewd and install the LaunchAgent so it runs without a terminal",
    )
    /**
     * 300s, not 60s, and the arithmetic is the reason.
     *
     * An idle tick costs about $0.023 because the Slack read goes through a model. At 60s that
     * is ~1,440 ticks/day, roughly $33 -- more than the $20 `budget.daily_usd` that `crew init`
     * writes, so the default schedule could not afford the default budget and the crew would
     * spend its whole allowance polling an empty DM. 300s is ~$6.60/day, leaving room for work.
     */
    .option(
      "--interval <s>",
      "seconds between ticks (~$0.023 each; 300s ≈ $6.60/day)",
      "300",
    )
    .option("--skip-build", "reuse the existing compiled binary", false)
    .action(async (o: { interval: string; skipBuild: boolean }) =>
      runCrewInstall(Number(o.interval), o.skipBuild),
    );

  crew
    .command("uninstall")
    .description(
      "Stop and remove the LaunchAgent (keeps the binary and ledger)",
    )
    .action(() => runCrewUninstall());

  crew
    .command("doctor")
    .description(
      "Preflight: config, agents, auth, launchd, and Full Disk Access",
    )
    .option("--json", "machine-readable", false)
    .action(async (o: { json: boolean }) => runCrewDoctor(o.json));

  crew
    .command("watch")
    .description(
      "Poll in the foreground until Ctrl-C (the simple alternative to a daemon)",
    )
    .option("--interval <s>", "seconds between ticks", "60")
    .action(async (o: { interval: string }) =>
      runCrewWatch(Number(o.interval)),
    );

  crew
    .command("go-live")
    .description(
      "Switch mode to live. Posts are irreversible and appear as you.",
    )
    .requiredOption(
      "--confirm-channel <D…>",
      "type the DM channel id back to confirm",
    )
    .action((o: { confirmChannel: string }) => runCrewGoLive(o.confirmChannel));

  crew
    .command("status")
    .description("Watermark, budget, tasks, halt state")
    .option("--json", "machine-readable", false)
    .action((o: { json: boolean }) => runCrewStatus(o.json));

  crew
    .command("explain <ts>")
    .description("Why did Ralph not respond to that message")
    .action((ts: string) => runCrewExplain(ts));

  crew
    .command("panic")
    .description("Write the HALTED sentinel; Ralph stops posting")
    .option("--reason <r>", "recorded reason", "manual")
    .action((o: { reason: string }) => runCrewPanic(o.reason));

  crew
    .command("resume")
    .description("Clear HALTED")
    .action(() => runCrewResume());

  crew
    .command("session <taskId>")
    .description(
      "Show the Claude session behind a reply handle, so you can continue it locally",
    )
    .option("--json", "machine-readable", false)
    .action((taskIdArg: string, o: { json: boolean }) =>
      runCrewSession(taskIdArg, o.json),
    );
}
