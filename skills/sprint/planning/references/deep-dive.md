# Sprint planning — deep dive (jstack-sprint-planning)

## When to use

- **Sprint goal, capacity, and scope** need to be set for an upcoming iteration.
- Bridging to a written plan when `superpowers:writing-plans` is available is optional but common.
- **Out of scope:** Day-to-day standup execution (`jstack:routines-standup`) or mid-sprint replanning unless the user asks.

## Process

1. **Confirm cadence** — length, dates, holidays from config or user; never assume.
2. **Capacity** — people × focus factor; subtract PTO/oncall if known; label gaps `[assumption]`.
3. **Carry-in** — unfinished work from prior sprint; flag risk if WIP is high.
4. **Proposed scope** — tie to sprint goal; map to `jstack:prioritize` if the backlog is unordered.
5. **Exit criteria** — what “done” means for the goal; link to Jira/Notion if configured.

## Best practices

- **One sprint goal** — testable sentence, not a theme list.
- Align **ready** stories (definition of ready) before pulling into sprint.
- If using `jstack:jira-*` skills, respect `jira_rules` from config.

## Anti-patterns

- Committing more points than capacity “because the business asked.”
- Skipping dependency or flag risks for cross-team items.

## Examples

**Weak:** “We’ll do the top items from the backlog.”  
**Strong:** “Goal: ship OAuth error surfacing in web. Capacity 80 pts, 12 pts buffer. Scope: PROJ-101, PROJ-104, PROJ-110; PROJ-112 deferred — dependency on Platform (not ready).”

## Templates

- `templates/config/sprint-templates.md`
- `templates/config/sdlc-templates.md` — if your org ties sprints to SDLC gates.

## Chaining

- **From** `jstack:prioritize` — take ranked list; fit to capacity.
- **To** `jstack:sprint` (status), `jstack:notion-sprint`, or `Skill(skill: "superpowers:writing-plans")` for a formal plan doc.
