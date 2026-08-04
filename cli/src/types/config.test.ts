/**
 * Tests for the enforced config contract.
 *
 * Two obligations, and the second is the one that matters:
 *
 *   1. The shipped files (`config/defaults.json`, this repo's `jstack.config.json`) must VALIDATE.
 *      A schema that rejects the repo's own defaults is broken, not strict.
 *   2. Every constraint must be shown to REJECT something. Before this file, 18 of 21 sections were
 *      `z.record(z.unknown())` — a green check that proved nothing. Each case below feeds a value a
 *      human would plausibly write and asserts the schema catches it.
 *
 * Four constraints in the first draft of the schema were wrong, caught by obligation 1: chains use
 * bare slugs (not `jstack:` tokens), `cron: ""` means unscheduled, `canonical_group.mode` includes
 * `manual_list`/`none`, and `claude_md_improver.min_priority` is a score floor (5.0) not a ratio.
 * Those are pinned below so they cannot regress.
 */
import { describe, expect, test } from "bun:test";
import { readFileSync, existsSync } from "node:fs";
import { join } from "node:path";
import { JstackConfigSchema, formatConfigIssues } from "./config.js";

const repoRoot = join(import.meta.dir, "..", "..", "..");

/** Parse and return `path: message` lines, or `[]` when valid. */
function issues(cfg: unknown): string[] {
  const r = JstackConfigSchema.safeParse(cfg);
  return r.success ? [] : formatConfigIssues(r.error);
}

/** Assert the schema rejects `cfg` and that some issue mentions `atPath`. */
function expectRejected(cfg: unknown, atPath: string): string[] {
  const found = issues(cfg);
  expect(found.length).toBeGreaterThan(0);
  expect(found.some((i) => i.startsWith(atPath))).toBe(true);
  return found;
}

describe("shipped config files validate", () => {
  test("config/defaults.json", () => {
    const raw = JSON.parse(
      readFileSync(join(repoRoot, "config", "defaults.json"), "utf8"),
    );
    expect(issues(raw)).toEqual([]);
  });

  test("this repo's jstack.config.json", () => {
    const p = join(repoRoot, "jstack.config.json");
    if (!existsSync(p)) return; // optional in a fresh checkout
    expect(issues(JSON.parse(readFileSync(p, "utf8")))).toEqual([]);
  });

  test("an empty config is valid — every section is optional", () => {
    expect(issues({})).toEqual([]);
  });
});

describe("forward compatibility: unknown keys never break an older CLI", () => {
  test("an unknown top-level section is accepted", () => {
    expect(issues({ some_future_section: { a: 1 } })).toEqual([]);
  });

  test("an unknown key inside a known section is accepted", () => {
    expect(issues({ telemetry: { enabled: true, future_knob: "x" } })).toEqual(
      [],
    );
  });
});

describe("no Zod defaults are injected into new sections", () => {
  // A `.default()` here would be persisted by writeConfig, silently rewriting a user's small
  // hand-written config into hundreds of lines of restated defaults.
  test("parsing {} does not invent team/sprint/routines/telemetry", () => {
    const parsed = JstackConfigSchema.parse({});
    expect(parsed.team).toBeUndefined();
    expect(parsed.sprint).toBeUndefined();
    expect(parsed.routines).toBeUndefined();
    expect(parsed.telemetry).toBeUndefined();
    expect(parsed.reports).toBeUndefined();
  });

  test("mcp_servers keeps its pre-existing default so setup keeps working", () => {
    expect(JstackConfigSchema.parse({}).mcp_servers).toEqual({});
  });
});

describe("cron: a malformed schedule silently never fires", () => {
  test("accepts a valid 5-field expression", () => {
    expect(issues({ routines: { standup: { cron: "30 9 * * 1-5" } } })).toEqual(
      [],
    );
  });

  test("accepts step and list syntax", () => {
    expect(issues({ routines: { h: { cron: "0 */4 * * *" } } })).toEqual([]);
    expect(issues({ routines: { h: { cron: "0 9,17 * * MON,FRI" } } })).toEqual(
      [],
    );
  });

  test('accepts "" — the shipped convention for "exists but unscheduled"', () => {
    expect(issues({ routines: { sprint_close: { cron: "" } } })).toEqual([]);
  });

  test("rejects a 6-field (seconds-prefixed) expression", () => {
    expectRejected(
      { routines: { s: { cron: "0 30 9 * * 1-5" } } },
      "routines.s.cron",
    );
  });

  test("rejects too few fields", () => {
    expectRejected({ routines: { s: { cron: "30 9 *" } } }, "routines.s.cron");
  });

  test("rejects English prose where a cron belongs", () => {
    expectRejected(
      { routines: { s: { cron: "every weekday at 9am" } } },
      "routines.s.cron",
    );
  });
});

describe("routine chains use bare slugs", () => {
  test("accepts bare and nested slugs", () => {
    expect(
      issues({ routines: { r: { chain: ["recon", "research/competitive"] } } }),
    ).toEqual([]);
  });

  // Regression: requiring the prefixed form rejected all four shipped routines.
  test("rejects the jstack: token form, and says which notation to use", () => {
    const found = expectRejected(
      { routines: { r: { chain: ["jstack:recon"] } } },
      "routines.r.chain.0",
    );
    expect(found.join(" ")).toContain("no 'jstack:' prefix");
  });

  test("rejects a chain that is a string rather than an array", () => {
    expectRejected({ routines: { r: { chain: "recon" } } }, "routines.r.chain");
  });
});

describe("numbers: the string-vs-number mistake", () => {
  test('rejects "2" for sprint.cadence_weeks', () => {
    expectRejected({ sprint: { cadence_weeks: "2" } }, "sprint.cadence_weeks");
  });

  test("rejects 0 and negative cadence", () => {
    expectRejected({ sprint: { cadence_weeks: 0 } }, "sprint.cadence_weeks");
    expectRejected({ sprint: { cadence_weeks: -1 } }, "sprint.cadence_weeks");
  });

  test("rejects a fractional velocity window", () => {
    expectRejected(
      { sprint: { velocity_window: 2.5 } },
      "sprint.velocity_window",
    );
  });

  test("allows 0 required approvals but rejects negative", () => {
    expect(issues({ policies: { review: { required_approvals: 0 } } })).toEqual(
      [],
    );
    expectRejected(
      { policies: { review: { required_approvals: -1 } } },
      "policies.review.required_approvals",
    );
  });

  test("rejects satisfaction_frequency outside 0..100", () => {
    expect(issues({ telemetry: { satisfaction_frequency: 20 } })).toEqual([]);
    expectRejected(
      { telemetry: { satisfaction_frequency: 101 } },
      "telemetry.satisfaction_frequency",
    );
    expectRejected(
      { telemetry: { satisfaction_frequency: -1 } },
      "telemetry.satisfaction_frequency",
    );
  });

  test("silo_scan.confidence_threshold is a 0..1 ratio", () => {
    expect(issues({ silo_scan: { confidence_threshold: 0.7 } })).toEqual([]);
    expectRejected(
      { silo_scan: { confidence_threshold: 70 } },
      "silo_scan.confidence_threshold",
    );
  });

  // Regression: this was modelled as a 0..1 ratio, which rejected the shipped default of 5.0.
  test("claude_md_improver.min_priority is a score floor, not a ratio", () => {
    expect(issues({ claude_md_improver: { min_priority: 5.0 } })).toEqual([]);
    expect(issues({ claude_md_improver: { min_priority: 8.5 } })).toEqual([]);
    expectRejected(
      { claude_md_improver: { min_priority: -1 } },
      "claude_md_improver.min_priority",
    );
  });
});

describe("times and timezones", () => {
  test("accepts 24-hour HH:MM", () => {
    expect(
      issues({ team: { business_hours: { start: "09:30", end: "17:00" } } }),
    ).toEqual([]);
  });

  test("rejects 12-hour prose", () => {
    expectRejected(
      { team: { business_hours: { start: "9am" } } },
      "team.business_hours.start",
    );
  });

  test("rejects an impossible clock time", () => {
    expectRejected(
      { team: { business_hours: { end: "25:00" } } },
      "team.business_hours.end",
    );
    expectRejected(
      { team: { business_hours: { end: "12:60" } } },
      "team.business_hours.end",
    );
  });

  test("accepts a real IANA zone", () => {
    expect(issues({ team: { timezone: "America/Los_Angeles" } })).toEqual([]);
    expect(issues({ team: { timezone: "UTC" } })).toEqual([]);
  });

  test("rejects a zone abbreviation that Intl cannot resolve", () => {
    expectRejected({ team: { timezone: "Pacific Time" } }, "team.timezone");
    expectRejected({ team: { timezone: "America/Nowhere" } }, "team.timezone");
  });

  test("rejects a weekday spelled out", () => {
    expectRejected(
      { team: { business_hours: { days: ["monday"] } } },
      "team.business_hours.days.0",
    );
    expect(
      issues({ team: { business_hours: { days: ["mon", "fri"] } } }),
    ).toEqual([]);
  });
});

describe("URLs", () => {
  test('"" means unconfigured', () => {
    expect(issues({ integrations: { jira: { base_url: "" } } })).toEqual([]);
  });

  test("rejects a hostname with no scheme", () => {
    expectRejected(
      { integrations: { jira: { base_url: "jira.example.com" } } },
      "integrations.jira.base_url",
    );
  });

  test("rejects a placeholder left in a webhook", () => {
    expectRejected(
      { integrations: { slack: { webhook_url: "<your-webhook-here>" } } },
      "integrations.slack.webhook_url",
    );
  });
});

describe("enums pin the values the wizard actually offers", () => {
  test("canonical_group.mode accepts every schema-questions option", () => {
    for (const mode of [
      "none",
      "manual_list",
      "slack_user_group",
      "google_group",
      "",
    ]) {
      expect(issues({ team: { canonical_group: { mode } } })).toEqual([]);
    }
  });

  test("canonical_group.mode rejects an invented mode", () => {
    expectRejected(
      { team: { canonical_group: { mode: "ldap" } } },
      "team.canonical_group.mode",
    );
  });

  test("debug.log_level rejects an unknown level", () => {
    expect(issues({ debug: { log_level: "debug" } })).toEqual([]);
    expectRejected({ debug: { log_level: "verbose" } }, "debug.log_level");
  });

  test("session.default_gbrain_target rejects an unknown target", () => {
    expectRejected(
      { session: { default_gbrain_target: "shared" } },
      "session.default_gbrain_target",
    );
  });

  test("canonical_group.google_group_email must be an email when set", () => {
    expect(
      issues({ team: { canonical_group: { google_group_email: "" } } }),
    ).toEqual([]);
    expectRejected(
      { team: { canonical_group: { google_group_email: "not-an-email" } } },
      "team.canonical_group.google_group_email",
    );
  });
});

describe("report branding renders straight into HTML", () => {
  test("accepts hex colours", () => {
    expect(
      issues({
        reports: { branding: { colors: { main: "#1a73e8", text: "#000" } } },
      }),
    ).toEqual([]);
  });

  test("rejects a CSS colour name", () => {
    expectRejected(
      { reports: { branding: { colors: { main: "cornflowerblue" } } } },
      "reports.branding.colors.main",
    );
  });

  test("rejects a malformed hex", () => {
    expectRejected(
      { reports: { branding: { colors: { main: "#12345" } } } },
      "reports.branding.colors.main",
    );
  });

  test("rejects an unknown density", () => {
    expectRejected(
      { reports: { branding: { density: "tight" } } },
      "reports.branding.density",
    );
  });
});

describe("previously-undescribed sections are now typed", () => {
  test("evals.token_budgets values must be positive numbers", () => {
    expect(issues({ evals: { token_budgets: { recon: 5000 } } })).toEqual([]);
    expectRejected(
      { evals: { token_budgets: { recon: "5000" } } },
      "evals.token_budgets.recon",
    );
    expectRejected(
      { evals: { token_budgets: { recon: 0 } } },
      "evals.token_budgets.recon",
    );
  });

  test("approval_chains.chains values must be arrays of strings", () => {
    expect(
      issues({ approval_chains: { chains: { default: ["a", "b"] } } }),
    ).toEqual([]);
    expectRejected(
      { approval_chains: { chains: { default: "a,b" } } },
      "approval_chains.chains.default",
    );
  });

  test("jira_rules.max_story_points must be a positive integer", () => {
    expectRejected(
      { jira_rules: { max_story_points: 0 } },
      "jira_rules.max_story_points",
    );
  });

  test("engineering_health.stale_pr_days rejects a string", () => {
    expectRejected(
      { engineering_health: { stale_pr_days: "7" } },
      "engineering_health.stale_pr_days",
    );
  });

  test("weekly_digest.window_days rejects a negative window", () => {
    expectRejected(
      { weekly_digest: { window_days: -7 } },
      "weekly_digest.window_days",
    );
  });

  test("pe.reporting_window_days rejects a fractional value", () => {
    expectRejected(
      { pe: { reporting_window_days: 30.5 } },
      "pe.reporting_window_days",
    );
  });
});

describe("formatConfigIssues", () => {
  test("renders dotted paths, not JSON blobs", () => {
    const found = issues({ routines: { standup: { cron: "nope" } } });
    expect(found[0]).toStartWith("routines.standup.cron: ");
    expect(found[0]).not.toContain("{");
  });

  test("labels a root-level failure as (root)", () => {
    const r = JstackConfigSchema.safeParse("not an object");
    expect(r.success).toBe(false);
    if (!r.success)
      expect(formatConfigIssues(r.error)[0]).toStartWith("(root): ");
  });

  test("reports every issue, not just the first", () => {
    const found = issues({
      sprint: { cadence_weeks: "2", velocity_window: "3" },
    });
    expect(found.length).toBe(2);
  });
});

describe("constraints carried over from the previous hand-written schema.json", () => {
  // The old file had `persona_threshold: {minimum:1, maximum:4}`. There are exactly four personas
  // (CEO/PM/ENG/QA), so a threshold of 5 can never be met — every edit is silently rejected.
  test("persona_threshold is bounded by the number of personas", () => {
    expect(issues({ claude_md_improver: { persona_threshold: 3 } })).toEqual(
      [],
    );
    expect(issues({ claude_md_improver: { persona_threshold: 4 } })).toEqual(
      [],
    );
    expectRejected(
      { claude_md_improver: { persona_threshold: 5 } },
      "claude_md_improver.persona_threshold",
    );
    expectRejected(
      { claude_md_improver: { persona_threshold: 0 } },
      "claude_md_improver.persona_threshold",
    );
  });
});
