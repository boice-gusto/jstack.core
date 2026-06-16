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

  if (opts.format === "json") {
    console.log(JSON.stringify(payload, null, 2));
    return;
  }
  if (opts.format === "unix") {
    console.log(String(payload.unix_ms));
    return;
  }
  console.log(`${payload.iso} (${tz})`);
}
