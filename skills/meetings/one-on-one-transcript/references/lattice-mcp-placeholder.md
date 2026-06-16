# Lattice MCP (placeholder)

**jstack does not ship a Lattice MCP server.** This document describes how to wire one when your org provides or builds it, so **`jstack-meetings-one-on-one-transcript`** can prefer Lattice over Notion.

## When to use

Set in `jstack.config.json` (see `config/defaults.json` → `one_on_one_cycle`):

- `lattice.enabled`: `true`
- `lattice.mcp_server_label`: host-specific string that matches your MCP config (e.g. `lattice`, `lattice-hr`)

The agent should **discover tools** from the MCP descriptor folder (or host UI), not assume method names.

## Expected capabilities (illustrative)

Until an official server exists, treat these as **design targets** for your integration:

| Capability | Purpose |
|------------|---------|
| Resolve employee / manager context | Map “this 1:1” to the right Lattice profile or cycle |
| Create or update 1:1 note | Prep or after content, with structured fields if the product supports them |
| Attach provenance | Optional metadata that the body is AI-assisted (or rely on body footer from `ai_attribution`) |

Exact tool names and parameters are **vendor-defined**. Read schemas at runtime.

## Host registration

1. Add the MCP server to Cursor / Claude / your gateway per Lattice (or internal) docs.
2. Put the same label in `lattice.mcp_server_label` and under `mcp_servers` if your config tracks enablement.
3. If tools are missing or fail, **fall back to Notion** per the core skill (private `pe_index` vs `one_on_ones`).

## Security

- Transcripts and 1:1 notes are **high sensitivity**; use least-privilege tokens and org-approved retention.
- Do not log full transcript text in MCP or gateway logs.

## Related

- Config field reference: [`config-shape.md`](./config-shape.md)
- Notion path: **`jstack-notion-one-on-one`**
