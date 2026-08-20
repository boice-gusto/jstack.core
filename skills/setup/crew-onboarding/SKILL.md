---
name: jstack-crew-onboarding
description: Conversational wizard for standing up a NEW crew (background Slack) agent — names it, shapes its persona through a few characterizing questions instead of a blank system-prompt, sets its workspace, confirms the owner-only default, then drafts the exact `jstackc crew agents add …` invocation and persona file for the user to review. Never runs it. Use for "add another crew agent", "set up a new background agent", "I want a second Ralph". Do NOT use to edit an existing agent, view status, enable/go-live, or diagnose why one didn't respond — that's all `jstack:crew`. Do NOT use for the general first-run jstack setup wizard — that's `jstack:onboarding`.
category: setup
effort: medium
argument-hint: "[agent-id]"
---

<!-- Chain Contract -->
<!-- inputs: user_request, existing_jstack_config_optional -->
<!-- outputs: drafted_add_command, drafted_persona_file, agent_id -->
<!-- chains-to: jstack:crew -->

Read the setup preamble first:
!cat ${CLAUDE_PLUGIN_ROOT}/prompts/setup/preamble.md

## What this skill is for

Take a user who wants a **new** crew agent from "I want another one of these" to a reviewable
`jstackc crew agents add <id> --workspace <path> ...` command and a drafted persona file —
without ever running it. It is the front door for creating an agent; `jstack:crew` is the
front door for everything that happens to one after it exists (list, show, edit, enable,
disable, remove, explain, doctor, panic).

- **Out of scope:** editing, enabling, or removing an existing agent; going live; diagnosing a
  non-response. All of those are `jstack:crew`.
- This skill never writes `jstack.config.json` and never shells out `crew agents add` itself.
  It produces text — a command and a file — for the user to run or save by hand.
- Also out of scope: scheduled, unprompted checks (`--proactive-check`, e.g. "check open
  incidents every morning and tell me if something needs attention"). Mention that these exist
  and can be set up later with `jstackc crew agents edit <id> --proactive-check "id:cron:prompt"`
  — this skill's job is naming/persona/workspace, not walking through every advanced config
  option; hand off to `jstack:crew` for the details.

## Absolute rules

1. **Never auto-run the add command.** Draft it in a fenced code block and stop. Even if the
   user says "just do it," the most you do is restate the exact command clean and ready to
   paste — running commands that mutate `jstack.config.json` is explicitly what `jstack:crew`
   reserves for the human (`crew.agents add` starts an agent **disabled** on purpose; drafting
   it here does not need to break that convention to be useful).
2. **Check `jstack.config.json`'s `crew.agents` for sigil collisions before proposing one.**
   Read the file directly (or run the read-only `jstackc crew agents list --json`) and collect
   every existing agent's `sigils`, case-insensitively, before suggesting `!<id>` /
   `@agent-<id>` or anything else. Never propose a sigil already owned by another agent — say
   so and pick a different one instead of asking the user to resolve the clash themselves.
3. **Never invent a workspace path.** Ask for it, or confirm one the user names. Do not assume
   `~/Documents` or the current repo without asking.
4. **Shape the persona with questions, not a blank page.** Do not ask "write me a system
   prompt for this agent." Ask three or four short, characterizing questions (see Step 3) and
   compose the persona text yourself from the answers.
5. **If `crew` isn't set up at all,** say so and hand off — this skill assumes `crew init` has
   already run. Don't try to run `crew init` from here.

## Step 1 — Name it and say what it's for

Parse `$ARGUMENTS` for a candidate id. If absent, ask in one turn: what should this agent do,
and what should it be called? Derive a kebab-case id (2–24 chars, starting with a letter,
matching `^[a-z][a-z0-9-]{1,23}$` — the same pattern `crew agents add` enforces) from the name
if the user doesn't give one directly.

## Step 2 — Check for collisions before proposing anything

Before naming sigils (or reusing an id), read the existing crew roster:

```bash
jstackc crew agents list --json
```

or read `jstack.config.json`'s `crew.agents` directly if the CLI isn't available. Collect:

- every existing agent **id** (the new one must not reuse one — `crew agents add` refuses that
  anyway, but say so up front rather than drafting a command that will fail)
- every existing agent's **sigils**, lower-cased (the default sigils for a new agent are
  `!<id>` and `@agent-<id>`; if either collides with another agent's sigil, propose a distinct
  id or an explicit `--sigil` pair instead — never let the user find out at `add` time)

## Step 3 — Shape the persona with a few characterizing questions

Use **AskUserQuestion** (with `preview:` where it helps) rather than asking for a system
prompt. A short, fixed set works better than an open-ended one:

- **Register** — terse and factual, warm and conversational, or dry and a little funny?
- **Scope** — what should it firmly decline to speculate about (e.g. "never guesses at
  production incident causes it hasn't read logs for")?
- **One quirk** — anything that makes it recognizably itself in a thread (a signoff habit, a
  favorite comparison, a pet peeve)?

Compose 2–4 sentences of persona guidance from the answers — not a transcript of the
questions. Offer the user the soul-file convention: a `SOUL.md` at the workspace root,
referenced by `--persona-file SOUL.md`, keeps a longer persona out of `jstack.config.json` and
versioned with the agent's own repo; a short one can stay inline via `--persona "<text>"`.
Ask which they'd prefer rather than assuming.

## Step 4 — Workspace

Ask for the absolute path to the repo this agent should read. Confirm it's the intended one —
do not silently reuse another agent's workspace unless the user says that's deliberate.

## Step 5 — Confirm the owner-only default

State this plainly, once, before drafting anything: **by default this agent answers only its
owner** (`crew.slack.self_user_id`) inside the self-DM, and — separately — will not proactively
answer anyone else even in a shared channel, because `policy.ingress.respond_to_others`
defaults to `false`. This is enforced in code (`isOwnerOnlyViolation` in
`cli/src/lib/crew/guards.ts`), not just convention. Ask the user to confirm that's what they
want; if they want it to answer teammates in a shared channel too, note that changing
`respond_to_others` is a `crew` config edit outside this skill's scope, and point at
`jstack:crew`'s "Do not" section for why that's treated as deliberate.

## Step 6 — Draft, don't run

Produce exactly two artefacts and stop:

1. If a persona file was chosen: the **content** of `SOUL.md` (or whatever name they picked),
   in a fenced code block, with the path it should be saved to.
2. The **exact** `jstackc crew agents add` command, in a fenced shell code block, using
   `--persona-file <name>` if a file was chosen or `--persona "<text>"` if inline:

```bash
jstackc crew agents add <id> \
  --workspace <path> \
  --description "<one line: what it's for>" \
  --sigil "!<id>" "@agent-<id>" \
  --persona-file SOUL.md
```

Tell the user plainly: this creates the agent **disabled** (unchanged crew behaviour), and the
next step after they run it themselves is `jstackc crew agents enable <id>` — which is theirs
to run, not this skill's.

## Worked example

> **User:** I want a second background agent that only answers questions about our billing
> repo.
>
> **Assistant:** What should I call it, and is there anything it should explicitly refuse to
> guess at?
>
> **User:** Call it "billy". It should never speculate about a customer's actual invoice
> amounts — only what the code does.
>
> **Assistant:** Checking existing agents for id/sigil collisions first…
> `jstackc crew agents list --json` shows one agent, `ralph`, with sigils `!ralph` /
> `@agent-ralph` — no collision with `billy` / `!billy` / `@agent-billy`.
>
> A few quick ones to shape its voice: terse-and-factual, warm-and-conversational, or
> dry-and-a-little-funny? Any signature quirk? *(asked via AskUserQuestion)*
>
> **User:** Terse and factual. No quirk needed.
>
> **Assistant:** Where's the billing repo, and inline persona or a `SOUL.md` file?
>
> **User:** `/Users/me/repos/billing`. Inline is fine, it's short.
>
> **Assistant:** By default `billy` will only answer *you* — even in a shared channel it won't
> jump in on its own unless `respond_to_others` is turned on later, which is a separate `crew`
> config edit. Confirm that's what you want?
>
> **User:** Yes.
>
> **Assistant:** *(drafts, does not run)*
> ```bash
> jstackc crew agents add billy \
>   --workspace /Users/me/repos/billing \
>   --description "Billing repo Q&A. Explains code, never speculates about actual invoice amounts." \
>   --sigil "!billy" "@agent-billy" \
>   --persona "Terse and factual. Explains what the billing code does; never speculates about a specific customer's actual invoice amounts — that requires reading real data it doesn't have."
> ```
> Run that yourself, then `jstackc crew agents enable billy` when you're ready for it to
> receive messages. It starts disabled either way.

## Output shape

- **Summary** — the agent id, one line on what it's for.
- **Collision check** — which existing ids/sigils were checked and that none clashed (or how
  the clash was avoided).
- **Persona** — inline text or the drafted file content, and which one.
- **Drafted command** — the fenced `crew agents add` invocation, unrun.
- **Next step** — that the user runs it, then `enable`s it when ready; that it is disabled and
  owner-only until they say otherwise.

## Failure modes

| Symptom | Recovery |
|---|---|
| No `crew` key in `jstack.config.json` | Say crew isn't initialized; point at `jstackc crew init --user <U…> --dm <D…> --workspace <path>` in `jstack:crew`. Don't attempt it here. |
| Proposed sigil collides | Caught in Step 2 before drafting; propose a different id/sigil pair, don't ask the user to resolve it. |
| User asks to run the command | Decline, restate it clean in a code block, remind them it stays disabled either way. |
| User wants it to answer teammates in a shared channel | Note that's a `respond_to_others` config edit outside this skill; hand off to `jstack:crew`. |
| Workspace path doesn't look real | Say so and ask for confirmation rather than silently drafting `jstackc crew doctor` will catch it, but catching it here is cheaper. |
| User wants an open-ended "write me a system prompt" | Redirect to the fixed characterizing questions in Step 3 instead. |

## Chaining

Ends with a drafted command, never executed. `suggested_next:` `jstack:crew`, for running the
command, enabling the agent, and everything that happens to it afterward. Do not auto-invoke
`crew agents add` yourself under any circumstance.

## User request

$ARGUMENTS
