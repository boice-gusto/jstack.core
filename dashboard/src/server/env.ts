import { realpathSync } from "node:fs";
import { join, resolve } from "node:path";

import type { DashboardEnv } from "@/lib/dashboard-env";

export type { DashboardEnv } from "@/lib/dashboard-env";
export { getDashboardEnv } from "@/lib/dashboard-env";

/**
 * Parent of the dashboard package = jstack.core (skills, skill-catalog.json).
 */
export function getJstackCoreRoot(): string {
  try {
    return realpathSync(resolve(join(process.cwd(), "..")));
  } catch {
    return resolve(join(process.cwd(), ".."));
  }
}

export function getAgentWorkingDirectory(env: DashboardEnv): string {
  const configured = env.DASHBOARD_AGENT_CWD?.trim();
  if (configured !== undefined && configured.length > 0) {
    return resolve(configured);
  }
  return getJstackCoreRoot();
}

export function getSkillCatalogPath(): string {
  return join(getJstackCoreRoot(), "skill-catalog.json");
}

export function getDashboardDataDirectory(): string {
  return join(getJstackCoreRoot(), ".dashboard-data");
}
