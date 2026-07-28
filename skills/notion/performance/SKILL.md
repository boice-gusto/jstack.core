---
name: jstack-notion-performance
description: Create or update a performance cycle page in Notion (goals, impact, growth, feedback summary) using templates/notion/performance.json; metadata only in core.
category: notion
data_class: people_performance
disable-model-invocation: true
effort: high
gbrain_destination: personal
---

<!-- Chain Contract -->
<!-- inputs: user_request, jstack_config -->
<!-- outputs: structured_result -->

Read the setup preamble first:
!cat ${CLAUDE_PLUGIN_ROOT}/prompts/setup/preamble.md

## What this skill is for
Create or update a performance-cycle page in Notion — goals, impact, growth, feedback summary — from `templates/notion/performance.json`, keeping people-performance data in the personal gbrain, not core.
- **Out of scope:** Deciding or finalizing a performance rating — this only assembles the page.

## Domain rules — notion-performance

### Absolute rules

1. **Describe observable behavior, not inferred motive**, in every impact or growth section — what
   someone did or produced is evidence; why they supposedly did it is speculation and does not
   belong on the page as fact ([Situation-Behavior-Impact feedback model — Center for Creative
   Leadership](https://www.ccl.org)).
2. **Substantive content stays in the personal gbrain destination**, per this skill's own
   `gbrain_destination: personal` frontmatter — only structural metadata (page title, creation
   date, template used) is referenced from core. Writing feedback or rating content to a shared or
   core destination is a scope violation, not a convenience.
3. **Never invent a quote, rating, or feedback line that wasn't actually supplied.** An unfilled
   template placeholder is a safer output than a fabricated one — it's visibly incomplete instead
   of silently wrong.
4. **Exclude any teammate's PII beyond name and role in a shared work context.** Health status,
   family situation, and personal-life details have no place on a performance page regardless of
   how they surfaced in a linked doc or meeting note.
5. **Do not compute or assert an overall rating tier** (exceeds/meets/below, or any org-specific
   scale) unless the user or a config-defined rubric explicitly supplies the mapping — assembling
   the page is not the same act as deciding the rating.
6. **Every impact claim on the page cites a dated, concrete example.** The evidentiary bar here is
   at least as strict as for any personnel document; an unlabeled impression does not belong in a
   record that may affect compensation or standing.
7. **Draft status until the named reviewer/manager explicitly approves.** A performance page is
   higher-stakes than a generic report and needs at least as strict a hold-for-review gate.

### Thresholds

| Signal | Threshold | Basis |
|---|---|---|
| Content destination | 100% of substantive content in `gbrain_destination: personal`; 0% in core | Sensitive performance content in a shared destination is a data-handling defect |
| Evidence per impact claim | ≥1 dated, concrete example | An unlabeled impression carries no more weight than a guess |
| Rating assignment | 100% derived from an explicit rubric/config mapping; 0% inferred by the skill | Assigning a rating with no rubric is a personnel decision this skill has no authority to make |
| PII fields | 0 unrelated personal identifiers (health, family, protected-class status) | The page describes work behavior only |

### Named anti-patterns

| Anti-pattern | Why wrong | What instead |
|---|---|---|
| Writing substantive content to the core/shared gbrain | Performance content is more sensitive than a normal report and leaks broadly | Route it to `gbrain_destination: personal`; keep only structural metadata in core |
| Assigning a rating tier with no rubric | The skill silently makes a personnel decision it has no authority to make | Only apply a rating explicitly derived from user input or a config rubric |
| Inventing a supportive quote to fill a template section | Fabricated evidence in a document that can affect compensation or standing | Leave the section as an explicit placeholder pending real input |
| Including a teammate's unrelated personal detail | Irrelevant PII in a sensitive artifact, disclosed without cause | Strip to role plus work-relevant behavior only |

### Worked example

- *Weak:* "Filled in the performance page — looks like a great quarter, gave them 'Exceeds'
  overall."
- *Sharp:* "Assembled `templates/notion/performance.json`: Goals (from the linked planning doc, 3
  items), Impact (2 dated examples supplied by the user — Mar 14 launch, Apr 2 incident response),
  Growth (left as an explicit placeholder, no input given yet). Did not assign an overall rating —
  no rubric mapping was provided in config or by the user, so that field stays blank pending the
  manager's own judgment. Written to the personal gbrain destination per frontmatter; only the page
  title and creation date are referenced from core. Status: Draft, pending manager review."

### What this skill must not do

- Does not decide or finalize a performance rating — assembles the page only, per this skill's own
  stated out-of-scope line.
- Does not render a judgment of the subject's overall worth or character.
- Does not include another person's PII.
- Does not publish without the named reviewer's explicit approval.

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
Resolve the parent page or database from `notion_defaults` — never guess an id. Read a page before overwriting its body. Create as a draft and let the user promote it; do not publish on their behalf. If the target is unset in config, say so instead of writing somewhere plausible.

### Step 3 — Execute
Apply the `jstack-notion-performance` workflow using config and any applicable templates under `templates/notion/`.

### Step 4 — Validate
Re-fetch the page and confirm the target parent, the title, and the properties you set. Verify you did not overwrite pre-existing content, and that it is still a draft unless the user asked to publish.

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
| Database not found | Confirm `database_id` in config or ask for a pasted Notion URL. |
| Property type mismatch | Show expected vs actual type; suggest manual Notion fix or config update. |

## Chaining
Complete the work here. If a natural follow-up exists (e.g. `jstack-notion-planning` then `jstack-notion-sprint`), add one line: `suggested_next: <skill-name>` with a copy-paste handoff block. Do not auto-invoke without user intent or a defined chain in `prompts/chains/`.

## User request

$ARGUMENTS
