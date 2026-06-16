# 🤝 1:1s — {{team_name}} {color="green"}

<callout icon="🤝" color="green_bg">
	**1:1 hub.** One section page per direct report (or peer). Cycle pages duplicate from `template_pages.one_on_one`. Sensitive performance content stays in `pe_index` (private), not here.
</callout>

<table_of_contents color="gray"/>

<columns>
	<column>
		### 📅 Cadence {color="green"}
		_Weekly / biweekly per direct report_
	</column>
	<column>
		### 🔗 Template {color="blue"}
		`template_pages.one_on_one`
		_(`one_on_one_template` — prompt-driven)_
	</column>
	<column>
		### 🔒 Sensitive content {color="red"}
		Goes to <mention-page url="{{<pe_index_url>}}">PE index</mention-page>, not here.
	</column>
</columns>

## Per-person pattern

Each direct report has a section page underneath. Inside that page:

- **Pinned:** career goals, current focus, blockers
- **Cycle pages:** one per scheduled 1:1, duplicated from the template
- **Linked:** their <mention-page url="{{<team_people_url>}}">People hub</mention-page>
- **Action item history:** rolling list with completion dates

`team.members[].notion.one_on_one_parent_page_id` points at this person's section page.

## Privacy

<callout icon="🔒" color="red_bg">
	**Watch the boundary.** Pay, performance feedback, and sensitive personal context belong in `pe_index` or your org's HR system. The team-side 1:1 hub is OK for the structural skeleton (who has 1:1s with whom), not for the content of those 1:1s.
</callout>

| Content | Goes here? |
|---|---|
| 1:1 cadence + cycle dates | ✅ Yes |
| Action items + decisions | ✅ Yes |
| Career goals (high-level) | ✅ Yes |
| Performance feedback | ❌ → `pe_index` |
| Pay / promotion content | ❌ → HR system |
| Crisis / personal-life context | ❌ Off Notion |

## Cycle template

The template is **prompt-driven** (`content_kind: "prompt"` in the catalog). The agent generates the page body at setup time using:

- `team.canonical_group.display_name`
- `one_on_one_cycle.cadence`
- `one_on_one_cycle.prepare_vs_after.*` suffixes
- Per-org tone preferences

See `one_on_one_template.prompt.md` for the prompt itself.

## Skills that write here

- `/jstack:meetings prepare` — pre-1:1 prep
- `/jstack:meetings action-items` — after-notes + actions
- `gusto-one-on-one-transcript` — overlay (PE-privacy defaults)

---

_Wired by `jstack-notion-setup` — `notion_defaults.parent_pages.one_on_ones` (catalog: `one_on_ones_hub`)_
