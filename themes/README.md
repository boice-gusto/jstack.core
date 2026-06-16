<p align="center">
  <img src="../assets/logo-placeholder.png" alt="jstack" width="240" height="240" />
</p>

# jstack themes (dashboard)

This directory holds **output style / color theme data** for the local dashboard, not plugin skills.

## `jstack.json`

```json
{
  "name": "jstack",
  "palette": {
    "primary": "#2563eb",
    "accent": "#10b981"
  }
}
```

| Field | Purpose |
|-------|---------|
| `name` | Theme label for the UI or future theme picker. |
| `palette.primary` | Main brand / navigation accent. |
| `palette.accent` | Secondary highlight (success, positive actions). |

**Optional extensions (if the app supports them):** add keys under `palette` (e.g. `danger`, `muted`) only in coordination with `dashboard` source so unused keys do not break the build.

## Markdown in this folder

- Use **this README** for editor notes. Do not add `SKILL.md` here; plugin skills belong in [`/skills`](../skills/).
- For the full map of doc types, see [`docs/MARKDOWN_SYSTEM.md`](../docs/MARKDOWN_SYSTEM.md).

## Accessibility

- Prefer contrast ratios that meet WCAG AA for text on `primary` / `accent` when used as button or link backgrounds. Validate in the running dashboard, not only in the JSON.
