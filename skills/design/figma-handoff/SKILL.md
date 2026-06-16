---
name: jstack-figma-handoff
description: Load jstack Figma workflow guidance before design-to-code or MCP Figma work; chain to figma-use when the host provides it.
category: design
data_class: internal
gbrain_destination: none
---

<!-- Chain Contract -->
<!-- inputs: user_request, jstack_config -->
<!-- outputs: structured_result -->

Read the setup preamble first:
!cat ${CLAUDE_PLUGIN_ROOT}/prompts/setup/preamble.md

## What this skill is for

**Design → code** and **Figma MCP** work: load vendor-neutral workflow, then implement or review UI with correct accessibility and token usage.

**Before any Figma write tool:** If the host bundles **`figma-use`** (OpenAI curated / Cursor Figma MCP), **invoke that skill first** — same rule as [`figma-workflow.md`](../../_core/references/figma-workflow.md). Skipping it causes common `use_figma` failures.

## Domain rules — Figma handoff

- Read **`${CLAUDE_PLUGIN_ROOT}/skills/_core/references/figma-workflow.md`** in full for MCP sequence (metadata → design context → screenshot).
- Prefer **Code Connect** and design-system components over pasting absolute coordinates from dev mode.
- **Accessibility:** focus order, contrast, labels — call out gaps vs design.
- **Org file keys / libraries:** `!cat` gusto `${CLAUDE_PLUGIN_ROOT}` sibling `jstack.gusto/references/design/figma.md` when present (path may vary); never invent internal file URLs.

## Config and references

- `jstack.config.json` — integrations only; Figma file keys usually come from user URL or org refs.
- [`figma-workflow.md`](../../_core/references/figma-workflow.md) — MCP sequence, reverse handoff, library sync.
- Integrations: `${CLAUDE_PLUGIN_ROOT}/skills/_core/references/integration-guide.md`
- Chaining: `${CLAUDE_PLUGIN_ROOT}/skills/_core/references/chaining-guide.md`

## Intake

1. Parse `$ARGUMENTS` — Figma URL, node, target repo area, or “review implementation vs design”.
2. If **file key / node id** missing and user has a URL, derive per workflow doc; else one clarifying question.
3. If the host has **`figma-use`**, chain to it before writes.

## Procedure

### Step 1 — Load workflow + org refs

Read `figma-workflow.md`. Load gusto design ref if available.

### Step 2 — Read-only MCP first

`get_metadata` / `get_design_context` / `get_screenshot` per server — then plan code changes.

### Step 3 — Implement or review

Map tokens to project theme; implement components; document intentional deviations.

### Step 4 — Summarize

**Summary**, **Details**, **Next steps**. If URLs or PRs were created, end with **## Links** per `response-artifacts.md`.

## Output shape

- **Summary** (2–4 sentences)
- **Details** — decisions, deviations, a11y notes
- **Next steps**
- **## Links** — Figma URL, PR, etc. when applicable

## Failure modes

| Symptom | Recovery |
|---------|----------|
| No Figma MCP | Point to `integration-guide.md` + `.mcp.json.example`; describe manual checklist. |
| Auth / 403 | Refresh token; never print secrets. |
| Wrong skill body / health copy | This skill is **Figma only** — if you see CI health text, the file was corrupted; use `figma-workflow.md`. |

## Chaining

- **After code:** `jstack:review-code-review`
- **Generate in Figma:** follow workflow “reverse handoff” + org `references/design/figma.md`

## User request

$ARGUMENTS
