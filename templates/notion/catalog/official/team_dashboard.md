# 👥 Team — {{team_name}} {color="green"}

<callout icon="👥" color="green_bg">
	**Team hub.** Roster, on-call, contact directory, and per-person hub pages. People resolve to `parent_pages.team_people`; contacts to `database_ids.contacts`.
</callout>

<table_of_contents color="gray"/>

<columns>
	<column>
		### 📣 Display name {color="green"}
		**{{team_canonical_display_name}}**
	</column>
	<column>
		### 🎯 Mission {color="purple"}
		_One sentence — what this team does and for whom._
	</column>
	<column>
		### 🚨 On-call now {color="red"}
		<mention-page url="{{<oncall_dashboard_url>}}">On-call</mention-page>
	</column>
</columns>

## Roster

<callout icon="👤" color="green_bg">
	Per-person hub pages live under <mention-page url="{{<team_people_url>}}">People</mention-page>. The roster source of truth is `team.members[]` in `jstack.config.json`.
</callout>

<table fit-page-width="true" header-row="true" header-column="true">
	<tr color="green_bg">
		<td>Person</td><td>Role</td><td>Level</td><td>Slack</td><td>GitHub</td><td>Hub</td>
	</tr>
	<tr>
		<td>**{{primary_member_name}}**</td><td>{{primary_member_role}}</td><td>{{primary_member_level}}</td><td>{{primary_member_slack}}</td><td>{{primary_member_github}}</td><td><mention-page url="{{<primary_member_hub_url>}}">hub</mention-page></td>
	</tr>
</table>

## Contacts (external)

<mention-database url="{{<contacts_db_url>}}">Contacts</mention-database>

## Working hours

<columns>
	<column>
		### 🕐 Primary timezone {color="blue"}
		_{{team_timezone}}_
	</column>
	<column>
		### 📅 Business hours {color="blue"}
		_{{business_hours_start}} – {{business_hours_end}}_
	</column>
	<column>
		### 📆 Working days {color="blue"}
		_{{business_days}}_
	</column>
</columns>

## Comms expectations

<callout icon="💬" color="blue_bg">
	**Async-first.** Default to Slack thread / Notion comment. Synchronous needed only for: incidents, decisions blocking >2 people, 1:1s.
</callout>

- **Response targets:** within working hours, ack within 4h; resolution by EoD.
- **Off-hours:** PagerDuty for Sev1/Sev2 only (see On-call dashboard).
- **Vacation / OOO:** mark in <mention-database url="{{<calendar_db_url>}}">Calendar</mention-database> with `Type = Holiday`.

## Per-person pattern

Each direct report has a section page under `parent_pages.team_people`. That page contains:
- Pinned: career goals, current focus, recent wins
- Linked: 1:1 hub page, performance notes (if applicable)
- History: action items they've owned, retro callouts

## Skills that write here

- `/jstack:team` — team snapshot
- `/jstack:notion team-note` — shared working notes
- `/jstack:notion report` — team-facing reports

---

_Wired by `jstack-notion-setup` — `notion_defaults.parent_pages.team_dashboard` (catalog: `team_dashboard`)_
