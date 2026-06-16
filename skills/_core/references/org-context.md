# Org context — config, injection, MCP, and CLI

**Canonical reference** for org-wide grounding: handbook, ethics, rubrics, coaching norms, optional Notion/Drive, and MCP hints. Base jstack ships **no employer content** — only keys, templates, and this contract.

Use this reference when a skill needs **org layout**, **people**, **ethics**, **engineering handbook**, **team documents** (Notion, Google Drive), **level criteria**, **HR-safe public guidance**, **coaching** framing, **self-review** or **self-critical-review** rubrics.

## Standard setup (one cohesive path)

1. **Pick a folder** for org markdown (e.g. `config/org/` or `docs/org-context/`). Set **`org_context.local.base_path`** to that directory (relative to workspace root or absolute).
2. **Copy slice templates** from [`templates/config/org-context/`](../../../templates/config/org-context/README.md): rename `*.md.example` → the filenames you list under **`org_context.local.files`** (keys must match the [default slice ids](#default-slice-ids) below). Use [`org-context.merge.example.json`](../../../templates/config/org-context/org-context.merge.example.json) as a merge snippet for `jstack.config.json`. Fill in real content or replace with exports from Notion/Drive.
3. **Set the ladder** (optional but recommended): **`levels_and_expectations.markdown_path`** to your IC/EM expectations doc. Add the token **`levels`** to **`skill_defaults.*.org_context_slices`** where the skill should load that file.
4. **Declare what each skill loads**: under **`skill_defaults.<skill_key>.org_context_slices`**, list slice ids (and optionally **`levels`**). Defaults in `config/defaults.json` include `self_eval` and `advice`; align **`<skill_key>`** with your host’s merge rules (short id vs `jstack-*` frontmatter name).
5. **Optional — live docs**: fill **`org_context.notion_pages`** / **`org_context.google_drive_folders`** (same slice ids as keys) and **`org_context.mcp_labels`** so runbooks stay host-agnostic. See [MCP and data CLI](#mcp-and-data-cli).

**Documentation map (same model everywhere):**

| Layer | Format | Role |
|-------|--------|------|
| Routing | JSON (`jstack.config.json`) | Paths, ids, slice lists, MCP labels — validated against `config/schema.json`. |
| Payload | Markdown (local or fetched) | Text the model reads; human-authored, diff-friendly. |
| How-to | This file + `templates/config/org-context/README.md` | Setup checklist and copy-paste examples. |

Related: [`config-schema.md`](config-schema.md) (key table), [`integration-guide.md`](integration-guide.md) (integrations), [`PE_AND_TEAM_CONFIG.md`](../../../docs/PE_AND_TEAM_CONFIG.md) (people-facing config overview).

## Merge order

Same as other skills: **CLI / `$ARGUMENTS`** → **`skill_defaults.<skill_key>`** → **`jstack.config.json`** (and repo **`config/defaults.json`** as lowest layer) → ask one question if a required id is missing.

## Top-level config: `org_context`

Source of truth for keys: `config/defaults.json` and `skills/_core/references/config-schema.md`.

| Block | Purpose |
|-------|---------|
| `org_context.local.base_path` | Directory for org-authored markdown (relative to workspace or absolute). |
| `org_context.local.files` | Map of **slice id** → **filename** under `base_path` (same pattern as `team_context.files`). |
| `org_context.notion_pages` | Optional map of slice id → Notion page id (or db id) when the host has Notion MCP. |
| `org_context.google_drive_folders` | Optional map of slice id → Drive folder or file id when Drive MCP/CLI is available. |
| `org_context.people.prefer_team_members` | When true, resolve people from `team.members` before calling tools. |
| `org_context.mcp_labels.documents` | String labels for which MCP servers provide doc reads (e.g. `notion`, host-specific Drive server id). |
| `org_context.mcp_labels.people` | Labels for roster/profile tools (e.g. `slack`, `jira`). |

### Default slice ids

Keys for **`org_context.local.files`** (each value is a filename under `local.base_path`):

| Key | Typical content |
|-----|-----------------|
| `org_structure` | Teams, reporting lines, groups (non-PII or redacted). |
| `ethics` | Code of conduct, escalation for misconduct. |
| `engineering_handbook` | How we build, review, on-call, SDLC. |
| `hr_public` | **Public** HR FAQs only — not personal records; defer sensitive HR to professionals. |
| `coaching` | Internal coaching / feedback norms (manager and IC). |
| `self_review_rubric` | Prompts and criteria for self-assessment. |
| `critical_review_rubric` | Structured self-critique / pre-mortem style prompts. |

Teams may add more keys under `local.files`; skills should tolerate unknown keys.

### Levels and expectations

**Canonical ladder** stays under `levels_and_expectations.markdown_path` and `levels_and_expectations.canonical_url`. Do not duplicate the full ladder inside `org_context` unless your org chooses to.

## Per-skill slices: `skill_defaults`

Optional key: **`org_context_slices`** — string array.

- Each entry is either:
  - A **slice id** matching `org_context.local.files` (agent resolves `base_path` + filename and **Read**s the file when non-empty), or
  - The token **`levels`**, meaning also load **`levels_and_expectations.markdown_path`** when set.

Example (`jstack.config.json`):

```json
{
  "skill_defaults": {
    "self_eval": {
      "org_context_slices": ["ethics", "engineering_handbook", "self_review_rubric", "levels"]
    },
    "advice": {
      "org_context_slices": ["ethics", "coaching"]
    }
  }
}
```

Skill frontmatter **`name`** (e.g. `jstack-self-eval`) may differ from the `skill_defaults` key your host uses; align with your plugin’s merge rules — often the short id is `self_eval` or `eval`.

## Injection procedure (for skill authors)

1. **Step 0 — Load org bundle (read-only)**  
   - Read `org_context` and `levels_and_expectations`.  
   - For each id in `skill_defaults.*.org_context_slices`, load the corresponding local file if configured.  
   - If a slice is only in `notion_pages` / `google_drive_folders`, fetch via MCP or org CLI **only when tools are enabled**; otherwise state what is missing.

2. **People**  
   - Match the subject to `team.members[]` via `id`, `metadata.name`, `slack.handle`, or `email.primary`.  
   - Use **`org_context.people.prefer_team_members`** before calling Slack/Jira MCP for display fields.

3. **Integrations**  
   - Follow `integration-guide.md` for `integrations.notion`, `integrations.google_drive`, and `mcp_servers`.  
   - Never invent page ids or folder ids — only use config + tool results.

4. **Safety**  
   - **HR / therapy:** Skills stay advisory; direct users to HR or licensed professionals for personal crises or formal disputes.  
   - **PII:** Only the user’s own or roster fields already in config; redact in logs.

## MCP and data CLI

| Need | Typical source |
|------|----------------|
| Handbook / policy docs | `org_context.local.files`, or Notion MCP + `notion_pages`, or Drive MCP + `google_drive_folders`. |
| Live Notion page | Notion MCP tools (workspace from `integrations.notion`). |
| Drive files | Drive MCP or org `gcloud`/`rclone` scripts — wire folder ids in `google_drive_folders`. |
| Slack profile / presence | Slack MCP + `team.members` resolution. |
| Jira assignee / workload | Jira MCP + `team.members[].jira`. |

Label servers under **`org_context.mcp_labels`** so runbooks stay host-agnostic; the host maps labels to installed MCP server names.

## Related config

- **`team_context`** — operational slices (channels, incidents, escalation); complements `org_context`.  
- **`knowledge_base`** — repo-wide search roots for RAG-style answers.  
- **`team.members`** — roster and per-person integration ids.  
- **`impact`**, **`brag`**, **`impact_prep`** — adjacent self-serve and rubric paths.
