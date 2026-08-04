import {
  existsSync,
  mkdirSync,
  readFileSync,
  unlinkSync,
  writeFileSync,
} from "node:fs";
import { homedir } from "node:os";
import { join } from "node:path";
import { expandHome } from "./store.js";

/**
 * LaunchAgent install for the crew tick.
 *
 * Every value here is a measured requirement, not a preference:
 *
 *  - `LimitLoadToSessionType: Aqua`. macOS has two launchd user domains. `gui/<uid>` (Aqua)
 *    inherits the unlocked login keychain, which the Slack MCP OAuth needs; `user/<uid>`
 *    (Background) does not, and keychain reads there fail with errSecInteractionNotAllowed.
 *    Bootstrap into `gui/$(id -u)`, never `user/$(id -u)`.
 *  - `USER` in the environment. Measured: the keychain lookup keys off $USER, and without it
 *    the API returns "Not logged in". launchd supplies it, but it is set explicitly so the
 *    plist documents the dependency.
 *  - `ThrottleInterval: 30`. A value of 1 lets launchd classify repeated starts as thrashing
 *    and stop the job permanently, which presents as a silently dead agent.
 *  - `ExitTimeOut: 60`, so a tick mid-post is not SIGKILLed at launchd's 20s default.
 *  - Absolute path to a COMPILED binary. launchd's PATH is /usr/bin:/bin:/usr/sbin:/sbin and
 *    cannot be set reliably from a plist. More importantly, TCC attributes to the responsible
 *    executable: a shell script is attributed to /bin/bash and denied ~/Documents, while a
 *    compiled binary gets its own identity and was measured reading it fine.
 *  - No secrets in EnvironmentVariables: it is world-readable and dumped by `launchctl print`.
 */

export const LABEL = "com.jstack.crew";

export interface InstallPaths {
  plist: string;
  binary: string;
  stdout: string;
  stderr: string;
}

export function installPaths(stateDir: string): InstallPaths {
  const dir = expandHome(stateDir);
  return {
    plist: join(homedir(), "Library", "LaunchAgents", `${LABEL}.plist`),
    binary: join(dir, "crewd"),
    stdout: join(dir, "logs", "crewd.out.log"),
    stderr: join(dir, "logs", "crewd.err.log"),
  };
}

export function renderPlist(
  p: InstallPaths,
  projectRoot: string,
  intervalSeconds: number,
): string {
  const esc = (s: string) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;");
  return `<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
  <key>Label</key><string>${LABEL}</string>
  <key>ProgramArguments</key>
  <array>
    <string>${esc(p.binary)}</string>
  </array>
  <key>EnvironmentVariables</key>
  <dict>
    <key>JSTACK_PROJECT_ROOT</key><string>${esc(projectRoot)}</string>
    <key>USER</key><string>${esc(process.env.USER ?? "")}</string>
    <key>HOME</key><string>${esc(homedir())}</string>
    <key>PATH</key><string>/usr/bin:/bin:/usr/sbin:/sbin:${esc(join(homedir(), ".local", "bin"))}</string>
  </dict>
  <key>StartInterval</key><integer>${intervalSeconds}</integer>
  <key>RunAtLoad</key><true/>
  <key>ThrottleInterval</key><integer>30</integer>
  <key>ExitTimeOut</key><integer>60</integer>
  <key>LimitLoadToSessionType</key><string>Aqua</string>
  <key>ProcessType</key><string>Background</string>
  <key>StandardOutPath</key><string>${esc(p.stdout)}</string>
  <key>StandardErrorPath</key><string>${esc(p.stderr)}</string>
</dict>
</plist>
`;
}

export function writePlist(
  p: InstallPaths,
  projectRoot: string,
  intervalSeconds: number,
): void {
  mkdirSync(join(homedir(), "Library", "LaunchAgents"), { recursive: true });
  mkdirSync(join(expandHome("~/.jstack/crew"), "logs"), { recursive: true });
  writeFileSync(p.plist, renderPlist(p, projectRoot, intervalSeconds), {
    mode: 0o600,
  });
}

export function removePlist(p: InstallPaths): void {
  if (existsSync(p.plist)) unlinkSync(p.plist);
}

export function isLoaded(): boolean {
  const r = Bun.spawnSync([
    "launchctl",
    "print",
    `gui/${process.getuid?.() ?? 0}/${LABEL}`,
  ]);
  return r.exitCode === 0;
}

export function bootstrap(p: InstallPaths): { ok: boolean; detail: string } {
  const uid = process.getuid?.() ?? 0;
  Bun.spawnSync(["launchctl", "bootout", `gui/${uid}/${LABEL}`]);
  const r = Bun.spawnSync(["launchctl", "bootstrap", `gui/${uid}`, p.plist]);
  const err = new TextDecoder().decode(r.stderr).trim();
  return { ok: r.exitCode === 0, detail: err || `exit ${r.exitCode}` };
}

export function bootout(): { ok: boolean; detail: string } {
  const uid = process.getuid?.() ?? 0;
  const r = Bun.spawnSync(["launchctl", "bootout", `gui/${uid}/${LABEL}`]);
  const err = new TextDecoder().decode(r.stderr).trim();
  return { ok: r.exitCode === 0, detail: err || `exit ${r.exitCode}` };
}

/**
 * Is this path inside a TCC-protected folder (~/Documents, ~/Desktop, ~/Downloads)?
 *
 * What happens there depends on WHICH executable launchd runs, because TCC attributes to the
 * responsible process. Both measured on this machine:
 *
 *   shell script    -> responsible process is /bin/bash, which holds no grant. DENIED:
 *                      `ls ~/Documents` and a file read both failed.
 *   compiled binary -> its own identity. ALLOWED: read ~/Documents and both workspaces,
 *                      with real file reads, no Full Disk Access grant added.
 *
 * So compiling is not merely a PATH convenience; it is what makes the protected case work.
 * This function therefore returns "worth verifying", NOT "will fail". The authoritative
 * answer comes from health.json, which crewd writes from inside the real launchd context on
 * every tick -- because a check run from a Terminal inherits Terminal's grants and would
 * report success while the LaunchAgent is denied.
 */
export function isTccProtected(workspace: string): boolean {
  const p = expandHome(workspace);
  const protectedRoots = ["Documents", "Desktop", "Downloads"].map((d) =>
    join(homedir(), d),
  );
  return protectedRoots.some((root) => p === root || p.startsWith(`${root}/`));
}

/** Does the compiled binary exist and look like a Mach-O executable rather than a script? */
export function binaryLooksCompiled(binary: string): boolean {
  if (!existsSync(binary)) return false;
  try {
    const fd = readFileSync(binary);
    // Mach-O magic: 0xfeedfacf (64-bit) or 0xcafebabe (universal).
    const m = fd.readUInt32BE(0);
    return (
      m === 0xcffaedfe ||
      m === 0xfeedfacf ||
      m === 0xcafebabe ||
      m === 0xbebafeca
    );
  } catch {
    return false;
  }
}
