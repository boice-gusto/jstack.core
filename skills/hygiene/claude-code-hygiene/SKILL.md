---
name: jstack-hygiene-claude-code-hygiene
description: Audit a user's actual Claude Code setup — skills, agents, hooks, slash commands, and settings.json permissions — for what is broken, stale, unused, or duplicated, then walk through a numbered fix plan before touching anything. Use for "audit my claude setup," "clean up unused skills," "is my claude code config stale," "find duplicate skills," "why do I have two agents that do the same thing," "do any of my skills have zero eval coverage," or a periodic hygiene sweep before a skill-authoring push. Two phases, always in this order — Phase 1 is a read-only audit that runs freely and never edits or deletes anything; Phase 2 (actually deleting, editing, or regenerating a skill/agent/hook/permission) only happens after the user has seen Phase 1's findings and confirms each fix item individually. Not for authoring a brand-new skill from scratch (jstack:skill-creator) or opening the PR itself (jstack:plugin) — this skill diagnoses and plans, those two execute.
when_to_use: Also trigger for "sweep my skills directory," "find dead agents," "check for orphaned reference files," "why is my settings.json so long," "check for broken chain contracts," "has Claude Code shipped anything new I'm not using," or any request to review/clean up/tidy the Claude Code setup itself (as opposed to reviewing a codebase or a PR).
category: hygiene
effort: high
context: fork
agent: Explore
---

<!-- Chain Contract -->
<!-- inputs: user_request, jstack_config, repo_root -->
<!-- outputs: audit_report, numbered_action_plan -->
<!-- chains-to: jstack:skill-creator, jstack:plugin -->

Read the setup preamble first:
!cat ${CLAUDE_PLUGIN_ROOT}/prompts/setup/preamble.md

## What this skill is for

Audit the Claude Code setup itself — every `SKILL.md`, `agents/*.md`, hook, slash command, and `settings.json`/`settings.local.json` permission entry — for what is broken, stale, unused, or duplicated, and turn that into a plan the user approves before anything changes. This is a meta-audit: the subject is the tooling, not the product code.

- **Out of scope:** Reviewing application code, PR diffs, or product architecture — that's `jstack:code-review` or a language-specific review skill. Authoring a brand-new skill from a blank page — that's `jstack:skill-creator`. Opening the PR that lands an approved fix — that's `jstack:plugin`. This skill must not perform any of those three; it hands off to them.
- **Must not:** touch a file, delete a file, or run a mutating command in Phase 1. Phase 1 is read-only, full stop — every tool call in that phase is `Read`, `Grep`, `Glob`, or a `bun run <check-script>` that itself only inspects and prints (never `apply_detailed_skills.py`, which writes).

## Two-phase design (read this before running)

**Phase 1 — read-only audit.** Runs in a forked, read-only subagent (`context: fork`, `agent: Explore` in this file's frontmatter). Explore has no `Edit`/`Write`/`NotebookEdit` tools by construction, so Phase 1 is mechanically incapable of mutating anything — that is the actual enforcement mechanism, not just a policy statement. Phase 1 ends by returning a findings report and a numbered action plan to the main session.

**Phase 2 — guided fix execution.** Cannot happen inside Phase 1's fork (no write tools, no memory of the conversation once it returns). Phase 2 begins in the **main session**, after the user has read Phase 1's report, and proceeds **one numbered item at a time** with an explicit user confirmation before each mutation — never a blanket "yes to all." This is why the frontmatter is deliberately **not** `disable-model-invocation: true`: Phase 1 must stay freely triggerable from plain conversation ("clean up unused skills" should just work), but nothing destructive can fire from that same trigger, because the fix step requires a second, explicit, per-item human decision that a forked read-only pass cannot obtain on its own.

## Domain rules — Claude Code hygiene

### Absolute rules
1. Never delete a skill, agent, hook, slash command, or permission entry without an explicit per-item confirmation from the user — "go ahead and clean it up" is not per-item confirmation for a 12-item plan.
2. Never regenerate or hand-edit the body of a hand-maintained skill without checking `scripts/apply_detailed_skills.py`'s `SKIP` set first (`python3 -c "import sys; sys.path.insert(0,'scripts'); from apply_detailed_skills import SKIP, SKILLS; print(sorted(str(p.relative_to(SKILLS).parent) for p in SKIP))"`). A `SKIP`-set skill that looks thin is a deliberate hand-authored exception, not a defect — see the worked example below.
3. A skill or agent with zero eval coverage, or zero grep hits in a 30-second search, is a **finding to verify**, not proof of being unused. Before writing "unused" or "dead," search `skills/`, `agents/`, `scripts/`, `cli/`, `prompts/`, and `docs/` for the skill's `name:` suffix, its directory path, and its `jstack:` chain token — all three, not just the file's own directory.
4. Cite exact evidence for every finding: a `file:line`, an exact `grep`/`bun run` output line, or a diff — never "seems unused," "looks stale," or "probably duplicated." If you cannot point at the line that proves it, the finding is not ready to report.
5. Never run Phase 2 inside Phase 1's forked pass. If Phase 1's fork ever finds itself holding an `Edit` or `Write` tool, stop — something is misconfigured, and that is itself a hygiene finding to report, not a fix to apply silently.
6. Present the full findings report and the full numbered plan before proposing any single fix in isolation. A user approving item 3 must have already seen items 1 through N.
7. Only audit what the user or `jstack.config.json` scoped in. Do not sweep repos, plugins, or directories the user did not name — mirrors the `jstack:engineering-health` rule against scanning unconfigured repos.
8. Never treat a mechanical gate's silence as clean. `bun run check-write-gates` and `bun run agents-check` only catch what they were written to catch (declared manifests, regex-shaped frontmatter) — pair every mechanical pass with the qualitative checks in the audit checklist below (duplicate bodies, drifted descriptions, thin content) that those gates cannot see.

### Audit checklist — mechanical gates this skill orchestrates, plus what they can't see

Run the existing gates and interpret their output; do not reimplement what they already do.

| # | Check | Command | What it catches | What it can't catch (do this by hand) |
|---|---|---|---|---|
| 1 | Duplicate skill bodies | no built-in gate — `diff` two `SKILL.md` bodies after stripping frontmatter, or hash the body like `scripts/check-eval-scaffold.ts` does for eval cases | nothing on its own | Flag a pair only when 90% or more of non-blank body lines are line-identical after stripping `name`/`description`. A shared template (e.g. the `${CLAUDE_PLUGIN_ROOT}` preamble line, a shared "Config and references" block) is expected and not evidence of duplication by itself. |
| 2 | Orphaned skill/agent | `grep -rn "<name-suffix>\|<dir-path>\|jstack:<suffix>" skills agents scripts cli prompts docs` | nothing — this is the manual check Absolute Rule 3 requires | 6 directories, 3 search terms, every time. A hit in `prompts/chains/` or a `kickoff_workflows` config entry still counts as a reference. |
| 3 | Catalog drift | `bun run docs:generate` then diff `skill-catalog.json`'s `description` field for the skill against its `SKILL.md` frontmatter `description` | nothing — `docs:generate` only regenerates, it doesn't diff for you | Read both descriptions side by side; if they diverge in scope (catalog says "creates," body says "drafts"), that's a drift finding. |
| 4 | Broken chain-contract syntax | `bun run validate-chains` | malformed `jstack:` tokens, chain steps in `evals/chain-evals.json` pointing nowhere | Whether the chain target is still the *right* next skill for the domain, not just whether it resolves |
| 5 | Missing required frontmatter | `bun run skills-depth` (add `:strict` to make depth fatal) and `bun run agents-depth` (add `:strict`) | missing `name`/`description`/`effort`, invalid YAML, block-scalar corruption, missing domain-rules/thresholds/anti-patterns/worked-example sections at a skill's tier | Whether `gbrain_destination`/`data_class` are set on a **leaf** skill that persists to memory (not flagged by either depth gate — check `skills/_core/references/gbrain-persistence-metadata.md` by hand), whether a write skill correctly has `disable-model-invocation: true` (covered by check 6 below), and whether a pure-read skill correctly has `context: fork` + `agent: Explore` |
| 6 | Write skills missing the invocation gate | `bun run check-write-gates` | a skill in the manifest's `WRITES` set that lost `disable-model-invocation: true`, or a gated skill absent from `WRITES` | A skill that mutates state but was never added to `WRITES` in the first place — that only shows up as a body that describes a create/update/delete action with no gate; read the body, don't trust the manifest alone |
| 7 | Agents with no judge-backed eval coverage | `bun run a2a:list` (candidate agents) and check `evals/a2a/cases/` for a case naming the agent; `bun run eval:coverage` for skills | which skills/agents have zero eval cases at all | Per Absolute Rule 3: zero coverage is a finding, not a verdict — check whether the agent/skill is dispatched from another skill's body or a routine chain before calling it "unused" |
| 8 | Stale/orphaned reference files | `find skills -path "*/references/*.md" -o -path "*/templates/*"`, then run check 2 against each hit | nothing automatically | A reference file with zero inbound `!cat`/link references from any `SKILL.md` is orphaned; one referenced only from a `SKIP`-set skill is still live |
| 9 | Settings permissions for retired tools/commands | Read `.claude/settings.json` and `.claude/settings.local.json` `permissions.allow`/`deny`; for each `Bash(...)` or `mcp__*` entry, grep for that command/tool across `skills/`, `agents/`, `scripts/`, `cli/` | nothing automatically — there is no gate for this | An entry with zero hits is a candidate to remove; an entry naming a tool the user's session doesn't have connected at all (check `mcp__*` prefixes against the active server list) is a stronger candidate |
| 10 | Name collisions | `bun run check-name-collisions` | two skill names within edit-distance 2 whose descriptions don't call each other out | Whether the collision is confusing in practice — read both descriptions as a first-time user would |
| 11 | Claude Code feature drift | If `WebFetch` or `WebSearch` is available in this session, fetch `https://docs.claude.com/en/docs/claude-code` and diff against what the user's setup uses (hooks, skills, plugin marketplace conventions) since the last known date you can establish from the session or prior notes. **If neither tool is available, skip this step and say so explicitly in the report** — do not guess at what's new. |

## Config and references
- `jstack.config.json` — scopes which repos/plugins are in play; never widen the audit beyond it or the user's explicit ask.
- `scripts/apply_detailed_skills.py` — the `SKIP` set (hand-maintained skills; never propose regenerating these bodies).
- `skills/_core/references/skill-conventions.md` and `skills/skill-creator/references/anthropic-alignment.md` — the authoring rubric findings are measured against.
- `skills/_core/references/skill-frontmatter-guide.md` — full frontmatter field reference (what "missing required frontmatter" means per field).
- `skills/_core/references/ask-user-question-patterns.md` — use `AskUserQuestion` with a `Confirm and continue | Edit before continuing | Skip this item | Cancel` option set for each Phase 2 item.
- `skills/_core/references/chaining-guide.md` — handoff payload format used below.

## Intake
1. Parse `$ARGUMENTS` for scope: a specific skill/agent path, "everything," or a specific complaint ("why do I have two skills that do X"). If unscoped, default to the whole `skills/` + `agents/` + `.claude/settings*.json` surface of the current repo only.
2. If the user asks for a fix directly ("just delete the dupes"), still run Phase 1 first and present the plan — do not skip straight to Phase 2 even when asked to move fast; say so in one line and proceed.
3. If the request bundles a hygiene audit with an unrelated task, do the audit first and offer to continue with the rest.

## Procedure

### Phase 1 — Step 1: Load scope
Read `jstack.config.json` for repo scope. Confirm which repo(s) are in play (`jstack.core`, an org overlay like `jstack.gusto`, or both) before reading anything.

### Phase 1 — Step 2: Run the mechanical gates
Run, in order, and capture raw output: `bun run validate-chains`, `bun run check-name-collisions`, `bun run check-write-gates`, `bun run agents-check`, `bun run skills-depth`, `bun run agents-depth`. Do not paraphrase a failure before quoting the exact line it printed.

### Phase 1 — Step 3: Run the qualitative checks
Work through the audit checklist's items 1, 2, 3, 8, 9, 11 by hand (they have no dedicated gate). For every candidate "unused"/"duplicate"/"stale" finding, complete the full search in Absolute Rule 3 before writing it down — a finding that skips the search is not a finding, it's a guess.

### Phase 1 — Step 4: Classify and cite
Group findings by severity (broken > drifted/duplicated > stale > cosmetic) and category (skills, agents, hooks/commands, settings.json). Every single finding line carries its evidence inline — see the worked example below for the bar.

### Phase 1 — Step 5: Build the numbered plan and hand back
Turn findings into a numbered action list, one line each: what changes, which file(s), and which mechanism performs it (direct `Edit`/`rm` after confirmation, or handoff to `jstack:skill-creator` / `jstack:plugin`). End Phase 1 here — do not execute anything, even an item that looks obviously safe.

### Phase 2 — Step 1: Present and wait
In the main session, restate the numbered plan. Ask which item(s) to act on — never assume "all of them" from a general "go ahead."

### Phase 2 — Step 2: One item, one confirmation
For each item the user selects, confirm the specific mutation (file, exact change) immediately before performing it — use `AskUserQuestion` with `Confirm and continue | Edit before continuing | Skip this item | Cancel` when the host supports it, otherwise ask in plain text and wait for an explicit yes.

### Phase 2 — Step 3: Execute the smallest safe mechanism
Trivial, unambiguous fixes (delete a confirmed-orphaned reference file, remove a confirmed-dead settings.json permission entry, add a single missing frontmatter field) may be done directly with `Edit`/`Bash rm`. Anything touching a `SKILL.md` body's mission, rules, or structure — or anything that should land as a reviewable diff — hands off to `jstack:skill-creator` (fix content) and then `jstack:plugin` (open the PR). Never run `python3 scripts/apply_detailed_skills.py` as a "fix" for a `SKIP`-set skill.

### Phase 2 — Step 4: Verify
After each fix, re-run the specific gate that flagged it (not the full `bun run check`) to confirm the finding is actually resolved before moving to the next item.

## Named anti-patterns

| Anti-pattern | Why wrong | What instead |
|---|---|---|
| Flagging a skill "unused" after a 30-second grep of its own directory | Real references live in `agents/`, `scripts/`, `prompts/chains/`, and `docs/`, not just the skill's own folder — a shallow search manufactures false positives | Search all six locations in Absolute Rule 3 before writing "orphaned" |
| Deleting first, asking later ("I cleaned up the 4 duplicates I found") | Removes the one safeguard a hygiene tool has over a user's own working setup; a false-positive duplicate is now gone | Always stop at the numbered plan; Phase 2 requires a confirmation per item, not a summary after the fact |
| Recommending removal of something small because it's small | Line count is not a duplication or dead-code signal — a 15-line skill can be a correctly scoped leaf while a 200-line one can be padding | Judge by distinct content and real references, never by size alone |
| Treating zero eval coverage as "this skill is broken" | Coverage gaps and brokenness are different findings with different fixes; conflating them turns an eval-authoring task into an unwarranted deletion | Report "no eval coverage" as its own finding with its own remedy (write evals), separate from any correctness claim |
| Regenerating a `SKIP`-set skill's body to "fix" a depth-gate warning | Silently destroys hand-authored content the `SKIP` set exists specifically to protect (see `scripts/apply_detailed_skills.py`'s own comments on the skills pinned there in 2026-08) | Check the `SKIP` set before proposing any regeneration; hand-edit within the file instead |
| Reporting a mechanical gate's clean exit as "everything is fine" | `bun run check-write-gates`/`agents-check` only test what they were coded to test — a real duplicate body or a drifted catalog entry passes both cleanly | Always pair the mechanical pass with the qualitative checklist items (1, 2, 3, 8, 9) before declaring the setup healthy |

## Worked example

- **Weak finding:** "The `granola-daily-summary-6pm` skill looks unused, probably safe to delete."
- **Sharp finding:** "`skills/granola-daily-summary/SKILL.md` is in the `apply_detailed_skills.py` `SKIP` set (hand-authored comment: 'after these 19 were found sharing a content-free generator-fallback paragraph') — it is intentionally hand-maintained, not stale. Separately, `grep -rn "granola-daily-summary" skills agents scripts cli prompts docs` returns hits only from its own directory and `evals/discover.ts`'s generic skill walk — no `kickoff_workflows` entry, no chain reference, no mention in `prompts/chains/`. That second fact, not the first, is the actual finding: it may be reachable only by direct invocation, which is fine for a routine but worth confirming with the user rather than assuming abandonment. Recommendation: ask whether it's still scheduled anywhere outside this repo (a cron/config the audit can't see) before touching it — not a deletion candidate from this evidence alone."
- The sharp version separates two different signals (SKIP-set intentionality vs. reference-search results), cites the exact evidence for each, and ends with a question instead of a verdict where the evidence doesn't support one.

## Output shape

**Phase 1 report:**
- **Summary** (2–4 sentences): scope audited, gates run, total findings by severity.
- **Findings** grouped by severity (Broken / Drifted or Duplicated / Stale / Cosmetic) then category (Skills / Agents / Hooks & commands / Settings permissions). Each line: evidence (`file:line` or command output) + one-sentence implication.
- **Numbered action plan**: one line per item — what, where, how (direct edit vs. handoff to `jstack:skill-creator` / `jstack:plugin`).
- **Limitations**: gates that couldn't run, scope not covered, and whether the Claude Code docs/changelog check (item 11) ran or was skipped.

**Phase 2 response**, per confirmed item: what changed (file + diff summary), which gate was re-run to verify, and the next item awaiting confirmation.

## Failure modes

| Symptom | Recovery |
|---------|----------|
| `bun run check-write-gates` / `agents-check` / depth checks not runnable (no `bun`, wrong directory) | Report which gates ran and which didn't; do not fabricate their output. |
| A "duplicate" candidate turns out to share only the boilerplate preamble/config block | Not a finding — drop it; shared scaffolding across every skill is expected. |
| User says "just fix everything" | Restate that Phase 2 goes item by item regardless; ask which items to start with. |
| A finding touches a `SKIP`-set skill | Route the fix through a hand-edit or `jstack:skill-creator`, never `apply_detailed_skills.py`. |
| `WebFetch`/`WebSearch` unavailable for the Claude Code feature-drift check | Skip item 11 and say so explicitly in Limitations — do not guess at what's new. |

## Chaining

Phase 2 items that touch a skill's mission, rules, or frontmatter structure hand off to `jstack:skill-creator` with the specific finding and file as payload. Once a fix (or a batch of confirmed fixes) is ready, hand off to `jstack:plugin` to open the PR — this skill never pushes or commits itself. Never auto-invoke either; each handoff needs the user's go-ahead per the chaining guide.

```
--- handoff ---
from: jstack:hygiene-claude-code-hygiene
to: jstack:skill-creator
payload:
  finding: "<one-line finding with evidence>"
  target_file: "skills/<path>/SKILL.md"
  requested_change: "<what Phase 2 confirmed>"
--- end handoff ---
```

## User request

$ARGUMENTS
