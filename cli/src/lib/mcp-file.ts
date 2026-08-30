import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";

/** Narrow a possibly-untrusted value to a plain object record, or undefined. */
function asRecord(v: unknown): Record<string, unknown> | undefined {
  return v && typeof v === "object" && !Array.isArray(v)
    ? (v as Record<string, unknown>)
    : undefined;
}

/**
 * Reads `.mcp.json`'s `mcpServers` map, or `null` if the file is missing OR malformed.
 * Values are untrusted (this file may not have gone through any schema validation) — callers
 * must narrow each entry themselves via `isMockMcpServerEntry`/`mcpServerEnvString` below,
 * rather than trusting a server's shape directly.
 */
export function readMcpServers(
  projectRoot: string,
): Record<string, unknown> | null {
  const mcpPath = join(projectRoot, ".mcp.json");
  if (!existsSync(mcpPath)) return null;
  try {
    const raw = JSON.parse(readFileSync(mcpPath, "utf8")) as Record<
      string,
      unknown
    >;
    return asRecord(raw?.mcpServers) ?? {};
  } catch {
    return null;
  }
}

/** True when a `.mcp.json` server entry is the jstack-mock fixture server. */
export function isMockMcpServerEntry(key: string, specRaw: unknown): boolean {
  if (key.toLowerCase() === "jstack-mock") return true;
  const spec = asRecord(specRaw);
  const args = Array.isArray(spec?.args) ? (spec.args as unknown[]) : [];
  return args.some((a) => String(a).includes("mcp-mock/server"));
}

/** Reads a trimmed, non-empty string env var off a `.mcp.json` server entry, or undefined. */
export function mcpServerEnvString(
  specRaw: unknown,
  key: string,
): string | undefined {
  const spec = asRecord(specRaw);
  const env = asRecord(spec?.env);
  const v = env?.[key];
  if (typeof v !== "string") return undefined;
  const trimmed = v.trim();
  return trimmed.length > 0 ? trimmed : undefined;
}
