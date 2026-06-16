# Team roster and canonical group identity

Use this when **setup wizards**, **update-config**, or **team / meetings skills** need a stable notion of “who is on the team” and how to **@mention or email the group** in the future without hardcoding.

## Config blocks

| Block | Role |
|-------|------|
| `team.members` | Authoritative **roster** for skills: top-level **`id`**, nested **`metadata`**, **`github`**, **`email`**, **`jira`**, **`notion`**, **`slack`**, **`misc`**. See `config-schema.md` → team.members. |
| `team.canonical_group` | Optional **org-wide group** handle: Slack user group or Google Group. **`mode`** chooses how tools should interpret the block. |

Never invent Slack ids, user group ids, or Notion page ids — collect from the user or from org admin tools.

## `team.canonical_group.mode`

| Mode | Meaning |
|------|---------|
| `none` | No shared group id. Use per-member **`slack.handle`** / **`email.primary`** on `team.members` only. |
| `manual_list` | Roster in `team.members` is source of truth for people-engineering skills. `canonical_group` fields may be empty or used as **documentation** for a future automation (no automatic sync). |
| `slack_user_group` | Team mentions should prefer **`slack_user_group_id`** (and optional **`slack_handle`** for display). Roster in config should still list members for levels, 1:1 pages, and reporting. |
| `google_group` | Team email list is **`google_group_email`**. Use for calendar invites, email digests, or future Workspace integrations. Roster in config remains the structured skill input. |

Pick **one** primary mode per workspace; mixing Slack and Google as “truth” without a documented convention confuses routing skills.

## Discovering values

### Slack user group (User Group / `@`-subteam)

- **In Slack (desktop):** Main menu → **People & user groups** → **User groups** → select the group → details often show a handle like `@eng-platform`.
- **API / admin:** Workspace admins may use Slack’s admin APIs or export; the **user group id** is an opaque string (e.g. `S0614TZR7F8`). Store it in `team.canonical_group.slack_user_group_id` when your automation needs the id; store the human handle in `slack_handle` if different from display.
- **Note:** “Channel” is not the same as “user group.” A channel id belongs under `integrations.slack.*`, not necessarily under `canonical_group`.

### Google Group

- **Admin:** [Google Admin console](https://admin.google.com) → Groups → find the group → primary email (e.g. `team-eng@company.com`) → set `team.canonical_group.google_group_email`.
- **No admin access:** Ask IT for the **group email address**; do not guess.

### `display_name`

Optional human label for reports and wizard summaries (e.g. `Platform Engineering`). Not used as a Slack or Google technical id.

## Wizard behavior (contract)

1. Collect **team name** and timezone (existing).
2. Ask whether the org uses a **Slack user group**, **Google Group**, or **neither** → set `team.canonical_group.mode` and fill ids when the user supplies them.
3. For each **direct report** (or each IC on the team, per user scope): **`id`** (stable slug); **`metadata`**: `name`, `role`, `level` (or ladder key aligned to `levels_and_expectations`), optional `title`; **`email`**: `primary` when known; **`slack`**: `handle`, optional `user_id`; **`github`**: `login`; optional **`jira`**: `account_id`; **`misc`** as needed.
4. **Notion:** Under `parent_pages.one_on_ones` (or PE index per policy), create or link a **per-person section** (subpage or linked page). Store:
   - `team.members[].notion.one_on_one_parent_page_id`
   - Optional `team.members[].notion.template_page_id` (golden duplicate source for that person; else use `one_on_one_cycle.notion.default_template_page_key`).
   - Optional `team.members[].notion.person_hub_page_id` under `team_people` for public roster pages.
5. Persist **`notion_defaults.template_pages.one_on_one`** if not set, and **`one_on_one_cycle.notion.default_template_page_key`**.
6. Point **`pe.teams`** / reporting keys if PE is enabled (existing PE docs).

## Related

- [`skills/notion/references/notion-vault-and-routing.md`](../../notion/references/notion-vault-and-routing.md) — vault keys and setup contract
- [`skills/meetings/one-on-one-transcript/references/config-shape.md`](../../meetings/one-on-one-transcript/references/config-shape.md) — 1:1 cycle + Notion routing
- [`docs/PE_AND_TEAM_CONFIG.md`](../../../docs/PE_AND_TEAM_CONFIG.md)
