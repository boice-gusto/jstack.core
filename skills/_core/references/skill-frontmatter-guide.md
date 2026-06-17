# Skill frontmatter guide — jstack conventions

Complete field reference for `SKILL.md` frontmatter. All fields are optional unless noted.

## Full example

```yaml
---
name: jstack-example
description: One to three sentences. What it does and when to invoke it. Never not invoke it.
when_to_use: Trigger phrases and synonyms. Appended to description in the skill listing.
category: engineering
gbrain_destination: team
data_class: internal
disable-model-invocation: true
context: fork
agent: Explore
effort: high
allowed-tools: Bash(git *) Grep Glob
disallowed-tools: AskUserQuestion
arguments: "[ticket_id, format]"
argument-hint: "[PROJ-123] [prose|json]"
paths: "src/**, tests/**"
model: claude-opus-4-8
---
```

---

## Field reference

### `name`
Display label shown in `/skills` listings. Does not change the `/` command name (that comes from the directory). Exception: a plugin-root `SKILL.md` uses `name` as the command name.

**jstack convention:** `jstack-<kebab-case-action>`. Lowercase, hyphens, action/outcome-oriented.

---

### `description`
What the skill does and when to use it. Claude uses this to decide when to auto-load the skill. Combined with `when_to_use`, capped at **1,536 characters** in the skill listing.

**jstack convention:** Lead with the action and primary use case. End with when NOT to use it if there is a sibling skill that overlaps.

---

### `when_to_use`
Additional trigger phrases, synonyms, or example requests. Appended to `description` in the listing.

**jstack convention:** Add paraphrase variants and indirect asks (e.g., "also when: user asks to recon, check in, sweep for issues").

---

### `disable-model-invocation`
Set `true` to prevent Claude from auto-loading this skill. Description is removed from context entirely. User must type `/skill-name`.

**jstack convention:** Required on all write/operational skills — any skill that posts, creates, transitions, updates, or deletes external state:
- All `jira/create`, `jira/transition`, `jira/update`, `jira/notify`, `jira/append`
- All `notion/*` write skills
- `announcements`, `meetings/post-slack`
- `routines/sprint-close`, `workflows/execute`, `workflows/recorder`

---

### `context`
Set `fork` to run the skill in an isolated subagent. The skill content becomes the subagent's prompt; it has no access to conversation history.

**jstack convention:** Use `context: fork` on pure read/research skills to protect the main context window from large file sweeps. Always pair with `agent: Explore` for read-only work.

```yaml
context: fork
agent: Explore
```

---

### `agent`
Which subagent type to use when `context: fork` is set. Options: `Explore` (read-only, fast), `Plan` (architecture), `general-purpose` (all tools).

**jstack convention:** Default to `Explore` for all knowledge/research/recon skills. Use `general-purpose` only when the forked skill needs to write or call MCPs.

---

### `effort`
Override effort level for this skill's turn. Clears on the next user message.
Options: `low` | `medium` | `high` | `xhigh` | `max`

**jstack tiering:**

| Effort | Skill category |
|--------|---------------|
| `low` | Routines (standup, morning-kickoff, health-check, weekly-digest), session init/end, store-note, diary, tasks, remember, focus |
| `medium` | Meetings action-items, transcribe, granola-highlights |
| `high` | Advice, ADR, SDLC, review/*, sprint planning/prep/refinement, reports/manager+team+engineer, self/eval+impact-prep+lookback, knowledge/search, research/explain+user+technical, engineering/health+silo-scan |
| `max` | recon, research/competitive+spike, metrics/team-metrics |

---

### `allowed-tools`
Tools Claude can use without a permission prompt while this skill is active. Does not restrict other tools; your session permissions still govern everything else.

Accepts space-separated strings or YAML list. Use `Bash(git *)` pattern syntax.

**jstack convention:** Declare MCP tools for skills that call Jira/Slack/Notion to eliminate per-call approval dialogs. Example:

```yaml
allowed-tools: mcp__jira__create_issue mcp__jira__search_issues
```

---

### `disallowed-tools`
Remove tools from the available pool while this skill is active. Clears on the next user message.

**jstack convention:** Add `disallowed-tools: AskUserQuestion` on all automated/routine skills that run in loops or scheduled routines. Prevents blocking on interactive prompts.

```yaml
disallowed-tools: AskUserQuestion
```

---

### `arguments`
Named positional args for `$name` substitution. Maps names to positions in order.

```yaml
arguments: "[ticket_id, status]"
# or YAML list:
arguments:
  - ticket_id
  - status
```

Use `$ticket_id` and `$status` in the body. `$ARGUMENTS` still expands to the full raw string.

---

### `argument-hint`
Shown in autocomplete when the user types `/skill-name `. Describes expected input.

```yaml
argument-hint: "[PROJ-123] [Done|In Progress|etc]"
```

---

### `paths`
Glob patterns. Claude auto-loads the skill only when working with matching files.

**jstack convention:** Not yet widely used. Candidate: `engineering/*` skills on `src/**, *.ts, *.tsx`.

---

### `model`
Override the model for this skill's turn. Reverts to session model on next prompt.

**jstack convention:** Leave unset unless a specific skill benefits from a stronger or weaker model. Setting `effort:` is usually sufficient.

---

### `shell`
`bash` (default) or `powershell`. Controls which shell runs `` !`command` `` and ```` ```! ```` blocks.

**jstack convention:** Not needed. All jstack skills run on macOS/Linux.

---

### `user-invocable`
Set `false` to hide from the `/` menu. Claude can still auto-load the skill.

**jstack convention:** Not yet widely used. Candidate: pure-reference skills that should never appear as commands (e.g., context cards, integration guides).

---

## Dynamic substitutions in skill body

| Variable | Expands to |
|----------|-----------|
| `$ARGUMENTS` | Full argument string typed after the skill name |
| `$ARGUMENTS[N]` | Nth argument (0-based) |
| `$N` | Shorthand for `$ARGUMENTS[N]` |
| `$name` | Named argument declared in `arguments:` frontmatter |
| `${CLAUDE_PLUGIN_ROOT}` | Plugin root directory — use for `!cat` includes |
| `${CLAUDE_SKILL_DIR}` | This skill's directory — use for bundled scripts |
| `${CLAUDE_SESSION_ID}` | Current session ID |
| `${CLAUDE_EFFORT}` | Active effort level string (`low` / `medium` / `high` / `xhigh` / `max`) |

---

## jstack-specific fields (non-standard)

These are read by jstack tooling but not by Claude Code's skill loader:

| Field | Purpose |
|-------|---------|
| `category` | Directory grouping shown in `jstack skills list` |
| `gbrain_destination` | `team` / `personal` / `none` — where skill outputs go in gbrain |
| `data_class` | `internal` / `confidential` / `public` — data handling guidance |
