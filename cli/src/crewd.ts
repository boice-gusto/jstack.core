#!/usr/bin/env bun
/**
 * `crewd` -- the compiled tick entrypoint launchd runs.
 *
 * Why a separate compiled binary rather than `bun run cli/src/index.ts crew tick`:
 *
 *  1. launchd's PATH is /usr/bin:/bin:/usr/sbin:/sbin and cannot be set reliably from a
 *     plist, so depending on `bun` being resolvable is fragile.
 *  2. A stable executable at a stable path, rather than a shell script whose TCC identity
 *     would be /bin/bash.
 *
 * One tick, then exit. There is no loop here on purpose: a short-lived process cannot wedge
 * silently, and launchd re-running it on a schedule is the supervision.
 */
import { existsSync, readFileSync, readdirSync, writeFileSync, mkdirSync } from "node:fs";
import { join } from "node:path";
import { CrewConfigSchema } from "./lib/crew/types.js";
import { tick } from "./lib/crew/tick.js";
import { snapshotPath } from "./lib/crew/store.js";

/**
 * DESIGN NOTE -- why this daemon needs no Full Disk Access grant.
 *
 * Measured, not assumed. Under launchd an ungranted compiled binary that touches ~/Documents
 * does not get an error: it BLOCKS forever on a consent prompt launchd cannot display, which
 * wedges the tick and, because launchd will not run a second instance of a label, kills every
 * later tick too.
 *
 * But a `claude` CHILD spawned by that same ungranted parent reads ~/Documents fine. Asked for
 * the first line of CLAUDE.md from a LaunchAgent holding no grant at all, it returned
 * `# CLAUDE.md — jstack.core` verbatim.
 *
 * So the split is: the PARENT never touches a protected path, and the CHILD does all the
 * repository reading -- which is what the worker already does via `--add-dir`. Only two
 * parent-side reads existed, and both are handled: the config now comes from a snapshot in
 * ~/.jstack (see `snapshotPath`, refreshed by the CLI, which runs from a terminal that does
 * have access), and the health probe skips protected workspaces instead of reading into them.
 *
 * If you add a parent-side `readFileSync`/`readdirSync` on anything under ~/Documents, ~/Desktop
 * or ~/Downloads, you reintroduce the hang. Delegate it to a child instead.
 */

function findConfig(): string | null {
  // The project root is passed explicitly, because a compiled binary has no meaningful cwd
  // when launchd starts it.
  const fromEnv = process.env.JSTACK_PROJECT_ROOT;
  if (fromEnv) {
    const p = join(fromEnv, "jstack.config.json");
    return existsSync(p) ? p : null;
  }
  let dir = process.cwd();
  for (let i = 0; i < 8; i++) {
    const p = join(dir, "jstack.config.json");
    if (existsSync(p)) return p;
    const up = join(dir, "..");
    if (up === dir) break;
    dir = up;
  }
  return null;
}

/**
 * Load the crew config without touching a protected path when we can avoid it.
 *
 * Snapshot first, always. Falling back to the project file is correct only when there is no
 * snapshot yet, and it is the one path that can still hang, so the caller preflights it.
 */
function loadConfig(): { cfg: ReturnType<typeof CrewConfigSchema.parse>; source: string } | { error: string } {
  const snap = snapshotPath();
  if (existsSync(snap)) {
    try {
      return { cfg: CrewConfigSchema.parse(JSON.parse(readFileSync(snap, "utf8"))), source: snap };
    } catch (e) {
      return { error: `snapshot at ${snap} is invalid: ${(e as Error).message}` };
    }
  }
  const path = findConfig();
  if (!path) return { error: "no config snapshot and no jstack.config.json found. Run: jstack crew install" };
  try {
    const raw = JSON.parse(readFileSync(path, "utf8")) as Record<string, unknown>;
    if (!raw.crew) return { error: `no "crew" key in ${path}` };
    return { cfg: CrewConfigSchema.parse(raw.crew), source: path };
  } catch (e) {
    return { error: `config invalid: ${(e as Error).message}` };
  }
}

const stamp = () => new Date().toISOString();

/**
 * TCC probe mode. Full Disk Access is granted per-executable, so only THIS binary can
 * answer "can the daemon read the workspace?". `crew doctor` shells out here rather than
 * testing with its own process, whose grants are different.
 */
function tccProbe(): number {
  const path = findConfig();
  if (!path) {
    console.log("READ_DENIED no-config");
    return 0;
  }
  try {
    const raw = JSON.parse(readFileSync(path, "utf8")) as Record<string, unknown>;
    const cfg = CrewConfigSchema.parse((raw as { crew: unknown }).crew);
    for (const a of Object.values(cfg.agents)) {
      const w = a.workspace.startsWith("~/") ? join(process.env.HOME ?? "", a.workspace.slice(2)) : a.workspace;
      try {
        readdirSync(w);
      } catch {
        console.log(`READ_DENIED ${w}`);
        return 0;
      }
    }
    console.log("READ_OK");
  } catch (e) {
    console.log(`READ_DENIED ${(e as Error).message}`);
  }
  return 0;
}

/**
 * Write what THIS process could actually see, so `crew doctor` can report the launchd
 * context rather than its own.
 *
 * This matters because TCC grants are per-executable AND inherited from the responsible
 * process: a probe spawned from a Terminal inherits Terminal's grants and reports success
 * even when the LaunchAgent is denied. A check that passes when the real thing fails is
 * worse than no check, so the only trustworthy answer comes from the daemon itself.
 */
function writeHealth(stateDir: string, workspaces: Record<string, string>, configSource: string): void {
  /**
   * Probe only what the PARENT is allowed to touch.
   *
   * The previous version read a real file out of every workspace, which was the right check
   * when the daemon needed its own grant -- and is now the exact call that hangs forever when
   * it has none. A TCC-protected workspace is deliberately left unprobed and marked
   * "delegated": the worker is a child and reads it with its own access, which was measured
   * working with the parent ungranted. The worker's own success or failure is the real
   * evidence, and it lands in the task ledger.
   */
  const protectedRoots = ["Documents", "Desktop", "Downloads"].map((d) => join(process.env.HOME ?? "", d));
  const isProtected = (p: string) => protectedRoots.some((r) => p === r || p.startsWith(`${r}/`));

  const readable: Record<string, boolean | "delegated"> = {};
  for (const [id, w] of Object.entries(workspaces)) {
    if (isProtected(w)) {
      readable[id] = "delegated";
      continue;
    }
    try {
      const entries = readdirSync(w);
      const probe = entries.find((f) => f.endsWith(".json") || f.endsWith(".md"));
      if (probe) readFileSync(join(w, probe), "utf8").slice(0, 16);
      readable[id] = true;
    } catch {
      readable[id] = false;
    }
  }

  try {
    mkdirSync(stateDir, { recursive: true, mode: 0o700 });
    writeFileSync(
      join(stateDir, "health.json"),
      JSON.stringify(
        {
          at: new Date().toISOString(),
          // launchd sets this; absent when run by hand from a shell.
          launchd: Boolean(process.env.XPC_SERVICE_NAME && process.env.XPC_SERVICE_NAME !== "0"),
          xpc_service: process.env.XPC_SERVICE_NAME ?? null,
          workspaces_readable: readable,
          config_source: configSource,
          // No longer needed by the daemon, and stating that is the point: a future reader
          // should not reintroduce a protected-path probe here.
          needs_full_disk_access: false,
        },
        null,
        2,
      ),
    );
  } catch {
    /* health reporting must never break a tick */
  }
}

/**
 * Preflight the Full Disk Access grant in a CHILD process, before this one touches any
 * protected path.
 *
 * Measured the hard way. Full Disk Access is keyed to the binary's code identity, not its
 * path, so REBUILDING crewd silently invalidates the grant. The next access to ~/Documents
 * then does not fail -- it BLOCKS, waiting on a consent prompt that a background LaunchAgent
 * can never display. The tick hangs forever, and because launchd will not run a second
 * instance of a label, every later tick never starts either. One rebuild took the daemon
 * down permanently with an empty log and `state = running`.
 *
 * A timer cannot rescue this: the blocking call is a synchronous readdir, so the event loop
 * never runs to fire one. The only way to bound it is to let a child take the hit and time
 * the child out. Verified: with config and workspaces on /tmp the same binary returns
 * READ_OK under launchd, which is what isolated this to the grant rather than the build.
 */
function preflightAccess(): { ok: boolean; detail: string } {
  const self = process.execPath;
  const r = Bun.spawnSync([self], {
    env: { ...process.env, JSTACK_CREW_TCC_PROBE: "1" },
    stdout: "pipe",
    stderr: "pipe",
    stdin: "ignore",
    timeout: 20_000,
  });
  const out = new TextDecoder().decode(r.stdout).trim();
  if (out.startsWith("READ_OK")) return { ok: true, detail: out };
  if (out === "") {
    return {
      ok: false,
      detail:
        "probe produced no output within 20s -- this is the signature of a MISSING Full Disk " +
        "Access grant: the read is blocked pending a consent prompt launchd cannot show. " +
        `Re-grant Full Disk Access to ${self} in System Settings > Privacy & Security ` +
        "(remove the old crewd entry first -- rebuilding changes the binary's identity).",
    };
  }
  return { ok: false, detail: out };
}

async function main(): Promise<number> {
  if (process.env.JSTACK_CREW_TCC_PROBE === "1") return tccProbe();

  /**
   * Preflight ONLY the fallback path, and only when it is actually taken.
   *
   * With a snapshot present this process touches nothing protected, so there is nothing to
   * preflight -- running it anyway is what made every tick cost 20s and then refuse to work.
   * Without a snapshot we must read the project config, which may sit in ~/Documents and
   * would block forever, so that single case still gets a bounded child probe.
   */
  const usingSnapshot = existsSync(snapshotPath());
  if (!usingSnapshot && process.env.JSTACK_CREW_SKIP_PREFLIGHT !== "1") {
    const pre = preflightAccess();
    if (!pre.ok) {
      console.error(`${stamp()} crewd: PREFLIGHT FAILED, skipping tick. ${pre.detail}`);
      // Exit 0: a non-zero exit invites launchd to treat this as a crash and throttle the
      // job into permanent death, which is the very failure this check exists to prevent.
      return 0;
    }
  }

  const loaded = loadConfig();
  if ("error" in loaded) {
    // A malformed config must not crash-loop: launchd throttles repeated fatal starts and
    // will eventually stop the job permanently, which looks exactly like silent death.
    console.error(`${stamp()} crewd: ${loaded.error}`);
    return 0;
  }
  const cfg = loaded.cfg;
  const configSource = loaded.source;

  const stateDir = cfg.state_dir.startsWith("~/")
    ? join(process.env.HOME ?? "", cfg.state_dir.slice(2))
    : cfg.state_dir;
  writeHealth(
    stateDir,
    Object.fromEntries(
      Object.entries(cfg.agents).map(([id, a]) => [
        id,
        a.workspace.startsWith("~/") ? join(process.env.HOME ?? "", a.workspace.slice(2)) : a.workspace,
      ]),
    ),
    configSource,
  );

  try {
    const s = await tick({ config: cfg, log: (l) => console.log(`${stamp()} ${l}`) });
    console.log(
      `${stamp()} tick read=${s.read} handled=${s.handled} dropped=${s.dropped.length} cost=$${s.costUsd.toFixed(4)}` +
        (s.backlogSkipped ? " backlog_skipped" : "") +
        (s.halted ? ` HALTED=${s.halted}` : ""),
    );
    // Exit 0 even when halted: a non-zero exit invites launchd to treat it as a crash.
    return 0;
  } catch (e) {
    console.error(`${stamp()} crewd: tick threw: ${(e as Error).message}`);
    return 0;
  }
}

/**
 * Guarded so that importing this file cannot run a tick. An earlier revision had the CLI
 * import a path helper from here, which would have executed a full poll cycle -- posting
 * included -- merely as a side effect of loading a command module.
 */
if (import.meta.main) process.exit(await main());
