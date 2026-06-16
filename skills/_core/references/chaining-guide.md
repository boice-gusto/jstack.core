# Skill chaining

## When to chain

Chain when the user's goal naturally spans multiple skills (e.g. "scan Slack then file the top 3 as Jira tickets"). Do **not** chain when a single skill can complete the work.

## Chain Contract (HTML comments in SKILL.md)

Every skill declares inputs and outputs in HTML comments at the top of its body:

```
<!-- inputs: user_request, jstack_config -->
<!-- outputs: structured_result -->
<!-- chains-to: jstack:prioritize -->
```

- **inputs** — what this skill expects from the caller or user.
- **outputs** — what it produces (used by the next skill in the chain).
- **chains-to** — the natural next skill. Optional; omit if no common follow-up.

## How to chain

1. **Orchestrators route** — parent skills (e.g. `skills/jira/SKILL.md`) pick the most specific child. They do not execute the child inline; they emit `suggested_next: <child-skill>`.
2. **Leaf skills hand off** — after completing work, a leaf skill adds one line: `suggested_next: jstack:<next-skill>` with a copy-paste handoff block containing the structured output the next skill needs.
3. **Never auto-invoke** — unless a `prompts/chains/` definition explicitly authorizes it, always wait for user confirmation before starting the next skill.

## Predefined chains (narrative)

Check `prompts/chains/` for named multi-step flows (e.g. incident response, intake-to-sprint). These are **human-readable** playbooks: prose, links, and ordering guidance for the operator.

## Executable kickoff workflows (config)

**Morning kickoff** (and similar) can also be defined as **machine-readable** YAML/JSON: ordered steps, each referencing a jstack skill `name` from `SKILL.md` frontmatter, optional `prompt`, `required`, and `on_fail: stop | continue | ask`. Loaded via `kickoff_workflows` in `jstack.config.json` and executed by **`jstack-morning-kickoff`** (`skills/routines/morning-kickoff/`).

- Use **narrative chains** when you need shared context for humans.
- Use **kickoff YAML** when you need PASS/FAIL checklists, resume state, and strict step ordering in chat.
- Cross-link by **step id** between the two without duplicating full prose.

## Handoff payload format

```
--- handoff ---
from: jstack:recon
to: jstack:prioritize
payload:
  action_items:
    - "Fix auth timeout in login service"
    - "Review Q3 roadmap draft"
  context: "Scanned #eng-team Slack and PROJ board for last 24h"
--- end handoff ---
```

The receiving skill reads the payload block and skips its own intake for fields already provided.

## Machine-readable handoffs (CLI / Claude)

For **scripts, MCP, and pipes**, use the same contract as [`output-formats.md`](./output-formats.md): request **`--output=json`** (or equivalent), emit **one JSON value** (optionally with top-level **`$schema`**), validate against `references/schemas/*.schema.json`. That is the same blob whether the producer is **Claude** or a **CLI** wrapper—mix hosts in any order without a second format. Narrative `--- handoff ---` YAML remains for human-in-the-loop steps; automation should prefer raw JSON stdout for `| jq` and file-based passes between tools.

## Rules

- One chain direction per turn. Do not fork into parallel chains without user intent.
- If a step fails (config, auth, API), **stop the chain** — do not continue with invented data.
- Each step restates what it did and what the next step expects before handing off.
