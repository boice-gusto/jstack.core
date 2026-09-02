import { afterEach, describe, expect, test } from "bun:test";
import { chmodSync, mkdtempSync, readFileSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import {
  formatJstackNotification,
  listIntegrations,
  sendJstackSlackNotification,
} from "./integrations.js";
import { CrewConfigSchema, type CrewConfig } from "./types.js";

function baseConfig(overrides: Record<string, unknown> = {}): CrewConfig {
  return CrewConfigSchema.parse({
    enabled: true,
    mode: "dry_run",
    slack: { self_user_id: "U0TESTUSER1" },
    agents: {
      ralph: { name: "Ralph", sigils: ["!ralph"], workspace: "/tmp/ws" },
    },
    policy: {
      ingress: { channels: ["D0TESTDM001"], authors: ["U0TESTUSER1"] },
      egress: { channels: ["D0TESTDM001"] },
    },
    ...overrides,
  });
}

function installFakeClaude(mcpListOutput: string): { restorePath: string } {
  const dir = mkdtempSync(join(tmpdir(), "fake-claude-integrations-"));
  writeFileSync(
    join(dir, "claude"),
    [
      "#!/bin/sh",
      `if [ "$1" = "mcp" ]; then echo "${mcpListOutput}"; exit 0; fi`,
      "exit 1",
    ].join("\n"),
  );
  chmodSync(join(dir, "claude"), 0o755);
  const restorePath = process.env.PATH ?? "";
  process.env.PATH = `${dir}:${restorePath}`;
  return { restorePath };
}

/** Records the Slack-send call's argv so a test can assert on the exact message text sent. */
function installFakeClaudeCapturingSend(): {
  restorePath: string;
  argvFile: string;
} {
  const dir = mkdtempSync(join(tmpdir(), "fake-claude-integrations-send-"));
  const argvFile = join(dir, "argv.txt");
  writeFileSync(
    join(dir, "claude"),
    [
      "#!/bin/sh",
      `printf '%s\\n' "$@" > ${argvFile}`,
      'echo \'{"is_error":false,"result":"{\\"message_ts\\": \\"1700000000.123456\\"}","total_cost_usd":0.0005}\'',
    ].join("\n"),
  );
  chmodSync(join(dir, "claude"), 0o755);
  const restorePath = process.env.PATH ?? "";
  process.env.PATH = `${dir}:${restorePath}`;
  return { restorePath, argvFile };
}

describe("formatJstackNotification", () => {
  test("matches the standard '[emoji] - message - sent by jstack' template", () => {
    expect(formatJstackNotification("🤖", "Here's your update")).toBe(
      "🤖 - Here's your update - sent by jstack",
    );
  });
});

describe("sendJstackSlackNotification", () => {
  let restorePath: string | undefined;
  afterEach(() => {
    if (restorePath !== undefined) process.env.PATH = restorePath;
  });

  test("sends the formatted template text through the same Slack MCP call sendMessage uses", async () => {
    const fake = installFakeClaudeCapturingSend();
    restorePath = fake.restorePath;

    const result = await sendJstackSlackNotification(
      "D0MYDM001",
      "🤖",
      "Here's your update",
    );
    expect(result.ok).toBe(true);

    const argv = readFileSync(fake.argvFile, "utf8");
    expect(argv).toContain("D0MYDM001");
    expect(argv).toContain("Here's your update - sent by jstack");
  });
});

describe("listIntegrations", () => {
  let restorePath: string | undefined;
  afterEach(() => {
    if (restorePath !== undefined) process.env.PATH = restorePath;
  });

  test("reports slack-dm as configured when crew is enabled with a non-empty ingress scope", () => {
    restorePath = installFakeClaude("no mcp servers here").restorePath;
    const [slack] = listIntegrations(baseConfig());
    expect(slack).toMatchObject({ id: "slack-dm", configured: true });
  });

  test("reports not configured when crew.enabled is false", () => {
    restorePath = installFakeClaude("no mcp servers here").restorePath;
    const [slack] = listIntegrations(baseConfig({ enabled: false }));
    expect(slack!.configured).toBe(false);
  });

  test("reports not configured when ingress has no authors (nothing scoped to 'only your user')", () => {
    restorePath = installFakeClaude("no mcp servers here").restorePath;
    const [slack] = listIntegrations(
      baseConfig({
        policy: {
          ingress: { channels: ["D0TESTDM001"], authors: [] },
          egress: { channels: ["D0TESTDM001"] },
        },
      }),
    );
    expect(slack!.configured).toBe(false);
  });

  test("mcpAvailable is true when `claude mcp list` reports a slack-named server", () => {
    restorePath = installFakeClaude(
      "claude-ai-slack: configured and running",
    ).restorePath;
    const [slack] = listIntegrations(baseConfig());
    expect(slack!.mcpAvailable).toBe(true);
  });

  test("mcpAvailable is false when `claude mcp list` reports no slack server", () => {
    restorePath = installFakeClaude(
      "github: configured and running",
    ).restorePath;
    const [slack] = listIntegrations(baseConfig());
    expect(slack!.mcpAvailable).toBe(false);
  });

  test("mcpAvailable is false and a detail is set when claude isn't on PATH at all", () => {
    const savedPath = process.env.PATH;
    process.env.PATH = "/definitely/not/a/real/path";
    const [slack] = listIntegrations(baseConfig());
    expect(slack!.mcpAvailable).toBe(false);
    expect(slack!.mcpDetail).toContain("not found");
    process.env.PATH = savedPath;
  });
});
