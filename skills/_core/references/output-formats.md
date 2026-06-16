# Optional structured output (JSON / YAML)

Skills default to **natural-language** replies. This reference defines an **optional** machine-friendly mode for evals, automation, MCP wrappers, and scripted pipelines.

## Default

Unless the user (or host wrapper) requests structured output, respond in **plain prose** as the skill already specifies. Do not emit JSON or YAML by default.

## How to request structured output

Hosts differ (slash commands, CLI, raw chat). Treat any of these as a structured-output request:

- **Flags:** `--output=json`, `--output=yaml`, `--format=json`, `--format=yaml`
- **Phrases:** “respond with JSON only”, “YAML only”, “match the schema in …”

Normalize to **one serialization**: `json` or `yaml`.

## Agent behavior when structured output is requested

1. **Prefer a contract** defined by this skill:
   - Inline in the skill body (small, stable shapes), and/or
   - `references/schemas/<skill-or-artifact>.schema.json` for [JSON Schema](https://json-schema.org/) validation, and/or
   - A short **example object** in `references/` (one valid minimal instance helps models more than schema alone).
2. **`$schema` on JSON instances:** When emitting JSON, set a top-level **`$schema`** string to the schema’s canonical **`$id`** (same file under `references/schemas/…`). Apps, IDEs, and validators resolve the contract without repo-specific paths. If the org sets **`skills.machine_readable.require_schema_ref`** to `true` in `jstack.config.json`, include **`$schema`** whenever structured output is used.
3. **Emit only** the serialized document (no explanatory prose **before** the payload). If the host requires markdown fences for a single JSON/YAML blob, use one fenced block; otherwise raw stream is preferred.
4. **Validate mentally** against the advertised keys; omit keys with unknown values only if the schema allows optional fields—otherwise use `null` or empty arrays as the schema specifies.

## Chaining: CLI, Claude, and mixed hosts

Use the **same** convention everywhere so handoffs do not fork:

| Path | Pattern |
|------|---------|
| **CLI → CLI** | Prior step prints **only** JSON to stdout when `--output=json`; next step reads stdin or a file. Pipe-friendly: `step-a \| jq '.field' \| step-b`. |
| **Claude → CLI** | Paste or save the model’s JSON blob; CLI tool validates against `$schema` / local schema file. |
| **CLI → Claude** | Pass the JSON as `$ARGUMENTS` or an attached file; the model merges it per the receiving skill’s intake. |
| **YAML handoff blocks** | Narrative chains may still use the `--- handoff ---` block from [`chaining-guide.md`](./chaining-guide.md); for automation, prefer **one JSON document** matching the next skill’s schema (or an envelope below). |

**Optional envelope** (multi-hop pipelines where the inner `result` shape varies): a wrapper schema with `skill`, `schema_version`, and `result`. Prefer a **flat** document validated by one schema when a single skill owns the output.

## Config: enable / disable auto structured output

In **`jstack.config.json`**:

- **`skills.machine_readable.enabled`** — default `true`. When **`false`**, automation (MCP wrappers, CI, morning kickoff runners) must **not** auto-inject `--output=json` / `--output=yaml`; interactive users may still ask for JSON in prose.
- **`skills.machine_readable.require_schema_ref`** — default `false`. When **`true`**, structured JSON should always include **`$schema`**.

See **`config/schema.json`** and **`defaults.json`**.

## YAML vs JSON

| Format | Prefer when |
|--------|-------------|
| **JSON** | Eval parsers, MCP, JavaScript tooling, strict validation |
| **YAML** | Human-edited configs, short nested structures (still validate in CI when critical) |

If the user asks for “structured output” without a format, prefer **JSON**.

## SKILL.md author checklist

Optional section at end of skill (or pointer here + one paragraph):

```markdown
## Structured output (optional)

- **Default:** prose per **Output shape** above.
- **When** the request includes `--output=json` / `--output=yaml` (or equivalent), respond with **only** that format.
- **Contract:** `references/schemas/<name>.schema.json` (optional) + see example in `<path>` or inline block below.
```

Keep the **canonical prose** UX in **Output shape**; duplicate only the deltas for JSON/YAML (field names, required vs optional).

## Anti-patterns

- Defaulting to JSON for skills aimed at executives or narrative announcements (unless explicitly requested).
- Huge schemas copied into SKILL.md — link to `references/schemas/` instead.
- Multiple different flag spellings across skills without documenting one preferred pair: **`--output=json`** and **`--output=yaml`**.

## See also

- [`skill-conventions.md`](./skill-conventions.md) — body structure including **Output shape**
- [`response-artifacts.md`](./response-artifacts.md) — links footer after creates/updates
- [`markdown-authoring-guide.md`](./markdown-authoring-guide.md) — variables and chaining
