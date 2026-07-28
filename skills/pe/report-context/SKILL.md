---
name: jstack-pe-report-context
description: Validate and normalize PE / team report JSON against schemas/pe; gate skills until pe.configured is true.
when_to_use: Building or validating performance/team report context JSON before render or Notion/ HTML publish.
category: reports
data_class: people_performance
effort: low
gbrain_destination: team
---

<!-- Chain Contract -->
<!-- inputs: user_request, jstack_config -->
<!-- outputs: structured_result -->

Read the setup preamble first:
!cat ${CLAUDE_PLUGIN_ROOT}/prompts/setup/preamble.md

## What this skill is for
Validate and normalize PE / team report JSON against schemas/pe; gate skills until pe.configured is true.

## Domain rules — pe/report-context

**Absolute rules**

1. Describe observable behavior, not inferred motive. What someone did, said, or produced is evidence; why they supposedly did it is speculation — "motivation is speculation, behavior is evidence" ([Psychology Today — Motivation Is Speculation, Behavior Is Evidence](https://www.psychologytoday.com/us/blog/how-we-learn/202508/motivation-is-speculation-behavior-is-evidence)). A report that states intent ("they don't care about quality") as fact has crossed from evidence into character judgment.
2. Every claim about a person needs a specific, dated example, ideally in situation-behavior-impact form: what was the situation, what did they do, what resulted. If you cannot name the instance, the claim doesn't belong in the report.
3. Never generalize from a single incident. A pattern claim ("consistently misses deadlines") needs evidence from multiple, separated instances — a single data point supports "on this date, X happened," not a trend.
4. Recency and range both matter: draw evidence from more than one time window (not all from the same week) so a single bad sprint or one good month doesn't dominate the read. A single standout incident can swing a rating by a large margin if left unchecked (the horn/halo effect) — treat any claim resting on one incident as unverified until corroborated ([performance review bias examples](https://sprad.io/blog/performance-review-biases-12-examples-and-how-to-fix-them-with-manager-scripts)).
5. Include only the minimum data necessary for the report's stated purpose. No unrelated personal details — health, family situation, protected-class information, personal opinions traded in confidence — belong in a report about work behavior.
6. State uncertainty explicitly. If evidence is thin, secondhand, or contested, say so rather than presenting it with the same confidence as a directly observed, corroborated fact.

## Thresholds

| Signal | Threshold | Why |
|---|---|---|
| Evidence span | ≥2 separate dated instances, from different time windows, before stating a pattern | One instance is an event; a pattern claim needs more than one data point to be more than an anecdote |
| Recency window | Weight examples from within the current reporting period; anything much older needs an explicit reason for staying relevant | Old, resolved issues shouldn't silently anchor a current assessment |
| Single-incident swing | Any claim resting on exactly one incident is flagged `[single-incident, unverified]` | A single standout event can move an assessment by a large margin (the horn/halo effect) even when it's not representative |
| PII fields in report | Zero unrelated personal identifiers (health, family, protected-class status, private conversations) | The report exists to describe work behavior, not a person's life outside it |

## Anti-patterns

| Anti-pattern | Why wrong | What instead |
|---|---|---|
| Stating motive as fact | "They did this because they don't respect the process" is a guess written as if observed | State the behavior only; if motive is genuinely relevant, mark it explicitly as an inference, not a fact |
| Single-incident generalization | One bad meeting becomes "consistently unprofessional" — the horn effect distorting a whole assessment | Require a second, separate, dated instance before calling something a pattern |
| Vague trait language | "Not a team player," "bad attitude" — unfalsifiable, unactionable, and easy to dispute because there's nothing concrete to point to | Replace with the specific situation-behavior-impact instance that prompted the concern |
| Including unrelated personal information | Health status, family situation, or private confidences have no bearing on work-behavior evidence and create real privacy harm | Include only what's necessary to describe the work-relevant behavior and its impact |
| Reporting hearsay as firsthand observation | "I heard that..." presented with the same confidence as something directly witnessed misleads the reader about evidence quality | Label secondhand information explicitly and note who observed it directly, if known |

## Worked example

- *Weak:* "This person doesn't take feedback well and seems checked out lately."
- *Sharp:* "In the March 14 design review, when asked to revise the API contract, the response was to close the doc without further comment; the revision wasn't made until a second, separate request on March 21. This is one specific instance from one week — flagging it as a single data point, not a stated pattern, since I don't have a second, separated example of the same behavior to corroborate a trend."

## What this skill must not do

- Must not render a judgment about a person's overall worth, character, or potential — it assembles evidence about specific, observable work behavior for a stated, legitimate purpose, nothing broader.
- Must not include another person's PII: health information, family details, protected-class status, or private conversations shared in confidence have no place here.
- Must not state inferred motive as if it were observed fact — motive, if included at all, is explicitly marked as inference.
- Must not generalize a pattern from a single incident, and must not omit the uncertainty when evidence is thin or secondhand.
- Must not be the mechanism that decides a personnel outcome — it prepares context for a human decision-maker; it does not make the decision.

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
Every figure traces to a named source with an as-of time. Mark a missing metric as `[no data]` — never interpolate it, and never drop the row silently, because omission in an authoritative-looking report misleads exactly as much as fabrication.

### Step 3 — Execute
Apply the `jstack-pe-report-context` workflow using config and any applicable templates under `templates/reports/`.

### Step 4 — Validate
Confirm every figure has a source and as-of time, that gaps read `[no data]`, and that the footer and scope match this report's kind. Re-run the render and confirm identical output from identical inputs.

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
| Missing data for a metric | Leave cell blank with `[no data]`; do not invent numbers. |
| Tone mismatch | Offer 2 tone options from `prompts/tones/` in one question. |

## Chaining
Complete the work here. If a natural follow-up exists (e.g. `jstack-team-report` then `jstack-share-html-publish`), add one line: `suggested_next: <skill-name>` with a copy-paste handoff block. Do not auto-invoke without user intent or a defined chain in `prompts/chains/`.

## User request

$ARGUMENTS
