---
name: jstack-pr-review-canvas
description: >-
  Generate an interactive HTML walkthrough of a GitHub PR — categorized file cards (core vs
  mechanical), reviewer annotations, rendered diffs with moved-code detection, and a review
  checklist — served locally so a reviewer can click through it instead of reading a raw diff.
  Use when the user pastes a GitHub PR URL/number and asks for a review, walkthrough, or visual
  summary, or says "review this PR," "make this easy to review," or "walk me through this diff."
  Do NOT use for the deep-read line-level defect hunt itself — `jstack:review-code-review` (or
  `jstack:thermonuclear-review` for a high-stakes pass) does the actual finding; this skill is
  the presentation layer on top of that reading, not a substitute for it. Do NOT use to publish
  or share the generated HTML anywhere outside this machine — it can contain proprietary diffs
  and stays local. Inspired by Cursor's `cursor-team-kit` plugin's `pr-review-canvas` skill,
  adapted to jstack conventions.
category: review
effort: high
generator: skip
---

<!-- Chain Contract -->
<!-- inputs: user_request, jstack_config, pr_url_or_number -->
<!-- outputs: local_html_url -->
<!-- chains-to: jstack:review-code-review, jstack:review-interrogate -->

Read the setup preamble first:
!cat ${CLAUDE_PLUGIN_ROOT}/prompts/setup/preamble.md
Load the policy this domain is governed by (do not restate it from memory):
!cat ${CLAUDE_PLUGIN_ROOT}/prompts/policies/review-policy.md

## What this skill is for
Turn a GitHub PR into a browsable, annotated HTML page — the diff a reviewer already has to read,
reorganized so the core logic is expanded and explained up front and boilerplate/mechanical churn
is collapsed by default. This is a **rendering and narration** layer: the actual review judgment
(what's a defect, what's blocking) comes from reading the diff yourself, the same way
`jstack:review-code-review` would, and getting written into the annotations — this skill does not
replace that reading with a template.
- **Out of scope:** Finding defects without reading the diff (that is fabrication, not review, and
  the annotations would be worthless); approving, merging, or commenting on the PR itself — this
  produces a local artifact for a human to read, never writes back to GitHub; publishing the
  generated HTML to any public or third-party host — it can contain proprietary source and stays
  on `127.0.0.1`, viewed locally only, never uploaded, emailed, or pasted into an external tool.

## Domain rules — PR review canvas
- Never fabricate a defect to fill an annotation slot. If a file's diff doesn't warrant a note,
  say so plainly ("no functional change here") rather than inventing a concern.
- The core-vs-mechanical split is a judgment call, not automatic — a one-line change to a load-bearing
  function is core; a 400-line lockfile or generated-catalog diff is mechanical. State which bucket
  a borderline file landed in and why, when it isn't obvious.
- Patch text goes through a JSON file on disk (`jq`, then a Python assembly step), never a hand-typed
  JS/JSON literal — a raw patch can contain `</script>`, backslashes, or quotes that break out of an
  inline `<script>` block. See Procedure Step 3.
- The local server binds `127.0.0.1` only, on a fixed port tried in sequence (never `0.0.0.0`, never
  a random/ephemeral port a backgrounded process's buffered stdout would hide).
- This never touches the real PR: no comments, no reviews, no status checks. It reads via `gh api`
  and writes only to `/tmp`.

### Named anti-patterns

| Anti-pattern | Why it's wrong | Do this instead |
|---|---|---|
| Annotating every file the same way | A one-line rename gets the same attention as a 200-line retry-logic change; the reviewer learns to skim past all the notes | Expand and annotate core files; collapse mechanical ones by default with a one-line `.bp-note` |
| Hand-embedding a raw patch string in a `<script>` block | A patch containing `</script>`, a backslash, or a quote breaks out of the tag or produces invalid JSON, even through naive `json.dumps` | Write patches to a JSON file via `jq`, inject with Python, and `<`/`>`-escape angle brackets |
| Writing an annotation before reading the patch | Produces generic praise or a guessed concern that doesn't match what actually changed | Read every file's patch first; name the specific mechanism the diff introduces or fixes |
| Binding the local server to `0.0.0.0` or a random port | Exposes the canvas (which can contain proprietary diffs) beyond the local machine, or hides the URL when backgrounded stdout is never read | Bind `127.0.0.1` on a fixed, known port (8432, then 8433, …) and tell the user the exact URL |
| Treating "large diff" as "risky diff" | A 1,400-line lockfile or generated-catalog diff is mechanical noise, not a review burden | Categorize by what actually changed (logic vs. generated/mechanical), not line count |

### Worked example

- *Weak:* A file card for `retryClient.ts` (+173/−11) with the note "Adds retry logic, looks
  reasonable" and the full 173-line diff expanded below it.
- *Sharp:* The same file card with the note "Adds exponential backoff + circuit breaker around
  `fetch()`. Before this PR a single timeout could cascade; after, failures trip the breaker after
  5 failures/10s. **Open question:** no idempotency key on the retried POST — check with
  `jstack:review-code-review` before merging." — a plain-English pseudocode block above a
  collapsed "Show full implementation (+173 lines)" `.bp-section`, so the reviewer reads the
  mechanism first and expands the raw diff only if they want to verify it.

## Config and references
- `jstack.config.json` — team ids, integrations, `skill_defaults`, `jira_rules`, `notion`, `gbrain`. Never hardcode.
- Library assets this skill injects verbatim (read, don't reinvent):
  `${CLAUDE_PLUGIN_ROOT}/skills/review/pr-review-canvas/library/template.html`,
  `${CLAUDE_PLUGIN_ROOT}/skills/review/pr-review-canvas/library/styles.css`,
  `${CLAUDE_PLUGIN_ROOT}/skills/review/pr-review-canvas/library/renderer.js`.
- Questions (open-ended, one at a time): `${CLAUDE_PLUGIN_ROOT}/skills/_core/references/question-patterns.md`
- Discrete choices (when the host supports AskUserQuestion or equivalent): `${CLAUDE_PLUGIN_ROOT}/skills/_core/references/ask-user-question-patterns.md`
- Integrations: `${CLAUDE_PLUGIN_ROOT}/skills/_core/references/integration-guide.md`
- Chaining: `${CLAUDE_PLUGIN_ROOT}/skills/_core/references/chaining-guide.md`

## Intake
1. Parse `$ARGUMENTS` for an `owner/repo#number`, a full PR URL, or a bare number (resolve
   `owner/repo` from the current git remote via `gh repo view --json nameWithOwner`).
2. If no PR is identifiable, ask **one** focused question rather than guessing a number.
3. If the request bundles a review ask ("also tell me if this is safe to merge") alongside the
   canvas ask, do the canvas here and suggest `jstack:review-code-review` for the merge verdict —
   don't blend a go/no-go call into what is meant to be a walkthrough artifact.

## Procedure
### Step 1 — Fetch PR data
Run these `gh api` calls (parallel where the host allows it):
```bash
gh api repos/{owner}/{repo}/pulls/{number} --jq '{title, body, user: .user.login, state, additions, deletions, changed_files, base: .base.ref, head: .head.ref}'
gh api repos/{owner}/{repo}/pulls/{number}/files --paginate --jq '.[] | {filename, status, additions, deletions, patch}'
gh api repos/{owner}/{repo}/pulls/{number}/comments --jq '.[] | {user: .user.login, body, path, line}'
```
If the integration is missing (`gh` not authenticated, repo not found), say so and point to `gh auth login` instead of faking PR data.

### Step 2 — Plan the safe path
This only reads (`gh api` GET calls) and writes to `/tmp` plus a local-only server — there is no
mutating action here to gate, but confirm the target repo is one the user actually has access to
before fetching, and never echo a `patch` field's raw content into your own reasoning as if it
were a defect just because it's large (large ≠ risky; read it).

### Step 3 — Read the diff and write the body HTML
Read every file's patch — actual understanding, not a skim — before writing `<body>` content.
Categorize each file core (logic that changed behavior) vs mechanical (lockfiles, generated
catalogs, pure formatting, renames with no logic change). Write annotations that name the
mechanism, the same standard `jstack:review-code-review` holds itself to — "this retries without
an idempotency key" is a finding; "this looks fine" is not.

Typical body structure (adapt freely — full creative control over the HTML beyond this):
- Header: title, PR number, author, +/− stats, files-changed pill
- Summary box: what the PR does, in plain English, 2-4 sentences
- Core file cards (`.file-card`, expanded by default, `.file-body.open`): sticky `.file-note`
  annotation above the rendered diff
- Mechanical file cards: collapsed by default, `.bp-section`/`.bp-hdr`/`.bp-body` with a one-line
  `.bp-note` ("generated lockfile, 1,400 lines, no manual review needed")
- Verbose logic gets a plain-English pseudocode summary in the note, with the real diff collapsed
  below it in a `.bp-section` labeled "Show full implementation"
- Review checklist at the bottom (`.verdict`): concrete open questions, not generic praise

Use `<div data-diff="KEY"></div>` placeholders wherever a diff should render; `renderer.js` finds
them automatically after page load. See the CSS class table and `renderDiff`/`toggle`/`esc` JS
functions documented in `library/renderer.js` and `library/styles.css` — read them before writing
the body so you use what's already there instead of re-implementing collapsible cards or diff
rendering inline.

**Patch strings are hostile input to a `<script>` tag** — they can contain `</script>`,
backslashes, and quotes that terminate the tag early even through `json.dumps`. Never hand-embed a
patch string in JS/JSON. Instead:
```bash
gh api repos/{owner}/{repo}/pulls/{number}/files --paginate \
  --jq '[.[] | {key: (.filename | gsub("[^a-zA-Z0-9]"; "_")), value: (.patch // "")}] | from_entries' \
  > /tmp/pr-patches-{number}.json
```
then assemble with Python (handles the JSON-in-`<script>` escaping correctly):
```python
import json
from pathlib import Path

patches = json.loads(Path('/tmp/pr-patches-{number}.json').read_text())
html = Path('/tmp/pr-review-{number}-body.html').read_text()
css = Path('${CLAUDE_PLUGIN_ROOT}/skills/review/pr-review-canvas/library/styles.css').read_text()
js = Path('${CLAUDE_PLUGIN_ROOT}/skills/review/pr-review-canvas/library/renderer.js').read_text()
tmpl = Path('${CLAUDE_PLUGIN_ROOT}/skills/review/pr-review-canvas/library/template.html').read_text()

safe_json = json.dumps(patches).replace('<', '\\u003c').replace('>', '\\u003e').replace('&', '\\u0026')

out = (
  tmpl.replace('/* INJECT_CSS */', css)
      .replace('/* INJECT_JS */', js)
      .replace('<!-- INJECT_BODY -->', html)
      .replace('{"__PR_DIFFS_PLACEHOLDER__":true}', safe_json)
)

Path('/tmp/pr-review-{number}.html').write_text(out)
```
Write body HTML to `/tmp/pr-review-{number}-body.html` first, then run the assembly above.

### Step 4 — Validate
Confirm every `data-diff="KEY"` in the body has a matching key in the patches JSON (a typo'd
filename-derived key silently renders "No diff data"). Confirm no annotation asserts a defect you
did not actually verify by reading the patch. Confirm the assembled file has no literal
`{"__PR_DIFFS_PLACEHOLDER__":true}` left over (a failed replace would ship an empty placeholder).

### Step 5 — Serve locally and hand off
```bash
cd /tmp && python3 -m http.server 8432 --bind 127.0.0.1
```
Run backgrounded; if 8432 is taken, try 8433, 8434, etc. — a fixed, known port, never port `0`
(a backgrounded process's stdout announcing a random port is invisible until it's read, which
never happens for a background shell). Tell the user the exact URL:
`http://127.0.0.1:8432/pr-review-{number}.html`. State what you did not review (files with no
patch data, e.g. binary diffs) and suggest `jstack:review-code-review` next if a real
approve/revise/block verdict is still needed — this skill only narrates, it doesn't verdict.

## Output shape
Use a domain-appropriate heading, then:
- **Summary** (2–4 sentences: PR title/number, what changed, where the reviewer's attention should go)
- **Details** — the local URL to open, and the core-vs-mechanical file split
- **Next steps** with owner + timeline if known
- **Limitations** (files with no diff data, anything not reviewed)
- For eval-gated skills, end with `result_ok: true` or `result_ok: false` + reason

## Failure modes

| Symptom | Recovery |
|---------|----------|
| `gh` not authenticated / repo not found | Point to `gh auth login`; do not fabricate PR data. |
| PR has 0 files or is already merged/closed | Say so; ask whether the user still wants the walkthrough. |
| A file's `patch` is empty (binary, too large, or a rename with no changes) | Render `.bp-note` stating no diff data is available — do not invent content for it. |
| Port 8432 (and the next few) all in use | Try the next port in sequence; tell the user which port actually bound. |
| A `data-diff` key doesn't match any patches JSON key | Fix the `gsub` filename normalization mismatch before shipping; don't ship a silently-empty diff panel. |

## Chaining
Complete the work here. This is a presentation layer, not a verdict — if the user still wants an
approve/revise/block call, suggest `suggested_next: jstack:review-code-review` (single deep read)
or `jstack:thermonuclear-review` (high-stakes, six-lens) as the natural follow-up. Do not
auto-invoke without user intent.

## User request

$ARGUMENTS
