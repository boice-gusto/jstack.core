# 3. Routing and config

Two separate questions come up constantly: "how did it pick that skill" and "where do org values
actually live." Different mechanisms answer each.

## Routing

Claude Code (or Codex/Cursor) matches your free text against every skill's `description` field —
that's the whole routing mechanism, no separate router process. This is why every `description:`
in this repo names when to invoke **and when not to** ("Not for X, use jstack:Y instead") — a
skill's description is the only signal deciding whether it fires. When two skills are close
enough to collide (e.g. `jira/append` vs `jira/update`, `notion/report` vs `notion/team-report`),
the losing skill's description explicitly disambiguates rather than leaving it to chance; a real
gate (`check-description-references.ts`) checks those disambiguation pointers actually resolve to
a real skill.

If you want a specific skill, name it (`/jstack:jira-create`, or `jstack-jira-create`) rather than
describing the task and hoping. Both work; naming it is faster and removes any ambiguity.

## Config

`jstack.config.json` holds every org-specific value — sprint length, approvers, channel ids,
integration keys — and nothing else. No skill hardcodes a team name, a channel id, or a sprint
cadence; if you ever see one that looks hardcoded, that's a bug, not a feature. Per-skill
overrides you want your team to be able to change live under `skill_defaults.<skill-id>`, not in
the skill's own prose.

To check what's actually configured:

```
jstack doctor
```

To change a value without hand-editing JSON (and risking an invalid config):

```
/jstack:update-config
```

It validates against the same Zod schema every skill enforces and shows a diff before writing —
you're not editing blind.

## Pitfall

Don't hand-edit `jstack.config.json` directly for anything beyond a quick local experiment.
`update-config` validates against the schema and can't leave you with a config that half the
skills reject; a hand-edit can, and the failure shows up later, in an unrelated skill, as a
confusing config error instead of an immediate validation message.

**Next:** [Multi-lens review](./04-multi-lens-review.md)
