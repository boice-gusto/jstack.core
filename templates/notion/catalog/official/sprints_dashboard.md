# 🏃 Sprints — {{team_name}} {color="orange"}

<callout icon="🏃" color="orange_bg">
	**Sprint hub.** Current sprint goal, board, and retro/planning artifacts. Tasks resolve to `database_ids.tasks`; private notes live in `parent_pages.private_sprints`.
</callout>

<table_of_contents color="gray"/>

<columns>
	<column>
		### 🎯 Current sprint {color="orange"}
		- **Goal:** _replace with sprint goal_
		- **Cadence:** _weekly / biweekly_
		- **Days remaining:** _N_
		- **Slug:** _S-NN_
	</column>
	<column>
		### 📊 Status {color="green"}
		- **Health:** 🟢 / 🟡 / 🔴
		- **Carryover:** _count_
		- **Spillover risk:** _summary_
	</column>
</columns>

## Board

<callout icon="🗂️" color="blue_bg">
	Inline view of the **Tasks** database, filtered to `Sprint = Current`. Edit the filter on the embedded view to re-scope.
</callout>

<mention-database url="{{<tasks_db_url>}}">Tasks</mention-database>

## Ceremonies

<columns>
	<column>
		### 📅 Planning {color="blue"}
		Owner: _name_
		Cadence: _per sprint start_
		Output: sprint goal + committed tasks.
	</column>
	<column>
		### 🔁 Standup {color="green"}
		Owner: rotating
		Cadence: daily / 3x weekly
		Output: blockers + on-track signal.
	</column>
	<column>
		### 🔍 Retro {color="purple"}
		Owner: _name_
		Cadence: per sprint end
		Output: 3 keep / 2 stop / 1 try.
	</column>
</columns>

## Sprint conventions

- **Sizing:** XS / S / M / L / XL on the Tasks DB `Effort` column.
- **WIP cap:** _N tasks per assignee in `In progress`._
- **Cutoff:** scope locked _N hours_ after planning.
- **Cross-sprint:** anything pulled forward gets a comment with the why.

## Retro archive

<details color="gray">
<summary>Sprint NN retro (YYYY-MM-DD)</summary>
**Keep:**
- _bullet_

**Stop:**
- _bullet_

**Try:**
- _bullet_

**Action items:**
- [ ] _action_ — @owner — due _date_
</details>

<details color="gray">
<summary>Sprint NN-1 retro (YYYY-MM-DD)</summary>
_archived retro content_
</details>

## Spillover policy

> _When a task spills, attach a comment with: original commitment date, blocker, new ETA, and whether it stays in this sprint or moves to next._ {color="orange"}

## Skills that write here

- `/jstack:sprint` — planning + mid-sprint re-plan
- `/jstack:notion sprint` — create / archive sprint pages
- `gusto-weekly-sprint-update` — weekly sprint status digest

---

_Wired by `jstack-notion-setup` — `notion_defaults.parent_pages.sprints_dashboard` (catalog: `sprints_dashboard`)_
