# Eval run telemetry (opt-in)

jstack defaults to **append-only JSONL** when eval telemetry is on: **`~/.jstack/telemetry.jsonl`** unless you override the path (see below). **Off by default** — no logging unless you enable it.

**Internal / Notion-ready privacy narrative:** [`TELEMETRY_NOTION.md`](TELEMETRY_NOTION.md).

## Enable

- Set `JSTACK_TELEMETRY=1` (or `true`) in the environment when running evals (e.g. `bun run evals/run-evals.ts`).
- Optional: `JSTACK_TELEMETRY_PATH=/path/to/file.jsonl` — default is `~/.jstack/telemetry.jsonl`.

## Verify local setup

- `jstack telemetry test` — writes one anonymous line to `~/.jstack/jstack.telemetry.selftest.jsonl` and shows paths (machine-only id file **`~/.jstack/telemetry-instance-id`**; see `telemetry/instance-id.ts`).

## Schema (one object per line)

| Field | Type | Notes |
|-------|------|--------|
| `ts` | string | ISO-8601 timestamp |
| `telemetry_instance_hash` | string | Short SHA-256-derived id from **`~/.jstack/telemetry-instance-id`** (UUID never sent raw) |
| `gate_id` | string | `jstack:<skill/rel/path>` |
| `case_name` | string | Eval case name |
| `status` | string | `completed` \| `timeout` \| `error` |
| `elapsed_sec` | number | Wall time |
| `tokens` | number | Parsed usage (0 if unavailable) |
| `cost_usd` | number | Parsed cost |
| `skill_triggered` | boolean | Heuristic from stream-json |
| `prompt_sha256` | string | SHA-256 of the **eval case prompt only** (UTF-8); no raw prompts are written |

## Privacy

- **No raw prompts or responses** in the log line by default.
- The hash is of `EvalCase.prompt` only (not the wrapped system/skill-instructions block sent to Claude).
- **No PII / PHI** in these lines — see [`TELEMETRY_NOTION.md`](TELEMETRY_NOTION.md).

## Implementation

Logging is invoked from `evals/execute.ts` after each `executeCase` result (including file-setup errors). See `evals/eval-telemetry.ts`.
