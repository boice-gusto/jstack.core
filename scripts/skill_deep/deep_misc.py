"""
Deep domain content for a mixed cluster of high-effort skills: two research skills,
federated multi-provider search, two Notion write skills, an incident retro, and the
single-page HTML design skill.

See scripts/skill_deep/__init__.py for how DEEP merges into the generator.

Owns exactly: research/explain-codebase, research/technical, federated-search,
notion/report, notion/performance, incident/retro, design/visual-single-page-html.
"""
from __future__ import annotations

DEEP: dict[str, str] = {
    "research/explain-codebase": """
## Domain rules — explain-codebase

### Absolute rules

1. **Map top-down before reading implementation detail.** Order: entry point(s) → routing/dispatch
   → data flow (how a request or job moves through the system) → boundaries (external services,
   database, auth, third-party APIs). Reading files in whatever order a directory listing happens
   to show them is not a map, it's a scroll.
2. **Do a breadth pass before any depth pass.** The C4 model's own ordering — context, then
   containers, then components, then code — is a top-down, breadth-before-depth sequence for
   exactly this reason: it produces a shared, checkable picture before anyone commits to one
   corner of it ([C4 model](https://c4model.com/)).
3. **Name the evidence for every structural claim.** "This service owns billing" needs a file or
   module behind it (`services/billing/index.ts`), not "it looks like it does."
4. **State coverage explicitly at the end**, split into three buckets: read directly, inferred from
   naming/structure but not opened, and unknown/not examined. A summary that doesn't distinguish
   these three implies full coverage it doesn't have.
5. **Never generalize a whole module's behavior from one function you read.** One function read in
   a 40-file module supports a claim about that function, not the module — say which one it was.
6. **The first file opened does not get to define the mental model.** Anchoring bias — the
   documented tendency to over-weight the first piece of information encountered and adjust
   insufficiently from it ([Tversky & Kahneman, 1974; anchoring bias](https://en.wikipedia.org/wiki/Anchoring_(cognitive_bias)))
   — is exactly why breadth-before-depth matters: it forces at least one more data point before a
   conclusion locks in.
7. **If the repo has a documented map** (README, ARCHITECTURE.md, CODEOWNERS), read it before
   free-form exploration, but verify its claims against current code rather than repeating stale
   docs as fact — docs drift from code silently.

### Thresholds

| Signal | Threshold | Basis |
|---|---|---|
| Structural-claim evidence | 100% of claims cite a file or module | Unsupported architecture claims are unfalsifiable |
| Breadth pass before depth | ≥1 full pass across entry point + routing layer before the first deep dive | Prevents anchoring on file #1 ([anchoring bias](https://en.wikipedia.org/wiki/Anchoring_(cognitive_bias))) |
| Files read before a behavioral claim | ≥2 (the file itself plus at least one caller or consumer) | A single file read in isolation can't confirm how it's actually invoked |
| Coverage disclosure | 3 explicit buckets stated: read / inferred / unknown | Anything less implies coverage the pass didn't achieve |

### Named anti-patterns

| Anti-pattern | Why wrong | What instead |
|---|---|---|
| Diving into the first interesting file | Anchors the whole mental model on one unrepresentative file before any breadth context exists | Do the entry-point → routing → data-flow → boundary pass first |
| Grep-and-guess | Claims behavior from a name match (`billing.ts` → "handles billing") without opening the file | Read the implementation before asserting what it does |
| Treating README as ground truth | Docs drift from code the moment either changes without the other | Cross-check documented claims against the current code before repeating them |
| Claiming full coverage of a large repo | False confidence; nobody reading the summary can tell what was actually opened | State read / inferred / unknown explicitly, every time |

### Worked example

- *Weak:* "This is a monorepo with a React frontend and a Node backend; auth is handled by
  middleware."
- *Sharp:* "Entry points read directly: `apps/web/src/main.tsx` (mounts `<App/>`),
  `apps/api/src/index.ts` (Express app). Routing read directly: `apps/api/src/routes/index.ts`
  registers `/auth` and `/orders`. Data flow read directly: the `/orders` handler in
  `apps/api/src/routes/orders.ts` calls `db.query()` inline — no ORM layer found in this pass.
  Auth boundary read directly: `middleware/auth.ts:1-40` checks a JWT against an env secret.
  Coverage — read directly: 5 files listed above. Inferred from directory naming only, not opened:
  `apps/api/src/services/*` (12 files). Unknown: test coverage, deploy config."

### What this skill must not do

- Does not modify code — it produces a map and, when requested, one targeted deep dive.
- Does not perform the tradeoff/option analysis of `jstack:research-technical` — that's a
  different judgment call layered on top of a map, not part of building the map itself.
- Does not claim exhaustive coverage of a large repo in one pass — states the boundary of what was
  read and offers to go deeper on a named area.
""",
    "research/technical": """
## Domain rules — technical

### Absolute rules

1. **Rank sources by a fixed hierarchy**: spec/RFC/official docs > maintainer statements
   (changelog, a maintainer's own issue/PR comment) > blog posts/tutorials > forum answers. When
   two sources conflict, the higher tier wins unless the lower tier is more recent *and* version-
   matches the installed version being asked about.
2. **Version-pin every behavioral claim.** An answer true for one major version can be false for
   the next — Semantic Versioning exists precisely because a MAJOR bump signals incompatible API
   changes ([semver.org](https://semver.org/)). State the exact version checked, not "the current
   version" or "generally."
3. **Distinguish documented behavior from observed behavior**, always labeled. Documented = the
   spec/official docs say this happens. Observed = this is what actually happened when it was run.
   The two usually agree; when they don't, that gap is itself the most important finding.
4. **Never assert API behavior not verified in the installed version.** If it can't be run, say
   "documented, not verified in this environment" — do not present untested reasoning as a fact
   with the same confidence as a checked one.
5. **Runtimes label their own stability.** Where a stability index exists — e.g. Node.js marks
   APIs Deprecated / Experimental / Stable
   ([Node.js documentation conventions](https://nodejs.org/api/documentation.html#stability-index))
   — surface that label; recommending an Experimental API as if it were Stable misrepresents risk
   the source itself already disclosed.
6. **A top-voted forum answer is not automatically current.** Check its age and the version it was
   written against before relying on it; an answer several major versions old is a lead to verify,
   not a citation to trust.
7. **State what could not be verified.** "Could not confirm this in the installed version — docs
   say X, no environment available to test" is a complete, honest answer; a confident guess dressed
   as a checked fact is not.

### Thresholds

| Signal | Threshold | Basis |
|---|---|---|
| Source tier | Tier 1 spec/RFC/official docs, Tier 2 maintainer statement, Tier 3 blog/tutorial, Tier 4 forum answer | Fixed ranking resolves conflicts without re-litigating each time |
| Version pin | 100% of API-behavior claims name the exact version checked | An unpinned claim can't be validated against a MAJOR-version change ([semver.org](https://semver.org/)) |
| Verification label | Every claim marked "documented" or "observed" (or both) — 0% unlabeled | Conflates guaranteed behavior with a single run |
| Answer staleness | An answer referencing a version ≥1 major version behind the installed version is flagged for re-verification | Matches how semver defines a breaking-change boundary |

### Named anti-patterns

| Anti-pattern | Why wrong | What instead |
|---|---|---|
| Treating a top-voted forum answer as authoritative | May predate several major versions; upvotes measure popularity, not currency | Check the spec/changelog first, then confirm against the currently installed version |
| Copying a blog snippet untested | Blogs can be wrong or outdated when written, and never get corrected | Verify against official docs and, where feasible, a minimal repro |
| Silent version omission | The reader can't tell whether the claim applies to their install | State the exact version checked in every claim |
| Reporting "observed" as "documented" | Conflates what happened once with what the spec guarantees to always happen | Label each separately; flag disagreement between them explicitly |

### Worked example

- *Weak:* "You can just use `array.flat()` to flatten nested arrays in JS."
- *Sharp:* "`Array.prototype.flat()` is documented on
  [MDN](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Array/flat)
  with broad modern-engine support. This repo's `.nvmrc` pins Node 18.x; `flat()` has shipped since
  Node 11, so it's safe here — documented and, per a quick `node -e` check, observed working
  identically. A 2015 Stack Overflow answer recommending a recursive polyfill predates this API
  entirely (Tier 4, superseded by Tier 1) and should not be used for this codebase's target
  runtime."

### What this skill must not do

- Does not execute untrusted third-party code without sandboxing to "verify" a claim.
- Does not fabricate a citation when no source was found — states "could not verify" instead.
- Does not substitute for `jstack:research-explain-codebase`'s structural mapping — this skill
  investigates an external technical question, not this repo's own architecture.
""",
    "federated-search": """
## Domain rules — federated-search

### Absolute rules

1. **State exactly which providers were queried, which returned zero hits, and which were
   unreachable — every time.** Federated search inherently combines heterogeneous, independently
   available backends ([federated search](https://en.wikipedia.org/wiki/Federated_search)); silent
   partial coverage reads as completeness to anyone who wasn't watching it run.
2. **"Not found in the providers reached" and "does not exist" are different claims.** Only the
   first is ever justified by a search that skipped or lost a provider — never collapse the two.
3. **Never fabricate a result or a credential.** A provider that errors, times out, or lacks a
   configured token is reported as unreachable — it is never a reason to synthesize a plausible-
   looking hit in its place.
4. **Every surfaced result carries per-provider evidence and an as-of/query timestamp.** A result
   with no source and no freshness marker cannot be checked or trusted by the reader.
5. **State the ranking rationale per result** — recency, exact keyword match, source authority, or
   a stated fusion method such as reciprocal rank fusion for combining independently ranked lists
   ([Cormack, Clarke & Buettcher, 2009 — Reciprocal Rank Fusion](https://plg.uwaterloo.ca/~gvcormac/cormacksigir09-rrf.pdf)).
   "Most relevant" with no named reason is not an audit trail.
6. **A provider timeout is a coverage gap, not a null result.** Report it as "timed out after
   config's configured window," never silently folded into "no hits."
7. **When providers disagree on a fact** (one says an incident is closed, another implies it's
   still open), surface the conflict explicitly — do not pick one silently and drop the other.

### Thresholds

| Signal | Threshold | Basis |
|---|---|---|
| Coverage disclosure | 100% of invoked providers listed as queried / zero-hit / unreachable / timed-out | Anything less misrepresents completeness |
| Provider timeout | Per-provider timeout from `jstack.config.json` / `mcp_servers` config, not invented — describe the shape, pull the number from config | Org-specific; hardcoding a figure here would be fiction |
| Result freshness | 100% of results carry an as-of query timestamp | Undated results can't be judged as current or stale |
| Ranking rationale | Named per result: recency, keyword match, source authority, or fusion method | Unlabeled ranking can't be audited or reproduced |

### Named anti-patterns

| Anti-pattern | Why wrong | What instead |
|---|---|---|
| Silent partial coverage | Reports as if fully searched when some providers failed or were skipped | Always list queried vs. zero-hit vs. unreachable vs. timed-out |
| "No hits" treated as "confirmed doesn't exist" | Absence of evidence in reachable providers isn't evidence of absence | State "not found in reachable providers"; name what wasn't reached |
| Fabricating a result when a provider errors | Worse than an honest gap — presents invented data as real | Report the error; never synthesize a plausible-looking hit |
| Merging ranked lists with no stated method | Unreproducible, unauditable ordering | Name the ranking basis or fusion method used for the final order |

### Worked example

- *Weak:* "Searched everywhere, didn't find anything about the outage."
- *Sharp:* "Queried: Jira (0 hits), Slack (3 hits, as of 2026-07-27 14:02 UTC), GitHub (1 hit).
  Unreachable: Notion — auth token expired, not searched, flagged rather than silently omitted.
  Ranking: the Slack thread ranks first on recency (posted 40 minutes prior) plus an exact keyword
  match on 'checkout-outage'; the GitHub issue ranks second on keyword match alone, with no
  recency signal. Conclusion: not found in Jira or Slack; cannot say it doesn't exist in Notion,
  since that provider was unreachable this run."

### What this skill must not do

- Does not decide which provider's conflicting account of a fact is correct — surfaces the
  conflict for the user to resolve.
- Does not retry a hung provider indefinitely — respects the configured timeout and reports the
  gap rather than blocking the whole search on one backend.
- Does not invent a provider's credential or id to make it appear queried when it wasn't configured.
""",
    "notion/report": """
## Domain rules — notion-report

### Absolute rules

1. **Resolve the parent page or database strictly from config or a pasted URL.** Read
   `jstack.config.json`'s `notion` section for the target id; if none is configured and no URL was
   given, stop and ask — never guess an id that "looks right" or reuse "whatever was used last
   time" from memory.
2. **Read the target location before writing to it.** When writing into an existing database,
   fetch its schema/properties first; a write that assumes property names and types without
   checking can silently create malformed rows or fail partway through.
3. **Never overwrite an existing page without first fetching and diffing its current content.** An
   overwrite that skipped the read step can destroy content nobody asked to change, with no way to
   tell what was lost.
4. **Every created or updated report starts in Draft** (or the equivalent non-published status from
   config) — promoting to Published is a separate, explicit action the user takes, never something
   this skill does on its own.
5. **Report the resulting page URL in every summary.** Without it, the user can't verify the write
   landed in the right place or undo it if it didn't.
6. **Confirm scope before writing** — personal, team, or org-wide database — when the request or
   config implies a narrower scope than the resolved target actually is, stop and confirm rather
   than writing to the broader one.
7. **A missing required id is a stop condition, not a fallback trigger.** Falling back to "the most
   recently used page" when the real target is unknown is exactly the kind of silent guess this
   skill exists to avoid.

### Thresholds

| Signal | Threshold | Basis |
|---|---|---|
| Parent/database resolution | 100% from config or an explicit pasted URL — 0% guessed | Guessed ids write to the wrong place undetected |
| Pre-write read | 100% of updates preceded by a fetch of current content | Skipping the read makes an overwrite irreversible and unaudited |
| Initial status on create | Draft (or config's non-published equivalent) on 100% of new pages | Publishing is the user's decision, not this skill's default |
| Missing id | Stop-and-ask on 100% of occurrences — 0% invented | An invented id is indistinguishable from a correct one until it's too late |

### Named anti-patterns

| Anti-pattern | Why wrong | What instead |
|---|---|---|
| Guessing a database id from memory | Writes land in the wrong destination with no error thrown | Require an explicit id from config or the current request |
| Overwriting without reading first | Destroys existing content invisibly, with no diff to recover from | Fetch and diff before every write to an existing page |
| Publishing a new report immediately | Removes the user's review step entirely | Default every create to Draft; let the user promote explicitly |
| Writing to a shared/org-wide database when personal scope was implied | Report ends up more visible than intended | Confirm scope explicitly before writing when it's ambiguous |

### Worked example

- *Weak:* "Created the report in Notion."
- *Sharp:* "Target resolved from `jstack.config.json` → `notion.report_database_id`. Read the
  database schema first: Title, Status, Owner, Date properties match this report's fields. Fetched
  the target location before writing — nothing existed there yet (new row, not an overwrite).
  Created with Status = Draft. Page: `<url>`. Promote to Published manually when ready."

### What this skill must not do

- Does not decide when to promote Draft to Published — that stays the user's call.
- Does not manage workspace membership, permissions, or public-web sharing settings.
- Does not choose between report/ADR/team-note sub-skills — that routing happens at the Notion
  orchestrator, one level up.
""",
    "notion/performance": """
## Domain rules — notion-performance

### Absolute rules

1. **Describe observable behavior, not inferred motive**, in every impact or growth section — what
   someone did or produced is evidence; why they supposedly did it is speculation and does not
   belong on the page as fact ([Situation-Behavior-Impact feedback model — Center for Creative
   Leadership](https://www.ccl.org)).
2. **Substantive content stays in the personal gbrain destination**, per this skill's own
   `gbrain_destination: personal` frontmatter — only structural metadata (page title, creation
   date, template used) is referenced from core. Writing feedback or rating content to a shared or
   core destination is a scope violation, not a convenience.
3. **Never invent a quote, rating, or feedback line that wasn't actually supplied.** An unfilled
   template placeholder is a safer output than a fabricated one — it's visibly incomplete instead
   of silently wrong.
4. **Exclude any teammate's PII beyond name and role in a shared work context.** Health status,
   family situation, and personal-life details have no place on a performance page regardless of
   how they surfaced in a linked doc or meeting note.
5. **Do not compute or assert an overall rating tier** (exceeds/meets/below, or any org-specific
   scale) unless the user or a config-defined rubric explicitly supplies the mapping — assembling
   the page is not the same act as deciding the rating.
6. **Every impact claim on the page cites a dated, concrete example.** The evidentiary bar here is
   at least as strict as for any personnel document; an unlabeled impression does not belong in a
   record that may affect compensation or standing.
7. **Draft status until the named reviewer/manager explicitly approves.** A performance page is
   higher-stakes than a generic report and needs at least as strict a hold-for-review gate.

### Thresholds

| Signal | Threshold | Basis |
|---|---|---|
| Content destination | 100% of substantive content in `gbrain_destination: personal`; 0% in core | Sensitive performance content in a shared destination is a data-handling defect |
| Evidence per impact claim | ≥1 dated, concrete example | An unlabeled impression carries no more weight than a guess |
| Rating assignment | 100% derived from an explicit rubric/config mapping; 0% inferred by the skill | Assigning a rating with no rubric is a personnel decision this skill has no authority to make |
| PII fields | 0 unrelated personal identifiers (health, family, protected-class status) | The page describes work behavior only |

### Named anti-patterns

| Anti-pattern | Why wrong | What instead |
|---|---|---|
| Writing substantive content to the core/shared gbrain | Performance content is more sensitive than a normal report and leaks broadly | Route it to `gbrain_destination: personal`; keep only structural metadata in core |
| Assigning a rating tier with no rubric | The skill silently makes a personnel decision it has no authority to make | Only apply a rating explicitly derived from user input or a config rubric |
| Inventing a supportive quote to fill a template section | Fabricated evidence in a document that can affect compensation or standing | Leave the section as an explicit placeholder pending real input |
| Including a teammate's unrelated personal detail | Irrelevant PII in a sensitive artifact, disclosed without cause | Strip to role plus work-relevant behavior only |

### Worked example

- *Weak:* "Filled in the performance page — looks like a great quarter, gave them 'Exceeds'
  overall."
- *Sharp:* "Assembled `templates/notion/performance.json`: Goals (from the linked planning doc, 3
  items), Impact (2 dated examples supplied by the user — Mar 14 launch, Apr 2 incident response),
  Growth (left as an explicit placeholder, no input given yet). Did not assign an overall rating —
  no rubric mapping was provided in config or by the user, so that field stays blank pending the
  manager's own judgment. Written to the personal gbrain destination per frontmatter; only the page
  title and creation date are referenced from core. Status: Draft, pending manager review."

### What this skill must not do

- Does not decide or finalize a performance rating — assembles the page only, per this skill's own
  stated out-of-scope line.
- Does not render a judgment of the subject's overall worth or character.
- Does not include another person's PII.
- Does not publish without the named reviewer's explicit approval.
""",
    "incident/retro": """
## Domain rules — retro

### Absolute rules

1. **Examine the system and process that allowed the incident, not who made a mistake.** "Human
   error" is the starting point for asking why the error was possible, not the concluding finding
   ([Blameless PostMortems and a Just Culture](https://www.adaptivecapacitylabs.com/blog/2019/07/09/blameless-postmortems-and-a-just-culture/);
   [Google SRE Book — Postmortem Culture](https://sre.google/sre-book/postmortem-culture/)).
2. **State multiple contributing factors, not a single root cause.** Real incidents typically pass
   through several weakened defenses at once, not one clean cause-and-effect chain — the Swiss
   cheese model of accident causation describes exactly this alignment of holes across layers
   ([Swiss cheese model](https://en.wikipedia.org/wiki/Swiss_cheese_model)). A retro naming one root
   cause usually stopped asking "why" too early.
3. **No individual is named as the cause of the incident.** If a specific action belongs in the
   timeline, describe the action and the system conditions that made it likely or possible — never
   a judgment of the person who took it.
4. **Every action item has a named owner and a due date.** An action item with either missing is
   not tracked — it's a wish that will not get revisited.
5. **Every timeline entry carries an explicit timezone or UTC.** A cross-team incident read later
   by people in different zones with bare local times will reconstruct the wrong sequence of
   events.
6. **Detection time, mitigation time, and resolution time are three separate timestamps.**
   Collapsing them into one "resolved at" hides how much of the total duration was detection lag
   versus actual fix time — information the next incident needs.
7. **The retro itself gets a review/close-out date.** An action item with no revisit date silently
   becomes permanent scope creep that never actually gets marked done.

### Thresholds

| Signal | Threshold | Basis |
|---|---|---|
| Contributing factors named | ≥2 before the retro is considered closed | A single named cause usually means the analysis stopped one "why" too early |
| Action item completeness | Owner + due date on 100% of action items | Either missing means the item is untracked, not just informal |
| Timeline timezone | 100% of timestamps carry UTC or an explicit offset | Bare local time misorders a cross-timezone timeline for later readers |
| Timestamp granularity | Detection, mitigation, and resolution logged as 3 distinct times | Collapsing them hides whether the gap was detection lag or fix time |
| Retro follow-up | 1 explicit review/close-out date, pulled from the org's configured review window rather than invented | An open item with no revisit date never actually closes |

### Named anti-patterns

| Anti-pattern | Why wrong | What instead |
|---|---|---|
| Naming a person as the cause | Turns a systems investigation into blame, which suppresses future honest reporting | Describe the action and the system conditions that made it possible, not the person |
| Stopping at "human error" | Treats the starting point of the investigation as its conclusion | Keep asking why the error was possible until a system-level factor is named |
| Single root cause | Real incidents usually align several weakened defenses at once, per the Swiss cheese model | Name every contributing factor found, not just the first or most obvious one |
| Action item with no owner or date | Effectively a wish list; nothing tracks it to completion | Require both an owner and a due date before an item counts as logged |
| Bare local timestamps | Misorders the sequence of events for anyone in a different timezone reading it later | Log every timestamp in UTC or with an explicit offset |

### Worked example

- *Weak:* "The on-call engineer pushed a bad config and caused the outage. They should be more
  careful next time. Action: be more careful."
- *Sharp:* "Contributing factors (not a single root cause): (1) the config-validation step in the
  deploy pipeline does not check the field that caused the outage — `deploy.yml` has no schema
  check on `retry_backoff_ms`; (2) the staging environment does not mirror production's connection
  pool size, so the same config passed staging cleanly. Timeline (UTC): 2026-07-20 14:02 config
  deployed; detected 14:09 via error-rate alert; mitigated 14:22 via rollback; resolved 15:10 after
  root config fix verified in staging with matched pool size. Action items: add schema validation
  for `retry_backoff_ms` to the deploy pipeline (owner: platform-eng, due 2026-08-03); align staging
  pool size with production (owner: infra, due 2026-08-10). Review date: 2026-08-15."

### What this skill must not do

- Does not decide or change the incident's severity classification retroactively — reports what
  was declared and when.
- Does not perform personnel evaluation of the on-call responder — any performance-relevant
  observation routes to `jstack:notion-performance` or an EM conversation, never blended into the
  blameless doc.
- Does not post the retro publicly or externally — this is an internal artifact; external comms
  route through `jstack:announcement-review`.
""",
    "design/visual-single-page-html": """
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
""",
}
