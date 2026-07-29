import { findProjectRoot, readConfigOptional } from "../lib/config.js";

export function runTime(opts: { format: string; sprint: boolean }): void {
  const now = new Date();
  const root = findProjectRoot();
  const cfg = readConfigOptional(root);
  const team = cfg?.team as { timezone?: string } | undefined;
  const tz = team?.timezone ?? Intl.DateTimeFormat().resolvedOptions().timeZone;

  const payload = {
    iso: now.toISOString(),
    unix_ms: now.getTime(),
    timezone: tz,
    sprint: opts.sprint
      ? {
          note: "Configure sprint dates in jstack.config.json under integrations or custom keys",
          placeholder_sprint_day: null,
        }
      : undefined,
  };

  switch (opts.format) {
    case "json":
      console.log(JSON.stringify(payload, null, 2));
      return;
    case "unix":
      console.log(String(payload.unix_ms));
      return;
    // `iso` used to fall through to the human branch, so it emitted `<iso> (<tz>)` — identical to
    // `--format human` and unparseable as a bare timestamp, despite both `--help` and the command
    // registry advertising it as a distinct format. A script asking for ISO got the human string.
    case "iso":
      console.log(payload.iso);
      return;
    case "human":
      console.log(`${payload.iso} (${tz})`);
      return;
    default:
      // Previously any unknown value silently rendered the human format and exited 0, so a typo
      // (`--format is0`) was indistinguishable from success.
      console.error(`Unknown --format "${opts.format}". Expected one of: human, iso, unix, json.`);
      process.exitCode = 1;
      return;
  }
}
