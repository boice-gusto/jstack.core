import { readFileSync, existsSync } from "node:fs";
import { join } from "node:path";
import { z } from "zod";
import { ENCODING_UTF8, JSTACK_CONFIG_FILE } from "@jstack/constants/paths";
import { getJstackCoreRoot } from "@/server/env";

const TelemetrySectionSchema = z
  .object({ enabled: z.boolean().optional(), endpoint: z.string().optional() })
  .passthrough();

const TeamSectionSchema = z.object({ name: z.string().optional() }).passthrough();

export type DashboardRelevantConfig = {
  telemetry?: z.infer<typeof TelemetrySectionSchema>;
  team?: z.infer<typeof TeamSectionSchema>;
};

/**
 * Reads the fields of `jstack.config.json` the dashboard actually consumes (telemetry settings,
 * team name), validated instead of handed back as `unknown` for each of the two call sites to
 * narrow independently -- one via an unchecked `as` cast, one via a hand-rolled `isRecord` chain.
 * Each section is validated independently (not the whole object at once) so a type mismatch in
 * one section doesn't make the other section's otherwise-valid data unavailable too, matching
 * how the two prior ad hoc narrowings each degraded independently. Both sections are
 * `.passthrough()`, matching `cli/src/types/config.ts`'s own rule, so an unmodeled field is
 * preserved on the returned object rather than silently dropped.
 */
export function readJstackConfig(): DashboardRelevantConfig | null {
  const p = join(getJstackCoreRoot(), JSTACK_CONFIG_FILE);
  if (!existsSync(p)) return null;
  const raw: unknown = JSON.parse(readFileSync(p, ENCODING_UTF8));
  const rec =
    raw && typeof raw === "object" && !Array.isArray(raw)
      ? (raw as Record<string, unknown>)
      : {};
  const telemetry = TelemetrySectionSchema.safeParse(rec.telemetry);
  const team = TeamSectionSchema.safeParse(rec.team);
  return {
    telemetry: telemetry.success ? telemetry.data : undefined,
    team: team.success ? team.data : undefined,
  };
}
