---
name: jstack-meetings-prepare
description: Build a 1-page meeting prep brief from calendar context, Jira in-progress items, and blockers for attendees.
category: meetings
effort: high
---

<!-- Chain Contract -->
<!-- inputs: user_request, jstack_config -->
<!-- outputs: structured_result -->

Read the setup preamble first:
!cat ${CLAUDE_PLUGIN_ROOT}/prompts/setup/preamble.md

## What this skill is for
Build a 1-page prep brief: Jira in-progress/blocked for attendees + user-provided calendar context. Read-only output.
- **Out of scope:** Posting, storing, or modifying external systems.

## Domain rules — meetings-prepare

### Absolute rules
1. Every agenda item states whether it needs a **decision**, a **discussion**, or is pure **information** — a bare topics list with no marker can't tell an attendee what to actually prepare.
2. A decision-bearing item names who is Responsible/Accountable (must attend) versus Consulted/Informed (can get the brief async) — defaulting everyone to "must attend" wastes exactly the calendar time this skill exists to protect.
3. Pre-reads ship attached to the agenda, not delivered verbally at the top of the meeting — material that needs review before a decision, read live instead, converts meeting time into read time.
4. State plainly what would happen if the meeting didn't happen. If the honest answer is "nothing" or "an async message would cover it," that is the cancellable signal — name it, don't bury it under a polished agenda.
5. Never record a decision or action item without a confirmed owner; actions additionally need a due date. An unattributed commitment can't be tracked or followed up.
6. Keep personal commentary and 1:1-specific content out of any brief meant for a shared or group meeting — the personal/team privacy boundary applies to meeting prep exactly as it does to knowledge capture.

### Thresholds
| Signal | Threshold | Source |
|---|---|---|
| Decision-item attendance | only Responsible + Accountable required in-room; Consulted + Informed can be async | [RACI for meeting attendance](https://www.pcma.org/raci-matrix-meeting-planning-clear-roles-effective-collaboration/); [McKinsey — limits of RACI](https://www.mckinsey.com/capabilities/people-and-organizational-performance/our-insights/the-organization-blog/the-limits-of-raci-and-a-better-way-to-make-decisions) |
| Pre-read delivery | attached with the agenda, before the meeting, not distributed at start | [Fellow — RACI meeting guide](https://fellow.app/blog/meetings/raci-meeting-your-complete-guide-to-a-well-informed-team/) |
| Cancellable test | purpose can't be stated in one sentence, or "what happens if this doesn't happen" answers "nothing"/"an async message" | [Lucid Meetings — Should you cancel your next meeting?](https://blog.lucidmeetings.com/blog/should-you-cancel-your-next-meeting/) |
| Action-item completeness | 100% of action items carry owner + due date; unassigned defaults to `unassigned` + a suggested ping | existing skill convention |

### Named anti-patterns
| Anti-pattern | Why wrong | What instead |
|---|---|---|
| Topics list with no decision markers | Attendees can't tell what to prep or what "done" looks like | Tag every item decision / discussion / information |
| Defaulting the whole team to "must attend" | Wastes calendar time for people who only need the outcome | Split R+A (must attend) from C+I (async brief) per item |
| Verbal context dump at meeting start | Burns synchronous time re-explaining material that should've been pre-read | Attach pre-reads to the agenda in advance |
| Recording a decision with no clear owner | Looks decided but isn't accountable or traceable later | Confirm attribution before writing a decision down |
| Prepping a brief without flagging a failed cancellable test | Optimizes a meeting that shouldn't happen instead of naming that fact | State the cancellable signal plainly when no decision or unique sync value exists |

### Worked example
- *Weak:* "Prepped a brief with talking points for tomorrow's sync."
- *Sharp:* "One decision item: approve or reject the CSV-export scope change (Responsible: eng lead; Accountable: PM — both must attend; QA and support are Consulted, briefed async via the linked doc). Pre-read attached, not for live reading. Two other agenda lines are pure status updates with no decision attached — flagging that these could move to an async Slack update instead; recommend cutting them from the live agenda. No action items carried forward without an owner: TICKET-310 spike — owner [name], due Friday."

### What this skill must not do
- Builds a read-only, 1-page prep brief (agenda framing, pre-reads, attendance split, blockers) — it does not send calendar invites, post to Slack, or store meeting notes (`jstack:meetings-post-slack`, `jstack:meetings-store-note` own those).
- Does not itself decide to cancel the meeting — it names the cancellable signal and lets the organizer act on it.

## Config and references
- `jstack.config.json` — team ids, integrations, `skill_defaults`, `jira_rules`, `notion`, `gbrain`. Never hardcode.
- Questions (open-ended, one at a time): `${CLAUDE_PLUGIN_ROOT}/skills/_core/references/question-patterns.md`
- Discrete choices (when the host supports AskUserQuestion or equivalent): `${CLAUDE_PLUGIN_ROOT}/skills/_core/references/ask-user-question-patterns.md`
- Integrations: `${CLAUDE_PLUGIN_ROOT}/skills/_core/references/integration-guide.md`
- Chaining: `${CLAUDE_PLUGIN_ROOT}/skills/_core/references/chaining-guide.md`

## Intake
1. Parse `$ARGUMENTS` — note whether the user **pasted** data or is asking you to **query** a system.
2. If a required id is missing, ask **one** focused question; otherwise use config defaults (label assumptions as `[assumption]`).
3. If the request bundles multiple unrelated goals, handle the first and offer to continue.

## Procedure
### Step 1 — Load config
Read relevant keys from `jstack.config.json`. If the integration is missing or unhealthy, say so and point to `jstack setup` / `jstack doctor` instead of faking data.

### Step 2 — Plan the safe path
Confirm attribution before recording a decision as someone's — misattributing a commitment is the costly error here. Keep personal notes out of team stores. Distinguish what was decided from what was merely discussed.

### Step 3 — Execute
Pull Jira in-progress and blockers for named attendees. Calendar is user-provided or paste.
- Output: 1-pager to bring to the room.

### Step 4 — Validate
Confirm each decision has an owner, each action has a date, and attribution matches what was actually said. Confirm personal content did not land in a shared store.

### Step 5 — Summarize and hand off
State what changed, what to verify, and suggest **one** next jstack skill if the work naturally continues.

## Output shape
Use a domain-appropriate heading, then:
- **Summary** (2–4 sentences)
- **Details** (bullets, table, or structured fields)
- **Next steps** with owner + timeline if known
- **Limitations** (partial data, no write access, etc.)
- For eval-gated skills, end with `result_ok: true` or `result_ok: false` + reason

## Failure modes

| Symptom | Recovery |
|---------|----------|
| Missing config / integration | Point to `jstack setup` or `jstack doctor`; do not continue with invented ids. |
| Auth / 403 / expired token | Stop; tell user to refresh credentials. Never print secrets. |
| Ambiguous goal | One clarifying question; if still unclear, present options A/B. |
| No transcript / empty paste | Ask user to provide notes or audio file path. |
| PII in public summary | Redact and flag before posting; offer redacted vs full versions. |

## Chaining
Complete the work here. If a natural follow-up exists (e.g. `jstack-meetings-granola` then `jstack-meetings-action-items`), add one line: `suggested_next: <skill-name>` with a copy-paste handoff block. Do not auto-invoke without user intent or a defined chain in `prompts/chains/`.

## User request

$ARGUMENTS
