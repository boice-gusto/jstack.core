import { describe, expect, test } from "bun:test";
import {
  INTEGRATION_CHECK_PATHS,
  isIntegrationConfigured,
} from "./integration-checks.js";

/**
 * `validate-config.ts` used to hand-duplicate 8 near-identical closures (unsafe casts +
 * nested-key drill-down) instead of being data-driven off this table. These tests exercise
 * every integration id's OR-semantics directly, without importing validate-config.ts itself
 * (which has top-level script side effects -- reads cwd's jstack.config.json and can exit).
 */
describe("INTEGRATION_CHECK_PATHS / isIntegrationConfigured", () => {
  const ids = Object.keys(INTEGRATION_CHECK_PATHS);

  test("covers exactly the 8 known integration ids", () => {
    expect(ids.sort()).toEqual(
      [
        "gbrain_personal",
        "gbrain_team",
        "gcal",
        "github",
        "jira",
        "notion",
        "sheets",
        "slack",
      ].sort(),
    );
  });

  test("jira: configured only when base_url is a non-empty string", () => {
    const paths = INTEGRATION_CHECK_PATHS.jira!;
    expect(isIntegrationConfigured({}, paths)).toBe(false);
    expect(
      isIntegrationConfigured(
        { integrations: { jira: { base_url: "" } } },
        paths,
      ),
    ).toBe(false);
    expect(
      isIntegrationConfigured(
        { integrations: { jira: { base_url: "https://x.atlassian.net" } } },
        paths,
      ),
    ).toBe(true);
  });

  test("slack: OR across public_channel / private_channel / webhook_url", () => {
    const paths = INTEGRATION_CHECK_PATHS.slack!;
    expect(isIntegrationConfigured({}, paths)).toBe(false);
    expect(
      isIntegrationConfigured(
        { integrations: { slack: { private_channel: "C123" } } },
        paths,
      ),
    ).toBe(true);
    expect(
      isIntegrationConfigured(
        {
          integrations: { slack: { webhook_url: "https://hooks.slack.com/x" } },
        },
        paths,
      ),
    ).toBe(true);
  });

  test("github: OR across org / default_repo", () => {
    const paths = INTEGRATION_CHECK_PATHS.github!;
    expect(
      isIntegrationConfigured(
        { integrations: { github: { org: "acme" } } },
        paths,
      ),
    ).toBe(true);
    expect(
      isIntegrationConfigured(
        { integrations: { github: { default_repo: "acme/repo" } } },
        paths,
      ),
    ).toBe(true);
    expect(
      isIntegrationConfigured({ integrations: { github: {} } }, paths),
    ).toBe(false);
  });

  test("gbrain_team / gbrain_personal read from the gbrain section, not integrations", () => {
    expect(
      isIntegrationConfigured(
        { gbrain: { team: { url: "https://gbrain/team" } } },
        INTEGRATION_CHECK_PATHS.gbrain_team!,
      ),
    ).toBe(true);
    expect(
      isIntegrationConfigured(
        { gbrain: { personal: { url: "" } } },
        INTEGRATION_CHECK_PATHS.gbrain_personal!,
      ),
    ).toBe(false);
  });

  test("notion / gcal / sheets: single-path checks", () => {
    expect(
      isIntegrationConfigured(
        { integrations: { notion: { workspace_id: "ws1" } } },
        INTEGRATION_CHECK_PATHS.notion!,
      ),
    ).toBe(true);
    expect(
      isIntegrationConfigured(
        { integrations: { gcal: { primary_calendar_id: "cal1" } } },
        INTEGRATION_CHECK_PATHS.gcal!,
      ),
    ).toBe(true);
    expect(
      isIntegrationConfigured(
        { integrations: { sheets: { default_spreadsheet_id: "" } } },
        INTEGRATION_CHECK_PATHS.sheets!,
      ),
    ).toBe(false);
  });
});
