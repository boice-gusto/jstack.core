---
name: jstack-onboarding
description: Conversational first-run onboarding — walks a new user from install to a validated jstack.config.json to their first real skill invocation, in one guided pass. Use for "get me set up", "onboard me", "I just installed jstack", or when jstack.config.json is missing. Not for editing an existing working config (use jstack:update-config) and not for diagnosing a specific doctor failure (use jstack:setup).
category: setup
effort: medium
argument-hint: "[ic|lead|shared]"
disable-model-invocation: true
---

<!-- Chain Contract -->
<!-- inputs: user_request, profile_hint, existing_jstack_config_optional -->
<!-- outputs: jstack_config_json, verification_transcript, first_skill_suggestion -->
<!-- chains-to: jstack:setup, jstack:update-config -->

Read the setup preamble first:
!cat ${CLAUDE_PLUGIN_ROOT}/prompts/setup/preamble.md

## What this skill is for

Take a user who has just installed jstack and leave them with a validated config, a clean
`jstack doctor`, and one real task completed. Conversational equivalent of
`onboarding/wizard.html` — same questions, same output, same guarantees.

- **Out of scope:** repairing a specific `doctor` failure (`jstack:setup`), editing a config
  that already works (`jstack:update-config`), and anything involving credentials.

## Hard rules

- **Never write a secret anywhere.** Not into config, not into markdown, not echoed back. If
  the user pastes a token, tell them to move it to an env var or secret store and rotate it.
  jstack reads credentials from the environment; MCP servers own their own auth.
- **Never invent org values.** No made-up project keys, workspace IDs, URLs, or channel names.
  If a value is unknown, leave the key out.
- **Omit rather than blank.** A skipped question means the key is absent from the config, not
  set to `""`. Empty strings look configured and make skills fabricate against them.
- **Confirm before writing.** Show the full proposed JSON and get an explicit yes before
  writing `jstack.config.json`. Never overwrite an existing config without showing a diff.
- **Personal values stay out of shared configs.** In `shared` profile, personal knowledge-base
  URLs go to `jstack.personal.json`, never the committed team file.

## Offer the visual wizard first

Both front doors exist and produce the same config. Say so once, in one line:

> There's also a click-through version at `onboarding/wizard.html` — open it directly in a
> browser (no server needed). Want that instead, or shall we do it here?

If they pick the HTML wizard, tell them the path, note that it ends with a download button,
and stop. Otherwise continue.

## Step 1 — Profile

Parse `$ARGUMENTS` for `ic`, `lead`, or `shared`. If absent, call **AskUserQuestion** with
`preview:` on each option so the user sees the shape of what they're choosing:

- **Individual** — one local config, personal knowledge base allowed inline.
- **Team lead** — adds routines and team knowledge base; still local.
- **Shared/committed** — team-safe only; personal values split into `jstack.personal.json`.

## Step 2 — Team basics

Ask for team name (required) and timezone (IANA, e.g. `America/Los_Angeles`). Ask both in one
turn. Validate the timezone shape and say so plainly if it looks wrong — don't silently accept
`PST`.

## Step 3 — Integrations

Ask which of Jira, Slack, Notion, GitHub, Google Calendar, Sheets they actually use. For each
selected one, ask only for non-secret identifiers:

| Integration | Ask for | Never ask for |
|-------------|---------|---------------|
| Jira | project key, base URL | API token |
| Slack | default channel | bot/user token |
| Notion | parent page or database id | integration secret |
| GitHub | org, default repo | PAT |
| Calendar / Sheets | nothing beyond enablement | OAuth secrets |

Skip anything they don't name. Do not enumerate all six one at a time if they've already said
"just Jira and Slack".

## Step 4 — Knowledge base

Ask for local markdown roots and, if they use one, the team knowledge base URL. In `shared`
profile, route any personal URL to `jstack.personal.json` and say that you're doing it.

If they set a default write target, confirm the matching URL exists — `doctor` will flag the
mismatch otherwise, and it's better caught here.

## Step 5 — Routines and telemetry

Routines (standup, weekly digest, sprint close, health check) are **off** unless asked for.
Telemetry is **opt-in**: state exactly what it sends — skill name, token count, latency; no
prompt text, no PII — then take yes or no. Don't editorialize either way.

## Step 6 — Review, confirm, write

1. Print the complete proposed `jstack.config.json`.
2. Include an `onboarding` block: `complete: false`, `wizard_last_run` (ISO 8601),
   `required_integrations` (the logical ids they enabled), and a short `notes` line.
3. Scan your own output for anything token-shaped before showing it. If present, stop and fix.
4. Get explicit confirmation. If a config already exists, show a diff and confirm again.
5. Write it to the project root.

## Step 7 — Verify

Run these and interpret the results for the user rather than pasting raw output:

```bash
./cli/bin/jstack doctor
bun run check
```

`.mcp.json (optional)` is advisory and does not fail the run — say so if it appears, so they
don't chase it. For any real failure, name the cause and the fix; hand off to `jstack:setup`
if it needs deeper repair.

## Step 8 — One real task, then done

Onboarding is not complete until they've used it once. Suggest exactly **one** skill matched to
what they configured — Jira → `jstack:jira-intake`; Notion → `jstack:notion-report`;
knowledge roots → `jstack:knowledge-search`; nothing configured → `jstack:recon` or
`jstack:adr`. Offer to run it now.

Then tell them how to mark themselves done: set `onboarding.complete: true`.

## Things a new contributor will get wrong — say these once

- **Most skill bodies are generated.** `scripts/apply_detailed_skills.py` rewrites the body of
  every `skills/**/SKILL.md` not in its `SKIP` set. Hand-editing a generated body loses the work
  on the next regeneration. Change the generator data, or add the skill to `SKIP`.
- **Frontmatter takes inline scalars only.** `allowed-tools: a, b` — a YAML block list is
  dropped by the generator's line-based parser.
- **bun only.** No npm/yarn/pnpm, including in `dashboard/`.
- **Two separate repos.** `jstack.core` (generic) and `jstack.gusto` (org overlay) are sibling
  clones under a plain parent folder; install core first. Org-specific values belong in the
  overlay, never in core.
- **Eval coverage is gated.** A new skill without eval cases fails `bun run check`.

## Output shape

- **Summary** — what was configured, in 2–4 sentences.
- **Config written** — path, and which sections were intentionally omitted.
- **Verification** — `doctor` / `check` result, interpreted.
- **Next step** — the one suggested skill.
- **Limitations** — anything skipped, unverified, or needing credentials the user must set.
- End with `result_ok: true` or `result_ok: false` + reason.

## Failure modes

| Symptom | Recovery |
|---------|----------|
| User pastes a token | Do not write it. Tell them to move it to env/secret store and rotate. Continue without it. |
| Config already exists | Show a diff, confirm before overwriting; offer `jstack:update-config` for a targeted edit instead. |
| `doctor` fails after write | Name the specific failing check and its fix; hand off to `jstack:setup` for repair flows. |
| User doesn't know an id | Leave the key out. Tell them which skill will ask for it later. |
| `bun run check` fails on eval coverage | A skill lacks evals. Point at `bun run generate-skill-evals`, and note scaffold cases must be replaced with real ones. |
| User wants the GUI midway | Point at `onboarding/wizard.html`; answers so far are not transferable, so offer to finish here instead. |

## Chaining

Complete onboarding here. `suggested_next:` the single skill from Step 8. Hand off to
`jstack:setup` for repair, `jstack:update-config` for later edits. Do not auto-invoke.

## User request

$ARGUMENTS
