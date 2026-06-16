import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { DISTRIBUTION_VERSION_DEFAULT_URL, ENCODING_UTF8 } from "@jstack/constants/paths";

const SEMVER_LINE = /^[0-9]+\.[0-9.]+$/;

export type UpdateCheckResult = {
  local_version: string | null;
  remote_version: string | null;
  upgrade_available: boolean;
  raw_line: string | null;
};

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
    remoteUrl && remoteUrl.length > 0 ? remoteUrl : DISTRIBUTION_VERSION_DEFAULT_URL;

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

  const upgrade_available = !!(local && remote && local !== remote);
  const raw_line = upgrade_available ? `UPGRADE_AVAILABLE ${local} ${remote}` : null;

  return {
    local_version: local,
    remote_version: remote,
    upgrade_available,
    raw_line,
  };
}
