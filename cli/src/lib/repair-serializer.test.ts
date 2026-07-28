import { describe, expect, it } from "bun:test";
import type { DependencyIssue } from "./dependency-resolver.js";
import { deserializeRepairs, serializeRepairs } from "./repair-serializer.js";

function sampleIssues(): DependencyIssue[] {
  return [
    {
      id: "kb-root-missing",
      configPath: ["knowledge_base", "roots"],
      severity: "error",
      message: "root missing on disk",
      repairs: [{ kind: "mkdir", path: "/tmp/docs" }],
    },
    {
      id: "notion-template-set-custom-missing",
      configPath: ["notion_defaults", "template_set"],
      severity: "warn",
      message: "custom catalog missing",
      repairs: [
        { kind: "write_file", path: "/tmp/catalog.json", content: '{"templates":[]}', ifMissing: true },
      ],
    },
    {
      id: "gbrain-target-empty-url",
      configPath: ["gbrain", "team", "url"],
      severity: "warn",
      message: "gbrain url empty",
      repairs: [{ kind: "set_config", path: ["gbrain", "team", "url"], value: "" }],
    },
    {
      id: "mcp-mock-missing",
      configPath: ["debug", "mock_mcp"],
      severity: "warn",
      message: "mock mcp missing",
      repairs: [{ kind: "shell_hint", cmd: "jstack mcp add jstack-mock", reason: "register mock server" }],
    },
  ];
}

describe("repair-serializer", () => {
  it("round-trips all four repair kinds", () => {
    const issues = sampleIssues();
    const back = deserializeRepairs(serializeRepairs(issues));
    expect(back).toEqual(issues);
  });

  it("round-trips an empty array", () => {
    const back = deserializeRepairs(serializeRepairs([]));
    expect(back).toEqual([]);
  });

  it("serialized output is valid JSON", () => {
    const json = serializeRepairs(sampleIssues());
    expect(() => JSON.parse(json)).not.toThrow();
  });

  it("throws TypeError with 'JSON parse failed' on invalid JSON", () => {
    expect(() => deserializeRepairs("not json {{{")).toThrow(TypeError);
    expect(() => deserializeRepairs("not json {{{")).toThrow(/JSON parse failed/);
  });

  it("throws TypeError with 'schema validation failed' on wrong shape", () => {
    const bad = JSON.stringify([{ id: 123, severity: "error" }]);
    expect(() => deserializeRepairs(bad)).toThrow(TypeError);
    expect(() => deserializeRepairs(bad)).toThrow(/schema validation failed/);
  });

  it("mkdir repair round-trips correctly", () => {
    const issues: DependencyIssue[] = [
      {
        id: "t",
        configPath: ["a"],
        severity: "error",
        message: "t",
        repairs: [{ kind: "mkdir", path: "/tmp/test" }],
      },
    ];
    const back = deserializeRepairs(serializeRepairs(issues));
    expect(back[0]!.repairs[0]).toEqual({ kind: "mkdir", path: "/tmp/test" });
  });

  it("write_file repair round-trips correctly", () => {
    const issues: DependencyIssue[] = [
      {
        id: "t",
        configPath: ["a"],
        severity: "warn",
        message: "t",
        repairs: [{ kind: "write_file", path: "/tmp/x.json", content: '{"x":1}', ifMissing: true }],
      },
    ];
    const back = deserializeRepairs(serializeRepairs(issues));
    expect(back[0]!.repairs[0]).toEqual({
      kind: "write_file",
      path: "/tmp/x.json",
      content: '{"x":1}',
      ifMissing: true,
    });
  });

  it("set_config repair round-trips correctly", () => {
    const issues: DependencyIssue[] = [
      {
        id: "t",
        configPath: ["a"],
        severity: "warn",
        message: "t",
        repairs: [{ kind: "set_config", path: ["a", "b"], value: false }],
      },
    ];
    const back = deserializeRepairs(serializeRepairs(issues));
    expect(back[0]!.repairs[0]).toEqual({ kind: "set_config", path: ["a", "b"], value: false });
  });

  it("shell_hint repair round-trips correctly", () => {
    const issues: DependencyIssue[] = [
      {
        id: "t",
        configPath: ["a"],
        severity: "warn",
        message: "t",
        repairs: [{ kind: "shell_hint", cmd: "jstack setup", reason: "re-run setup" }],
      },
    ];
    const back = deserializeRepairs(serializeRepairs(issues));
    expect(back[0]!.repairs[0]).toEqual({ kind: "shell_hint", cmd: "jstack setup", reason: "re-run setup" });
  });
});
