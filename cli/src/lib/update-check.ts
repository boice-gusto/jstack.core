import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import {
  DISTRIBUTION_VERSION_DEFAULT_URL,
  ENCODING_UTF8,
} from "@jstack/constants/paths";

const SEMVER_LINE = /^[0-9]+\.[0-9.]+$/;

/**
 * The 4 real states a version check can land in, as a tag instead of 4 loosely-related flat
 * fields (2 nullable strings, a boolean, and a derived nullable string) whose valid combinations
 * were an implicit invariant enforced only inside `checkDistributionUpdate` -- every consumer
 * had to re-derive which state it was in via priority-ordered `!field` checks instead of reading
 * a tag.
 */
export type UpdateCheckResult =
  | { status: "no-local-version" }
  | { status: "offline"; local_version: string }
  | { status: "up-to-date"; local_version: string }
  | {
      status: "upgrade-available";
      local_version: string;
      remote_version: string;
    };

/**
 * Projects the union back to the flat 4-key shape `jstack doctor --json` has always emitted.
 * That JSON contract is outside this module's ownership boundary (doctor.ts) and must not
 * change shape, so it gets an adapter here instead of being rewritten to the new union.
 */
export function toLegacyUpdateFields(result: UpdateCheckResult): {
  local_version: string | null;
  remote_version: string | null;
  upgrade_available: boolean;
  raw_line: string | null;
} {
  switch (result.status) {
    case "no-local-version":
      return {
        local_version: null,
        remote_version: null,
        upgrade_available: false,
        raw_line: null,
      };
    case "offline":
      return {
        local_version: result.local_version,
        remote_version: null,
        upgrade_available: false,
        raw_line: null,
      };
    case "up-to-date":
      return {
        local_version: result.local_version,
        remote_version: result.local_version,
        upgrade_available: false,
        raw_line: null,
      };
    case "upgrade-available":
      return {
        local_version: result.local_version,
        remote_version: result.remote_version,
        upgrade_available: true,
        raw_line: `UPGRADE_AVAILABLE ${result.local_version} ${result.remote_version}`,
      };
  }
}

function readVersionFile(pluginRoot: string): string | null {
  const p = join(pluginRoot, "VERSION");
  if (!existsSync(p)) return null;
  const v = readFileSync(p, ENCODING_UTF8).trim().replace(/\s+/g, "");
  return v.length ? v : null;
}

/** Best-effort remote fetch; no disk cache (doctor is infrequent). */
export async function checkDistributionUpdate(
  pluginRoot: string,
  remoteUrl: string | undefined,
): Promise<UpdateCheckResult> {
  const local = readVersionFile(pluginRoot);
  const url =
    remoteUrl && remoteUrl.length > 0
      ? remoteUrl
      : DISTRIBUTION_VERSION_DEFAULT_URL;

  let remote: string | null = null;
  try {
    const ac = new AbortController();
    const t = setTimeout(() => ac.abort(), 5000);
    const res = await fetch(url, { signal: ac.signal });
    clearTimeout(t);
    if (res.ok) {
      const text = (await res.text()).trim().replace(/\s+/g, "");
      if (SEMVER_LINE.test(text)) remote = text;
    }
  } catch {
    /* offline or blocked */
  }

  if (!local) return { status: "no-local-version" };
  if (!remote) return { status: "offline", local_version: local };
  if (local === remote) return { status: "up-to-date", local_version: local };
  return {
    status: "upgrade-available",
    local_version: local,
    remote_version: remote,
  };
}
