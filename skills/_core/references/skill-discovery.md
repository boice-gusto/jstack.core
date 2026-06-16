# Skill discovery (portable)

When the user’s goal is unclear:

1. Restate intent in one sentence.
2. Propose **1–3** candidate **`jstack:*`** skills with a one-line reason each.
3. Prefer **routers**: `jstack-reports`, `jstack-jira`, `jstack-notion`, `jstack-knowledge`, `jstack-meetings`, `jstack-sprint`.
4. If the **CLI** is available, run: `jstack skills index --json` and `jstack skills show <id> --json` for authoritative paths.
5. Fall back to **`evals/evals.json`** as the canonical skill inventory list.
6. External catalogs: [`docs/SKILL_SOURCES.md`](../../../docs/SKILL_SOURCES.md).

## Org overlays (e.g. Gusto)

If an org-specific plugin (such as **`jstack.gusto`**) is installed, read that plugin’s **`references/skill-routing.md`** for org-prefixed skills and allowlisted vendor plugins — **after** applying this core flow.
