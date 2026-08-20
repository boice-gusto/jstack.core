---
name: jstack-sop-expectations
description: "Maintain role expectations docs: what success looks like, autonomy boundaries, escalation paths."
category: sop
effort: medium
---

<!-- Chain Contract -->
<!-- inputs: user_request, jstack_config -->
<!-- outputs: structured_result -->

Read the setup preamble first:
!cat ${CLAUDE_PLUGIN_ROOT}/prompts/setup/preamble.md

## What this skill is for
Maintain the role-expectations document: what success looks like, autonomy boundaries, and escalation paths.
- **Out of scope:** Enforcing the expectations — surface gaps between policy and reality for the user to resolve.

## Domain rules — expectations

- Single source of truth: link to canonical Notion/Confluence home.
- SOP changes often need a stakeholder list; include rationale and comms snippet.
- If SOP and reality differ, call out the tension and suggest an experiment, not fake compliance.
- **A good autonomy-boundary/escalation-path entry names a specific on-call rotation or role plus
  a stated SLA** (e.g. "page the on-call SRE via PagerDuty; ack within 15 minutes" or "P1 outside
  business hours escalates to the EM within 30 minutes"), not "ask your manager" or "use your
  judgment." An unnamed escalation path can't be followed under pressure — the person reading it
  at 2am needs a name/role and a time bound, not a vibe.
- **Anti-pattern — the vague-authority escalation line.** Writing "check with your manager if
  unsure" as the entire autonomy boundary looks like guidance but gives the reader nothing to act
  on: no channel, no named role, no time bound. Replace it with the actual rotation/role, the tool
  used to reach them (PagerDuty, Slack channel, on-call alias), and the response-time expectation.

### Worked example
- *Weak:* "If something goes wrong outside your area, escalate to your manager."
- *Sharp:* "Autonomy boundary: you can deploy without review for docs-only changes; anything
  touching billing code requires a second approval. Escalation: page `#platform-oncall` via
  PagerDuty for P1/P2; the on-call SRE acks within 15 minutes per the team's SLA. For anything
  below P2, post in `#platform-help` and expect a response within one business day."

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
Describe the process that is actually followed, not the aspirational one. Every step names an owner and an observable completion condition.

### Step 3 — Execute
Role expectations doc: what success looks like, autonomy boundaries, escalation. Pair with resources.

### Step 4 — Validate
Confirm every step has an owner and an observable completion condition, and that it describes current practice rather than intent.

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
| No canonical SOP link in config | Ask for the Notion/Confluence URL before proceeding. |
| SOP contradicts observed practice | Surface the tension explicitly; suggest an experiment. |

## Chaining
Complete the work here. If a natural follow-up exists, add one line: `suggested_next: <skill-name>` with a copy-paste handoff block. Do not auto-invoke without user intent or a defined chain in `prompts/chains/`.

## User request

$ARGUMENTS
