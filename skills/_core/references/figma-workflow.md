# Figma workflow (jstack)

Use this when implementing or reviewing UI from Figma alongside code.

Aligned with [OpenAI curated Figma cluster](https://github.com/openai/skills/tree/main/skills/.curated): treat **`figma-use`** (or host equivalent) as mandatory before write tools; **`figma-implement-design`** maps to this handoff path; **`figma-generate-design`** is the reverse (code → canvas).

## MCP read sequence (official Figma MCP)

Use when the host exposes **get_design_context**, **get_metadata**, **get_screenshot** (names may vary by server):

1. **Parse URL** → `fileKey`, `nodeId` (branch URLs: use branch key as `fileKey` per server docs).
2. **get_metadata** (optional) — locate node ids when the user only shared file-level URL.
3. **get_design_context** — primary: structured hints, Code Connect snippets, token names; adapt output to the repo stack (not paste raw as final code).
4. **get_screenshot** — visual ground truth when layout/spacing is ambiguous.
5. **Writes** (`use_figma` / plugin API) — only after **`figma-use`** skill loaded; batch related edits.

## Before MCP writes

1. If your environment provides **figma-use** / official Figma MCP instructions, **load that skill** before any `use_figma` (or equivalent) tool call — skipping it causes common failures.
2. Confirm you have **file key** and **node id** (from a Figma URL); normalize `node-id` query param (`-` → `:`).

## Design system and Code Connect

- Prefer **mapped components** from Code Connect (or your repo’s design-system package) over pasting raw absolute layout from dev mode.
- Map **variables / tokens** to the project’s CSS or theme (Tailwind tokens, CSS variables) instead of hardcoding hex from inspect.

## Handoff quality bar

- **Accessibility:** focus order, contrast, labels — call out gaps vs design.
- **Responsive:** note breakpoints; do not assume desktop-only unless specified.
- **States:** hover, focus, disabled, loading — match design or document deviations.

## Where org context lives

- **Vendor-neutral** guidance stops here.
- **jstack.gusto:** `references/design/figma.md` for default libraries, team file keys, and internal policy links.

## Reverse handoff (code → Figma)

When building screens **into** Figma from code or specs: use org **`jstack.gusto/references/design/figma.md`** (when the gusto plugin is installed) for file targets; follow upstream **`figma-generate-design`** / **`figma-generate-library`** patterns if installed — search design system components before drawing raw frames.

## Library / tokens sync

- Prefer **variables and styles** from the team library over hardcoded hex.
- **`figma-generate-library`**-style workflows: document token renames in the same PR as code theme updates.

## Chaining

- **From design → code:** `figma-handoff` (or this doc) → implement in repo → optional `jstack:review-code-review`.
- **From code → Figma:** use org `references/design/figma.md` for file targets; follow figma-generate skills if your host bundles them.
