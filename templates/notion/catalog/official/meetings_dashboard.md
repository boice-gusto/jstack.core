# 📆 Meetings — {{team_name}} {color="blue"}

<callout icon="📆" color="blue_bg">
	**Meetings hub.** Recurring meetings, upcoming sessions, notes index, and the meeting-notes template. Calendar resolves to `database_ids.calendar`; raw transcripts live in `parent_pages.private_transcripts`.
</callout>

<table_of_contents color="gray"/>

<columns>
	<column>
		### 🔴 Today / next {color="red"}
		_Pinned upcoming meeting summary. Replace with mention-page to current week's notes._
	</column>
	<column>
		### 📋 Active series {color="blue"}
		- Standup
		- Sprint planning
		- Sprint retro
		- 1:1s
		- All-hands
	</column>
</columns>

## Calendar

<callout icon="📅" color="blue_bg">
	Inline view of the **Calendar** database, filtered to `Type = Meeting`.
</callout>

<mention-database url="{{<calendar_db_url>}}">Calendar</mention-database>

## Recurring series

<table fit-page-width="true" header-row="true">
	<tr color="blue_bg">
		<td>Series</td><td>Cadence</td><td>Owner</td><td>Output</td><td>Notes home</td>
	</tr>
	<tr>
		<td>**Standup**</td><td>daily / 3x</td><td>rotating</td><td>blockers</td><td>Team Notes</td>
	</tr>
	<tr>
		<td>**Sprint planning**</td><td>per sprint</td><td>EM</td><td>committed scope</td><td>Sprints</td>
	</tr>
	<tr>
		<td>**Sprint retro**</td><td>per sprint</td><td>EM</td><td>keep/stop/try</td><td>Sprints</td>
	</tr>
	<tr>
		<td>**1:1s**</td><td>weekly / biweekly</td><td>manager ↔ report</td><td>action items</td><td>1:1s</td>
	</tr>
	<tr>
		<td>**All-hands**</td><td>monthly</td><td>EM / PE</td><td>broader context</td><td>Team Notes</td>
	</tr>
</table>

## Note conventions

<callout icon="💡" color="yellow_bg">
	**Every meeting page MUST include:** date, attendees, agenda, decisions (with owners), action items (with owners + due dates).
</callout>

- Use the **Meeting Notes — Template** page (`template_pages.meeting_notes`) as the duplicate source.
- For recorded meetings: drop the recording link in the template's "Recording" field; raw transcripts go to `private_transcripts`.
- Decisions that affect architecture become ADRs (`/jstack:notion adr`).

## Recent notes

<details color="gray">
<summary>Recent meeting notes (last 5)</summary>
_Replace with `<mention-page>` blocks once notes exist._

- _2026-04-28 — Weekly sync_
- _2026-04-21 — Sprint planning_
- _2026-04-18 — Retro_
- _2026-04-14 — All-hands prep_
- _2026-04-07 — Architecture review_
</details>

## Who runs which meeting

<columns>
	<column>
		### 🎤 Facilitators {color="purple"}
		- Standup → rotating
		- Retro → EM
		- All-hands → PE
	</column>
	<column>
		### 📝 Note-takers {color="green"}
		- Standup → none (skip)
		- Retro → rotating
		- All-hands → assigned
	</column>
</columns>

## Skills that write here

- `/jstack:meetings prepare` — pre-meeting prep
- `/jstack:meetings transcribe` — auto-transcript + summary
- `/jstack:meetings action-items` — extract + assign actions
- `/jstack:notion meeting-notes` — create from template

---

_Wired by `jstack-notion-setup` — `notion_defaults.parent_pages.meetings_dashboard` (catalog: `meetings_dashboard`)_
