<p align="center">
  <img src="../assets/logo-placeholder.png" alt="jstack" width="240" height="240" />
</p>

# Examples (input / output fixtures)

Each subdirectory holds **synthetic** **input-*** and **output-*** pairs that show what jstack skills and agents are expected to produce. They are for **tests, evals, and documentation**—not real customer data.

## Naming

| Prefix | Use |
|--------|-----|
| `input-` | User request, raw paste, or skill arguments |
| `output-` | Example of a good completion (or intermediate artifact) |

## Domains

| Path | What it illustrates |
|------|------------------------|
| `session/` | Session init and wrap-up |
| `reports/` | Team, engineer, manager, eval outputs |
| `recon/` | Slack-style recon in → action list out |
| `meetings/` | Prep, highlights, Slack post, action items |
| `incident/` | Incident in → retro-style notes |
| `review/` | Project update in → multi-lens review out |
| `self/` | Diary / focus / 9-grid / lookback style |
| `knowledge/` | Raw intake → processed → stored record |
| `jira/` | Story text, transitions, notify drafts |
| `intake/` | Product request → ticket shape |
| `notion/` | ADR, article, sprint summary |
| `announcements/` | Raw bullet notes → public-facing copy |
| `workflows/` | Flow def, preview, run report, visual diff |
| `metrics/` | My vs team rollups (synthetic numbers) |
| `research/` | Research asks + spike / codebase explain outputs |

**Authoring:** When you add a new example, keep **PII and secrets** out. Prefer fake URLs (`example.test`). See [`docs/MARKDOWN_SYSTEM.md`](../docs/MARKDOWN_SYSTEM.md) and [`skills/_core/references/markdown-authoring-guide.md`](../skills/_core/references/markdown-authoring-guide.md).
