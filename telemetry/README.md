<p align="center">
  <img src="../assets/logo-placeholder.png" alt="jstack" width="240" height="240" />
</p>

# jstack telemetry (opt-in)

Anonymous usage metrics only: skill name, token counts, latency, success, optional gate results, optional 1–5 satisfaction. **No PII**, no prompts, no file contents, no repository paths that identify individuals.

- **Default:** off. Enable in `jstack.config.json` → `telemetry.enabled` and/or during `jstack setup`.
- **Machine id:** `~/.jstack/telemetry-instance-id` (UUID). Receivers see a short **`telemetry_instance_hash`** derived from it — not the raw UUID. See `instance-id.ts`.
- **Eval telemetry (separate):** opt-in via `JSTACK_TELEMETRY=1`; **append-only JSONL** default path `~/.jstack/telemetry.jsonl`. Privacy + Notion-ready copy: [`docs/TELEMETRY_NOTION.md`](../docs/TELEMETRY_NOTION.md), field table: [`docs/TELEMETRY.md`](../docs/TELEMETRY.md).
- **Endpoint:** your own receiver URL; the collector in `sender.ts` **no-ops** when `telemetry.endpoint` is unset, so there is no silent third-party exfil.
- **Contract:** `schema.ts` defines the Zod shape; keep client and any server receiver in lockstep on schema version.

## CLI

- `jstack telemetry status` / `flush` — buffer and config.
- `jstack telemetry test` — one anonymous self-test line to `~/.jstack/jstack.telemetry.selftest.jsonl` and path summary (no remote required).
- Full help: `jstack --help-json` for structured metadata.

## Implementation layout

| File | Role |
|------|------|
| `schema.ts` | Zod (or shared types) for payloads |
| `collector.ts` / `sender.ts` | Batch and send with backoff; respect disabled flag |
| `cli.ts` | User-facing buffer commands |

## Operating a receiver (optional)

1. Run an HTTP endpoint that accepts the schema in `schema.ts` (and validates server-side).
2. Set `telemetry.endpoint` in config to that URL.
3. Test with a single synthetic event before enabling in production orgs.

## `scripts/telemetry-drain.sh`

Reference implementation stub for a future HTTP **drain** or batch uploader. Replace or wire to your own pipeline; do not commit secrets. See root [`docs/MARKDOWN_SYSTEM.md`](../docs/MARKDOWN_SYSTEM.md) for where this fits vs plugin `SKILL.md` docs.

## Markdown note

This README is for **operators and contributors**. Plugin behavior remains in [`/skills`](../skills/); do not duplicate eval or skill logic here.
