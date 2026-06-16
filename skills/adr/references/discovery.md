# Finding or choosing an ADR directory

## Priority order

1. **Explicit path** — If the user names a file or directory (e.g. `docs/adr/015-observability.md` or `write to plans/decisions/`), use that. Create parent dirs only after confirmation when creating a **new** file.

2. **`knowledge_base.roots`** — If `jstack.config.json` lists roots that contain an existing `adr/`, `docs/adr/`, or `docs/decisions/`, prefer the shallowest match under those roots.

3. **Workspace scan (read-only)** — Look for existing markers (in order):
   - `docs/adr/` with `*.md`
   - `adr/` at repo root with `*.md`
   - `docs/decisions/` with `*.md`
   - `.adr/` or `architecture/decisions/` (less common; use if files exist)

4. **Create default** — If none exist and the user agrees to bootstrap: **`docs/adr/`** at workspace root, plus a one-line `README.md` pointing at this skill’s template if helpful.

## Numbering

- Prefer **`NNN-kebab-case-title.md`** (three-digit zero-padded), e.g. `014-use-postgres-for-events.md`.
- Scan chosen directory for `^\d{3}-` filenames; next number is max+1.
- If the folder uses undated titles only, follow local convention after listing existing files.
