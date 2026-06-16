import { readFileSync, existsSync } from "node:fs";
import { join } from "node:path";
import type { JstackConfig } from "../types/config.js";

export interface RoutineRow {
  id: string;
  cron: string;
  enabled: boolean;
  chain: string[];
}

export function listRoutinesFromConfig(cfg: JstackConfig): RoutineRow[] {
  const r = cfg.routines as Record<string, { cron?: string; enabled?: boolean; chain?: string[] }> | undefined;
  if (!r) return [];
  return Object.entries(r).map(([id, v]) => ({
    id,
    cron: v.cron ?? "",
    enabled: !!v.enabled,
    chain: v.chain ?? [],
  }));
}

export function loadScheduleFile(pluginRoot: string, id: string): unknown | null {
  const p = join(pluginRoot, "config", "schedules", `${id}.json`);
  if (!existsSync(p)) return null;
  return JSON.parse(readFileSync(p, "utf8"));
}
