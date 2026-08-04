---
name: jstack-create-plugin-pr
description: Open a PR to jstack.core or jstack.gusto using distribution.github from config; block secrets via path_deny_globs.
when_to_use: Contributor has local changes and wants a PR against the configured core or gusto distribution repo.
category: plugin
data_class: internal
disable-model-invocation: true
effort: medium
gbrain_destination: inherit
---

<!-- Chain Contract -->
<!-- inputs: user_request, jstack_config -->
<!-- outputs: structured_result -->

Read the setup preamble first:
!cat ${CLAUDE_PLUGIN_ROOT}/prompts/setup/preamble.md

## What this skill is for
Prepare a plugin change as a reviewable pull request: scoped diff, rationale, and the verification command a reviewer can run.
- **Out of scope:** Merging, pushing to a default branch, or committing unless asked. Never bundle unrelated changes into one PR.

## Domain rules — plugin PR

A plugin PR changes what every future session loads, so a defect here is not one bad run —
it is every run until someone notices. Review accordingly.

1. **One concern per PR.** A PR that touches a skill body, a config default, and a CI gate
   cannot be reverted cleanly when one of the three turns out to be wrong. Split it.
2. **Name the verification command in the PR body.** Not "tested locally" — the exact command a
   reviewer runs, and what a pass looks like. If the change is not verifiable by a command, say
   why and what was checked by hand.
3. **Never hand-edit a generated skill body.** `scripts/apply_detailed_skills.py` rewrites every
   `skills/**/SKILL.md` not in its `SKIP` set. A hand edit to a generated body is lost on the next
   regeneration, and the PR will look correct while the change silently disappears. Change the
   generator data, or add the skill to `SKIP` and take ownership of it.
4. **Regenerate derived artifacts in the same PR.** `skill-catalog.json`, `skills-data.js`, and the
   docs `index.html` are generated. A PR that adds a skill without regenerating them leaves the
   catalog disagreeing with the tree.
5. **A new skill ships with eval cases.** Coverage is gated; a skill with no evals cannot be shown
   to still work. Scaffolded cases that assert nothing (non-empty output, a word that would appear
   anyway) satisfy the count and prove nothing — they are a defect, not coverage.
6. **State the blast radius.** Which skills, agents, or gates does this touch? A reviewer cannot
   assess risk from a diff alone when the change is to shared generator data.
7. **Do not push to a default branch, and do not commit unless asked.** PRs only.

### Gate criteria before requesting review

| Criterion | Gate |
|-----------|------|
| Full gate run | `bun run check` exits 0 on the branch, not just the changed subset |
| Frontmatter round-trip | Any new frontmatter key uses an inline scalar — a YAML block list is silently dropped by the generator's line-based parser |
| Chain references | Every `jstack:<slug>` token resolves; `bun run validate-chains` passes |
| Generated artifacts | Regenerated and included, so the catalog matches the tree |
| Scope | One concern; unrelated cleanups moved to their own PR |
| Reviewer effort | Diff readable in one sitting; if it is not, split it rather than asking for a heroic review |

### Anti-patterns

| Anti-pattern | Why it's wrong | Instead |
|---|---|---|
| Hand-editing a generated skill body | The change vanishes on the next regeneration while the PR looks correct | Edit the generator data, or add the skill to `SKIP` |
| Bundling unrelated changes | Cannot revert one without reverting the others | One concern per PR |
| "Tested locally" with no command | A reviewer cannot reproduce it, so it is an assertion, not evidence | State the command and the expected result |
| Adding a skill without evals | Fails the coverage gate, and nothing proves the skill works | Author real cases that would fail if the skill regressed |
| Scaffolded evals left as-is | Green check, zero information | Replace with assertions tied to this skill's actual behavior |
| Omitting regenerated artifacts | Catalog and docs disagree with the tree | Regenerate in the same PR |
| Editing `config/schema.json` expecting enforcement | No code loads it; it is documentation | Change the Zod schema in `cli/src/types/config.ts` for enforcement |
| Silent behavior change to a shared template | Affects every generated skill at once | Call it out explicitly and state the count affected |

### Worked example

**Weak PR description**

> Improved the review skills and fixed some config stuff. Tested locally.

Unreviewable: which skills, what changed in config, what "improved" means, and no way to verify.

**Sharp PR description**

> Adds a `skill_deep` entry for `review/code-review` (thresholds + anti-patterns + worked example)
> and nothing else. Generated bodies regenerated, so `skills/review/code-review/SKILL.md` is in the
> diff as generator output, not a hand edit.
>
> Blast radius: one skill body. No config, no gates, no shared template.
>
> Verify: `python3 scripts/apply_detailed_skills.py && bun run check` (exits 0), then
> `bun scripts/skills-depth-check.ts` shows `review/code-review` with no findings.

### Out of scope

Merging, pushing to a default branch, or committing without being asked. Authoring the domain
content itself — this skill prepares the change for review; the content belongs to the skill or
agent being changed. Never widen a PR's scope to include an unrelated fix noticed along the way;
file it separately.

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
Read current state before changing it. Prefer the reversible action; when an action is irreversible, show what will change and get explicit confirmation first. If a required id or path is missing from config, stop and ask — never substitute a guess.

### Step 3 — Execute
Diff the local changes and confirm they serve one concern; if a skill body, a config default, and a gate are all touched, split before opening the PR. If any changed `skills/**/SKILL.md` is generator output, edit the generator data instead of the body (or add the skill to `SKIP`), and regenerate `skill-catalog.json`, `skills-data.js`, and the docs `index.html` if a skill was added or restructured. Write the PR body with the exact verification command and expected result (not "tested locally"), and state the blast radius — which skills, agents, or gates the change touches.

### Step 4 — Validate
Before reporting done: confirm the change landed where intended, that nothing outside the stated scope was touched, and that every id, path, and figure you emitted came from config or the conversation rather than from inference. Name anything you could not verify.

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

## Chaining
Complete the work here. If a natural follow-up exists, add one line: `suggested_next: <skill-name>` with a copy-paste handoff block. Do not auto-invoke without user intent or a defined chain in `prompts/chains/`.

## User request

$ARGUMENTS
