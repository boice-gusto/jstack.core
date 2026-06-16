---
name: jstack-granola-daily-summary
description: "Summarize Granola (or meeting) notes into a daily digest."
category: workflows
gbrain_destination: team
data_class: internal
when_to_use: "End-of-day summary from meeting notes or Granola exports."
---

<!-- Chain Contract -->
<!-- end Chain Contract -->

Read the setup preamble first:
!cat ${CLAUDE_PLUGIN_ROOT}/prompts/setup/preamble.md
# Granola Daily Summary → Notion

You are generating a daily meeting digest for the user. The goal is to save
them the chore of reviewing transcripts by hand: they want to open one
Notion page per day and see, at a glance, what was discussed and what they
(or others) owe as a result.

## Date resolution

- Default to **today in America/Los_Angeles** (PST/PDT). Compute this with
  `date` via Bash or inline — do not guess.
- If the user (or the scheduled task prompt) supplies `--date YYYY-MM-DD`,
  use that instead. This enables back-filling.
- Keep the resolved date in a variable `REPORT_DATE` (format `YYYY-MM-DD`)
  and use it consistently for the page title and all searches.

## Step 1 — Pull the day's meetings from Granola

1. Using the **Granola** (or meeting-ingest) MCP server registered in the host
   config, list meetings whose **start time falls on `REPORT_DATE`** in PT.
   Tool names vary by server implementation (e.g. `list_meetings`,
   `query_granola_meetings`); confirm in `mcps/<server-id>/tools/` before calling.
2. For each meeting, fetch the transcript via that server's transcript tool
   (commonly `get_meeting_transcript`).

Do **not** filter meetings — the user has explicitly opted in to "no
filtering". Include every meeting Granola returns, even short ones.

### If a meeting has no transcript

Still include it in the output with a note `(no transcript available)` in
place of the summary. The user wants to know the meeting existed.

### If there are zero meetings for the day

Skip straight to Step 3 and create a page whose body simply says
`No meetings recorded for REPORT_DATE.` This is important — the user
relies on the daily page appearing as a signal that the automation ran.

## Step 2 — Summarize each meeting

For every meeting, produce the following block. Use neutral, concise
language. The user is a busy professional; aim for skimmability over
completeness.

```
## <Meeting Title>
**Time:** <start time PT> – <end time PT>  ·  **Participants:** <names>

### Summary
<3–5 sentences of what was actually discussed — the "what". Focus on
decisions reached, problems raised, and topics covered. Do not editorialize.>

### Action items & decisions
- **<Owner>** — <action or decision>  _(due: <deadline if stated>)_
- ...
```

**Attribution rules for action items:**

- If a transcript line like "I'll send that over by Friday" is clearly
  attributable to a speaker, attribute it to that speaker by name.
- If ownership is ambiguous, write `**Unassigned**` rather than guessing.
- Include explicit deadlines only when actually stated; omit the `_(due: …)_`
  suffix otherwise.
- A "decision" is anything the group agreed on (go/no-go, picked option A,
  deferred until next week). List decisions in the same bullet list and
  prefix with `**Decision:**` so they stand out.

If there are zero action items and zero decisions, write
`_No explicit action items or decisions captured._` so the section is
never empty.

## Step 3 — Resolve the Notion parent page

The parent page is **provided by the user** via the `--parent-page` argument.
This can be a Notion page ID or a full Notion URL.

- If the user supplies `--parent-page <id-or-url>`, extract the page ID and
  use it directly when creating the child page.
- If the user does **not** supply `--parent-page`, **ask them** before
  proceeding:

  > "Which Notion page should I publish the daily summary under? Please
  > provide the page ID or URL (e.g., open the page in Notion → Share →
  > Copy link)."

  Do **not** guess or use a default — every user's workspace is different.

Once you have the parent page ID, store it in a variable `PARENT_PAGE_ID`
and use it consistently for creating/updating child pages.

### Idempotency check

Before creating a new page, use your **Notion** MCP's search (tool names vary;
see `mcps/<server-id>/tools/`) scoped to the parent to find a child titled
`Daily Summary — REPORT_DATE`. If one exists, **update** it instead of creating
a duplicate — rerunning the skill for the same day should refresh the output.

## Step 4 — Create (or update) the daily page

Create (or update) the child under `PARENT_PAGE_ID` using your Notion MCP's
page-create / page-update tools with the title and body below.

- **Title:** `Daily Summary — REPORT_DATE`
- **Body:**

```
## Overview
- **Meetings:** <N>
- **Total duration:** <HH:MM>
- **Generated:** <ISO timestamp in PT>

---

<one block per meeting, in chronological order, using the Step 2 template>
```

If there were zero meetings, the body is just:
```
No meetings recorded for REPORT_DATE.
```

## Step 5 — Report back

Post a single short message in chat with:
- The Notion page URL
- A one-line stat: `<N> meetings · <X> action items · <Y> decisions`

That's it. Don't over-narrate — the user just wants confirmation and the
link.

## Error handling

- **Notion auth / token expired** → surface the exact error and tell the
  user to re-authorize the Notion MCP server from the host (/mcp or equivalent),
  then re-run this skill.
- **Granola returns nothing unexpectedly** → don't silently pretend it was
  a no-meetings day; ask the user whether they want to proceed with an
  empty page or investigate.
- **Partial failure mid-run** (some transcripts fetched, some failed) →
  include the successful ones and mark the failures in the page with
  `(transcript fetch failed: <reason>)`. Better to publish a partial
  digest than nothing.

## Why this skill exists (theory of mind for future-you)

The user runs a lot of meetings and finds it hard to extract what actually
matters from Granola's raw transcripts. A dated page under "Weekly AI's"
becomes their canonical record — one place per day to revisit, share, or
copy action items from. Because this runs unattended at 6pm PT every day,
reliability matters more than cleverness: prefer predictable output over
creative formatting, and always produce *some* page even on no-meeting
days so the user trusts the automation is alive.
