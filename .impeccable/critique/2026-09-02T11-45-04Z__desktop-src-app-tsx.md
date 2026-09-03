---
target: jstack desktop app
total_score: 27
max_score: 40
na_heuristics: 
p0_count: 1
p1_count: 2
timestamp: 2026-09-02T11-45-04Z
slug: desktop-src-app-tsx
---
Method: dual-agent (A: general-purpose design review · B: general-purpose detector/browser evidence)

## Design Health Score

| # | Heuristic | Score | Key Issue |
|---|-----------|-------|-----------|
| 1 | Visibility of System Status | 3 | No explicit "daemon disconnected" banner — a crashed daemon renders identically to a quiet one |
| 2 | Match System / Real World | 4 | Genuinely coder-native vocabulary throughout (thinking level, cron, tool-call cards) |
| 3 | User Control and Freedom | 3 | Session close/reopen is flexible, but no undo on the destructive path |
| 4 | Consistency and Standards | 3 | Agent-picker dropdown duplicated verbatim across the two nav layouts; close-session UX differs between them |
| 5 | Error Prevention | 2 | Cron field validates only non-emptiness; malformed input fails silently, later, elsewhere |
| 6 | Recognition Rather Than Recall | 3 | Live status dots reduce recall load; cron syntax has no in-context reference |
| 7 | Flexibility and Efficiency | 2 | No bulk actions, no agent-config duplication, no composer slash-commands |
| 8 | Aesthetic and Minimalist Design | 3 | Restrained palette, but composer's 5-control row and flat type scale add noise |
| 9 | Error Recovery | 2 | Errors are scattered raw strings with no next-step guidance |
| 10 | Help and Documentation | 2 | Info tab is a shortcuts list only — no explanation of modes, cron, or MCP inheritance |
| **Total** | | **27/40** | **Acceptable** |

## Design Specificity Verdict

**LLM assessment:** This is authored for jstack specifically, not a re-skinned template — the terminal-boot Splash screen, the tray-pulse logic reasoned around a real macOS API gap, the Diagnostics tab's claude-on-PATH/jstack.config.json checks, and the Schedule tab's explicit "this part is CLI-only, not from this app" admission are all details a generic product wouldn't contain. But specificity is uneven: the composer (ai-elements/*) is largely unmodified Vercel AI Elements boilerplate, complete with image-preview and multimodal-attachment affordances that overpromise — the backend converts every attachment to inert text (attachmentsToText), so the paperclip/image UI implies a capability the daemon doesn't have.

**Deterministic scan:** One CLI finding (side-tab, index.css:159, a bordered left-accent on Markdown code blocks) and one runtime-only finding neither assessment could get any other way: the live DOM measures six distinct font sizes packed into a 1.8:1 ratio (flat-type-hierarchy). That's the detector independently confirming, with numbers, what the design review flagged qualitatively — section headers across the Settings dialog all read at identical visual weight regardless of consequence.

## Overall Impression

The bones are good and the identity is real — this doesn't feel like a template. But it's an "Acceptable" (27/40) build because the power-user surface (schedules, cron, tool permissions, MCP inheritance) is under-scaffolded relative to how much control it hands out: nothing stops you from typing a broken cron expression, nothing confirms before you close a session or delete a schedule, and the one screen most likely to need explaining (Settings, 9 tabs deep) is the one with the least in-app help. The single biggest opportunity is closing the gap between "this app trusts you with real power" and "this app tells you what that power does before you use it."

## What's Working

1. **lib/sessionStatus.ts's status model** — the red/yellow/green/white state machine is turn-count-based rather than timestamp-based specifically to dodge clock-skew bugs, reasoned through in its own comment. Real rigor behind what looks like a decorative dot.
2. **The tray-icon pulse** (App.tsx) — a two-frame flipbook working around macOS having no animated tray-icon API, torn down cleanly, correctly prioritizing "something's thinking" above every other state.
3. **Splash.tsx** — a bespoke terminal-boot loading screen ("connecting to agent daemon…") instead of a generic spinner. Both assessments independently flagged this as the strongest single moment in the app.

## Priority Issues

**[P0] Zero-agent onboarding gives no orientation before demanding configuration**
- Why it matters: Onboarding.tsx is the very first screen after install for a first-timer, and it opens straight into a 6-field agent-creation form (name, avatar, persona, model, tools, MCP) with zero sentence explaining what any of it means.
- Fix: One line of orientation copy above the form, and collapse persona/MCP/tools behind a "Show advanced options" toggle so the default view is just Name + Model + Create.
- Suggested command: /impeccable onboard

**[P1] Destructive actions (close session, delete schedule) have no confirmation or undo**
- Why it matters: handleCloseSessionById and handleDeleteSchedule both fire immediately from an easy-to-misclick dropdown item or bare X icon. Session close triggers a real, effectively-permanent daemon-side state change.
- Fix: A brief inline "Undo" toast (5s) after close/delete, consistent with the reassurance the "Learned:" retro summary already gives on close.
- Suggested command: /impeccable harden

**[P1] The Schedule tab's cron field has no validation, preview, or in-context help**
- Why it matters: handleCreateSchedule validates only non-emptiness. A malformed cron string submits successfully and only fails later via "Last ran ... failed," disconnected in time and place from the actual mistake.
- Fix: Client-side cron syntax validation with inline error text, plus a human-readable preview ("runs daily at 9:00 AM") next to the field.
- Suggested command: /impeccable clarify

**[P2] Flat typographic hierarchy — confirmed by both review and runtime measurement**
- Why it matters: Section headers across Settings all use identical text-sm font-semibold styling regardless of stakes (a destructive scheduling action reads exactly as quiet as a read-only display panel). The detector independently measured this: six font sizes compressed into a 1.8:1 ratio on the live page — a scale too narrow to do real hierarchy work.
- Fix: Widen the type scale (e.g., a clearer step between section headers, field labels, and body/caption text) and let heading weight vary with consequence, not just section.
- Suggested command: /impeccable typeset

**[P2] Settings' 9 flat, equal-weight tabs conceptually overlap**
- Why it matters: Advanced, Diagnostics, and Debug are all plausible answers to "why isn't my agent responding" with no signal for which one to check first.
- Fix: Either fold Debug's log tail into Diagnostics as a collapsible section, or add a visual grouping (subheading or divider) splitting Configure / Automate / Troubleshoot / Reference.
- Suggested command: /impeccable layout

## Persona Red Flags

**Alex (Power User):** No bulk operations anywhere — can't multi-close sessions, can't duplicate an agent's config as a starting point, no shortcut to jump to a specific tab or session besides typing into Cmd+K. Slack proactive checks are visible but explicitly read-only in-app ("managed via jstackc crew agents edit, not from this app"), forcing a context-switch to the CLI for a feature the GUI shows but can't act on.

**Sam (Accessibility-Dependent):** The Brain (thinking-level) and Shield (mode) composer icons convey their meaning only through hover title text — invisible to keyboard-only flows. The Debug tab uses color alone (red/yellow background) for error/warning severity with no icon or text marker. Collapsed-rail session status is color-only with no text alternative beyond an on-focus title.

**Riley (Stress-Tester):** switchToSession has no request-cancellation or ordering guard around its getSessionHistory await — rapid session-switching could plausibly land an out-of-order response in the wrong view. Combined with the no-confirm destructive actions above, this is exactly the profile that triggers accidental data loss through fast clicking.

## Minor Observations

- IntegrationCard.tsx hardcodes Slack-specific copy ("The Slack MCP is available to claude") inside what's meant to be a generic reusable card — a second integration would show the wrong text without editing the component internals.
- The composer's action row (attach, mic, thinking-level, mode, send — 5 controls) has no sub-grouping to signal which controls are attachments vs. turn settings.
- MODELS mixes friendly names (claude-sonnet-5) with a raw model ID (claude-haiku-4-5-20251001) directly in the picker UI.
- The side-tab detector finding on Markdown code blocks (index.css:159) is deliberate per its own code comment, but still visually resembles the generic "AI-slop" left-accent pattern the detector exists to catch — worth a second look even though it's justified.
- No distinction between "zero agents configured" and "daemon unreachable" — both currently render as the same onboarding screen.

## Questions to Consider

- If the composer's attach/image affordances promise multimodal input the daemon can't honor, is that an intentional placeholder for future capability, or should it be trimmed to match what actually works today?
- At what point does a 9-tab Settings dialog stop being "everything in one place" and start being a sign that Settings needs its own multi-pane window?
