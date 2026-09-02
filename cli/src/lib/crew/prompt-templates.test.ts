import { afterEach, describe, expect, test } from "bun:test";
import { mkdirSync, mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { renderWorkerSystemPrompt } from "./prompt-templates.js";

function withPluginRoot(templateBody: string): {
  root: string;
  restore: () => void;
} {
  const root = mkdtempSync(join(tmpdir(), "jstack-prompt-templates-"));
  mkdirSync(join(root, "prompts", "crew"), { recursive: true });
  writeFileSync(
    join(root, "prompts", "crew", "worker-system.md"),
    templateBody,
  );
  const saved = process.env.CLAUDE_PLUGIN_ROOT;
  process.env.CLAUDE_PLUGIN_ROOT = root;
  return {
    root,
    restore: () => {
      if (saved === undefined) delete process.env.CLAUDE_PLUGIN_ROOT;
      else process.env.CLAUDE_PLUGIN_ROOT = saved;
    },
  };
}

describe("renderWorkerSystemPrompt", () => {
  let restore: (() => void) | undefined;
  afterEach(() => {
    restore?.();
    restore = undefined;
  });

  test("substitutes every placeholder", () => {
    const fixture = withPluginRoot(
      "Hi {{AGENT_NAME}}. {{PERSONA_CLAUSE}}Nonce: {{NONCE}}. Limit: {{MAX_MESSAGE_CHARS}}.\n",
    );
    restore = fixture.restore;

    const result = renderWorkerSystemPrompt({
      agentName: "Ralph",
      personaClause: "Terse and direct. ",
      nonce: "abc123",
      maxMessageChars: 2000,
    });
    expect(result).toBe(
      "Hi Ralph. Terse and direct. Nonce: abc123. Limit: 2000.",
    );
  });

  test("an empty personaClause disappears cleanly, not as a literal placeholder", () => {
    const fixture = withPluginRoot(
      "Hi {{AGENT_NAME}}. {{PERSONA_CLAUSE}}Done.\n",
    );
    restore = fixture.restore;

    const result = renderWorkerSystemPrompt({
      agentName: "Ralph",
      personaClause: "",
      nonce: "n",
      maxMessageChars: 1,
    });
    expect(result).toBe("Hi Ralph. Done.");
  });

  test("the real prompts/crew/worker-system.md file exists and renders without leftover placeholders", () => {
    // No withPluginRoot fixture here -- resolves the actual repo file, so a rename/deletion of
    // it (or a leftover {{PLACEHOLDER}} no caller ever fills) is caught here, not just in
    // production.
    const result = renderWorkerSystemPrompt({
      agentName: "Ralph",
      personaClause: "",
      nonce: "n",
      maxMessageChars: 2000,
    });
    expect(result).toContain("You are Ralph");
    expect(result).not.toMatch(/\{\{\w+\}\}/);
  });
});
