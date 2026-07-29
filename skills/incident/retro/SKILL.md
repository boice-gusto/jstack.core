---
name: jstack-retro
description: "Facilitate a blameless retrospective: timeline, impact, what went well, improvements, actions with owners and dates."
category: incident
effort: high
---

<!-- Chain Contract -->
<!-- inputs: user_request, jstack_config -->
<!-- outputs: structured_result -->

Read the setup preamble first:
!cat ${CLAUDE_PLUGIN_ROOT}/prompts/setup/preamble.md
Load the policy this domain is governed by (do not restate it from memory):
!cat ${CLAUDE_PLUGIN_ROOT}/prompts/policies/incident-policy.md
!cat ${CLAUDE_PLUGIN_ROOT}/prompts/chains/incident-response-chain.md

## What this skill is for
Run a blameless incident retro: timeline, contributing factors, and action items with owners — describing system and process failure, never individual fault.
- **Out of scope:** Assigning blame to a person, and closing action items on the participants' behalf.

## Domain rules — retro

### Absolute rules

1. **Examine the system and process that allowed the incident, not who made a mistake.** "Human
   error" is the starting point for asking why the error was possible, not the concluding finding
   ([Blameless PostMortems and a Just Culture](https://www.adaptivecapacitylabs.com/blog/2019/07/09/blameless-postmortems-and-a-just-culture/);
   [Google SRE Book — Postmortem Culture](https://sre.google/sre-book/postmortem-culture/)).
2. **State multiple contributing factors, not a single root cause.** Real incidents typically pass
   through several weakened defenses at once, not one clean cause-and-effect chain — the Swiss
   cheese model of accident causation describes exactly this alignment of holes across layers
   ([Swiss cheese model](https://en.wikipedia.org/wiki/Swiss_cheese_model)). A retro naming one root
   cause usually stopped asking "why" too early.
3. **No individual is named as the cause of the incident.** If a specific action belongs in the
   timeline, describe the action and the system conditions that made it likely or possible — never
   a judgment of the person who took it.
4. **Every action item has a named owner and a due date.** An action item with either missing is
   not tracked — it's a wish that will not get revisited.
5. **Every timeline entry carries an explicit timezone or UTC.** A cross-team incident read later
   by people in different zones with bare local times will reconstruct the wrong sequence of
   events.
6. **Detection time, mitigation time, and resolution time are three separate timestamps.**
   Collapsing them into one "resolved at" hides how much of the total duration was detection lag
   versus actual fix time — information the next incident needs.
7. **The retro itself gets a review/close-out date.** An action item with no revisit date silently
   becomes permanent scope creep that never actually gets marked done.

### Thresholds

| Signal | Threshold | Basis |
|---|---|---|
| Contributing factors named | ≥2 before the retro is considered closed | A single named cause usually means the analysis stopped one "why" too early |
| Action item completeness | Owner + due date on 100% of action items | Either missing means the item is untracked, not just informal |
| Timeline timezone | 100% of timestamps carry UTC or an explicit offset | Bare local time misorders a cross-timezone timeline for later readers |
| Timestamp granularity | Detection, mitigation, and resolution logged as 3 distinct times | Collapsing them hides whether the gap was detection lag or fix time |
| Retro follow-up | 1 explicit review/close-out date, pulled from the org's configured review window rather than invented | An open item with no revisit date never actually closes |

### Named anti-patterns

| Anti-pattern | Why wrong | What instead |
|---|---|---|
| Naming a person as the cause | Turns a systems investigation into blame, which suppresses future honest reporting | Describe the action and the system conditions that made it possible, not the person |
| Stopping at "human error" | Treats the starting point of the investigation as its conclusion | Keep asking why the error was possible until a system-level factor is named |
| Single root cause | Real incidents usually align several weakened defenses at once, per the Swiss cheese model | Name every contributing factor found, not just the first or most obvious one |
| Action item with no owner or date | Effectively a wish list; nothing tracks it to completion | Require both an owner and a due date before an item counts as logged |
| Bare local timestamps | Misorders the sequence of events for anyone in a different timezone reading it later | Log every timestamp in UTC or with an explicit offset |

### Worked example

- *Weak:* "The on-call engineer pushed a bad config and caused the outage. They should be more
  careful next time. Action: be more careful."
- *Sharp:* "Contributing factors (not a single root cause): (1) the config-validation step in the
  deploy pipeline does not check the field that caused the outage — `deploy.yml` has no schema
  check on `retry_backoff_ms`; (2) the staging environment does not mirror production's connection
  pool size, so the same config passed staging cleanly. Timeline (UTC): 2026-07-20 14:02 config
  deployed; detected 14:09 via error-rate alert; mitigated 14:22 via rollback; resolved 15:10 after
  root config fix verified in staging with matched pool size. Action items: add schema validation
  for `retry_backoff_ms` to the deploy pipeline (owner: platform-eng, due 2026-08-03); align staging
  pool size with production (owner: infra, due 2026-08-10). Review date: 2026-08-15."

### What this skill must not do

- Does not decide or change the incident's severity classification retroactively — reports what
  was declared and when.
- Does not perform personnel evaluation of the on-call responder — any performance-relevant
  observation routes to `jstack:notion-performance` or an EM conversation, never blended into the
  blameless doc.
- Does not post the retro publicly or externally — this is an internal artifact; external comms
  route through `jstack:announcement-review`.

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
Stabilize before diagnosing. Record the timeline as you go, not afterwards from memory. Do not state a cause until it is established — in anything customer-facing, "under investigation" is correct and a guess is a liability.

### Step 3 — Execute
Timeline, impact, what went well, what to improve, actions with owners and dates.
- No individual blame — name systems and gaps.
- If customer comms needed, use `jstack:announcement-review` after draft is ready.

### Step 4 — Validate
Confirm the timeline is ordered and sourced, that cause is labelled as established or under investigation, and that no customer-facing text asserts more than is known.

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
| Impact unverified | Do not announce resolved; state current known status only. |

## Chaining
Complete the work here. If a natural follow-up exists, add one line: `suggested_next: <skill-name>` with a copy-paste handoff block. Do not auto-invoke without user intent or a defined chain in `prompts/chains/`.

## User request

$ARGUMENTS
