/**
 * Tests the onboarding wizard's config-generation logic against the REAL source in
 * `wizard.html`. The wizard must stay a single self-contained file (it is opened via
 * `file://`, with no build step), so instead of importing a module we slice the pure
 * logic out of the inline <script> and run it with a stubbed `$()` DOM accessor.
 *
 * This guards the parts that would silently corrupt a user's config: omitting keys the
 * user never answered, keeping personal URLs out of a committed team config, and
 * refusing anything that looks like a credential.
 */
import { describe, expect, test } from "bun:test";
import { readFileSync } from "node:fs";
import { join } from "node:path";

const WIZARD = join(import.meta.dir, "wizard.html");

type Answers = Record<string, string | boolean>;

interface Built {
  cfg: Record<string, any>;
  personal: Record<string, any>;
}
type Harness = {
  buildConfigs: () => Built;
  validate: (cfg: Record<string, any>) => { errs: string[]; warns: string[] };
};

/** Extract the wizard's pure logic and bind it to a fake DOM backed by `answers`. */
function harness(answers: Answers): Harness {
  const html = readFileSync(WIZARD, "utf8");
  const script = html.match(/<script>([\s\S]*)<\/script>/)?.[1];
  if (!script) throw new Error("wizard.html: no inline <script> found");

  // Slice from the integrations data through the end of validate() — the pure core.
  const start = script.indexOf("const INTEGRATIONS =");
  const endMarker = "let current = 0;";
  const end = script.indexOf(endMarker);
  if (start === -1 || end === -1 || end < start) {
    throw new Error("wizard.html: logic markers moved; update onboarding/wizard.test.ts");
  }
  const logic = script.slice(start, end);

  // The sliced region includes a DOM-building IIFE. Rather than narrow the slice (which
  // would break whenever the script is reordered), give it inert stubs: every node
  // supports the handful of operations the wizard performs, and `$` reports answers.
  const node = (): any =>
    new Proxy(
      {
        value: "",
        checked: false,
        innerHTML: "",
        textContent: "",
        style: {},
        append: () => {},
        classList: { toggle: () => {}, add: () => {}, remove: () => {} },
        setAttribute: () => {},
        addEventListener: () => {},
      },
      { get: (t, k) => (k in t ? (t as any)[k] : () => {}) },
    );

  const $ = (id: string) => {
    const n = node();
    if (id in answers) {
      const v = answers[id];
      if (typeof v === "boolean") n.checked = v;
      else n.value = v;
    }
    return n;
  };
  const el = (_tag: string, props: any = {}) => Object.assign(node(), props);
  const document = {
    createElement: () => node(),
    querySelectorAll: () => [] as unknown[],
    getElementById: $,
    addEventListener: () => {},
  };

  // `render` is declared past the slice; the IIFE wires it to change handlers.
  const render = () => {};

  const factory = new Function(
    "$",
    "el",
    "document",
    "render",
    `${logic}; return { buildConfigs, validate, INTEGRATIONS, ROUTINES };`,
  );
  return factory($, el, document, render) as Harness;
}

describe("onboarding wizard — config generation", () => {
  test("omits every key the user did not answer", () => {
    const { cfg } = harness({ teamName: "Platform" }).buildConfigs();
    expect(cfg.team).toEqual({ name: "Platform" });
    // Unanswered sections must be absent entirely, not present-and-empty.
    expect(cfg.integrations).toBeUndefined();
    expect(cfg.knowledge_base).toBeUndefined();
    expect(cfg.gbrain).toBeUndefined();
    expect(cfg.routines).toBeUndefined();
    expect(cfg.telemetry).toBeUndefined();
    expect(cfg.sprint).toBeUndefined();
  });

  test("records an onboarding block so readiness checks have a signal", () => {
    const { cfg } = harness({ teamName: "Platform" }).buildConfigs();
    expect(cfg.onboarding.complete).toBe(false);
    expect(typeof cfg.onboarding.wizard_last_run).toBe("string");
    expect(Array.isArray(cfg.onboarding.required_integrations)).toBe(true);
  });

  test("includes only checked integrations, with their filled fields", () => {
    const { cfg } = harness({
      teamName: "Platform",
      use_jira: true,
      jira_project_key: "ABC",
      jira_base_url: "https://example.invalid",
      use_slack: false,
    }).buildConfigs();

    expect(Object.keys(cfg.integrations)).toEqual(["jira"]);
    expect(cfg.integrations.jira).toEqual({
      project_key: "ABC",
      base_url: "https://example.invalid",
    });
    expect(cfg.onboarding.required_integrations).toContain("jira");
  });

  test("an enabled integration with no details still registers", () => {
    const { cfg } = harness({ teamName: "P", use_gcal: true }).buildConfigs();
    expect(cfg.integrations.gcal).toEqual({});
  });

  test("splits knowledge roots on newlines and drops blank lines", () => {
    const { cfg } = harness({
      teamName: "P",
      kbRoots: "./docs\n\n  ./notes  \n",
    }).buildConfigs();
    expect(cfg.knowledge_base.roots).toEqual(["./docs", "./notes"]);
  });

  test("shared profile keeps the personal URL OUT of the team config", () => {
    const { cfg, personal } = harness({
      teamName: "P",
      profile: "shared",
      gbTeam: "https://example.invalid/team",
      gbPersonal: "https://example.invalid/me",
    }).buildConfigs();

    expect(cfg.gbrain.team).toBe("https://example.invalid/team");
    expect(cfg.gbrain.personal).toBeUndefined();
    expect(personal.gbrain.personal).toBe("https://example.invalid/me");
    // Belt and braces: the personal URL must not appear anywhere in the committed blob.
    expect(JSON.stringify(cfg)).not.toContain("example.invalid/me");
  });

  test("individual profile keeps both URLs in one local config", () => {
    const { cfg, personal } = harness({
      teamName: "P",
      profile: "ic",
      gbPersonal: "https://example.invalid/me",
    }).buildConfigs();
    expect(cfg.gbrain.personal).toBe("https://example.invalid/me");
    expect(personal.gbrain).toBeUndefined();
  });

  test("routines are opt-in", () => {
    const { cfg } = harness({ teamName: "P", rt_standup: true }).buildConfigs();
    expect(cfg.routines).toEqual({ standup: { enabled: true } });
  });
});

describe("onboarding wizard — validation", () => {
  const v = (cfg: Record<string, any>) => harness({}).validate(cfg);

  test("team name is required", () => {
    expect(v({}).errs.join(" ")).toMatch(/Team name is required/);
    expect(v({ team: { name: "P" } }).errs).toEqual([]);
  });

  test("flags a non-IANA timezone as a warning, not an error", () => {
    const r = v({ team: { name: "P", timezone: "PST" } });
    expect(r.errs).toEqual([]);
    expect(r.warns.join(" ")).toMatch(/IANA/);
  });

  test("accepts a real IANA timezone", () => {
    expect(v({ team: { name: "P", timezone: "America/Los_Angeles" } }).warns).toEqual([]);
  });

  test("warns when the default target has no matching URL", () => {
    const r = v({ team: { name: "P" }, session: { default_gbrain_target: "team" } });
    expect(r.warns.join(" ")).toMatch(/no team knowledge base URL/);
  });

  test("warns on a non-http knowledge base URL", () => {
    const r = v({ team: { name: "P" }, gbrain: { team: "example.invalid" } });
    expect(r.warns.join(" ")).toMatch(/http\(s\) URL/);
  });

  // The important one: a pasted credential must be a hard error, never a warning.
  test.each([
    ["github token", "ghp_abcdefghijklmnopqrstuvwxyz0123456789"],
    ["slack bot token", "xoxb-123456789-abcdefghijklmnop"],
    ["api key", "sk-abcdefghijklmnopqrstuvwx"],
  ])("rejects a pasted %s as an error", (_label, secret) => {
    const r = v({ team: { name: "P" }, integrations: { jira: { base_url: secret } } });
    expect(r.errs.join(" ")).toMatch(/looks like a token/);
  });

  test("does not false-positive on ordinary values", () => {
    const r = v({
      team: { name: "Platform Engineering" },
      integrations: { jira: { project_key: "ABC", base_url: "https://example.invalid" } },
    });
    expect(r.errs).toEqual([]);
  });

  // Confirmed bypasses of the original regex `/(?:ghp_|xox[baprs]-|sk-[A-Za-z0-9]{16,})/`.
  // Each of these slipped past the old validator undetected before the fix.
  test.each([
    ["github fine-grained PAT", "github_pat_11AAAAAAA0aaaaaaaaaaaa_aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa"],
    ["github oauth token (gho_)", "gho_16CharactersXXXXXXXXXXXXXXXXX"],
    ["github user-to-server token (ghu_)", "ghu_16CharactersXXXXXXXXXXXXXXXXX"],
    ["github server-to-server token (ghs_)", "ghs_16CharactersXXXXXXXXXXXXXXXXX"],
    ["github refresh token (ghr_)", "ghr_16CharactersXXXXXXXXXXXXXXXXX"],
    ["atlassian api token", "ATATT3xFfGF0T1eXaMpLeToKeNvAlUe1234567890ABCDEF"],
    ["slack app-level token", "xapp-1-A0123456789-1234567890123-abcdef0123456789abcdef0123456789abcdef0123456789abcdef01234567"],
    ["aws access key id", "AKIAIOSFODNN7EXAMPLE"],
    ["aws temporary access key id", "ASIAIOSFODNN7EXAMPLE"],
    ["google api key", "AIzaSyD9tSrke72PouQMnMXa7eZSW0jkFMBWY12"],
    ["openai project key (sk-proj-)", "sk-proj-abcdefghijklmnopqrstuvwxyz0123456789ABCDEF"],
    ["anthropic api key (sk-ant-)", "sk-ant-api03-abcdefghijklmnopqrstuvwxyz0123456789ABCDEFGHIJKLMN"],
    ["jwt", "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiIxMjM0NTY3ODkwIiwibmFtZSI6IkpvaG4gRG9lIn0.dozjgNryP4J3jVmNHl0w5N_XgL0n3I9PlFUP0THsR8U"],
    ["pem private key block", "-----BEGIN PRIVATE KEY-----\nMIIEvQIBADANBgkqhkiG9w0BAQEFAASCBKcwggSjAgEAAoIBAQC\n-----END PRIVATE KEY-----"],
    ["pem rsa private key block", "-----BEGIN RSA PRIVATE KEY-----\nMIIEvQIBADANBgkqhkiG9w0BAQEFAASCBKcwggSjAgEAAoIBAQC\n-----END RSA PRIVATE KEY-----"],
    ["uppercased github token (casing trick)", "GHP_abcdefghijklmnopqrstuvwxyz0123456789"],
    ["zero-width-space split token (obfuscation trick)", "gh\u200bp_abcdefghijklmnopqrstuvwxyz0123456789"],
    ["generic high-entropy mixed-case secret", "K7gN3xTt7qJ7dFj4mE9pQ2wZ8yB1cV6nR0sU5aH3lP9oI2uXyZ0"],
  ])("rejects a smuggled %s as an error", (_label, secret) => {
    const r = v({ team: { name: "P" }, integrations: { jira: { base_url: secret } } });
    expect(r.errs.join(" ")).toMatch(/looks like a token/);
  });

  test("rejects a credential split across an embedded newline", () => {
    // Simulates a paste that lands as a single string containing a real line break —
    // JSON.stringify turns that into a literal `\n` inside the serialized blob, which
    // must not be enough to break a length-gated pattern like `sk-...`.
    const secret = "sk-ant-api03-abcd\nefgh1234567890123456";
    const r = v({ team: { name: "P" }, integrations: { jira: { base_url: secret } } });
    expect(r.errs.join(" ")).toMatch(/looks like a token/);
  });

  test("does not false-positive on a Notion-shaped 32-hex database id", () => {
    const r = v({
      team: { name: "Platform Engineering" },
      integrations: { notion: { parent_page_id: "0123456789abcdef0123456789abcdef" } },
    });
    expect(r.errs).toEqual([]);
  });

  test("does not false-positive on other plain identifiers", () => {
    const r = v({
      team: { name: "Platform Engineering", timezone: "America/Los_Angeles" },
      integrations: {
        github: { org: "your-org", default_repo: "your-repo" },
        slack: { default_channel: "#team-updates" },
      },
      gbrain: { team: "https://example.invalid/team" },
    });
    expect(r.errs).toEqual([]);
  });
});
