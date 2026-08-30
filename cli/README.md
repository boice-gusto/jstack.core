<p align="center">
  <img src="../assets/logo.png" alt="jstack" width="240" height="240" />
</p>

# `@jstack/cli`

## Interactive prompts (Clack)

- Prefer `@clack/prompts` (`confirm`, `select`, `text`) for guided flows; reuse helpers in `src/lib/cliUi.ts`.
- Before prompting: guard with `isInteractive()` — when false, emit `--json` where defined, or print `nonInteractiveHint()` and exit non-zero if the operation requires a choice.
- On cancel: `if (handleCancel(result)) exitCancelled();`
- Do not add `console.log` debug noise on success paths; use `chalk.dim` sparingly for hints.

## Scripts

Run from repo root with Bun (`bun run …` in `jstack.core/package.json`).

## Agent-drivable CLI checklist

A command an agent (not a human at a keyboard) will call must be usable without ever seeing a
prompt. Check these when adding a command:

- **Non-interactive-first.** Already the default via the `isInteractive()` guard in `cliUi.ts`
  (see above) — every prompt must have a non-TTY path (`--json`, a flag, or a documented default),
  never a hang.
- **`--dry-run` on anything that mutates.** Several commands already have this (e.g. `doctor
  --dry-run`, the agent-stream route's dry-run flag); add it to any new command that writes
  config, files, or an external system.
- **Fast, actionable errors.** An error an agent reads should name the fix, not just the failure
  (`jstack setup` / `jstack doctor`, not a stack trace) — this is already this repo's convention
  for config/integration failures; keep it for new commands too.
- **Worked examples in `--help`, not just flag descriptions.** This one is a real, current gap —
  no command uses commander's `.addHelpText()` to show a real invocation. When adding a command
  non-trivial enough to need more than its flag list, add one via `.addHelpText("after", ...)`
  showing an actual command line, not just prose describing what the flags do.
