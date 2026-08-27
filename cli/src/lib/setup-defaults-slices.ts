import { z } from "zod";
import { McpRegistrySchema, type McpRegistry } from "../types/mcp-registry.js";
import { JstackConfigSchema } from "../types/config.js";

function isPlainObject(x: unknown): x is Record<string, unknown> {
  return typeof x === "object" && x !== null && !Array.isArray(x);
}

/** Narrow unknown to a plain object for mergeDeep; non-objects become {}. */
export function asRecord(x: unknown): Record<string, unknown> {
  return isPlainObject(x) ? x : {};
}

/**
 * Parsed via the canonical `gbrain`/`knowledge_base` sections `config.ts` already enforces,
 * rather than a second, separately hand-maintained pair of narrow schemas (`GbrainSliceSchema`/
 * `KnowledgeBaseSliceSchema`, removed here) that could silently drift from what `config.ts`
 * actually validates. Both canonical sections are `.passthrough()`, so the parsed value keeps
 * unknown keys and can serve directly as a `mergeDeep` base -- no separate untyped
 * `Record<string, unknown>` copy needed just to avoid losing them (the old `defGbrain`/`defKb`/
 * `defKbGbrain` fields this module used to also expose).
 */
export type GbrainSlice = NonNullable<
  z.infer<typeof JstackConfigSchema.shape.gbrain>
>;
export type KnowledgeBaseSlice = NonNullable<
  z.infer<typeof JstackConfigSchema.shape.knowledge_base>
>;

export type SetupDefaultsSlices = {
  defSession: Record<string, unknown>;
  defKs: Record<string, unknown>;
  defPe: Record<string, unknown>;
  defaultsTeam: Record<string, unknown>;
  defaultGbrain: GbrainSlice;
  defaultKb: KnowledgeBaseSlice;
  mcpExisting: McpRegistry | undefined;
};

/**
 * Narrow `defaults.json` sections used by setup without casting the full tree to JstackConfig.
 */
export function extractSetupSlices(
  defaults: Record<string, unknown>,
): SetupDefaultsSlices {
  const defSession = asRecord(defaults.session);
  const defKs = asRecord(defaults.knowledge_storage);
  const defPe = asRecord(defaults.pe);
  const defaultsTeam = asRecord(defaults.team);

  const gbrainParsed = JstackConfigSchema.shape.gbrain.safeParse(
    defaults.gbrain,
  );
  const defaultGbrain: GbrainSlice =
    gbrainParsed.success && gbrainParsed.data ? gbrainParsed.data : {};

  const kbParsed = JstackConfigSchema.shape.knowledge_base.safeParse(
    defaults.knowledge_base,
  );
  const defaultKb: KnowledgeBaseSlice =
    kbParsed.success && kbParsed.data ? kbParsed.data : {};

  const mcpParsed = McpRegistrySchema.safeParse(defaults.mcp_servers);
  const mcpExisting: McpRegistry | undefined = mcpParsed.success
    ? mcpParsed.data
    : undefined;

  return {
    defSession,
    defKs,
    defPe,
    defaultsTeam,
    defaultGbrain,
    defaultKb,
    mcpExisting,
  };
}
