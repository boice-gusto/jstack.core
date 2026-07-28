---
name: jstack-visual-single-page-html
description: Build one standalone HTML file with React, Tailwind 4-style tokens, Chart.js/D3 via CDN, shadcn-compatible CSS themes, citations to design theory, report IA hierarchy, and typographic markdown rendering—not a Next.js bundle.
when_to_use: User wants a single downloadable HTML dashboard, branded report viewer, slide-like page, or interactive viz page without a build step; mentions React Tailwind Chart.js D3 shadcn themes SPA CDN; asks for markdown on page with professional layout or report/presentation design.
category: design
data_class: internal
effort: high
gbrain_destination: none
---

<!-- Chain Contract -->
<!-- inputs: user_request, jstack_config -->
<!-- outputs: structured_result -->

Read the setup preamble first:
!cat ${CLAUDE_PLUGIN_ROOT}/prompts/setup/preamble.md

## What this skill is for
Build one standalone HTML file with React, Tailwind 4-style tokens, Chart.js/D3 via CDN, shadcn-compatible CSS themes, citations to design theory, report IA hierarchy, and typographic markdown rendering—not a Next.js bundle.

## Domain rules — visual-single-page-html

### Absolute rules

1. **Ship exactly one self-contained HTML file.** No bundler, no build step, no local imports the
   browser can't resolve directly at open time.
2. **Pin every CDN dependency to an exact version**, never `@latest`, and add a Subresource
   Integrity hash where the CDN serves one
   ([MDN — Subresource Integrity](https://developer.mozilla.org/en-US/docs/Web/Security/Subresource_Integrity)).
   An unpinned or unverified script is a supply-chain hole in a file meant to be portable and
   durable long after it was written.
3. **Contrast is a requirement, not an aesthetic choice.** Normal text meets at least 4.5:1 and
   large text (≥18pt, or ≥14pt bold) meets at least 3:1 against its background
   ([WCAG 2.1 SC 1.4.3 — Contrast Minimum](https://www.w3.org/WAI/WCAG21/Understanding/contrast-minimum.html)).
   Check it against the actual rendered colors; don't eyeball it.
4. **Every interactive element is keyboard-reachable with a visible focus indicator** — tab order
   matches visual order, and `outline: none` with no replacement focus style is a defect
   ([WCAG 2.1 SC 2.4.7 — Focus Visible](https://www.w3.org/WAI/WCAG21/Understanding/focus-visible.html)).
5. **Meaning is never conveyed by color alone.** A status, error, or category distinguished only by
   hue needs a second channel — icon, label, or pattern — alongside it
   ([WCAG 2.1 SC 1.4.1 — Use of Color](https://www.w3.org/WAI/WCAG21/Understanding/use-of-color.html)).
6. **Sanitize any markdown or HTML rendered from user-supplied or external content before it enters
   the DOM.** Raw `innerHTML` of untrusted content is a standing XSS vector
   ([OWASP — Cross-Site Scripting](https://owasp.org/www-community/attacks/xss/)); use a sanitizer
   such as DOMPurify rather than trusting the source.
7. **The page explicitly handles four states before it ships**: empty (no data yet), loading (fetch
   in flight), error (fetch or render failed), and populated/no-data-matches-filter. Building only
   the happy path leaves the page unfinished, not done
   ([Nielsen Norman Group — Empty States](https://www.nngroup.com/articles/empty-state-interface-design/)).

### Thresholds

| Signal | Threshold | Basis |
|---|---|---|
| Contrast, normal text | ≥4.5:1 | [WCAG 2.1 SC 1.4.3](https://www.w3.org/WAI/WCAG21/Understanding/contrast-minimum.html) |
| Contrast, large text (≥18pt / ≥14pt bold) | ≥3:1 | [WCAG 2.1 SC 1.4.3](https://www.w3.org/WAI/WCAG21/Understanding/contrast-minimum.html) |
| CDN pinning | 100% of script/style tags pinned to an exact version; SRI hash present where supported | [MDN — SRI](https://developer.mozilla.org/en-US/docs/Web/Security/Subresource_Integrity) |
| States implemented | 4 of 4 (empty, loading, error, populated) visually distinct | A happy-path-only build fails on first load, error, or an empty dataset |
| Focus indicator coverage | 100% of interactive elements show a visible focus state; 0 instances of bare `outline: none` | [WCAG 2.1 SC 2.4.7](https://www.w3.org/WAI/WCAG21/Understanding/focus-visible.html) |

### Named anti-patterns

| Anti-pattern | Why wrong | What instead |
|---|---|---|
| `outline: none` with no replacement | Keyboard users lose all visual tracking of position | Use `:focus-visible` with a clear replacement style |
| `<script src="...@latest">` | Behavior can change or the dependency can be compromised with no warning | Pin an exact version; add an SRI hash |
| Color-only status indicators | Invisible or indistinguishable to colorblind users | Pair color with an icon or text label |
| `innerHTML` of raw markdown/user content | Standing XSS injection vector | Sanitize with DOMPurify (or equivalent) before inserting into the DOM |
| Building only the populated/happy-path view | Breaks or shows nothing useful on first load, error, or empty data | Design and implement all four states before calling it done |

### Worked example

- *Weak:* `<div id="chart"></div><script>document.getElementById('chart').innerHTML = data.description;</script>`,
  light-gray text on white, and a color-only legend.
- *Sharp:* "Body text `#595959` on `#FFFFFF` measures 7.1:1, above the 4.5:1 minimum. The chart
  legend pairs color with a text label and a distinct marker shape, not color alone.
  `data.description` (markdown from an external source) renders via
  `DOMPurify.sanitize(marked.parse(data.description))`, not raw `innerHTML`. Chart.js is pinned at
  `chart.js@4.4.1` with an SRI `integrity` attribute, not `@latest`. Four states are implemented: a
  skeleton loader while fetching, an empty-state message when there's no data yet, an error banner
  if the fetch throws, and the populated chart."

### What this skill must not do

- Does not build a multi-page app or anything requiring a bundler or build pipeline.
- Does not embed real user data, secrets, or PII inside the shipped file — reads from provided or
  sample data, or a documented external endpoint.
- Does not skip accessibility requirements for "just a quick internal tool" — the requirement
  applies regardless of expected audience size.

## Config and references
- `jstack.config.json` — team ids, integrations, `skill_defaults`, `jira_rules`, `notion`, `gbrain`. Never hardcode.
- Questions (open-ended, one at a time): `${CLAUDE_PLUGIN_ROOT}/skills/_core/references/question-patterns.md`
- Discrete choices (when the host supports AskUserQuestion or equivalent): `${CLAUDE_PLUGIN_ROOT}/skills/_core/references/ask-user-question-patterns.md`
- Integrations: `${CLAUDE_PLUGIN_ROOT}/skills/_core/references/integration-guide.md`
- Chaining: `${CLAUDE_PLUGIN_ROOT}/skills/_core/references/chaining-guide.md`

## Intake
1. Parse `$ARGUMENTS` — note whether the user **pasted** data or is asking you to **query** a system.
2. If a required id is missing, ask **one** focused question; otherwise use config defaults (label assumptions as `[assumption]`).
3. If the request bundles multiple unrelated goals, handle the first and offer to continue.

## Procedure
### Step 1 — Load config
Read relevant keys from `jstack.config.json`. If the integration is missing or unhealthy, say so and point to `jstack setup` / `jstack doctor` instead of faking data.

### Step 2 — Plan the safe path
Read current state before changing it. Prefer the reversible action; when an action is irreversible, show what will change and get explicit confirmation first. If a required id or path is missing from config, stop and ask — never substitute a guess.

### Step 3 — Execute
Apply the `jstack-visual-single-page-html` workflow using config and any applicable templates under `templates/design/`.

### Step 4 — Validate
Before reporting done: confirm the change landed where intended, that nothing outside the stated scope was touched, and that every id, path, and figure you emitted came from config or the conversation rather than from inference. Name anything you could not verify.

### Step 5 — Summarize and hand off
State what changed, what to verify, and suggest **one** next jstack skill if the work naturally continues.

## Output shape
Use a domain-appropriate heading, then:
- **Summary** (2–4 sentences)
- **Details** (bullets, table, or structured fields)
- **Next steps** with owner + timeline if known
- **Limitations** (partial data, no write access, etc.)
- For eval-gated skills, end with `result_ok: true` or `result_ok: false` + reason

## Failure modes

| Symptom | Recovery |
|---------|----------|
| Missing config / integration | Point to `jstack setup` or `jstack doctor`; do not continue with invented ids. |
| Auth / 403 / expired token | Stop; tell user to refresh credentials. Never print secrets. |
| Ambiguous goal | One clarifying question; if still unclear, present options A/B. |

## Chaining
Complete the work here. If a natural follow-up exists, add one line: `suggested_next: <skill-name>` with a copy-paste handoff block. Do not auto-invoke without user intent or a defined chain in `prompts/chains/`.

## User request

$ARGUMENTS
