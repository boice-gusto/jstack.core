import { realpathSync } from "node:fs";
import { resolve } from "node:path";

import type { DashboardEnv } from "@/server/env";
import { getJstackCoreRoot } from "@/server/env";

/**
 * Resolve and verify agent cwd stays within jstack.core tree (prevents path escape).
 */
export function resolveAgentCwd(env: DashboardEnv): string {
  const root = realpathSync(getJstackCoreRoot());
  const configured = env.DASHBOARD_AGENT_CWD?.trim();
  const target =
    configured !== undefined && configured.length > 0 ? resolve(configured) : root;
  const cwd = realpathSync(target);
  const prefix = root.endsWith("/") ? root : `${root}/`;
  if (cwd !== root && !cwd.startsWith(prefix)) {
    throw new Error("DASHBOARD_AGENT_CWD must be inside jstack.core root");
  }
  return cwd;
}
