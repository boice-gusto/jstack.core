import { describe, expect, test } from "bun:test";
import { mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { resolvePersona, SOUL_FILE_NAME } from "./persona.js";

function workspace(): string {
  return mkdtempSync(join(tmpdir(), "crew-persona-test-"));
}

describe("resolvePersona: fallback to the inline string", () => {
  test("no persona_file at all -- returns the inline persona", () => {
    const ws = workspace();
    expect(resolvePersona({ persona: "Answer tersely.", workspace: ws })).toBe(
      "Answer tersely.",
    );
  });

  test("no persona_file and no inline persona -- returns the empty default", () => {
    const ws = workspace();
    expect(resolvePersona({ persona: "", workspace: ws })).toBe("");
  });
});

describe("resolvePersona: persona_file wins when set and readable", () => {
  test("reads SOUL.md at the workspace root, trimmed", () => {
    const ws = workspace();
    writeFileSync(join(ws, SOUL_FILE_NAME), "\nYou are gruff but thorough.\n");
    expect(
      resolvePersona({
        persona: "ignored inline text",
        persona_file: SOUL_FILE_NAME,
        workspace: ws,
      }),
    ).toBe("You are gruff but thorough.");
  });

  test("a persona_file under a different name still resolves relative to workspace", () => {
    const ws = workspace();
    writeFileSync(join(ws, "persona.md"), "Curious and concise.");
    expect(
      resolvePersona({
        persona: "",
        persona_file: "persona.md",
        workspace: ws,
      }),
    ).toBe("Curious and concise.");
  });

  test("an absolute persona_file path is used as-is, not joined to workspace", () => {
    const ws = workspace();
    const outside = mkdtempSync(join(tmpdir(), "crew-persona-outside-"));
    const absPath = join(outside, "SOUL.md");
    writeFileSync(absPath, "Lives outside the workspace.");
    expect(
      resolvePersona({ persona: "", persona_file: absPath, workspace: ws }),
    ).toBe("Lives outside the workspace.");
  });

  test("persona_file set but missing throws a clear error, not a silent empty persona", () => {
    const ws = workspace();
    expect(() =>
      resolvePersona({
        persona: "fallback that must NOT be silently used",
        persona_file: SOUL_FILE_NAME,
        workspace: ws,
      }),
    ).toThrow(/persona_file/);
  });

  test("the thrown error names the resolved path, so a typo'd filename is diagnosable", () => {
    const ws = workspace();
    try {
      resolvePersona({ persona: "", persona_file: "SOAL.md", workspace: ws });
      throw new Error("expected resolvePersona to throw");
    } catch (e) {
      expect((e as Error).message).toContain("SOAL.md");
      expect((e as Error).message).toContain(ws);
    }
  });
});
