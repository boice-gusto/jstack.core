import { afterEach, describe, expect, test } from "bun:test";
import { chmodSync, mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { listMcpServersRaw } from "./mcp.js";

/** `mcpOutput` may contain real newlines -- printed with `printf '%s\n'` (one call per line,
 * via the shell's own arg splitting on IFS) rather than `echo`, whose backslash-escape handling
 * differs across /bin/sh implementations. */
function installFakeClaude(
  mcpOutput: string,
  mcpExitCode = 0,
): { restorePath: string } {
  const dir = mkdtempSync(join(tmpdir(), "fake-claude-mcp-"));
  writeFileSync(
    join(dir, "claude"),
    [
      "#!/bin/sh",
      'if [ "$1" = "mcp" ]; then',
      `  printf '%s\\n' '${mcpOutput.replace(/'/g, "'\\''")}'`,
      `  exit ${mcpExitCode}`,
      "fi",
      "exit 1",
    ].join("\n"),
  );
  chmodSync(join(dir, "claude"), 0o755);
  const restorePath = process.env.PATH ?? "";
  process.env.PATH = `${dir}:${restorePath}`;
  return { restorePath };
}

describe("listMcpServersRaw", () => {
  let restorePath: string | undefined;
  afterEach(() => {
    if (restorePath !== undefined) process.env.PATH = restorePath;
  });

  test("reports claudeFound: false and an error when claude isn't on PATH", () => {
    const savedPath = process.env.PATH;
    process.env.PATH = "/definitely/not/a/real/path";
    const result = listMcpServersRaw();
    expect(result).toMatchObject({
      ok: false,
      claudeFound: false,
      servers: [],
    });
    expect(result.error).toContain("not found");
    process.env.PATH = savedPath;
  });

  test("splits stdout into one server per non-empty line", () => {
    restorePath = installFakeClaude(
      "slack: connected\ngithub: connected",
    ).restorePath;
    const result = listMcpServersRaw();
    expect(result.ok).toBe(true);
    expect(result.servers).toEqual(["slack: connected", "github: connected"]);
  });

  test("reports ok: false with claude's stderr as the error when the command fails", () => {
    restorePath = installFakeClaude("", 1).restorePath;
    const result = listMcpServersRaw();
    expect(result.ok).toBe(false);
    expect(result.claudeFound).toBe(true);
    expect(result.servers).toEqual([]);
  });

  test("an empty server list is reported as ok with zero servers, not an error", () => {
    restorePath = installFakeClaude("").restorePath;
    const result = listMcpServersRaw();
    expect(result).toMatchObject({ ok: true, servers: [] });
  });
});
