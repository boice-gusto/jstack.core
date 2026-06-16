# ℹ️ About — {{team_name}} {color="gray"}

<callout icon="ℹ️" color="gray_bg">
	**About this team.** Mission, history, what we do, what we don't, and the values that shape decisions. Update annually or when scope changes.
</callout>

<table_of_contents color="gray"/>

## Mission

> _One sentence describing what we exist to do, for whom, and why it matters._ {color="purple"}

## What we do

<columns>
	<column>
		### ✅ In scope {color="green"}
		- _Capability 1_
		- _Capability 2_
		- _Capability 3_
	</column>
	<column>
		### ❌ Out of scope {color="red"}
		- _Boundary 1_
		- _Boundary 2_
		- _Things other teams own_
	</column>
</columns>

## Values

<callout icon="🧭" color="purple_bg">
	**Operating values that guide trade-offs.** When two good options conflict, these are the tiebreakers.
</callout>

1. _Value 1_ — _what it means in practice_
2. _Value 2_ — _what it means in practice_
3. _Value 3_ — _what it means in practice_

## How we work

| Practice | What that looks like |
|---|---|
| **Async-first** | Default to written; sync only when faster |
| **Decisions documented** | ADRs for architecture; meeting notes for everything else |
| **Strong opinions, loosely held** | Push back early, commit fully once decided |
| **Customer outcomes > internal optics** | Ship value, not artifacts |

## History

<details color="gray">
<summary>Team history</summary>
- _Year_ — Team formed / scope set
- _Year_ — Major milestone
- _Year_ — Reorg / re-scope
</details>

## Stakeholders

<columns>
	<column>
		### 🤝 Direct {color="blue"}
		- _Team A — for X_
		- _Team B — for Y_
	</column>
	<column>
		### 🌐 Adjacent {color="purple"}
		- _Team C_
		- _Team D_
	</column>
	<column>
		### 🎯 Customers {color="green"}
		- _Internal user group_
		- _External user group_
	</column>
</columns>

## Where to find us

- **Slack:** `#{{team_slack_channel}}` (replace with `channels.team_public` value)
- **Page hub:** <mention-page url="{{<team_hub_url>}}">Team HQ</mention-page>
- **Sprint board:** <mention-page url="{{<sprints_dashboard_url>}}">Sprints</mention-page>
- **Documents:** <mention-page url="{{<documents_dashboard_url>}}">Documents</mention-page>
- **On-call:** <mention-page url="{{<oncall_dashboard_url>}}">On-call</mention-page>

## How to contribute

1. **Got a request?** → <mention-page url="{{<intake_dashboard_url>}}">Intake</mention-page>
2. **Want to learn what we're working on?** → <mention-page url="{{<sprints_dashboard_url>}}">Sprints</mention-page>
3. **Need to onboard?** → <mention-page url="{{<onboarding_dashboard_url>}}">Onboarding</mention-page>
4. **Want context on past decisions?** → <mention-page url="{{<documents_dashboard_url>}}">Documents</mention-page> (filter by Type = ADR)

---

_Wired by `jstack-notion-setup` — `notion_defaults.parent_pages.about_page` (catalog: `about_page`)_
