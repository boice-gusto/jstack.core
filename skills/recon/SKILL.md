---
name: jstack-recon
description: Read-oriented sweep across configured Slack, Jira, and similar integrations to answer "what needs attention"—P1s, stale work, open questions, and standup-ready action items. Produces a bounded summary plus an explicit action_items count line for evals. Does not open tickets, post to Slack, or change external state unless a different skill is invoked after user approval.
category: recon
---

<!-- Chain Contract -->
<!-- inputs: user_request, jstack_config, integration APIs or pasted exports -->
<!-- outputs: structured_result (summary + action_items + optional next_skill) -->
<!-- chains-to: jstack:prioritize -->

Read the setup preamble first:
!cat ${CLAUDE_PLUGIN_ROOT}/prompts/setup/preamble.md

## What this skill is for

- **In scope:** “What’s on fire?”, “standup prep,” “what’s stale?”, “summarize the last N hours/days in #channel or PROJECT,” **synthesizing** threads/issues into a **short** brief. Prefer **read** tools: search, list, fetch issue/ thread metadata, summarize.
- **Out of scope:** **Creating** Jira issues, **posting** Slack messages, **transitioning** workflow states, **editing** Notion, or any write without explicit user confirmation and a **different** skill (e.g. `jstack:jira-intake`, `jstack:meetings-post-slack`). This skill **stops** at a clear handoff when writes are needed.

**References**
- Slack MCP behavior and limits: `${CLAUDE_PLUGIN_ROOT}/skills/recon/references/slack-patterns.md` and `_core/best-practices/slack/mcp-patterns.md` if present.
- Question discipline: `${CLAUDE_PLUGIN_ROOT}/skills/_core/references/question-patterns.md`
- Discrete choices (AskUserQuestion or equivalent): `${CLAUDE_PLUGIN_ROOT}/skills/_core/references/ask-user-question-patterns.md`
- Integrations: `${CLAUDE_PLUGIN_ROOT}/skills/_core/references/integration-guide.md`
- Accuracy + parallel multi-source gathering: `${CLAUDE_PLUGIN_ROOT}/skills/_core/best-practices/accuracy-rules.md`, `parallel-agents.md` — use when merging Slack + Jira + GitHub + calendar; distinguish **discussed** vs **done**. Org-specific filters may live in an overlay plugin’s `team_context` / `references/org-context.md`.

## Intake: resolve scope from `$ARGUMENTS` + thread

1. **Integrations** — `slack` only, `jira` only, or **both** (default: whatever the user names; if they say “everything” use **all configured** in `jstack.config.json`).
2. **Time window** — Examples: `last_24h`, `since monday`, `this_sprint`, `last_standup` (if unknown, use **one** question: *“Narrow to last 24h, this week, or this sprint?”*). If the user **pasted** a static export, the window is **the paste**—state that explicitly.
3. **Depth**
   - **`list`** — Bullets, minimal narrative; good for “just the action items.”
   - **`narrative`** — 1–2 sentences of context per cluster (e.g. per incident, per project).
4. **Audience** (optional) — “For my eyes” vs “paste into standup” vs “escalation summary” (affects tone and PII; see [PII and safety](#pii-and-safety)).

**Rule:** **At most one** clarifying question. If the user gave **channel/project** ambiguously, prefer asking **which project key or channel** over asking about time.

## Output shape

- **Default:** the markdown skeleton in **Step 4 — Output (required shape)** (summary, hot/urgent, stale, action items with `action_items: <N>`, limitations, suggested next).
- **Raw list only:** if the user explicitly asked for a list, still keep **`action_items: <N>`** on its own line and a one-line **Recon summary** per eval contract.

## Procedure (execute in order)

### Step 1 — Load config

- Read `jstack.config.json` for team identifiers, default channels, Jira project keys, and any `skill_defaults` that apply to recon. **Never** invent a channel ID, project key, or domain.
- If **nothing** is configured for the requested integration, state that and **do not** mock API data.

### Step 2 — Pull signals (read-only)

**Slack (when in scope)**
- Prefer **search or history** for the time window; group by **thread** or **topic** when many messages.
- Classify: **P0/P1 language**, on-call handoffs, “blocked,” “can someone…,” and **unanswered questions** (question mark + no reply in thread).
- If rate limits or partial visibility apply, **say** “partial; only N messages visible” rather than overclaiming.

**Jira (when in scope)**
- Prefer **filter / board** for “updated in window” + **priority** + **status** (e.g. In Progress, Blocked).
- Call out: **aging** in same status, **assignee = empty**, **subtasks** not done, **SLA** field if the team uses it (only if present in response—do not invent).
- If only **one** of many projects is relevant, name which you searched.

**Pasted or offline content**
- If the user **pasted** Slack/Jira text, treat the paste as **authoritative**; do not claim you “searched” the channel. Say **Source: user paste**.

### Step 3 — Synthesize

- **Order by urgency:** user-visible incidents / P1s first → blockers → deadlines → other.
- **Deduplicate:** same ask in two threads = one line with “(2 threads)”.
- **No orphan bullets:** every action item has **owner** (person or *unassigned*), or **@mention** if visible.

### Step 4 — Output (required shape)

Use this skeleton unless the user asked for a **raw list only** (then still keep the `action_items` line and header one-liner).

```markdown
## Recon summary
<2–4 sentences: what matters and why now>

## Hot / urgent
- …

## Stale or at risk
- …

## Action items
- [ ] <verb-first> — **Owner:** <name|unassigned> — **Due/SLA if known>**
- [ ] …

action_items: <N>

## Notes / limitations
- <e.g. partial Slack visibility, Jira filter = X, user paste only>

## Suggested next steps
- <e.g. run `/jstack:prioritize` on the list, or `jstack:jira-intake` for first item—**do not** execute>
```

**Eval gate line:** The line `action_items: <N>` **must** match the **count of checklist bullets** in `## Action items`. If there are **zero** action items, output `action_items: 0` and still provide a one-line `## Recon summary`.

### Step 5 — Chaining and handoff

- If the user asked to **order** the list, **rank**, or use **RICE/WSJF**, after the recon output add **exactly**:

  `next_skill: jstack:prioritize`

  …and **paste the same action items** under a `## Handoff payload for prioritize` block (copy-paste friendly). Skill id: `jstack-prioritize`.

- If they need **Jira** created from the top item, do **not** create here; end with: “Use `jstack:jira-intake` with these fields: …” (fill **Summary**, **Description stub**, **Labels** as optional).

- The frontmatter `chains-to` names the **typical** graph; only emit `next_skill` when the user **wants** ranking—otherwise omit it to avoid spurious handoffs.

## PII and safety

- **Do not** paste secrets, full auth tokens, or **customer** names from production unless the user explicitly included them and needs them; prefer **redacted** (e.g. `customer A`).
- If summarizing for a **wider** channel, strip **personal** health or performance details down to a generic label.

## Edge cases

| Case | Behavior |
|------|----------|
| **No activity** in window | Short summary: “no notable activity”; `action_items: 0` |
| **Too many** items (50+) | Top **10** by urgency + one line: “N more; narrow time window or filter by project.” |
| **Conflicting** priority in Slack vs Jira | State the conflict: “Slack says P1, Jira says P2—verify in SOAR/issue PLAT-1234.” |
| **User asked for “email”** but not configured | Say email is out of scope or needs integration; offer Slack/Jira or paste. |
| **Standup** format | Add **Yesterday / Today / Blockers** only if the user said “standup”; else keep default sections. |

## Failure modes and recovery

| Situation | What to do |
|-----------|------------|
| Missing or invalid config | Point to `/jstack:setup` or `jstack setup`; if possible say **which** key is missing (`slack.workspace`, Jira `projectKey`, etc.—only keys you know from schema/docs). |
| Integration unhealthy | `jstack doctor` + `integration-guide.md`; output whatever partial info is safe. |
| Tool returns errors | One-line per error, no stack traces; suggest retry or narrower query. |
| User expects **live** data but only paste provided | **Label** as paste-only. |

## Micro-example (illustrative format only)

```markdown
## Recon summary
One deployment-related thread in #eng-alerts; Jira shows PLAT-8912 in review. No new P0s in the last 24h.

## Hot / urgent
- **Deploy rollback** (thread t-42): clear as of 10:20 UTC; follow-up: postmortem note.

## Action items
- [ ] Add replica lag pre-deploy check — **Owner:** jordan — **By:** EOW
- [ ] Close loop on PR 4412 review — **Owner:** sam — **By:** next standup

action_items: 2
```

## User request

$ARGUMENTS
