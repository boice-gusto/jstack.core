---
name: jstack-crew
description: Inspect and manage the background Slack agents (crew) that watch a DM and answer in it — list, show, create, edit, enable, disable, remove agents, check status, explain why a message got no reply, and halt everything. Use when the user asks about "my agents", "background agents", "Ralph", "crew", "why didn't it respond", or wants to add/disable an agent. Do NOT use to compose or send a Slack message, and do NOT use to switch the crew to live posting — that is a deliberate human step (`jstackc crew go-live`).
category: crew
effort: low
disable-model-invocation: true
disallowed-tools: AskUserQuestion
argument-hint: "[list|show <id>|add <id>|edit <id>|enable <id>|disable <id>|remove <id>|status|doctor|explain <ts>|ui|panic]"
---

# Crew: managing background Slack agents

The **crew** is a set of named agents that poll one Slack conversation, decide in
deterministic TypeScript whether anything is addressed to them, and answer in a thread.
This skill is the operator surface for them. It reads and edits
`jstack.config.json` → `crew.agents` and the crew ledger; it never composes a Slack message.

## Two facts to state before you change anything

1. **Crew posts as the operator, not as a bot.** There is no bot identity. Every message an
   agent sends is attributed to the human, and Slack posts **cannot be edited or deleted**.
2. **`mode` gates everything.** In `dry_run` the pipeline runs and renders the exact payload
   but posts nothing. Going live is `jstackc crew go-live --confirm-channel <D…>` and is the
   operator's decision, never yours.

## Procedure

1. **Orient before acting.** Run:

   ```bash
   jstackc crew agents list
   jstackc crew status
   ```

   `status` shows `mode`, whether a `HALTED` sentinel is present, the watermark, task count
   and spend against the daily cap. If `halted` is `YES`, say so first: nothing will run
   until it is cleared, and the recorded reason usually explains why.

2. **Answer read-only questions from `list` / `show` / `explain`.** Do not edit config to
   answer a question.

   | Question | Command |
   |---|---|
   | What agents exist, which are live? | `jstackc crew agents list` |
   | What exactly is agent X configured to do? | `jstackc crew agents show <id>` |
   | Why did a message get no reply? | `jstackc crew explain <message_ts>` |
   | Is it running, what has it spent? | `jstackc crew status` |
   | Is anything misconfigured? | `jstackc crew doctor` |
   | I want to see it all at once | `jstackc crew ui` |
   | What proactive checks does agent X have, and where do they post? | `jstackc crew agents list-checks <id>` |

   `explain` prints the decision trace with a `rule_id` per drop. Report the rule rather
   than speculating. Common ones: `G3_no_sigil` (no trigger in the message),
   `too_old` (older than the cold-start window, root messages only),
   `G1_outbox` (the agent's own post), `ingress_author` / `ingress_channel` (policy),
   `owner_only` (a shared-channel message from someone other than the owner, with
   `respond_to_others` false), `no_agent` (matched no *enabled* agent), `blocked_budget`,
   `backlog_skipped`.

3. **Creating an agent.** Needs an id and a workspace:

   ```bash
   jstackc crew agents add <id> --workspace <path> --description "<what it is for>"
   ```

   It is created **disabled** on purpose: adding an agent must never silently change what
   answers the operator's messages. Default sigils are `!<id>` and `@agent-<id>`; a sigil
   already owned by another agent is refused rather than resolved by key order. Tell the
   operator the enable command; do not run it unprompted.

4. **Changing an agent.** `jstackc crew agents edit <id>` with any of `--name --model
   --workspace --sigil --tool --description --persona --persona-file --emoji`. `--sigil` and
   `--tool` **replace** the list rather than appending. The config is validated before it is
   written, so an edit that would not load fails without touching the file.

   `--persona-file` is the soul-file convention: point it at a markdown file resolved against
   the agent's own `--workspace` (convention: `SOUL.md`), and its content becomes the persona
   at runtime, overriding the inline `--persona` string. A `persona_file` that does not
   resolve to a readable file fails the task loudly rather than answering with no persona.

5. **Who gets answered.** By default an agent answers only its owner (`crew.slack.
   self_user_id`) in a shared, non-DM channel; the self-DM is unaffected because it never
   contains anyone else. This is enforced in code (`isOwnerOnlyViolation` in `guards.ts`),
   separately from the `policy.ingress.authors` allowlist, so adding a teammate to `authors`
   for a future shared channel does not by itself make the agent answer them. Set
   `policy.ingress.respond_to_others: true` to lift that, deliberately, per-agent-policy.

6. **Turning an agent off.** Prefer `disable` over `remove`:

   - `jstackc crew agents disable <id>` — out of routing, definition kept. Reversible.
   - `jstackc crew agents remove <id> --yes` — deletes the definition. Refused for the last
     remaining agent, because crew cannot load with none. Task history survives in the ledger.

7. **Stopping everything.** `jstackc crew panic --reason "<why>"` writes a `HALTED` sentinel;
   the tick refuses to run or post until `jstackc crew resume`. Use this rather than editing
   config when something is going wrong. Note that `panic` cannot recall a message already
   posted, and cannot cancel a scheduled one.

8. **The orchestration page.** `jstackc crew ui` starts an **ephemeral** server on 127.0.0.1
   with a per-run token and opens a page covering agents, tasks, logs, scheduler and doctor.
   It dies on Ctrl-C and the token is never written to disk.

   Suggest it when the operator wants an overview rather than an answer. Two things to tell
   them rather than let them discover: `go-live`, `resume`, `install` and `uninstall` are
   **not reachable from the page** on purpose, and the server refuses cross-site requests,
   GET mutations and unexpected `Host` headers — because a browser-reachable control plane
   that can post as them is the shape of a known RCE, and loopback binding alone is not a
   defence.

9. **Running without a terminal.** `jstackc crew install` compiles `crewd` and installs a
   LaunchAgent. Compiling is not cosmetic: TCC attributes file access to the executable
   launchd runs, so a shell script is attributed to `/bin/bash` and denied `~/Documents`,
   while a compiled binary was measured reading it fine. `jstackc crew doctor` reports the
   real answer, because it reads what `crewd` recorded from inside the launchd context rather
   than probing from a terminal that has different grants. Only send someone to System
   Settings if doctor actually says denied.

10. **Verifying a change without posting.** `jstackc crew simulate '<text>'` pushes a synthetic
   message through the real poller, guards, router and renderer and stops at the Slack
   boundary. It forces `dry_run` even when `mode` is `live`, so it is always safe.

11. **Checking answer quality, not just plumbing.** `jstackc crew eval` grades the agent's real
    answers on hard tasks — multi-file tracing, a refusal, an unknown symbol, a prompt
    injection. Every case runs through `simulate`, so it never posts and never moves a
    watermark. Two kinds of check: deterministic ones (every cited `file.ts:42` is resolved
    against the real workspace and the line number verified) and judged rubric criteria. Use
    `--deterministic` for a free offline pass, `--only <ids>` for one case. It costs roughly
    $1 for the full suite, so do not run it on a whim; report the pass counts and the artefact
    path under `.tmp/crew-evals/`.
    - A run that aborts with "crew could not run" is a blocker (contended lock, HALTED, auth),
      not an agent failure. Fix the blocker and re-run; do not report it as a quality result.
    - `judge_incomplete` on a criterion is a harness fault for the same reason.

12. **Proactive checks: the other half of crew.** Everything above is REACTIVE -- an agent
    answers because someone said something with a sigil in it. A `proactive_check` is the
    opposite: a scheduled, unprompted investigation the agent runs on its own, and posts about
    only if it decides there is something the operator should know.

    ```bash
    jstackc crew agents edit ralph \
      --proactive-check "morning-incidents:0 9 * * *:Check open incidents; report only if one needs attention"
    ```

    The compact spec is `id:cron-schedule:prompt` — the schedule is a normal 5-field cron
    string (same validator `routines.<id>.cron` uses), and the prompt is everything after the
    second colon, so it may itself contain colons. `--proactive-check` passed to `edit`
    **replaces the whole list**, the same convention `--sigil` and `--tool` already use — pass
    every check you want kept, not just the new one. List what is configured with
    `jstackc crew agents list-checks <id>`, and fire one right now (bypassing its schedule)
    with `jstackc crew agents run-check <id> <check-id> --force` to see what it would actually
    post without waiting for 9am.

    **Silence on "found nothing" is the correct outcome, not a failure.** Every check carries
    `require_explicit_finding` (default `true`): the model is asked to reply either `NO_FINDING`
    or `FINDING: <message>`, and only a well-formed `FINDING:` reply ever posts — anything else,
    including a reply that ignores the contract, is treated as silence. This is the concrete
    defence against the classic "cron job that posts something every single day whether or not
    anything happened" anti-pattern. Setting `require_explicit_finding: false` is available but
    means "post the model's raw reply every time it fires, finding or not" — that is a
    deliberate, named opt-in, never something to suggest as a default.

    **Channel resolution never guesses at a shared channel.** An unset `channel` on a check
    always resolves to the agent's own configured DM (`policy.egress.channels[0]`); an explicit
    `channel` must already be in `policy.egress.channels` or the check refuses to run rather
    than posting somewhere egress config never allowed. Override one check's channel with
    `--proactive-channel "<check-id>=<channel>"` alongside `--proactive-check`.

    **What actually fires these:** the SAME tick loop that already polls Slack (`crew watch` or
    the launchd-installed `crewd`) — not a second, separate cron mechanism. `routines.*.cron`
    (`jstack schedule`) now has an executor (`jstack schedule run <id>`, an unattended `claude -p`
    turn through the routine's chain, with `--dry-run` and a run-history record) but, unlike
    crew's tick loop, nothing in this repo calls it on its own schedule — an operator still has
    to point an external cron/launchd entry at `jstack schedule run <id>` for it to actually fire
    unattended; `jstack schedule report` says so plainly if it never has been. So proactive
    checks still piggyback on the one recurring trigger crew already has, budget cap, halt
    sentinel and all, rather than on `routines.*.cron`. Manually firing one with `crew
    agents run-check` is also safe to wire to an external cron if an operator wants a cadence
    independent of the tick interval — it re-runs the same due-check logic, so calling it when
    nothing is due is a no-op, not a duplicate post.

## Report back

State, in this order: mode and halt state; the agents and which are enabled; what you
changed and the exact command; anything the operator must do next (usually `enable`, or
`go-live`). If you edited config, name the file. Keep it to a few lines.

## Failure modes

- **`no "crew" key`** — not set up. `jstackc crew init --user <U…> --dm <D…> --workspace <path>`.
  Get the DM channel id from the operator; do not guess it.
- **`HALTED`** — report the recorded reason and stop. Clearing it is the operator's call.
- **`auth_lost`** in the event log — the Slack MCP grant is gone. Only an interactive
  `claude mcp login` fixes it; the crew cannot self-heal, by design.
- **`backlog_skipped`** — messages arrived faster than the page budget. Suggest raising
  `crew.slack.max_pages` or `read_limit`, or ticking more often. The skipped range is in the
  event detail.
- **Nothing is polling.** `crew tick` is one cycle. Continuous operation is either
  `jstackc crew install` (LaunchAgent, survives terminal close and reboot) or
  `jstackc crew watch` (foreground). If the operator says "it didn't respond", check this
  before anything else — it is the most common cause.
- **`backlog_skipped`** — more messages arrived than one tick's page budget. The skipped range
  is named in the event detail; raise `crew.slack.max_pages` or tick more often.

## Do not

- Do not run `go-live`, `enable`, or `remove` on your own initiative. Propose and let the
  operator choose.
- Do not hand-edit `crew.agents` in `jstack.config.json`; the subcommands validate before
  writing and refuse duplicate sigils.
- Do not add a channel to `policy.egress.channels` other than the operator's own DM without
  an explicit instruction. Everything posted there is attributed to them, permanently.
