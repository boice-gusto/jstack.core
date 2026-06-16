# 🏢 {{team_name}} Team HQ {color="blue"}

<callout icon="🏢" color="blue_bg">
	**Shared hub for {{team_canonical_display_name}}.** This page must live inside the team's Notion teamspace — not in private workspace pages.
</callout>

<table_of_contents color="gray"/>

<columns>
	<column>
		### 🎯 Mission {color="purple"}
		> _One sentence describing what this team does and for whom._
	</column>
	<column>
		### 🚨 On-call now {color="red"}
		<mention-page url="{{<oncall_dashboard_url>}}">On-call</mention-page>
	</column>
	<column>
		### 📊 Sprint {color="orange"}
		<mention-page url="{{<sprints_dashboard_url>}}">Sprints</mention-page>
	</column>
</columns>

## Quick links

<columns>
	<column>
		### 👥 People {color="green"}
		- <mention-page url="{{<team_dashboard_url>}}">Team</mention-page>
		- <mention-page url="{{<one_on_ones_hub_url>}}">1:1s</mention-page>
		- <mention-page url="{{<onboarding_dashboard_url>}}">Onboarding</mention-page>
		- <mention-page url="{{<management_dashboard_url>}}">Management</mention-page>
	</column>
	<column>
		### 🛠️ Work {color="blue"}
		- <mention-page url="{{<engineering_dashboard_url>}}">Engineering</mention-page>
		- <mention-page url="{{<sprints_dashboard_url>}}">Sprints</mention-page>
		- <mention-page url="{{<intake_dashboard_url>}}">Intake</mention-page>
		- <mention-page url="{{<oncall_dashboard_url>}}">On-call</mention-page>
	</column>
	<column>
		### 📚 Knowledge {color="brown"}
		- <mention-page url="{{<product_wiki_url>}}">Wiki</mention-page>
		- <mention-page url="{{<documents_dashboard_url>}}">Documents</mention-page>
		- <mention-page url="{{<product_strategy_url>}}">Product Strategy</mention-page>
		- <mention-page url="{{<about_page_url>}}">About</mention-page>
	</column>
</columns>

## Databases

| Database | Purpose | Inline view |
|---|---|---|
| **Tasks** | Sprint board / kanban | <mention-database url="{{<tasks_db_url>}}">Tasks</mention-database> |
| **Calendar** | Meetings, sprints, releases | <mention-database url="{{<calendar_db_url>}}">Calendar</mention-database> |
| **Intake** | Triage hub for incoming requests | <mention-database url="{{<intake_db_url>}}">Intake</mention-database> |
| **Contacts** | Stakeholders + vendors | <mention-database url="{{<contacts_db_url>}}">Contacts</mention-database> |
| **Documents** | Specs / ADRs / runbooks | <mention-database url="{{<documents_db_url>}}">Documents</mention-database> |

## How this hub works

<callout icon="💡" color="yellow_bg">
	**Config drives where pages land — not the page tree.** Each child here is wired into `jstack.config.json` under `notion_defaults.parent_pages.*` and `database_ids.*`. jstack skills resolve parents via `post_targets`. Edit the config to redirect routing.
</callout>

- The active **template set** is recorded in `notion_defaults.template_set` (`official` by default).
- Switch sets by changing that value and re-running `jstack-notion-setup`.
- `notion_defaults.golden_pages.<id>` lets you point setup at user-authored golden templates instead of the catalog's markdown defaults — useful for visually-rich pages (configured DB views, embedded blocks).

## Recent activity

<details color="gray">
<summary>Recently updated pages</summary>
_Replace with `<mention-page>` blocks for the most recently touched pages, or embed a Documents view sorted by Last Edited._
</details>

---

_Wired by `jstack-notion-setup` — `notion_defaults.parent_pages.team_hub` (catalog: `company_team_page`)_
