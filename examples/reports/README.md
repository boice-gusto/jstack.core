# Report examples — payloads, templates, and rendered HTML

Use this folder to **review every supported `report_kind`** alongside the human outlines under [`templates/reports/`](../templates/reports/) and the JSON Schema [`schemas/reports/report-payload-v1.schema.json`](../schemas/reports/report-payload-v1.schema.json).

## Quick review flow

1. Pick a row from the table below.
2. Open the **template** (outline authors follow).
3. Open the **payload** JSON (source of truth for section titles + markdown + optional charts).
4. Open the matching **rendered HTML** in a browser (single-file static shell with Tailwind CDN).

Regenerate all HTML after editing payloads:

```bash
cd jstack.core
bun run reports:review-bundle
```

Paths for `jstack report render` resolve from the **current working directory** when no `jstack.config.json` is found upward (typical dev checkout). Run commands from **`jstack.core`**.

## Mapping: `report_kind` → template → payload → rendered

| `report_kind` | Template outline | Payload | Rendered HTML |
|---------------|------------------|---------|---------------|
| `team-weekly` | [`templates/reports/team-weekly.md`](../templates/reports/team-weekly.md) | [`payloads/team-weekly.json`](payloads/team-weekly.json) | [`rendered/team-weekly.html`](rendered/team-weekly.html) |
| `engineer-weekly` | [`engineer-weekly.md`](../templates/reports/engineer-weekly.md) | [`payloads/engineer-weekly.json`](payloads/engineer-weekly.json) | [`rendered/engineer-weekly.html`](rendered/engineer-weekly.html) |
| `manager-rollup` | [`manager-rollup.md`](../templates/reports/manager-rollup.md) | [`payloads/manager-rollup.json`](payloads/manager-rollup.json) | [`rendered/manager-rollup.html`](rendered/manager-rollup.html) |
| `project-status` | [`project-status.md`](../templates/reports/project-status.md) | [`payloads/project-status.json`](payloads/project-status.json) | [`rendered/project-status.html`](rendered/project-status.html) |
| `sprint-summary` | [`sprint-summary.md`](../templates/reports/sprint-summary.md) | [`payloads/sprint-summary.json`](payloads/sprint-summary.json) | [`rendered/sprint-summary.html`](rendered/sprint-summary.html) |
| `incident-retro` | [`incident-retro.md`](../templates/reports/incident-retro.md) | [`payloads/incident-retro.json`](payloads/incident-retro.json) | [`rendered/incident-retro.html`](rendered/incident-retro.html) |
| `eval-report` | [`eval-report.md`](../templates/reports/eval-report.md) | [`payloads/eval-report.json`](payloads/eval-report.json) | [`rendered/eval-report.html`](rendered/eval-report.html) |
| `self-report` | [`self-report.md`](../templates/reports/self-report.md) | [`payloads/self-report.json`](payloads/self-report.json) | [`rendered/self-report.html`](rendered/self-report.html) |
| `generic` | *(no dedicated outline — use [`AUTHORING.md`](../templates/reports/AUTHORING.md))* | [`payloads/generic.json`](payloads/generic.json) | [`rendered/generic.html`](rendered/generic.html) |

## Older markdown-only samples

These predate the payload/rendered bundle; they remain useful as copy/style references:

- [`output-team-weekly.md`](output-team-weekly.md)
- [`output-engineer-weekly.md`](output-engineer-weekly.md)
- [`output-manager-rollup.md`](output-manager-rollup.md)
- [`output-eval-report.md`](output-eval-report.md)

## Related

- Authoring guide: [`templates/reports/AUTHORING.md`](../templates/reports/AUTHORING.md)
- Extra sample JSON (team-weekly style): [`templates/reports/examples/sample-payload.json`](../templates/reports/examples/sample-payload.json)
