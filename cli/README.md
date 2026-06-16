<p align="center">
  <img src="../assets/logo-placeholder.png" alt="jstack" width="240" height="240" />
</p>

# `@jstack/cli`

## Interactive prompts (Clack)

- Prefer `@clack/prompts` (`confirm`, `select`, `text`) for guided flows; reuse helpers in `src/lib/cliUi.ts`.
- Before prompting: guard with `isInteractive()` — when false, emit `--json` where defined, or print `nonInteractiveHint()` and exit non-zero if the operation requires a choice.
- On cancel: `if (handleCancel(result)) exitCancelled();`
- Do not add `console.log` debug noise on success paths; use `chalk.dim` sparingly for hints.

## Scripts

Run from repo root with Bun (`bun run …` in `jstack.core/package.json`).
