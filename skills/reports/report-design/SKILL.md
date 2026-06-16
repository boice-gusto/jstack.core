---
name: jstack-report-design
description: Map org brand to semantic report tokens (colors, type, radius) for static HTML shells and jstack report render.
category: reports
gbrain_destination: inherit
data_class: internal
when_to_use: User wants report HTML/PDF to match brand; configure reports.branding and related defaults.
---

<!-- Chain Contract -->
<!-- inputs: user_request, brand_inputs optional, jstack_config -->
<!-- outputs: branding_json_fragment, structured_result -->
<!-- chains-to: jstack report render, share-html-publish, reports/team, etc. -->

Read the setup preamble first:
!cat ${CLAUDE_PLUGIN_ROOT}/prompts/setup/preamble.md

## What this skill is for

Help authors set **`reports.branding`** in `jstack.config.json` (merged over `config/defaults.json`) so **`jstack report render`** injects consistent **CSS variables** into `templates/reports/shells/default.html`. Keep proposals **JSON-shaped** and **secret-free**. Optionally align with **`skill_defaults.reports`** for tone defaults per org.

## Out of scope

- Fetching real brand assets from a corporate DAM (user may paste hex or Figma); do not invent official palette names without a source.
- Full dashboard (Next.js) theming; that’s a different surface — use **`html-spa-design.md`** to distinguish.

## Domain rules — report branding

- **Semantic tokens:** Map to slots like primary, surface, text, border — not ad hoc class names in every skill.
- **Schema awareness:** Large structured payloads use **`schemas/reports/report-payload-v1.schema.json`**; branding is separate from payload fields.
- **Preview loop:** Suggest `jstack report render --data … --out …` for local verification.

## Config and references

- `${CLAUDE_PLUGIN_ROOT}/skills/_core/references/html-spa-design.md` (static CDN shell vs React dashboard)
- `${CLAUDE_PLUGIN_ROOT}/skills/design/visual-single-page-html/references/brand-variables.md` (**multi-brand** presets, **`assets_dir`**, logos; extends **`reports.branding`** semantics)
- `${CLAUDE_PLUGIN_ROOT}/templates/reports/AUTHORING.md` (sections, tone, payload)
- `${CLAUDE_PLUGIN_ROOT}/schemas/reports/report-payload-v1.schema.json`
- `${CLAUDE_PLUGIN_ROOT}/skills/reports/share-html-publish/SKILL.md` (hosted / MCP publish path)
- Design handoff: `${CLAUDE_PLUGIN_ROOT}/skills/design/figma-handoff/SKILL.md` when mapping from Figma exports

## Intake

1. Ask or infer: **source** of colors (Figma, existing site, or user-provided hex list).
2. Confirm output target: **static shell** (default) vs future dashboard (document limitation).

## Procedure

### Step 1 — Read design guide

Read **`html-spa-design.md`** for the semantic token table and naming.

### Step 2 — Figma (optional)

If the user has Figma context, route through **`design/figma-handoff`**, then map hex to **semantic** slots (avoid one-off class names in skills).

### Step 3 — Propose config fragment

Propose a JSON fragment for **`reports.branding` only** (and mention **`skill_defaults.reports`** if tone defaults apply). No secrets, no API keys.

### Step 4 — Preview

Suggest: `jstack report render --data … --out …` for a local check.

## Output shape

- **Proposed `reports.branding`** — fenced JSON fragment ready to merge.
- **Token mapping** — Small table: semantic slot, hex, notes.
- **Next command** — Render command line with placeholders.

## Failure modes

| Symptom | Recovery |
|---------|----------|
| Conflicting with existing `reports.branding` | Show diff; ask to merge or replace. |
| User wants full React theme | Out of scope; point to dashboard package docs. |

## Chaining

- `suggested_next:` **`jstack-report`** family or **`jstack-report-share-html-publish`** when hosting matters.

## User request

$ARGUMENTS
