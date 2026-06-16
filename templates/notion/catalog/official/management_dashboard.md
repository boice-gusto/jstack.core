# 🎯 Management — {{team_name}} {color="purple"}

<callout icon="🎯" color="purple_bg">
	**Management hub.** 1:1s, performance cycles, capacity, and decisions that shape the team. Per-person performance content stays in `parent_pages.pe_index` (private); roster updates in `team.members[]`.
</callout>

<table_of_contents color="gray"/>

<columns>
	<column>
		### 🤝 1:1s {color="green"}
		<mention-page url="{{<one_on_ones_hub_url>}}">1:1 hub</mention-page>
	</column>
	<column>
		### 📊 Performance {color="purple"}
		_PE / cycle reviews — see `pe_index` (private)_
	</column>
	<column>
		### ⚖️ Capacity {color="orange"}
		_Sprint commitments + spillover_
	</column>
</columns>

## Cadences

<table fit-page-width="true" header-row="true">
	<tr color="purple_bg">
		<td>Cadence</td><td>Activity</td><td>Output</td>
	</tr>
	<tr>
		<td>Weekly</td><td>1:1s with each direct report</td><td>1:1 page (Prep + After)</td>
	</tr>
	<tr>
		<td>Per sprint</td><td>Capacity check + scope adjust</td><td>Sprint goal locked</td>
	</tr>
	<tr>
		<td>Monthly</td><td>Skip-level + cross-team sync</td><td>Team note</td>
	</tr>
	<tr>
		<td>Quarterly</td><td>Goals review + planning</td><td>Strategy update</td>
	</tr>
	<tr>
		<td>Half-yearly</td><td>Performance cycle (H1 / H2)</td><td>Review documents</td>
	</tr>
</table>

## Decisions log

<callout icon="📜" color="purple_bg">
	**Significant management decisions** (scope changes, hires, role changes, process). Architecture decisions go to ADRs; product decisions to Product Strategy.
</callout>

<details color="gray">
<summary>Recent decisions (last 5)</summary>
- _YYYY-MM-DD — Decision — owner — rationale_
- _YYYY-MM-DD — Decision — owner — rationale_
</details>

## Performance philosophy

> _What "good performance" looks like on this team — bar by level, expectations._ {color="purple"}

- **Levels:** see `team.members[].metadata.level` and `levels_and_expectations.*` config.
- **Calibration:** EM / PE / next-level peer per cycle.
- **Documentation:** kept in `pe_index` (private), not the team teamspace.

## Capacity tracking

<columns>
	<column>
		### 🟢 Available {color="green"}
		_Member, focus area, days/week_
	</column>
	<column>
		### 🟡 Partial {color="yellow"}
		_OOO, holiday, side-project carve-out_
	</column>
	<column>
		### 🔴 Out {color="red"}
		_PTO, leave, on-call recovery_
	</column>
</columns>

## Hiring

<callout icon="🪜" color="green_bg">
	**Active reqs and pipeline.** Candidates' content stays in your ATS — link from here, don't paste.
</callout>

- **Open reqs:** _list with link_
- **Interview loop:** _link to runbook_
- **Onboarding plan:** <mention-page url="{{<onboarding_dashboard_url>}}">Onboarding</mention-page>

## Skills that write here

- `/jstack:meetings prepare` (1:1 prep)
- `/jstack:notion performance` (cycle reports)
- `/jstack:advice` (leadership counsel)
- `gusto-ic-impact-prep` (overlay)

---

_Wired by `jstack-notion-setup` — `notion_defaults.parent_pages.management_dashboard` (catalog: `management_dashboard`)_
