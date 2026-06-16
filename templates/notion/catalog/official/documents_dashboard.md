# 📁 Documents — {{team_name}} {color="brown"}

<callout icon="📁" color="brown_bg">
	**Documents hub.** Catalog of specs, ADRs, runbooks, contracts, briefs. The Documents DB tracks status + ownership + review cadence; the Wiki holds the readable narrative.
</callout>

<table_of_contents color="gray"/>

<columns>
	<column>
		### 🆕 Recent {color="brown"}
		_Replace with `<mention-page>` blocks for the last 5 docs._
	</column>
	<column>
		### 🔍 Needs review {color="yellow"}
		_Embed a Documents view filtered to `Next Review <= today`._
	</column>
	<column>
		### ⚠️ Stale {color="red"}
		_Embed a Documents view filtered to `Last Reviewed > 6 months ago`._
	</column>
</columns>

## Catalog

<callout icon="📁" color="brown_bg">
	Inline view of the **Documents** database. Default sort: Status → Last Reviewed.
</callout>

<mention-database url="{{<documents_db_url>}}">Documents</mention-database>

## Doc types

<table fit-page-width="true" header-row="true">
	<tr color="brown_bg">
		<td>Type</td><td>What it is</td><td>Skill</td><td>Review cadence</td>
	</tr>
	<tr>
		<td>**Spec**</td><td>Design + scope of a feature</td><td>`/jstack:notion article`</td><td>per release</td>
	</tr>
	<tr>
		<td>**ADR**</td><td>Architecture Decision Record</td><td>`/jstack:notion adr`</td><td>quarterly</td>
	</tr>
	<tr>
		<td>**Runbook**</td><td>How to handle a recurring scenario</td><td>`/jstack:notion knowledge-base`</td><td>quarterly</td>
	</tr>
	<tr>
		<td>**Contract**</td><td>Vendor / customer agreement</td><td>manual</td><td>per renewal</td>
	</tr>
	<tr>
		<td>**Brief**</td><td>Short proposal / pitch</td><td>manual</td><td>one-off</td>
	</tr>
	<tr>
		<td>**Notes**</td><td>Misc that doesn't fit above</td><td>manual</td><td>—</td>
	</tr>
</table>

## Conventions

<callout icon="💡" color="yellow_bg">
	**Every entry needs:** Owner, Status, Tags, and (for Spec/ADR/Runbook) Last Reviewed + Next Review.
</callout>

- **Linking:** every doc references the related Tasks/PRs/Slack threads in its body.
- **ADR template:** Context → Decision → Consequences → Alternatives considered.
- **Verification:** mark pages `verified` (Notion's built-in) when reviewed; let it auto-expire on the next review date.

## Tags taxonomy

`eng` · `product` · `design` · `ops` · `legal` · `security`

Add new tags via the DB schema only — keep the set tight to preserve filterability.

## Skills that write here

- `/jstack:notion adr` — ADRs
- `/jstack:notion article` — long-form
- `/jstack:notion knowledge-base` — runbooks
- `/jstack:knowledge intake` — promotes private notes to Documents

---

_Wired by `jstack-notion-setup` — `notion_defaults.parent_pages.documents_dashboard` (catalog: `documents_dashboard`)_
