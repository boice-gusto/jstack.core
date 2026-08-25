# TODOs

Deferred work identified during review, not yet scheduled. Each entry has enough context for
someone picking it up later to understand the motivation and where to start.

## Content-consistency check for skill/agent prose

**What:** A CI check that catches drift between `agents/*.md`'s "Configuration read order"
sections and `docs/agents-config-matrix.md`'s per-agent namespace column, and between a
skill's frontmatter `description` and its own body's mission statement.

**Why:** This session's skill/agent quality pass fixed ~39 content issues (wrong descriptions,
stale mission statements, config-matrix rows naming namespaces an agent doesn't actually read).
None of these have automated regression protection: `scripts/agents-check.ts` and
`scripts/skills-depth-check.ts` verify frontmatter presence and link validity, not prose
accuracy. A future hand-edit could silently revert any of these fixes — e.g. `product-pm.md`'s
config namespaces back to the wrong `pe.*`/`impact.*`, or `engineering/silo-scan/SKILL.md`'s
description back to "detect overlapping work" — and every existing CI gate would still pass.

**Pros:** Closes a real, demonstrated bug class (this exact drift already happened once,
undetected, until a review caught it). Cheap to check mechanically for the matrix-namespace
case specifically (string containment: does every namespace token in an agent's matrix row
appear somewhere in that agent's own file).

**Cons:** A general "is this English sentence still accurate" checker isn't mechanically
checkable — only the structured piece (matrix namespace tokens vs. agent file content) is.
Scope needs to stay narrow (that one bug class) rather than growing into an open-ended prose
linter, or the cost/value ratio flips.

**Context:** Surfaced during a `/plan-eng-review` retrospective review of
`fix/simplification-audit-round1` (2026-08-25). See commits `5e71b17` (product-pm matrix
contradiction), `29a9b32` (silo-scan body/description mismatch) for the exact bug class this
would catch.

**Depends on / blocked by:** None. Standalone script, could live alongside
`scripts/agents-check.ts`.

## Dashboard rate limiting bounds memory, not request cost or concurrency

**What:** The per-identity rate limiter (`dashboard/src/lib/rate-limit.ts`) keys on
`x-forwarded-for` (see `auth-request.ts`'s `getRateLimitIdentity`), a header any client can set
to an arbitrary value per request. Rotating it gets a fresh, fully-allowed bucket every time.
This session added a hard cap on the bucket Map's size, which bounds worst-case memory during a
flood — but an attacker rotating identities still gets unlimited *requests* against
`/api/agent/stream`, an endpoint that spawns a real, billed `claude` process per call.

**Why:** Memory exhaustion and unbounded expensive-request volume are two different failure
modes; this session's fix (and its own test) only proves the first is closed. The second is
arguably the more consequential one for a dashboard that spawns real agent processes.

**Pros:** Closes the actual cost/abuse vector, not just the memory symptom. A global
concurrency cap on the agent-spawn endpoint specifically (independent of per-identity limits)
is a comparatively narrow, well-understood fix.

**Cons:** The "right" per-identity fix requires a real design decision — what counts as a
trusted proxy identity in this deployment's actual reverse-proxy setup (if any), since
blindly trusting `x-forwarded-for` from a client that can set it directly is the root cause.
That's not a 15-minute patch.

**Context:** Surfaced by the Codex outside-voice pass during `/plan-eng-review` on
`fix/simplification-audit-round1` (2026-08-25): "rate limiting is still bypassable... caps
memory, not request cost." See `dashboard/src/lib/auth-request.ts:31`,
`dashboard/src/lib/rate-limit.ts`, `dashboard/src/app/api/agent/stream/route.ts`.

**Depends on / blocked by:** Knowing whether this dashboard actually sits behind a trusted
reverse proxy in its real deployment (determines whether a trusted-identity fix is even
possible) — worth answering before starting the design.

## SSE agent-stream requests keep the spawned process running after client disconnect

**What:** `dashboard/src/app/api/agent/stream/route.ts`'s `ReadableStream` never checks
`request.signal` or registers an abort/cancel handler. Only `killTimer` (the existing
10-minute timeout) ever kills the spawned `claude` process — a client that disconnects
mid-stream doesn't stop it.

**Why:** Every abandoned request burns the full spawned-process lifetime (and its real API
cost) regardless of whether anyone is still waiting on the result.

**Pros:** Real cost savings if the dashboard sees meaningful disconnect-before-completion
traffic (tab closed, navigation away, network drop).

**Cons:** Touches the same `'error'`/`'close'` handler logic this session already hardened
once this session (`2a8c221`) — needs care to avoid re-introducing the double-close/double-
telemetry issue that fix specifically guarded against.

**Context:** Surfaced by the Codex outside-voice pass during `/plan-eng-review` on
`fix/simplification-audit-round1` (2026-08-25). Pre-existing; not part of this session's diff
to this file (which only touched the `'error'` handler, not signal/cancel handling). See
`dashboard/src/app/api/agent/stream/route.ts:130`.

**Depends on / blocked by:** None.

## Setup lock has a TOCTOU race and can be stolen from an active wizard

**What:** `cli/src/lib/setup-lock.ts`'s `acquireSetupLock` uses `existsSync` then
`writeFileSync` — two concurrent `jstack setup` invocations can both observe no lock and both
proceed. The 30-minute stale-lock expiry can also steal an active (just slow) wizard's lock,
and either owner can then unconditionally delete the other's lock file on release.

**Why:** The lock exists specifically to prevent concurrent setup runs from corrupting
`jstack.config.json`; a TOCTOU race defeats that purpose under real concurrent invocation.

**Pros:** A real fix (exclusive file creation via the `wx` flag, plus an ownership token
checked before delete-on-release) is a well-understood, contained pattern.

**Cons:** None significant — this is a correctness fix with no real tradeoff, just needs
someone to sit down and do it.

**Context:** Surfaced by the Codex outside-voice pass during `/plan-eng-review` on
`fix/simplification-audit-round1` (2026-08-25). Completely pre-existing — zero commits touched
`setup-lock.ts` this session; flagged per "see something, say something," not part of this
review's actual scope. See `cli/src/lib/setup-lock.ts:62`.

**Depends on / blocked by:** None.

## Workflow artifact verification is fabricated-green-prone

**What:** `cli/src/lib/workflow-engine.ts`'s `hasWorkflowArtifacts` just checks whether
`artifacts/workflows/<id>/` is non-empty. Nothing clears or run-scopes that directory, so a
stale artifact from a *prior* run makes a *later* run falsely report success. Separately, the
spawned Claude process (`cli/src/lib/crew/slack.ts`) inherits the invocation's cwd while
verification checks against `projectRoot` — running `jstack workflow run` from a subdirectory
could write and check different locations entirely.

**Why:** This is exactly the "fabricated-green-report" failure mode this codebase's own docs
(`examples/workflows/*`) already warn about elsewhere — the artifact-existence check was added
specifically to avoid trusting the agent's own claim of success, but as written it can still be
fooled by leftover state from an earlier run.

**Pros:** A per-run-id-scoped artifact subdirectory plus an explicit, pinned child cwd closes
both halves of the gap with a contained, well-understood change.

**Cons:** None significant, just needs someone to do the (small) design work of picking a run-id
scheme.

**Context:** Surfaced by the Codex outside-voice pass during `/plan-eng-review` on
`fix/simplification-audit-round1` (2026-08-25). Pre-existing; neither file's specific logic
here was touched by this session's actual diffs to them. See
`cli/src/lib/workflow-engine.ts:163`, `cli/src/lib/crew/slack.ts:39`.

**Depends on / blocked by:** None.
