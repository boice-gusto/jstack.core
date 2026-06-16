# GBrain persistence metadata (skills and references)

Read **[repo-and-privacy.md](repo-and-privacy.md)** and **[config-team-vs-personal.md](config-team-vs-personal.md)** first. This doc defines **machine-readable** fields so agents default to the correct **team vs personal** persistence and **sensitivity** tier.

## YAML frontmatter on `SKILL.md`

| Key | Values | Meaning |
|-----|--------|---------|
| `gbrain_destination` | `team` \| `personal` \| `none` \| `inherit` | Default target when the user asks to save structured output to gbrain. `inherit` uses `session.default_gbrain_target` / session init. |
| `data_class` | `non_sensitive` \| `internal` \| `people_performance` | Policy + eval hooks. `people_performance` (brags, evals, impact prep): **never** write to team-visible storage without explicit user confirmation unless org policy in config overrides. |

**Orchestrators** may use `gbrain_destination: inherit` if children declare their own targets.

## Reference `.md` files

- **Preferred:** add the same two keys as **YAML frontmatter** at the top of the reference file.
- **Legacy refs without frontmatter:** optional HTML comment block in the first 20 lines:

```html
<!--
gbrain_destination: team
data_class: internal
-->
```

## Runtime rules

1. Read `gbrain_destination` and `data_class` before any gbrain / memory / shared Notion write.
2. Resolve `inherit` from session + `jstack.config.json` (`gbrain.team` vs `gbrain.personal` per repo-and-privacy).
3. **`people_performance` + `team`:** require explicit user confirmation, or follow `skill_defaults.gbrain.people_performance_target` if defined.
4. **Never** instruct users to commit `gbrain.personal`, home paths, or session stores into the **team** `jstack.config.json`.

## Config alignment

- Team URLs belong in **team-visible** config only when everyone may read them.
- Personal brain URLs belong in **personal / gitignored** overrides (`jstack.personal.json` or equivalent).
