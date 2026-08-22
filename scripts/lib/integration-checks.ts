import { deepGet } from "../../cli/src/lib/schema-questions.js";

/**
 * Which integration ids `validate-config.ts`'s `onboarding.required_integrations` check
 * understands, and the OR-candidate config paths that mark each one "configured". Previously
 * 8 hand-duplicated closures doing the same unsafe-cast-and-drill-down; this is the data those
 * closures encoded, extracted so it's importable (and testable) without triggering
 * validate-config.ts's top-level script side effects.
 */
export const INTEGRATION_CHECK_PATHS: Record<string, string[][]> = {
  jira: [["integrations", "jira", "base_url"]],
  slack: [
    ["integrations", "slack", "public_channel"],
    ["integrations", "slack", "private_channel"],
    ["integrations", "slack", "webhook_url"],
  ],
  notion: [["integrations", "notion", "workspace_id"]],
  github: [
    ["integrations", "github", "org"],
    ["integrations", "github", "default_repo"],
  ],
  gcal: [["integrations", "gcal", "primary_calendar_id"]],
  sheets: [["integrations", "sheets", "default_spreadsheet_id"]],
  gbrain_team: [["gbrain", "team", "url"]],
  gbrain_personal: [["gbrain", "personal", "url"]],
};

/** An integration is "configured" if any of its OR-candidate paths holds a non-empty value. */
export function isIntegrationConfigured(
  obj: unknown,
  paths: string[][],
): boolean {
  return paths.some((path) => {
    const v = deepGet(obj, path);
    return v != null && String(v).trim() !== "";
  });
}
