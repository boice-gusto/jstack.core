# Config wizard

Interactive setup pattern for skills that need config values which aren't set yet. Skills inject this ref to get a consistent wizard experience.

## When to trigger the wizard

A skill triggers the wizard when **all three** conditions are met:
1. A config value is required to proceed (not just nice-to-have).
2. The value is missing or empty in `jstack.config.json`.
3. No safe default exists (can't use `[assumption]`).

Do NOT trigger for optional values. Do NOT trigger if the value exists but the user wants to change it — that's an override, not a wizard (see Override section below).

## Wizard flow

### Step 1 — Detect the gap

```
I need `sprint.cadence_weeks` to plan this sprint, but it's not configured yet.
```

Name the exact config key. Don't say "some settings are missing."

### Step 2 — Offer a template or ask

If predefined templates exist for this config section, offer them:

```
Pick a starting point for sprint config:

1. **Light** — 1-week sprints, no formal ceremonies
2. **Standard** — 2-week sprints, planning + retro
3. **Scaled** — 2-week sprints, planning + retro + demo + grooming

Or tell me your specifics and I'll configure it custom.
```

If no templates exist, ask one focused question per the question-patterns ref:

```
How long are your sprints? (e.g., "1 week", "2 weeks", "monthly")
```

### Step 3 — Confirm and write

Show the user exactly what will be written:

```
I'll add this to jstack.config.json:

  sprint.cadence_weeks: 2
  sprint.ceremonies: ["planning", "retro"]

Confirm? (yes / edit / skip)
```

Three responses:
- **yes** → write the config, continue with the skill.
- **edit** → user provides corrections, re-confirm.
- **skip** → proceed without the value; skill uses `[not configured]` in output where needed.

### Step 4 — Write and resume

Use `jstack:update-config` to write the value. Then resume the original skill seamlessly — don't make the user re-invoke.

## Bootstrap (nothing exists yet)

When **no** `jstack.config.json` (or host equivalent) is present:

1. Say that both **team** and **personal** GBrain slots exist in the schema (`gbrain.team`, `gbrain.personal`); the user can fill team first, personal second.
2. Offer to create from `config/defaults.json` → proposed `jstack.config.json` after confirm.
3. For a **team git repo**: offer steps — `mkdir`, `git init`, write team-only config, first commit (see `${CLAUDE_PLUGIN_ROOT}/skills/_core/references/config-team-vs-personal.md`).
4. For **personal overlay**: offer `mkdir -p ~/.config/jstack` and copy `config/personal.example.json` → `jstack.personal.json`, then edit `gbrain.personal` (never commit personal URL to the team repo).

Do not run `git init` or write files **without** explicit user confirmation on paths and remote names.

## Override flow

When the user says "use 1-week sprints for this one" but config says 2 weeks:

1. Use the override for this invocation.
2. Note it in output: `[override: sprint.cadence_weeks = 1 for this run]`.
3. Ask: "Want to save this as the new default?" 
   - **yes** → write to config.
   - **no** → one-time only, config unchanged.

## Template registry

Skills with predefined templates register them here. The wizard presents these when the relevant config section is empty.

| Config section | Templates | Location |
|----------------|-----------|----------|
| `approval_chains` | startup, scaleup, enterprise | `_core/references/approval-chains.md` |
| `sprint` | light, standard, scaled | `templates/config/sprint-templates.md` |
| `policies.incidents` | startup, standard, enterprise | `templates/config/incident-templates.md` |
| `policies.sdlc` | minimal, standard, strict | `templates/config/sdlc-templates.md` |
| Full config | startup, scaleup, enterprise | `templates/config/{startup,scaleup,enterprise}.json` |
| Team + personal split | personal overlay file | `config/personal.example.json`, `skills/_core/references/config-team-vs-personal.md` |

## How skills inject this

Add this line to the "Config and references" section of any skill that reads config values:

```
- Wizard: `${CLAUDE_PLUGIN_ROOT}/skills/_core/references/config-wizard.md`
```

The skill doesn't need to implement wizard logic itself. It reads this ref, and the pattern handles the rest.

## Anti-patterns

- Asking multiple config questions at once (one at a time).
- Writing to config without showing the user what will change.
- Triggering the wizard for optional or read-only values.
- Making the user re-invoke the skill after config is set.
- Silently using an empty string as a value instead of surfacing the gap.
