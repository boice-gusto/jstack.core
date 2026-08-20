# Per-skill data for the generator. Edit here, then re-run apply_detailed_skills.py.
from __future__ import annotations

# ---------------------------------------------------------------------------
# DESCRIPTIONS — replace the generic suffix; keep under ~200 chars for discovery
# ---------------------------------------------------------------------------
DESCRIPTIONS: dict[str, str] = {
    # --- jira ---
    "jira": "Route Jira requests to the right sub-skill (get, create, update, intake, transition, notify, append). Ask one question if ambiguous.",
    "jira/get": "Fetch Jira issues by key or JQL filter and return a structured table of status, assignee, priority, and links.",
    "jira/create": "Create a Jira issue from user input or intake payload, with dup-check and template pre-fill from config.",
    "jira/update": "Update fields or add comments on an existing Jira issue. Confirm before sensitive field changes.",
    "jira/intake": "Convert raw text or a jstack:intake payload into Jira-ready fields (summary, description, AC, labels).",
    "jira/transition": "Move a Jira issue between workflow states after validating the transition is legal and required fields are set.",
    "jira/notify": "Draft a Slack or email notification about a Jira event (status change, assignment, comment) for user approval.",
    "jira/append": "Append structured content (meeting notes, checklist, update block) to an existing Jira issue description or comment.",
    # --- notion ---
    "notion": "Route Notion requests to the right sub-skill (adr, article, sprint, report, etc.). Ask one question if ambiguous.",
    "notion/update": "Patch named properties on an existing Notion page. Return the view URL after update.",
    "notion/planning": "Create or update a roadmap / OKR planning page in Notion, linking to Jira epics when ids are available.",
    "notion/sprint": "Create or update a sprint page in Notion with goal, scope, and Jira sprint id when provided.",
    "notion/project": "Create or update a Notion project profile page: stakeholders, RAG status, and links to Jira/comms.",
    "notion/report": "Create a long-form report page or DB row in Notion. Set Status to Draft until user reviews.",
    "notion/adr": "Create or update an Architecture Decision Record in Notion with numbering, status, and superseded links.",
    "notion/article": "Create a Notion article (blog/eng journal) with title, audience tag, and Draft status until approved.",
    "notion/team-note": "Create a lightweight team note in Notion. Suggest ADR for binding decisions instead.",
    "notion/team-report": "Create or update a week-over-week team report page in Notion using templates/notion/team-report.json; hand off from jstack-team-report.",
    # --- meetings ---
    "meetings": "Route meeting requests to the right sub-skill (prepare, transcribe, action-items, post-slack, etc.).",
    "meetings/prepare": "Build a 1-page meeting prep brief from calendar context, Jira in-progress items, and blockers for attendees.",
    "meetings/transcribe": "Convert meeting audio/video to text via approved transcription patterns. Mark [inaudible] and redact PII for public summaries.",
    "meetings/granola-highlights": "Import Granola AI highlights and map bullets to Decisions, Open Questions, and Action Items.",
    "meetings/action-items": "Extract action items with owner + due date from meeting notes. Output a checklist for Jira intake.",
    "meetings/post-slack": "Draft a meeting summary for a Slack channel with tone from prompts/tones/. Do not post without user approval.",
    "meetings/notion-highlights": "Insert meeting highlights into a Notion DB with title, date, participants, and transcript link.",
    "meetings/store-note": "Route meeting notes to personal or team storage based on session gbrain target.",
    "meetings/store-note/team": "Save meeting notes to team gbrain or Notion per config. Follow team storage rules.",
    "meetings/store-note/personal": "Save meeting notes to personal gbrain. Never auto-post to team channels.",
    # --- research ---
    "research": "Route research requests to the right sub-skill (technical, competitive, user, spike, explain-codebase).",
    "research/technical": "Structured technical investigation: architecture options, tradeoff matrix, recommendation with migration/operability risks.",
    "research/competitive": "Competitive analysis with comparison table. Treat public info as potentially stale; never claim private competitor metrics.",
    "research/user": "Synthesize user interview themes with verbatim quotes (permission-aware). Distinguish frequent vs loud users.",
    "research/spike": "Time-boxed technical spike: hypothesis, method, go/no-go criteria up front. Report findings even if spike fails.",
    "research/explain-codebase": "Map a codebase top-down: entry file, packages, main flows, then one deep dive the user requested.",
    # --- reports ---
    "reports": "Route report requests to the right sub-skill (team, engineer, manager, project, eval).",
    "reports/team-report": "Generate a weekly team report: velocity, risks, dependencies, and 3 asks to leadership.",
    "reports/engineer-report": "Generate an individual engineer report: shipped, WIP, blockers, next. No invented metrics.",
    "reports/manager-report": "Generate a manager rollup across teams without stack-ranking individuals.",
    "reports/project-report": "Generate a stakeholder 1-pager: RAG status, milestones, risk register snapshot.",
    "reports/eval-report": "Generate a 9-grid evaluation report with growth framing. Sensitive — mark manager-only if needed.",
    # --- metrics ---
    "metrics": "Route metrics requests to my-metrics or team-metrics.",
    "metrics/my-metrics": "Personal throughput and review latency from GitHub/Jira. No peer comparison unless user is a people manager.",
    "metrics/team-metrics": "Team DORA-style signals with caveats for sample size. Separate unplanned work % when labels exist.",
    # --- self ---
    "self": "Route personal productivity requests to the right sub-skill (diary, lookback, focus, eval, remember, tasks, explain).",
    "self/diary": "Write a single journal entry to personal gbrain. Never auto-post to team channels.",
    "self/lookback": "Review last N days of personal gbrain + calendar and surface patterns. Gentle, not therapeutic.",
    "self/focus": "Synthesize 2-3 focus blocks from tasks + gbrain, one explicit non-goal, and a timebox suggestion.",
    "self/eval": "Self-assessment on a 9-grid with one growth goal for next 2 weeks. Not formal HR input unless user says so.",
    "self/remember": "Store a durable personal fact or decision in gbrain. Refuse or rotate if the user pastes a secret.",
    "self/tasks": "Roll up personal tasks from Jira + gbrain TODOs. Deduplicate and return top 5 with a parking lot.",
    "self/explain": "Short narrative of recent work for PR descriptions or standup, tying commits to user impact.",
    # --- session ---
    "session": "Route to session init or end.",
    "session/init": "Start a jstack session: set gbrain target (personal vs team), load sprint/timezone context, confirm integrations.",
    "session/end": "End the current session: summarize, flush carryover items, optionally run eval hooks.",
    # --- knowledge ---
    "knowledge": "Route knowledge requests to intake, process, search, self-knowledge, or team-knowledge.",
    "knowledge/intake": "Ingest raw text into a structured record (title, body, tags). Flag PII/secrets before storage.",
    "knowledge/search": "Answer questions using configured doc roots, URLs, and GitHub scope from jstack.config.json (knowledge_base) — not free-form web guesswork.",
    "knowledge/process": "Deduplicate, merge near-duplicates, and set canonical links across gbrain/Notion entries.",
    "knowledge/self-knowledge": "Link personal GitHub activity and gbrain entries. No scraping private repos without token scope.",
    "knowledge/team-knowledge": "Build the team knowledge graph: link issues, ADRs, runbooks. Suggest hubs and flag stale pages.",
    # --- review ---
    "review": "Route review requests to project-review, announcement-review, or counsel-review.",
    "review/project-review": "Review a project update for schedule, scope, risk, and stakeholder issues. Factual errors vs strategy issues.",
    "review/announcement-review": "Review an announcement for tone, accuracy, and channel fit. Flag legal/PR risks if external.",
    "review/counsel-review": "Multi-persona review (CEO/PM/eng/QA/design) with synthesis and tensions. Not vote-counting by title.",
    # --- routines ---
    "routines": "Route to the right routine sub-skill (standup, weekly-digest, sprint-close, health-check, custom, morning-kickoff).",
    "routines/standup": "Generate standup content: yesterday/today/blocked from Jira+Slack. 3 bullets max per person. Draft only.",
    "routines/weekly-digest": "Generate a weekly digest: exec summary + links. Separate customer-facing section if two audiences.",
    "routines/sprint-close": "Sprint close routine: velocity, spill, carry, retro hook. Do not fabricate demo links.",
    "routines/health-check": "Run jstack doctor + integration smoke test. Classify: P1 broken, P2 degraded. Output one Slack summary line.",
    "routines/custom": "Execute a custom routine from its config/schedules/<id>.json definition plus the routines block in config/defaults.json. If schedule JSON is invalid, return a fix, not a fake result.",
    # --- workflows ---
    "workflows": "Route workflow requests to builder, recorder, execute, or viewer.",
    "workflows/builder": "Build a BROWSER workflow definition as JSON at `config/workflows/<id>.json`: start URL and ordered steps drawn from the six kinds the schema allows (goto, click, fill, wait, screenshot, ai). No credentials in the file. Not for skill-chain, routine, or policy design — that is `jstack-workflow-builder` (singular), a different skill one letter away.",
    "workflows/recorder": "Record user browser actions into a workflow definition. Scrub captured secrets before saving and add stability notes for generated selectors before promoting to CI.",
    "workflows/viewer": "Summarize what a workflow run log contains: steps taken and artifacts produced. Never reconstruct a result for a run with no report.",
    # --- incident ---
    "incident": "Route incident requests to the main commander flow or retro sub-skill.",
    "incident/retro": "Facilitate a blameless retrospective: timeline, impact, what went well, improvements, actions with owners and dates.",
    # --- standalone ---
    "prioritize": "Rank a list using RICE, WSJF, value/effort, or a user-provided rubric. Show scores and cutline.",
    "adr": "Create or update a local markdown Architecture Decision Record (ADR) with typed context (engineering, design, team, codebase, org); discover existing adr folders; confirm path before write.",
    "intake": "Convert unstructured feature/ticket requests into shaped ticket fields. Split bundled requests into separate candidates.",
    "announcements": "Draft channel-ready or email-ready announcements from rough notes, respecting tone policies and internal/external distinction.",
    "engineering": "Summarize engineering health: CI status, PR queue, flaky tests, revert risk from configured repos.",
    "sdlc": "Map SDLC stages to evidence (tests, sign-offs, flags, migrations). Produce gate checklists, not Jira state changes.",
    "setup": "Repair an existing jstack setup: interpret a jstack doctor failure, fix a missing or broken jstack.config.json after onboarding was skipped, or re-run MCP server discovery. No secrets in chat. Not for a brand-new user's first-time walkthrough — use jstack:onboarding for that.",
    "update-config": "Edit jstack.config.json with validation against config/schema.json. Show diff and rollback one-liner. Not for first-time setup — use jstack:onboarding.",
    "project": "Cross-surface project status (Notion/Jira): RAG health, 3 risks, 3 asks, milestone table.",
    "team": "Team snapshot: roster, on-call, sprint goal, dependencies. No individual performance color.",
    "sprint": "Sprint-level orchestrator: planning and mid-sprint re-plan from capacity, goals, and Jira.",
    "sprint/planning": "Sprint planning: capacity, commit vs goal, spill from last sprint with root causes.",
    "sop": "Route SOP requests to expectations or resources sub-skill.",
    "sop/expectations": "Maintain role expectations docs: what success looks like, autonomy boundaries, escalation paths.",
    "sop/resources": "Maintain resources docs: on-call, tools, how to get unblocked, SLA references.",
}

# ---------------------------------------------------------------------------
# WHEN_TO_USE — optional Claude Code field (single line); paraphrases & indirect asks
# Combined with description for host listing; see markdown-authoring-guide.md
# ---------------------------------------------------------------------------
WHEN_TO_USE: dict[str, str] = {
    "jira": "Also when the user mentions tickets, issues, JQL, triage, filing bugs, sprint backlog, status transitions, or commenting on an issue.",
    "knowledge": "Also for wiki/runbook search, doc Q&A from repo URLs, gbrain or Notion knowledge, note ingestion, deduping entries, or team knowledge graph.",
    "session": "Also when starting or ending a jstack session, choosing personal vs team gbrain target, or wrapping up with a session summary.",
    "setup": "Also for a jstack doctor failure, a missing or corrupted jstack.config.json on a project that was previously working, or MCP integration health checks. Not for a new user's first-time onboarding conversation (jstack:onboarding) or editing an already-working config (jstack:update-config).",
    "update-config": "Not for a brand-new project with no config yet — that is jstack:onboarding's job.",
    "adr": "Also when the user mentions docs/decisions, RFC-lite, supersede ADR-NNN, or recording architecture or org decisions in git markdown.",
    "intake": "Also when shaping a feature idea, PRD snippet, messy notes, or Slack thread into ticket-ready fields (before Jira create).",
    "workflows": "Also for Playwright-style flows, browser automation JSON definitions under `config/workflows/`, recording steps, or running jstack workflow.",
}

# ---------------------------------------------------------------------------
# MISSIONS — the "What this skill is for" body (unique per skill/category)
# ---------------------------------------------------------------------------
MISSIONS: dict[str, str] = {
    'knowledge/intake': 'Turn raw pasted or captured text into one structured record — title, body, tags, source, and as-of time — flagging PII or secrets before anything is stored.\n- **Out of scope:** Judging whether the knowledge is correct, and merging it against existing entries — dedupe and merge belong to `jstack:knowledge-process`. Never persist without confirmation.',
    'knowledge/process': 'Reconcile a new record against what is already stored: find near-duplicates, then merge, supersede, or link — and ask before writing. The written output can also be a Notion knowledge-base entry directly, when that is the configured canonical store, rather than only a gbrain record.\n- **Out of scope:** Extracting the record from raw text (`jstack:knowledge-intake`) and answering questions from the store (`jstack:knowledge-search`). Never silently overwrite an existing entry.',
    'knowledge/skill-finder': 'Given a described need, name the skill that fits and say why the near-misses do not.\n- **Out of scope:** Doing the work of the skill it recommends, and inventing a skill that does not exist — if nothing fits, say so plainly.',
    'reports/report-design': "Choose the report's shape before its content: audience, sections, and which figures earn a place.\n- **Out of scope:** Producing the finished report (`jstack:reports`) and inventing figures to fill a section — an empty section is a finding, not a gap to paper over.",
    'reports/share-html-publish': 'Publish an already-reviewed HTML artifact and return the resulting link.\n- **Out of scope:** Authoring or editing the report content, and publishing anything the user has not seen. Never publish to a public or unfamiliar destination without explicit confirmation of the audience.',
    'scaffold': "Create the file skeleton for a new skill or plugin that satisfies this repo's conventions and passes its gates.\n- **Out of scope:** Writing the skill's domain content, and hand-editing a generated skill body — most bodies come from the generator, so a hand edit to a non-`SKIP` skill is lost on the next run.",
    'workflows/builder': 'Author a browser workflow definition — start URL and ordered steps — as JSON at `config/workflows/<id>.json`, so it can be executed unattended via `jstack:workflow-execute`. The schema has no assertion kind, so a check is a `wait` on a selector that only appears in the desired state.\n- **Out of scope:** Running the workflow (`jstack:workflows-execute`) and recording one from live interaction (`jstack:workflows-recorder`). Never place a credential in the definition file.',
    'workflows/recorder': 'Capture a live interaction as a replayable workflow definition, naming each step by role or label rather than a brittle selector.\n- **Out of scope:** Executing the recording, and hand-tuning it afterwards (`jstack:workflows-builder`). Never record against production data or capture a credential-entry step.',
    'workflows/viewer': 'Summarize what a recorded run actually did: the steps its log reports and the artifacts it produced.\n- **Out of scope:** Re-running the workflow or editing the definition. Never report an outcome that the run log does not contain, and never fill a gap in the log from the definition.',

    # --- jira ---
    "jira": "Route the user's Jira request to the most specific sub-skill. Do not execute Jira operations directly from the orchestrator — each op has its own guardrails.\n- **Out of scope:** Create/delete Jira projects, bulk org reassignment, or production writes without confirmation.",
    "jira/get": "Fetch one or more Jira issues by key or JQL and present a clean table. Read-only — no mutations.\n- **Out of scope:** Creating, updating, or transitioning issues (use the appropriate sibling skill).",
    "jira/create": "Create a new Jira issue from user input, an intake payload, or a template. Always dup-check first.\n- **Out of scope:** Bulk creation, project-level changes, or skipping required fields.",
    "jira/update": "Update fields or post comments on an existing issue. Confirm before changing sensitive fields (security level, customer).\n- **Out of scope:** Transitions (use `jira/transition`), creating new issues, or bulk edits.",
    "jira/intake": "Shape raw text into Jira-ready fields: summary, description with AC, issuetype, priority, labels. Does NOT create the issue.\n- **Out of scope:** Filing the issue — hand off to `jstack:jira-create` with the payload.",
    "jira/transition": "Move an issue between workflow states. Validate the transition is legal for the current state and all required fields are set BEFORE attempting.\n- **Out of scope:** Field updates beyond what the transition requires (use `jira/update`).",
    "jira/notify": "Draft a Slack or email message about a Jira event. **Draft only** — do not post without explicit user approval.\n- **Out of scope:** Actually posting to Slack (use `jstack:meetings-post-slack` if needed).",
    "jira/append": "Append structured blocks (notes, checklists, updates) to an existing issue's description or comments. De-dupe same-day blocks.\n- **Out of scope:** Replacing the entire description or creating new issues.",
    # --- notion ---
    "notion": "Route Notion requests to the most specific sub-skill. Do not write pages directly from the orchestrator.\n- **Out of scope:** Workspace membership, public sharing, or export settings.",
    "notion/adr": "Create or update an ADR page: sequential numbering, status tracking, superseded links. Rejected ADRs keep honest status.\n- **Out of scope:** Workspace-level permission changes.",
    "notion/article": "Create an article page (blog, eng journal) with audience tag and Draft status. Do not mark Published without user approval.\n- **Out of scope:** Multi-page content or CMS publishing pipelines.",
    "notion/report": "Create a long-form report page or database row in Notion from the user's content, setting Status to Draft until the user reviews it.\n- **Out of scope:** Marking the page Published without explicit user approval.",
    "notion/update": "Patch only the named properties on an existing Notion page and return the page's view URL after the update completes.\n- **Out of scope:** Creating new pages or restructuring content — this is a targeted property patch only.",
    "notion/performance": "Create or update a performance-cycle page in Notion — goals, impact, growth, feedback summary — from `templates/notion/performance.json`, keeping people-performance data in the personal gbrain, not core.\n- **Out of scope:** Deciding or finalizing a performance rating — this only assembles the page.",
    "notion/planning": "Create or update a roadmap or OKR planning page in Notion, linking to Jira epics when ids are available.\n- **Out of scope:** Creating the underlying Jira epics — link to existing ones only.",
    "notion/project": "Create or update a Notion project profile page covering stakeholders, RAG status, and links to Jira and comms threads.\n- **Out of scope:** Updating the underlying Jira board — this only maintains the Notion profile.",
    "notion/sprint": "Create or update a sprint page in Notion with goal, scope, and the Jira sprint id when it is provided.\n- **Out of scope:** Moving Jira issues between sprints — this only documents the plan.",
    "notion/standup": "Create or update a standup page or database row in Notion using the configured standup template and gallery page.\n- **Out of scope:** Posting the standup to Slack — use `jstack:meetings-post-slack` for that.",
    "notion/team-note": "Create a lightweight team note in Notion for information that does not need a formal decision record.\n- **Out of scope:** Binding decisions — suggest `jstack:notion-adr` instead.",
    "notion/team-report": "Create or update a week-over-week team report page in Notion from `templates/notion/team-report.json`.\n- **Out of scope:** Generating the underlying metrics — pull facts from `jstack:team-report` or user input, never invent numbers.",
    "notion/setup": "Build the Notion team HQ and private vault page tree from the typed template catalog, keeping team artifacts inside the team space and vault content workspace-private, then write the resulting page ids back into `jstack.config.json`.\n- **Out of scope:** Populating page content beyond the initial scaffold — that is each writer skill's job.",
    "notion/one-on-one": "Create or update a 1:1 page in Notion with date, topics, and action items from `templates/notion/one-on-one.json`, respecting private-manager visibility defaults.\n- **Out of scope:** Transcribing the meeting itself — use `jstack:meetings-one-on-one-transcript` first.",
    # --- meetings ---
    "meetings": "Route meeting requests to the most specific sub-skill: prepare, transcribe, action-items, post-slack, notion-highlights, or store-note.\n- **Out of scope:** Sending calendar invites or joining calls.",
    "meetings/prepare": "Build a 1-page prep brief: Jira in-progress/blocked for attendees + user-provided calendar context. Read-only output.\n- **Out of scope:** Posting, storing, or modifying external systems.",
    "meetings/action-items": "Extract action items from notes with owner + due. If owner is unclear, mark `TBD` with a suggested ping target.\n- **Out of scope:** Creating Jira tickets directly — hand off to `jstack:jira-intake`.",
    "meetings/post-slack": "Draft a meeting summary for a Slack channel using tone from `prompts/tones/`. Never post without explicit user approval.\n- **Out of scope:** Transcribing audio or extracting action items — those are separate upstream skills.",
    "meetings/transcribe": "Convert meeting audio or video into text using approved transcription patterns, marking `[inaudible]` segments and redacting PII before any public summary.\n- **Out of scope:** Extracting action items or highlights — hand off to the appropriate downstream skill.",
    "meetings/granola-highlights": "Import Granola AI highlights and map each bullet to Decisions, Open Questions, or Action Items.\n- **Out of scope:** Raw audio transcription — this consumes Granola's own output, not audio.",
    "meetings/notion-highlights": "Insert meeting highlights into a Notion database with title, date, participants, and a link to the transcript.\n- **Out of scope:** Generating the highlights themselves — this only records them in Notion.",
    "meetings/store-note": "Route a note-storage request to the personal or team child skill based on the session gbrain target.\n- **Out of scope:** Writing content directly — routes to `jstack:meetings-store-note-personal` or `jstack:meetings-store-note-team`.",
    "meetings/store-note/personal": "Save meeting notes to the personal gbrain only. Never auto-post personal notes to team channels.\n- **Out of scope:** Team-visible storage — use `jstack:meetings-store-team` for that.",
    "meetings/store-note/team": "Save meeting notes to the team gbrain or Notion per config, following the team's storage rules.\n- **Out of scope:** Personal-only notes — use `jstack:meetings-store-personal` for that.",
    "meetings/one-on-one-transcript": "Produce paired 1:1 prep notes and after-meeting notes from configured transcript sources, preferring Lattice MCP when enabled and falling back to Notion private PE or 1:1 parent pages; always append AI attribution.\n- **Out of scope:** Posting notes to team-visible spaces — 1:1 content stays private by default.",
    "meetings/transcripts-ingest": "Ingest new transcript files from Google Drive or a paste into the meetings pipeline, classify the source, and hand off to the matching highlights, transcribe, or action-items skill.\n- **Out of scope:** Performing the transcription, highlight extraction, or action-item extraction itself — this only hands the file to the right downstream skill.",
    # --- self ---
    "self": "Route personal productivity requests to the right sub-skill. Session gbrain target (personal vs team) must be respected.\n- **Out of scope:** Therapy, HR advice, or storing other people's PII without redaction.",
    "self/diary": "Write a single journal entry to personal gbrain. Never auto-post to team channels; never mix team data in.\n- **Out of scope:** Multi-day lookbacks (use `self/lookback`) or team-visible storage.",
    "self/brag": "Assemble a daily or weekly brag entry from Slack, GitHub, and Jira activity mapped to configured impact dimensions, weighting significance with tiered PR labels. Save to the personal gbrain by default.\n- **Out of scope:** Formal performance-review narratives — use `jstack:self-eval` or `jstack:self-report`.",
    "self/tasks": "Roll up personal tasks from Jira and gbrain TODOs into one deduplicated list, returning the top 5 with a parking lot for the rest.\n- **Out of scope:** Creating or updating Jira tickets — use the Jira skills for writes.",
    "self/eval": "Produce a self-assessment on a 9-grid with one concrete growth goal for the next two weeks. Treat it as personal reflection, not formal HR input, unless the user says otherwise.\n- **Out of scope:** Submitting or publishing the eval anywhere — it stays a draft for the user.",
    "self/remember": "Store a durable personal fact or decision in gbrain with full provenance attached. Refuse to store, and tell the user to rotate, anything that looks like a secret or credential.\n- **Out of scope:** Team-visible storage — this always writes to the personal gbrain target.",
    "self/explain": "Write a short narrative of recent work — commits, tickets, reviews — tying it to user impact for a PR description or standup update. Keep it factual; never invent work that did not happen.\n- **Out of scope:** Full accomplishment reports — use `jstack:self-brag` or `jstack:self-report`.",
    "self/focus": "Synthesize 2-3 focus blocks for the day or week from tasks and gbrain content, naming one explicit non-goal and a timebox suggestion.\n- **Out of scope:** Calendar writes — suggest blocks, do not create events.",
    "self/lookback": "Review the last N days of personal gbrain entries and calendar context to surface patterns worth noticing, in a gentle and observational tone, not a therapeutic one.\n- **Out of scope:** Diagnosing mental-health concerns — redirect to professional support if the content warrants it.",
    "self/impact-prep": "Prepare IC impact evidence — a quick Growth Check-in or a full Quarterly sweep — by gathering artifacts, asking gap-filling questions, and applying configured rubrics. Save to the personal gbrain by default.\n- **Out of scope:** Writing the final performance narrative — hand off to `jstack:self-eval` or `jstack:self-report`.",
    # --- session ---
    "session/init": "Start a session: set gbrain target, load sprint and timezone from `jstack time`, confirm integration health.\n- **Out of scope:** Silently ending a prior session — ask once if ambiguous.",
    "session/end": "End the current session: produce summary, flush carryover items, run eval hooks if configured.\n- **Out of scope:** Starting a new session in the same turn without asking.",
    # --- prioritize ---
    "prioritize": "Turn a list (from recon, user paste, or Jira filter) into a ranked order using RICE, WSJF, value/effort, or a custom rubric. Show a scored table with cutline.\n- **Out of scope:** Creating tickets or executing the top item — those require linked skills.",
    # --- adr (repo markdown; Notion ADRs use notion/adr) ---
    "adr": "Draft or revise a **local** `.md` ADR: classify kind (engineering, design, team, codebase, org), resolve `docs/adr/` or user path per `${CLAUDE_PLUGIN_ROOT}/skills/adr/references/discovery.md`, match numbering and cross-links to sibling files.\n- **Out of scope:** Notion database ADRs — use `jstack:notion-adr` (`skills/notion/adr`). Silent overwrite — confirm full path first.",
    # --- setup ---
    "setup": "Walk the user through first-time onboarding: `jstack setup` wizard, config creation, `jstack doctor` validation, dashboard pointers.\n- **Out of scope:** Writing secrets to markdown or logging tokens. If the user pastes a token, tell them to move it to an env/secret store and rotate.",
    # --- sdlc ---
    "sdlc": "Map SDLC stages to evidence the team produces. For each gate, list entrance/exit criteria. Do not waive a gate without a named risk-acceptance line.\n- **Out of scope:** Making Jira state changes or deploying code — produce checklists and narrative only.",
    # --- announcements ---
    "announcements": "Turn rough notes into channel-ready copy. Distinguish internal vs public; never leak unreleased product detail unless user confirmed external audience.\n- **Out of scope:** Actually posting — produce a draft for user approval.",
    # --- intake ---
    "intake": "Shape raw feature requests, bug reports, or tasks into structured ticket fields. Split bundled asks into separate candidates.\n- **Out of scope:** Creating tickets — hand off the payload to `jstack:jira-intake` or clipboard.",
    # --- project ---
    "project": "Cross-surface project health from Notion, Jira, and user-supplied updates. Output: RAG status, 3 risks, 3 asks, milestone table.\n- **Out of scope:** Updating Jira or Notion directly — produce a read-only snapshot.",
    # --- team ---
    "team": "Structural team snapshot: roster, on-call, sprint goal, cross-team dependencies. No individual performance commentary.\n- **Out of scope:** Performance reviews or stack-ranking people.",
    # --- engineering ---
    "engineering": "Summarize engineering health from configured repos: CI status, PR queue, flaky tests, revert risk.\n- **Out of scope:** Modifying repos, merging PRs, or fixing CI — surface issues for humans to act on.",
    "engineering/health": "Summarize engineering health — CI status, PR queue, flaky tests, and revert risk — using only the repos configured for this team.\n- **Out of scope:** Fixing CI, merging PRs, or modifying repos — surface issues for humans to act on.",
    "engineering/silo-scan": "Detect overlapping work — same files or similar tickets and PRs — starting from a Jira ticket or GitHub PR, flagging matches above a confidence threshold.\n- **Out of scope:** Posting comments on matched items without explicit user approval.",
    # --- sprint ---
    "sprint": "Route sprint requests to the right sub-skill (planning, mid-sprint re-plan). Provide capacity and goal context.\n- **Out of scope:** Moving Jira issues between sprints without user confirmation.",
    "sprint/planning": "Run sprint planning: assess capacity, compare commit against goal, and explain spill from the prior sprint with root causes.\n- **Out of scope:** Bulk-moving Jira issues into the sprint without user confirmation.",
    "sprint/prep": "Curate the pre-refinement queue against sprint goals: flag stale work, suggest new tickets for gaps, and draft a priority order.\n- **Out of scope:** Running the refinement ceremony itself — hand off to `jstack:sprint-refinement`.",
    "sprint/refinement": "Facilitate the refinement ceremony: walk five standard questions per ticket, show a capacity snapshot, and confirm each ticket against a sprint-ready checklist.\n- **Out of scope:** Bulk Jira writes — get explicit confirmation before updating multiple tickets.",
    # --- sop ---
    "sop": "Route SOP requests to the right sub-skill (expectations, resources). Maintain canonical links to Notion/Confluence.\n- **Out of scope:** Enforcing SOPs — surface tensions between policy and reality for the user to resolve.",
    "sop/expectations": "Maintain the role-expectations document: what success looks like, autonomy boundaries, and escalation paths.\n- **Out of scope:** Enforcing the expectations — surface gaps between policy and reality for the user to resolve.",
    "sop/resources": "Maintain the resources document: on-call rotation, tools, how to get unblocked, and SLA references.\n- **Out of scope:** Changing on-call schedules or tool access — this only documents them.",
    # --- update-config ---
    "update-config": "Edit `jstack.config.json` with schema validation, diff output, and a rollback one-liner.\n- **Out of scope:** Writing secrets into config — redirect to env/secret store.",
}

# ---------------------------------------------------------------------------
# CATEGORY_DEEP — domain detail block (one per category, shared by all skills in it)
# ---------------------------------------------------------------------------
CATEGORY_DEEP: dict[str, str] = {
    "jira": (
        "## Domain rules — Jira\n"
        "- All Jira work respects `jira_rules` in config and `templates/jira/*.json`. Project key, issue type, and transitions come from **config or user** — never from memory.\n"
        "- `get` is read-only. `create`, `update`, `append`, `transition`, `notify` are writes — confirm when the org requires approval, batch when possible, return Jira **key + URL** in every summary.\n"
        "- Dup-check before create: suggest search on `jstack-jira-get` if the summary matches a likely existing issue.\n"
        "- MCP / API errors: one-line user-facing message + whether it is retryable. Keep raw JSON out of chat."
    ),
    "notion": (
        "## Domain rules — Notion\n"
        "- Use `templates/notion/*.json` and property maps from team conventions. Never invent a `database_id` — require config or pasted URL.\n"
        "- ADR vs report vs team-note differ; pick the sub-skill that matches. Keep parent/child page relationships explicit.\n"
        "- Return **Notion page URL** in the summary for every create/update.\n"
        "- No workspace-wide member or public-web changes without a dedicated sub-step the user approves."
    ),
    "meetings": (
        "## Domain rules — meetings\n"
        "- Privacy: mark sensitive transcript segments; offer redacted summary for public channels.\n"
        "- Action items need **owner + due**; if owner unknown, `unassigned` + suggested ping.\n"
        "- Not a calendar authority — suggest invite text, do not send unless a tool explicitly does."
    ),
    "research": (
        "## Domain rules — research\n"
        "- Distinguish **findings** from **recommendation**. Cite sources; if web/tools unavailable, return assumptions + a to-verify list.\n"
        "- Time-box spikes: scope, limit, go/no-go criteria in the result header.\n"
        "- Not a substitute for legal/patent work — stop at questions for counsel."
    ),
    "reports": (
        "## Domain rules — reports\n"
        "- Fill `templates/reports/*` with data from config, tools, and user-supplied facts only — never invent velocity, incidents, or goals.\n"
        "- Match tone from `prompts/tones/` and audience from `prompts/personas/`.\n"
        "- For rollups, strip IC names when policy requires. Eval reports are sensitive — growth framing, not performance-review legal claims."
    ),
    "metrics": (
        "## Domain rules — metrics\n"
        "- Derive rollups from Jira/GitHub only; label gaps when data is partial.\n"
        "- DORA language is descriptive, not a percentile claim unless the user's pipeline computes them.\n"
        "- Never compare people in rank-and-yank tone; use neutral framing."
    ),
    "self": (
        "## Domain rules — self (personal)\n"
        "- Session target must match `session/init` — do not mix team pages into personal or vice versa.\n"
        "- Only the user's own PII; never suggest storing others' private data without redaction.\n"
        "- If the ask crosses into therapy/HR territory, give a kind refusal + redirect to professional support."
    ),
    "session": (
        "## Domain rules — session lifecycle\n"
        "- `init` sets gbrain target, issues or reads `session.current_session_id`, loads context; `end` flushes to GBrain with **provenance** per `gbrain.provenance` and `gbrain-entry-provenance.md`.\n"
        "- Config keys: `session.*`, `gbrain` URLs + `gbrain.provenance` (config_label, identity, entry_fields), eval hooks.\n"
        "- Not a login system — the host enforces auth; this manages jstack session state only."
    ),
    "knowledge": (
        "## Domain rules — knowledge\n"
        "- **Lookup vs store:** `jstack:knowledge-search` answers from configured sources (`knowledge_base` in config). Intake/process store into gbrain/Notion. See `skills/knowledge/references/gbrain-patterns.md`.\n"
        "- Intake raw notes → process (tag, dedupe, link) → route to gbrain/Notion per config.\n"
        "- No invented hierarchy: if a page id is missing, return markdown the user can paste.\n"
        "- Deduplication: merge duplicates; keep the oldest decision link as canonical."
    ),
    "review": (
        "## Domain rules — review\n"
        "- Multi-perspective pass using `prompts/personas/*`. Separate factual issues from tone issues.\n"
        "- Output: approve / revise / block with specific edits, not generic praise.\n"
        "- If the same content must ship in Notion, feed output to `jstack:notion-article` with edits applied."
    ),
    "routines": (
        "## Domain rules — routines\n"
        "- Scheduled skill chains from `config/schedules/` and the routines block in config. Use `jstack schedule` CLI.\n"
        "- Idempotent: a failed mid-way routine must be re-runnable; record what already completed.\n"
        "- Output is often a Slack block — keep under channel norms (length, @here rules)."
    ),
    "workflows": (
        "## Domain rules — browser workflows\n"
        "- Build, record, run, and view `jstack workflow` CRUD. Preview/diff before production mutate.\n"
        "- Secrets: `fill` values that are secrets name an env var; never write a credential into the JSON definition or print one in chat.\n"
        "- Same flow definition for CI and local — call out which base URL the user is targeting."
    ),
    "incident": (
        "## Domain rules — incident\n"
        "- Tight SEV-scoped loop: status, comms, mitigations, customer impact, timeline.\n"
        "- Draft comms only — never post externally from this skill. Use `jstack:announcement-review` for tone.\n"
        "- After stabilization, hand off to `incident/retro` for blameless follow-ups."
    ),
    "setup": (
        "## Domain rules — setup\n"
        "- **Team + personal:** `gbrain.team` and `gbrain.personal` are both in schema; `session.default_gbrain_target` picks default. If files/repos are missing, bootstrap from `config/defaults.json` and `config/personal.example.json` — see `${CLAUDE_PLUGIN_ROOT}/skills/_core/references/config-team-vs-personal.md`.\n"
        "- No secrets in chat. If the user pastes a token, tell them to move it to env/secret store and rotate.\n"
        "- Validate against `config/schema.json`. Follow `integration-guide.md` for MCP server discovery.\n"
        "- Do not start arbitrary servers without user opt-in."
    ),
    "sop": (
        "## Domain rules — SOPs\n"
        "- Single source of truth: link to canonical Notion/Confluence home.\n"
        "- SOP changes often need a stakeholder list; include rationale and comms snippet.\n"
        "- If SOP and reality differ, call out the tension and suggest an experiment, not fake compliance."
    ),
    "sprint": (
        "## Domain rules — sprint\n"
        "- Do not silently drop committed work: show spill reasons (dependency, new critical work, scope).\n"
        "- If historical velocity data is missing, use T-shirt estimates with a conversion note."
    ),
    "prioritize": (
        "## Domain rules — prioritization\n"
        "- Show one table of scores or rationale per item; label subjective columns as `[judgment]`.\n"
        "- Tie-break: use explicit rules (revenue, risk reduction, date); if still tied, ask one question.\n"
        "- Expect `action_items:` payloads from recon; output is stack rank + first cutline."
    ),
    "intake": (
        "## Domain rules — intake\n"
        "- Shape raw feature requests, bug reports, or task descriptions into structured fields.\n"
        "- Split bundled requests: one candidate per distinct ask; label splits so the user can recombine.\n"
        "- If the text is too vague for a ticket, return a short form (summary, AC, type, priority) the user can fill in one pass.\n"
        "- Never create tickets directly — output is a payload for `jstack:jira-intake` or clipboard."
    ),
    "project": (
        "## Domain rules — project status\n"
        "- Cross-surface: pull from Notion project page, Jira board, and user-supplied updates.\n"
        "- RAG health: Red = blocked / at risk, Amber = dependency or scope risk, Green = on track. Label the signal source.\n"
        "- 3 risks + 3 asks to leadership (or \"none\" if clean). Milestone table with dates and status per row.\n"
        "- If Jira board is not linked, accept user paste or config epic keys."
    ),
    "team": (
        "## Domain rules — team snapshot\n"
        "- Roster from config + on-call from integrations if available. Sprint goal from Jira or user paste.\n"
        "- Dependencies: list cross-team blockers with owner and status.\n"
        "- No individual performance color — this is a structural snapshot, not a stack-rank.\n"
        "- If team members are missing from config, list what is known and note the gap."
    ),
    "engineering": (
        "## Domain rules — engineering health\n"
        "- CI status: green/red/flaky per repo from configured GitHub/CI integration.\n"
        "- PR queue: count open, stale (>3 days), blocked. Link to oldest stale PR.\n"
        "- Flaky tests: list top offenders if data available; otherwise note gap.\n"
        "- Revert risk: recent merges to main with failing checks or missing reviews.\n"
        "- All data from config repos only — never scan unrelated repos."
    ),
    "announcements": (
        "## Domain rules — announcements\n"
        "- Distinguish **internal** (Slack, email to team) vs **external** (blog, customer email). Never leak unreleased product details in external copy.\n"
        "- Apply tone from `prompts/tones/` and match channel norms (length, emoji, @here rules).\n"
        "- Draft only — never post without explicit user approval.\n"
        "- If the content touches legal, compliance, or pricing, flag for stakeholder review before send."
    ),
    "sdlc": (
        "## Domain rules — SDLC / release readiness\n"
        "- Map stages (dev → test → stage → prod) to evidence: test results, sign-offs, feature flags, migration plans.\n"
        "- For each gate, list entrance/exit criteria. Do not waive a gate without a named risk-acceptance line.\n"
        "- Every prod deploy discussion should have a revert or kill-switch sentence.\n"
        "- Produce checklists and narrative — not Jira state changes (use linked skills for that)."
    ),
    "update-config": (
        "## Domain rules — config editing\n"
        "- Validate edits against `config/schema.json` when schema is available.\n"
        "- **Team + personal:** editing `jstack.config.json` usually affects **shared** keys; personal GBrain and identity belong in `jstack.personal.json` (see `config/personal.example.json` and `${CLAUDE_PLUGIN_ROOT}/skills/_core/references/config-team-vs-personal.md`).\n"
        "- Show diff: what changed, why, and a rollback one-liner.\n"
        "- Never write secrets into config — if the user tries, redirect to env/secret store."
    ),
}

# ---------------------------------------------------------------------------
# CHAINS_TO — specific chain targets per skill path
# ---------------------------------------------------------------------------
CHAINS_TO: dict[str, str] = {
    "adr": "jstack:notion-adr",
    "jira/intake": "jstack:jira-create",
    "jira/create": "jstack:jira-notify",
    "jira/transition": "jstack:jira-notify",
    "meetings/action-items": "jstack:jira-intake",
    "meetings/granola-highlights": "jstack:meetings-action-items",
    "meetings/transcribe": "jstack:meetings-action-items",
    "session/init": "jstack:recon",
    "session/end": "jstack:init-session",
    "knowledge/intake": "jstack:knowledge-process",
    "intake": "jstack:jira-intake",
    "routines/standup": "jstack:meetings-post-slack",
    "routines/sprint-close": "jstack:notion-sprint",
}

# ---------------------------------------------------------------------------
# CHAIN_EXAMPLES — category-appropriate "A then B" pair for the generic
# Chaining section. Only categories with a genuinely sensible in-category (or
# obviously adjacent) two-step flow get an entry; everything else omits the
# parenthetical example rather than showing an irrelevant Jira pair.
# ---------------------------------------------------------------------------
CHAIN_EXAMPLES: dict[str, tuple[str, str]] = {
    "jira": ("jstack-jira-intake", "jstack-jira-create"),
    "meetings": ("jstack-meetings-granola", "jstack-meetings-action-items"),
    "knowledge": ("jstack-knowledge-intake", "jstack-knowledge-process"),
    "session": ("jstack-init-session", "jstack-end-session"),
    "notion": ("jstack-notion-planning", "jstack-notion-sprint"),
    "reports": ("jstack-team-report", "jstack-share-html-publish"),
    "sprint": ("jstack-sprint-prep", "jstack-sprint-planning"),
    "routines": ("jstack-standup", "jstack-meetings-post-slack"),
    "workflows": ("jstack-workflows-builder", "jstack-workflow-execute"),
}


def chaining_example(category: str) -> str:
    """Backtick-quoted "`A` then `B`" pair for this category's Chaining section, or "" if none fits."""
    pair = CHAIN_EXAMPLES.get(category)
    if not pair:
        return ""
    a, b = pair
    return f"`{a}` then `{b}`"


# ---------------------------------------------------------------------------
# FAILURE_EXTRAS — additional failure table rows per category or path
# ---------------------------------------------------------------------------
FAILURE_EXTRAS: dict[str, str] = {
    "jira": "| Jira API rate limit / 429 | Back off; suggest narrowing JQL or retrying in 60s. |\n| Issue not found (404) | Confirm key and project; suggest `jstack-jira-get` with filter. |\n| Required field missing for transition | Collect the field before retrying the transition. |",
    "notion": "| Database not found | Confirm `database_id` in config or ask for a pasted Notion URL. |\n| Property type mismatch | Show expected vs actual type; suggest manual Notion fix or config update. |",
    "meetings": "| No transcript / empty paste | Ask user to provide notes or audio file path. |\n| PII in public summary | Redact and flag before posting; offer redacted vs full versions. |",
    "research": "| Web search unavailable | Return assumptions as `[unverified]` with a to-verify checklist. |\n| Codebase too large to map | Top-down overview first, then offer targeted deep dives. |",
    "reports": "| Missing data for a metric | Leave cell blank with `[no data]`; do not invent numbers. |\n| Tone mismatch | Offer 2 tone options from `prompts/tones/` in one question. |",
    "self": "| Emotional crisis language | Be brief, kind; suggest professional support. Do not role-play therapy. |\n| User pastes a secret | Refuse to store; tell them to rotate immediately. |",
    "session": "| Prior session still open | Ask once whether to end it or continue. Do not silently close. |",
    "knowledge": "| Duplicate entry detected | Show the existing canonical and ask: merge, update, or skip. |",
    "routines": "| Schedule JSON invalid | Return the validation error and a minimal valid example. |\n| Routine failed mid-way | Report which steps succeeded and which failed; suggest re-run. |",
    "workflows": "| Browser driver not available | Document requirements; do not block on GUI if headless was requested. |\n| Step fails or a `wait` selector never appears | Abort at that step, name it, and suggest the selector fix — do not continue and report the later steps as passing. |\n| Runner is the stub (`runWorkflowStub`) | It returns `ok: true` with no artifact by design. Report `unverified` and say a real driver is not wired; never present it as a pass. |\n| Definition rejected by `WorkflowDefinitionSchema` | Name the offending field — usually a `kind` outside the six allowed values, or an invented `assertions` block — and fix the definition, not the schema. |",
    "incident": "| Impact unverified | Do not announce resolved; state current known status only. |",
    "setup": "| User pastes token in chat | Tell them to move to env/secret store and rotate. Never log it. |",
    "metrics": "| GitHub/Jira not linked | Return import instructions and a manual table template. |",
    "prioritize": "| Scores are entirely subjective | Label all columns `[judgment]`; surface the rubric used. |",
    "adr": "| Multiple adr folders found | List candidates; user picks one or supplies explicit path. |\n| User wants Notion properties too | After save, suggest `jstack:notion-adr`; do not conflate flows. |\n| Unclear supersede chain | Read sibling ADRs; ask which ADR id this replaces before updating headers. |",
    "review": "| No artifact to review | Ask for doc link, paste, or file path. Do not improvise a review. |",
    "intake": "| Bundled request too large | Split into first candidate + remainder; confirm split with user. |\n| Ambiguous priority/type | Return a 2-option form; do not guess. |",
    "project": "| Jira board not linked | Accept epic keys or user paste; note the data gap in output. |\n| Stale Notion page | Show last-updated date; suggest refresh before sharing externally. |",
    "team": "| Team roster incomplete in config | List known members; note gap and suggest config update. |\n| On-call integration missing | Omit on-call section; note it as unavailable. |",
    "engineering": "| CI integration not configured | List repos from config; point to `integration-guide.md` for setup. |\n| No PR data available | Return manual checklist template instead of empty table. |",
    "announcements": "| Audience unclear (internal vs external) | Ask one question before drafting. |\n| Legal/compliance content detected | Flag for stakeholder review; do not finalize. |",
    "sdlc": "| Policy file missing in `prompts/policies/` | Use sensible defaults; list assumptions explicitly. |\n| Gate evidence incomplete | List what is missing per gate; do not auto-approve. |",
    "update-config": "| Schema validation failed | Show the error and the valid shape; do not write invalid config. |\n| User tries to add secrets | Refuse; redirect to env/secret store. |",
    "sop": "| No canonical SOP link in config | Ask for the Notion/Confluence URL before proceeding. |\n| SOP contradicts observed practice | Surface the tension explicitly; suggest an experiment. |",
    "sprint": "| No velocity data available | Use T-shirt estimates with a conversion note; do not invent points. |\n| Sprint scope exceeds capacity | Show the gap and suggest which items to defer. |",
}


# ---------------------------------------------------------------------------
# path_extras — path-specific Step 3 content (the unique procedural detail)
# ---------------------------------------------------------------------------
def _jira(op: str) -> str:
    b = {
        "get": (
            "Fetch by **key** or **JQL**. For JQL, echo the exact filter and cap the result count "
            "with a \"narrow further\" line if over limit.\n"
            "- Expand only fields the user needs (reduces token load); add subtasks if asked.\n"
            "- Output: key table with status, assignee, priority, updated, link."
        ),
        "create": (
            "Map **issue type** and **components** to `jira_rules`; pre-fill description from "
            "`templates/jira/*.json` when the template key matches.\n"
            "- **Dup check:** if summary matches a likely existing issue, list 1-2 candidate keys "
            "and ask **one** disambiguation before create.\n"
            "- Output: return key, id, URL. For epics, note epic name in the summary line.\n"
            "- Field/screen metadata and CRUD conventions (resolve required fields and options from "
            "`createmeta`, never from memory): "
            "!cat ${CLAUDE_PLUGIN_ROOT}/skills/jira/references/field-metadata.md\n"
            "!cat ${CLAUDE_PLUGIN_ROOT}/skills/jira/references/jira-crud-patterns.md"
        ),
        "update": (
            "Support field-level changes. For sensitive fields (security level, customer), confirm once "
            "if policy requires.\n"
            "- **Comments:** respect internal vs public visibility per project settings. State assumption if unknown.\n"
            "- Output: summarize what changed in plain English for the user to paste to Slack."
        ),
        "intake": (
            "Convert raw text or `jstack:intake` output to Jira-ready fields: summary, description with AC "
            "as checklist markdown, issuetype, priority, labels from policy.\n"
            "- If required fields are missing, return a **form** the user can answer in one pass.\n"
            "- Do NOT create the issue. End with `suggested_next: jstack-jira-create` and the payload."
        ),
        "transition": (
            "Resolve the transition id from API metadata — never hardcode. Validate the transition is "
            "legal for the current state.\n"
            "- **Guards:** if a field is required for the transition, collect it before attempting.\n"
            "- Output: from-status → to-status with timestamp; link to view issue.\n"
            "- Transition-metadata and CRUD conventions (map user intent to a real transition id from "
            "the API response, not from memory): "
            "!cat ${CLAUDE_PLUGIN_ROOT}/skills/jira/references/field-metadata.md\n"
            "!cat ${CLAUDE_PLUGIN_ROOT}/skills/jira/references/jira-crud-patterns.md"
        ),
        "notify": (
            "Build Slack (or email) text from the issue: summary, why it matters, link. Match @channel "
            "rules from team policy.\n"
            "- **Draft only** unless the user explicitly approves posting.\n"
            "- For bulk, batch into one post or thread per the user's request."
        ),
        "append": (
            "Append to description or comment with structured blocks (h2, checklist). Avoid clobbering "
            "existing formatting.\n"
            "- **Idempotent:** if appending a signature block (e.g. meeting notes), de-dupe the same day's "
            "block if already present.\n"
            "- Output: diff summary of what was added."
        ),
    }
    return b.get(op, "")


def _notion(seg: str) -> str:
    b = {
        "update": "Patch only named properties. Fetch current revision first if concurrent edits are a risk.\n- Return the view URL after update.",
        "planning": "Roadmap/OKR page shape. Align quarters to fiscal vs calendar as config says.\n- Link to Jira epics when ids exist in text.",
        "sprint": "Sprint page with embedded goal. Mirror Jira sprint name/id when provided.\n- If mismatch between Notion and Jira sprint, list the discrepancy.",
        "project": "Project profile: stakeholders, RAG, links to Jira board and comms.\n- One canonical source-of-truth link per system.",
        "report": "Long-form report or DB row. Set Status to Draft until user reviews.\n- For exports to PDF/HTML, that is out of scope — suggest manual export.",
        "adr": "ADR numbering + Superseded links. If decision is rejected, keep status honest and point to the winning ADR.\n- Template: `templates/notion` + best-practices for ADR text.",
        "article": "Article (blog/eng journal): title, summary, audience (internal|external) at top.\n- Do not mark Published without user go-ahead.",
        "team-note": "Light note on team space. Not a substitute for a decision doc — suggest ADR for binding choices.",
    }
    return b.get(seg, "")


def _meetings(tail: str) -> str:
    b = {
        "prepare": "Pull Jira in-progress and blockers for named attendees. Calendar is user-provided or paste.\n- Output: 1-pager to bring to the room.",
        "transcribe": "AV → text via org-approved provider patterns. Mark `[inaudible]` and add timestamps if asked.\n- **PII/HR:** redact in public summary even if present in transcript.",
        "granola-highlights": "Ingest Granola import format. Map bullets to Decisions, Open Questions, Action Items.\n- Suggest Notion or Slack as next destination.",
        "action-items": "Extract with owner + due. If owner unclear, `TBD` + proposed owner from context.\n- End with `suggested_next: jstack-jira-intake` for each, or a single table for batch.",
        "post-slack": "Draft with tone from `prompts/tones/`. For @here, use only if user said important-level.\n- Thread vs channel per team habit — ask if ambiguous.",
        "notion-highlights": "DB insert with meeting title, date, participants. Link to raw transcript if stored elsewhere (with permission).",
        "store-note": "Pick personal vs team child skill based on session gbrain target.\n- If team requires both gbrain and Notion, follow store-note/team rules.",
        "store-note/team": "Save to team gbrain or Notion per config. Follow `gbrain-patterns.md` for team storage rules.",
        "store-note/personal": "Save to personal gbrain only. Never auto-post to team channels.",
    }
    return b.get(tail, "")


def _research(seg: str) -> str:
    b = {
        "technical": "Architecture options, tradeoff matrix, recommendation.\n- Include migration and operability risks, not just API surface.",
        "competitive": "Comparison table. Treat public info as potentially stale.\n- Never claim private competitor metrics without a source line.",
        "user": "Interview synthesis: themes, verbatim quotes with permission context.\n- Distinguish frequent vs loud users.",
        "explain-codebase": "Entry file → map packages → main flows. For large repos, top-down first then one deep dive the user asked for.\n- Mermaid or bullet architecture is fine if user asked for a diagram.",
        "spike": "Hypothesis, time box, method, go/no-go in the first screenful.\n- If spike fails, say stop and report what was learned (still value).",
    }
    return b.get(seg, "")


def _reports(seg: str) -> str:
    b = {
        "team-report": "Velocity narrative with caveats. Risks, dependencies, and 3 asks to leadership if applicable.",
        "engineer-report": "Individual weekly: shipped, WIP, blockers, next. No invented metrics. Tone: peer+manager safe.",
        "manager-report": "Rollup across people without stack-ranking. Focus on system issues (CI, on-call, hiring).",
        "project-report": "Stakeholder 1-pager: RAG, milestones, risk register snapshot.",
        "eval-report": "Sensitive: growth framing. Avoid comparing to other individuals by name. Mark manager-only if not peer-shareable.\n- Grid axes and placement guidance: !cat ${CLAUDE_PLUGIN_ROOT}/skills/_core/references/9-grid-framework.md",
    }
    return b.get(seg, "")


def _self(seg: str) -> str:
    b = {
        "diary": "One session journal entry. gbrain personal target only unless user overrides.\n- No auto-post to team channels.\n- Structure the entry situation → emotion → learning → next experiment: !cat ${CLAUDE_PLUGIN_ROOT}/skills/_core/references/reflection-patterns.md",
        "lookback": "Last N days of personal gbrain + calendar. Surface patterns in one short section.\n- Gentle tone; not therapy.\n- Structure around wins, misses, surprises, one habit to change: !cat ${CLAUDE_PLUGIN_ROOT}/skills/_core/references/reflection-patterns.md",
        "focus": "From tasks + gbrain: 2-3 focus blocks, one explicit non-goal, and a timebox suggestion.\n- Structure around top 3 outcomes, blockers, first next step tomorrow: !cat ${CLAUDE_PLUGIN_ROOT}/skills/_core/references/reflection-patterns.md",
        "eval": "Self assessment only. Suggest one growth goal for next 2 weeks.\n- Do not use as formal HR input unless user says so.\n- Grid axes and placement guidance: !cat ${CLAUDE_PLUGIN_ROOT}/skills/_core/references/9-grid-framework.md",
        "remember": "Durable fact storage in gbrain. Attach provenance: `jstack_session_id`, `gbrain_target`, `config_label`, `slack_handle` if resolved, `source_skill: jstack-self-remember`, `written_at`. See `gbrain-entry-provenance.md`.\n- Rotate or refuse if the user pastes a secret.",
        "tasks": "Roll-up of Jira + gbrain TODOs. Deduplicate. If overload, return top 5 and a parking lot.",
        "explain": "Short narrative of recent work for PR description or standup. Tie commits/tickets to user impact.",
    }
    return b.get(seg, "")


def _knowledge(seg: str) -> str:
    b = {
        "intake": "Raw text → title + body + tags. Flag PII/secret before storage.\n- gbrain target: team vs personal from session; see `gbrain-patterns.md`.",
        "process": "Dedupe, merge near-duplicates, set canonical link.\n- If Notion + gbrain, pick one canonical per topic (user can override).",
        "search": "Read `knowledge_base` in config: roots, doc_urls, github.repos, retrieval prompts. Cite paths/URLs; optional GBrain when `gbrain.include`.\n- If empty, wizard or `jstack:update-config`.",
        "self-knowledge": "Personal GitHub and gbrain linking: repos starred, own PR themes.\n- No scraping private repos without token scope.",
        "team-knowledge": "Team graph: link issues, ADRs, runbooks. Suggest hubs and flag stale pages.",
    }
    return b.get(seg, "")


def _session(seg: str) -> str:
    b = {
        "init": "Set gbrain target. Set or read `session.current_session_id` (opaque). Load team context. Echo sprint and timezone from `jstack time` if available.\n- Do not end prior session silently — ask once if ambiguous.",
        "end": "Summary, carryover, links. When writing to GBrain, include envelope: session id, gbrain_target, config_label, slack_handle/ids if resolved, `source_skill: jstack-end-session`, `written_at`. See `gbrain-entry-provenance.md`.\n- Optional metrics from eval hooks. Clear ready for next init.",
    }
    return b.get(seg, "")


def _routines(seg: str) -> str:
    b = {
        "standup": "Yesterday/today/blocked from Jira+Slack per config. 3 bullets max per person if multi-person.\n- Post only in draft for user approval.",
        "weekly-digest": "Exec summary + links. Separate customer-facing section if two audiences.",
        "sprint-close": "Velocity, spill, carry, retro hook. If demo links missing, do not fabricate.",
        "health-check": "`jstack doctor` + integration smoke. P1: broken integration. P2: degraded.\n- Output one Slack summary line + detail thread.",
        "custom": "Read `config/routines` + config routines block. If schedule JSON invalid, return fix, not fake result.",
    }
    return b.get(seg, "")


def _workflows(seg: str) -> str:
    b = {
        "builder": (
            "Write a JSON definition to `config/workflows/<id>.json` matching `WorkflowDefinitionSchema` "
            "(`cli/src/types/workflow.ts`): `id`, `name`, `start_url`, `steps[]`, where each step is "
            "`{id, kind, selector?, value?, url?, notes?}`.\n"
            "- `kind` is one of `goto`, `click`, `fill`, `wait`, `screenshot`, `ai`. There is **no assertion "
            "kind** — express a check as a `wait` on a selector that only exists in the desired state, plus a "
            "`screenshot` for evidence.\n"
            "- No credentials in the file: a `fill` whose value is a secret names an env var, never a literal."
        ),
        "recorder": "Record user actions → definition. Scrub captured secrets before saving, add stability notes for generated-looking selectors, and mark the result unvalidated — a recording proves the steps happened once, not that they replay.",
        "viewer": "Summarize what the run log actually contains, step by step. If no report file exists for the run, say so and stop — do not reconstruct a plausible result from the definition.",
        "execute": "Load the saved `config/workflows/<id>.json`, print the step list as a preview, get explicit confirmation, then run it. The shipped executor is `runWorkflowStub` — it produces no artifact, so report `unverified` and name the missing driver instead of claiming the browser ran.",
    }
    return b.get(seg, "")


def _review(seg: str) -> str:
    b = {
        "project-review": "Schedule, scope, risk, stakeholders checklists. Separate factual errors from strategy issues.",
        "announcement-review": "Tone + accuracy + channel fit. Flag legal/PR risks if external.",
        "counsel-review": "Multi-persona (CEO/PM/eng/QA/design) with synthesis and tensions. Not vote-counting by title.",
    }
    return b.get(seg, "")


def _sop(seg: str) -> str:
    b = {
        "expectations": "Role expectations doc: what success looks like, autonomy boundaries, escalation. Pair with resources.",
        "resources": "On-call, tools, how to get unblocked. All links from config. SLA only if the org published one — else `[TBD]`.",
    }
    return b.get(seg, "")


def _metrics(seg: str) -> str:
    b = {
        "my-metrics": "Personal throughput and review latency. If GitHub not linked, return import instructions and a manual table template.\n- No peer comparison unless user is a people manager.",
        "team-metrics": "Team DORA-style table with caveats for sample size.\n- Separate unplanned work % if Jira has labels — else omit.",
    }
    return b.get(seg, "")


# Per-key intake addendum, appended to the standard "## Intake" block.
#
# Only design/authoring skills belong here. A skill that reads config and acts does not need an
# interview, and pasting one into all 137 skills would be exactly the uniformity problem this file
# otherwise avoids — the generic intake already covers "parse args, ask one question if blocked."
INTAKE_EXTRAS: dict[str, str] = {
    "workflows/builder": (
        "Before writing any definition, run the design interview:\n\n"
        "!cat ${CLAUDE_PLUGIN_ROOT}/skills/_core/references/workflow-design-interview.md\n\n"
        "For a browser definition specifically, the questions config cannot answer are: what starts "
        "the flow, what observable on-page state means it succeeded (that state becomes a `wait` "
        "selector, since the schema has no assertion kind), which fills read from env, and what this "
        "flow must explicitly not touch. Post the understanding lock before drafting, not after."
    ),
}


def path_extras(key: str) -> str:
    if not key:
        return ""
    parts = key.split("/")
    d0 = parts[0]
    d1 = parts[1] if len(parts) > 1 else None
    tail = "/".join(parts[1:]) if len(parts) > 1 else None

    dispatch = {
        "jira": _jira,
        "notion": _notion,
        "meetings": _meetings,
        "research": _research,
        "reports": _reports,
        "self": _self,
        "knowledge": _knowledge,
        "session": _session,
        "routines": _routines,
        "workflows": _workflows,
        "review": _review,
        "sop": _sop,
        "metrics": _metrics,
    }

    if d0 in dispatch and tail:
        return dispatch[d0](tail)

    # standalone specials
    if key == "incident/retro":
        return (
            "Timeline, impact, what went well, what to improve, actions with owners and dates.\n"
            "- No individual blame — name systems and gaps.\n"
            "- If customer comms needed, use `jstack:announcement-review` after draft is ready."
        )
    if key == "sprint/planning":
        return (
            "Capacity (holidays, on-call) + commit vs goal. Show spill from last sprint with root causes.\n"
            "- Jira: suggest sprint scope as list of issue keys, not a silent bulk edit.\n"
            "- `suggested_next:` `jstack:reports` or Notion sprint page update when user uses both."
        )
    if key == "update-config":
        return (
            "Edits to `jstack.config.json` (and, if the user asks, `jstack.personal.json` path): validate against `config/schema.json` when possible.\n"
            "- If the user is only setting `gbrain.personal` or personal `provenance`, prefer the personal file so the team repo stays shareable.\n"
            "- Diff-style output: what changed, why, and rollback one-liner."
        )
    if key == "intake":
        return (
            "Parse the raw text into candidate ticket fields: summary, description (with AC as checklist), "
            "issue type, priority, labels.\n"
            "- If the text contains multiple distinct asks, split into separate candidates and label each.\n"
            "- If required fields are too vague, return a short form the user can complete in one pass.\n"
            "- End with `suggested_next: jstack-jira-intake` and the shaped payload."
        )
    if key == "project":
        return (
            "Pull data from Notion project page and Jira board (or accept user paste if integrations are missing).\n"
            "- Build: RAG status line, milestone table (name, date, status), 3 risks with owner, 3 asks to leadership.\n"
            "- If Jira is unavailable, accept epic keys or a pasted sprint view.\n"
            "- Output is read-only — do not update Notion or Jira from this skill."
        )
    if key == "team":
        return (
            "Build a structural snapshot from config roster, on-call integration (if available), and Jira sprint goal.\n"
            "- Dependencies: list cross-team blockers with owner and current status.\n"
            "- If roster is incomplete, list what is known and note the gap.\n"
            "- No performance commentary — this is a factual structure view."
        )
    if key == "engineering":
        return (
            "Query configured repos for CI status (green/red/flaky), open PR count, stale PRs (>3 days), "
            "and recent merges with failing checks.\n"
            "- Flaky tests: list top offenders if data available; otherwise note the gap.\n"
            "- Revert risk: flag recent main merges missing reviews or with post-merge failures.\n"
            "- All data from config repos only — never scan unrelated repos."
        )
    if key == "announcements":
        return (
            "Classify audience (internal vs external) — ask once if unclear.\n"
            "- Apply tone from `prompts/tones/` and match channel norms (length, formatting, @here rules).\n"
            "- If content touches legal, compliance, or pricing, flag for stakeholder review.\n"
            "- Output a draft for user approval; never post directly."
        )
    if key == "prioritize":
        return (
            "Apply the configured rubric (RICE, WSJF, value/effort) or a user-provided one to each item.\n"
            "- Show one scored table with all items ranked. Label subjective columns as `[judgment]`.\n"
            "- Draw a cutline: items above = recommended scope, items below = parking lot.\n"
            "- If two items tie, use explicit tie-break rules (revenue, risk, date); if still tied, ask one question."
        )
    if key == "adr":
        return (
            "Classify ADR kind; read `${CLAUDE_PLUGIN_ROOT}/skills/adr/references/adr-types.md` for prompts.\n"
            "- Resolve output folder per `${CLAUDE_PLUGIN_ROOT}/skills/adr/references/discovery.md` (explicit path > scan > propose `docs/adr/`).\n"
            "- Fill `${CLAUDE_PLUGIN_ROOT}/skills/adr/references/template.md`; number filename `NNN-kebab-title.md` consistently with siblings.\n"
            "- Confirm full path before write; set Supersedes / Superseded by when replacing an ADR."
        )
    if key == "setup":
        return (
            "If `jstack.config.json` is missing, create it from `config/defaults.json` (or a template) after user confirm; if team wants a new git repo for shared config, outline `git init` + first commit of **team-only** keys.\n"
            "For personal: if `jstack.personal.json` (or the path the host uses) is missing, copy `config/personal.example.json` to `~/.config/jstack/jstack.personal.json` and set `gbrain.personal` + `gbrain.provenance.config_label`. See `${CLAUDE_PLUGIN_ROOT}/skills/_core/references/config-team-vs-personal.md`.\n"
            "Walk through `jstack setup` wizard steps: team name, GBrain team URL, integrations, GBrain personal URL in personal file.\n"
            "- Validate with `jstack doctor` after creation. Report integration health per service.\n"
            "- If the user pastes a token, tell them to move it to env/secret store and rotate.\n"
            "- Point to dashboard for visual confirmation if available."
        )
    if key == "sdlc":
        return (
            "For each stage gate (dev → test → stage → prod), list entrance and exit criteria based on "
            "`prompts/policies/` or team convention.\n"
            "- Map criteria to evidence the team produces: test results, sign-offs, feature flags, migration plans.\n"
            "- If a gate is missing evidence, list what is needed — do not auto-approve.\n"
            "- Include a revert / kill-switch sentence for any prod deploy discussion."
        )
    return ""


# ─────────────────────────────────────────────────────────────────────────────
# Step 2 ("plan the safe path") and Step 4 ("validate") used to emit one generic
# line each into every generated skill: "Prefer read-only first, then idempotent
# updates..." and "Correct surface, no stray side effects...". Those appeared in
# 122 and 107 skills respectively and changed nothing about behavior — they named
# no tool, path, or check. These dicts replace them with guidance specific to the
# domain. Lookup is key-first, then category, then DEFAULT (same as CATEGORY_DEEP).
# ─────────────────────────────────────────────────────────────────────────────

SAFE_PATH: dict[str, str] = {
    "DEFAULT": (
        "Read current state before changing it. Prefer the reversible action; when an action is "
        "irreversible, show what will change and get explicit confirmation first. If a required id "
        "or path is missing from config, stop and ask — never substitute a guess."
    ),
    "jira": (
        "Search before you create — a duplicate ticket is worse than a missing one. Read the issue's "
        "current status and its legal transitions before transitioning; do not assume a workflow. "
        "Never invent an issue key, field value, or transition id — fetch metadata or ask. For any bulk "
        "change, show the count, the field diff, and a sample of affected keys, then wait for confirmation."
    ),
    "notion": (
        "Resolve the parent page or database from `notion_defaults` — never guess an id. Read a page "
        "before overwriting its body. Create as a draft and let the user promote it; do not publish "
        "on their behalf. If the target is unset in config, say so instead of writing somewhere plausible."
    ),
    "announcements": (
        "Draft, get approval, then publish — in that order, always. Resolve the channel from "
        "`policies.announcements.channels`; if it is unset, ask rather than picking one. Never send to "
        "an external or unfamiliar destination without explicit confirmation of the audience."
    ),
    "review": (
        "Read the whole change before commenting on any part of it. Separate blocking findings from "
        "suggestions, and cite `file:line` for each. Do not approve based on a summary you did not verify. "
        "Rank by severity, not by reading order."
    ),
    "research": (
        "State which sources you searched and which you could not reach — silent partial coverage reads "
        "as completeness. Distinguish \"not found\" from \"does not exist\". Timestamp findings, because a "
        "stale answer presented as current is worse than no answer."
    ),
    "reports": (
        "Every figure traces to a named source with an as-of time. Mark a missing metric as `[no data]` — "
        "never interpolate it, and never drop the row silently, because omission in an authoritative-looking "
        "report misleads exactly as much as fabrication."
    ),
    "metrics": (
        "State the denominator and the time window before stating the number; a rate without either is "
        "unusable. Prefer percentiles to averages and say which you used. Note the data's freshness."
    ),
    "knowledge": (
        "Search for near-duplicates before writing anything new — unresolved duplicates make later retrieval "
        "untrustworthy. Carry source and as-of time on every entry. Ask before persisting, and honour the "
        "session's team-vs-personal target rather than defaulting to shared."
    ),
    "meetings": (
        "Confirm attribution before recording a decision as someone's — misattributing a commitment is the "
        "costly error here. Keep personal notes out of team stores. Distinguish what was decided from what "
        "was merely discussed."
    ),
    "incident": (
        "Stabilize before diagnosing. Record the timeline as you go, not afterwards from memory. Do not state "
        "a cause until it is established — in anything customer-facing, \"under investigation\" is correct and "
        "a guess is a liability."
    ),
    "sprint": (
        "Read the board's actual state before planning against it. When something spilled, diagnose which of "
        "scope growth, underestimation, or blockage caused it rather than re-committing the same item. Change "
        "the plan or the scope, not the record of what happened."
    ),
    "self": (
        "Personal target by default; write to a shared store only when the user asks explicitly. Never place "
        "another person's performance data or PII in a personal or team note."
    ),
    "session": (
        "Make init and end idempotent — re-running either must not duplicate state or double-write carryover. "
        "Read the existing session id before assigning one."
    ),
    "setup": (
        "Show the full proposed config and get confirmation before writing. Validate against the schema. Omit "
        "a key the user skipped rather than writing an empty string. Never write a credential to a config file."
    ),
    "update-config": (
        "Show a diff of the exact keys changing, and get confirmation before writing. Validate the result "
        "before saving. Never write a secret, and never silently widen a scope the user did not ask to widen."
    ),
    "routines": (
        "This runs unattended: never block on an interactive prompt. Every step must be idempotent, because a "
        "retry or an overlapping run will happen. Report a partial failure as a partial failure — a scheduled "
        "job that fails silently goes unnoticed for weeks."
    ),
    # Fallback for the router and execute — the surfaces that actually drive a browser. The
    # authoring/recording/reading surfaces get their own entries below: a single "preview before a
    # destructive action" rule applied to a skill that writes a JSON file checks nothing that skill
    # can get wrong.
    "workflows": (
        "Preview before any destructive UI action and require confirmation. Wait on observable state, never on "
        "a fixed delay. Capture an artifact (screenshot, trace, or log) as evidence; without one, do not claim "
        "the run passed — and the shipped runner is a stub that produces none, so `unverified` is the honest "
        "ceiling until a real driver is wired."
    ),
    "workflows/builder": (
        "Nothing executes here, so the safety question is what this file will do when someone else runs it "
        "unattended months from now. Every `click` and `fill` needs a preceding `wait` on its own selector — a "
        "step that races the page is the defect that only ever reproduces in CI. Secrets are env references, "
        "never literals, because this file gets committed."
    ),
    "workflows/recorder": (
        "A recording captures whatever was on screen: tokens, session cookies, customer names in test data. "
        "Scrub before saving, not at review time. Flag auto-generated selectors as brittle instead of promoting "
        "the recording straight to CI."
    ),
    "workflows/viewer": (
        "This surface only reads, so the risk is not a destructive action — it is inventing a result. If the run "
        "produced no report, say that, rather than describing what the definition would have done."
    ),
    "engineering": (
        "Name the mechanism, not the symptom, and cite the file or component that shows it. Prefer measuring to "
        "asserting. If you cannot name the alternative to what you are criticizing, say so plainly."
    ),
    "sdlc": (
        "Gates are not skippable silently. If one must be bypassed, produce a risk-acceptance line naming who "
        "approved it, what risk was accepted, and the mitigation. Confirm the revert path exists before release."
    ),
    "intake": (
        "Separate bundled asks into distinct candidates before shaping any of them. Name the user and the moment "
        "the need occurs. Do not invent acceptance criteria the requester did not imply — ask."
    ),
    "prioritize": (
        "State the ranking criteria before you rank, not after the order is chosen. Make the cutline explicit and "
        "say what falls below it. Do not present a ranking as objective when its inputs were estimates."
    ),
    "sop": (
        "Describe the process that is actually followed, not the aspirational one. Every step names an owner and an "
        "observable completion condition."
    ),
}

VALIDATION: dict[str, str] = {
    "DEFAULT": (
        "Before reporting done: confirm the change landed where intended, that nothing outside the stated scope "
        "was touched, and that every id, path, and figure you emitted came from config or the conversation rather "
        "than from inference. Name anything you could not verify."
    ),
    "jira": (
        "Re-read the issue after writing: the status, the fields you set, and the links you added are what you "
        "intended, and nothing else changed. Confirm you created exactly one ticket, not a duplicate."
    ),
    "notion": (
        "Re-fetch the page and confirm the target parent, the title, and the properties you set. Verify you did not "
        "overwrite pre-existing content, and that it is still a draft unless the user asked to publish."
    ),
    "announcements": (
        "Confirm the destination, the audience, and that approval was actually given before send — not assumed. "
        "Re-read the text for anything that should not leave the org."
    ),
    "review": (
        "Confirm every finding cites a real location and that severities are ordered. Confirm you did not present a "
        "preference as a defect. State explicitly what you did not review."
    ),
    "research": (
        "Confirm every claim has a source and an as-of time, and that coverage gaps are stated rather than implied. "
        "No source, no claim."
    ),
    "reports": (
        "Confirm every figure has a source and as-of time, that gaps read `[no data]`, and that the footer and scope "
        "match this report's kind. Re-run the render and confirm identical output from identical inputs."
    ),
    "metrics": (
        "Confirm each number carries its denominator, window, and freshness, and that no average is hiding a "
        "distribution you should have shown as percentiles."
    ),
    "knowledge": (
        "Confirm the entry is findable by the query a future reader would actually use, that provenance is attached, "
        "and that no duplicate was left unresolved. Confirm it went to the intended team-vs-personal target."
    ),
    "meetings": (
        "Confirm each decision has an owner, each action has a date, and attribution matches what was actually said. "
        "Confirm personal content did not land in a shared store."
    ),
    "incident": (
        "Confirm the timeline is ordered and sourced, that cause is labelled as established or under investigation, "
        "and that no customer-facing text asserts more than is known."
    ),
    "sprint": (
        "Confirm the numbers match the board rather than the narrative, and that carryover is explained rather than "
        "silently re-committed."
    ),
    "self": (
        "Confirm the write went to the personal target unless explicitly told otherwise, and that no other person's "
        "PII or performance data is present."
    ),
    "session": (
        "Confirm re-running would produce the same state — no duplicated session, no double-written carryover."
    ),
    "setup": (
        "Run `jstack doctor` and interpret the result for the user rather than pasting it. Confirm no secret was "
        "written and that skipped keys are absent rather than empty."
    ),
    "update-config": (
        "Re-read the config and confirm only the intended keys changed and the file still parses. Confirm no secret "
        "was written."
    ),
    "routines": (
        "Confirm the run completed without needing interactive input, that a re-run would be safe, and that any "
        "partial failure is reported as such with the failing step named."
    ),
    "workflows": (
        "Confirm an artifact exists for every claimed step outcome. Without one, downgrade the result to "
        "unverified rather than reporting a pass."
    ),
    "workflows/builder": (
        "Confirm the definition parses against `WorkflowDefinitionSchema`, that every `kind` is one of the six "
        "the schema accepts, that every `click`/`fill` is preceded by a `wait`, and that no value is a credential "
        "literal. Do not claim the flow works — nothing was run."
    ),
    "workflows/recorder": (
        "Confirm no secret survived into the saved definition and that every selector is either stable or "
        "explicitly flagged. State that the recording is unvalidated until it replays."
    ),
    "workflows/viewer": (
        "Confirm every statement traces to a line in the run log. What is not in the log is absent, not implied."
    ),
    "engineering": (
        "Confirm each finding names a mechanism and a location, and that any measurement you cite is reproducible."
    ),
    "sdlc": (
        "Confirm each gate is either satisfied with evidence or explicitly bypassed with a recorded risk acceptance."
    ),
    "intake": (
        "Confirm bundled asks were separated, that acceptance criteria are testable, and that nothing was invented "
        "on the requester's behalf."
    ),
    "prioritize": (
        "Confirm the criteria were stated before ranking, the cutline is explicit, and estimate-based inputs are "
        "labelled as estimates."
    ),
    "sop": (
        "Confirm every step has an owner and an observable completion condition, and that it describes current "
        "practice rather than intent."
    ),
}


def safe_path_for(key: str, category: str) -> str:
    """Step 2 guidance: key-specific, else category, else default."""
    return SAFE_PATH.get(key, SAFE_PATH.get(category, SAFE_PATH["DEFAULT"])).strip()


def validation_for(key: str, category: str) -> str:
    """Step 4 guidance: key-specific, else category, else default."""
    return VALIDATION.get(key, VALIDATION.get(category, VALIDATION["DEFAULT"])).strip()


# Per-skill deep domain content (thresholds, anti-patterns, worked examples) for
# high-judgment skills. Merged over CATEGORY_DEEP so a per-key entry wins over the
# category default, letting those skills stay generated instead of moving to SKIP.
try:
    from skill_deep import load_deep as _load_deep

    CATEGORY_DEEP.update(_load_deep())
except ImportError:  # pragma: no cover - skill_deep is optional
    pass


# ── Missions added to close the "no declared boundary" gap ────────────────────
#
# 53 skills rendered no `- **Out of scope:**` clause because `build_body()` falls back to the raw
# frontmatter `description` when neither a per-key nor a category MISSIONS entry exists. That gap has
# two costs: the skill never states what it will not do, and `scripts/generate-skill-evals.ts` cannot
# derive a per-skill boundary eval, so those skills fall back to a generic trivia case.
#
# ROUTERS get routing missions. LEAVES get leaf missions, deliberately per-key rather than by
# category: `build_body()` resolves `MISSIONS.get(key, MISSIONS.get(category, desc))`, so a bare
# category entry would make every unkeyed leaf under it describe itself as a router — the exact defect
# that had to be removed from ~32 leaf skills earlier. Every category that has a router mission today
# also has a per-key entry for each of its leaves, and that invariant is preserved here.
MISSIONS.update({
    # ── Routers ──
    "computer-use": "Route computer-use requests to the right surface: native macOS/desktop UI (`jstack:computer-use-cua`), web automation (`jstack:workflow-execute`, Playwright MCP), or a saved JSON workflow definition under `config/workflows/`. Pick one surface and say why.\n- **Out of scope:** Driving the machine yourself from this skill, and installing drivers or granting accessibility permissions — those are operator steps.",
    "incident": "Route an incident request to the right sub-skill (retro, find-sme, oncall-summary). Establish whether the incident is active or closed before routing — an active incident goes to on-call context, a closed one to retro.\n- **Out of scope:** Declaring or resolving an incident, paging anyone, and writing status-page updates.",
    "knowledge": "Route a knowledge request to the right sub-skill: capture (`intake`), reconcile (`process`), retrieve (`search`), or graph-building (`self-knowledge`, `team-knowledge`). Retrieval and capture are different skills — do not capture as a side effect of answering.\n- **Out of scope:** Writing entries directly from the orchestrator, and deciding team-vs-personal placement without the session gbrain target.",
    "metrics": "Route a metrics request to `my-metrics` (individual) or `team-metrics` (team roll-up). Both read from configured sources; neither invents a number.\n- **Out of scope:** Performance evaluation of a named person, and defining new org-wide metric definitions.",
    "reports": "Route a report request to the sub-skill for that audience and artifact (team, engineer, manager, project, eval, share-html-publish, report-design). Audience determines the shape, not the data.\n- **Out of scope:** Publishing or sharing the rendered artifact, and inventing figures for a section whose source is unavailable.",
    "research": "Route a research request to the right sub-skill: technical (tradeoff analysis), competitive (market), user (qualitative), explain-codebase (this repo), or spike (timeboxed feasibility). Deliverable shape differs per sub-skill.\n- **Out of scope:** Presenting an unverified claim as fact, and making the build-vs-buy decision — surface the tradeoffs for a human to decide.",
    "review": "Route a review request to the right lens: code-review (diff), project-review (schedule/scope/risk), announcement-review (comms), or counsel-review (multi-persona). One lens per request unless the user asks for reconciliation.\n- **Out of scope:** Approving or merging anything, and overriding a named human reviewer's verdict.",
    "routines": "Route to the right routine sub-skill (standup, weekly-digest, sprint-close, health-check, morning-kickoff, custom). Resolve the routine id against `config/defaults.json` `routines` and `config/schedules/<id>.json` before running; if the two disagree, say so.\n- **Out of scope:** Creating or editing a routine definition (`jstack:workflow-builder`), and firing integrations for a routine whose `enabled` is false.",
    "session": "Route a session-lifecycle request to `init` or `end`. Session state (gbrain target, session id) lives in `jstack.config.json` under `session` — read it rather than assuming.\n- **Out of scope:** Doing the work of the session itself, and changing the gbrain target silently mid-session.",
    "workflows": "Route a browser-workflow request to the right sub-skill (builder, recorder, viewer, execute). Authoring a definition and running one are separate sub-skills — do not run as a side effect of building.\n- **Out of scope:** Production mutations without an explicit preview-then-confirm, and storing credentials in a workflow definition — form fills read from env.",

    # ── Leaves: design ──
    "design/figma-handoff": "Turn a Figma design into an implementable handoff: named components and variants, token references, state coverage, and the accessibility contract each state must meet.\n- **Out of scope:** Writing the component code (`jstack:review-code-review` for the diff, frontend-specialist for implementation), and editing the Figma file itself.",
    "design/visual-single-page-html": "Produce a single self-contained HTML page — inline CSS, no build step, CDN scripts pinned with SRI — for a visual artifact a reader opens directly.\n- **Out of scope:** Multi-page apps, anything needing a bundler or server, and embedding real customer or employee data in the page.",

    # ── Leaves: research ──
    "research/technical": "Produce a technical tradeoff analysis: options as rows, decision criteria as columns, and an explicit recommendation with the condition that would reverse it.\n- **Out of scope:** Implementing the chosen option, and asserting a benchmark number you did not measure or cite.",
    "research/competitive": "Compare named alternatives on capabilities a user would actually choose between, separating verified facts from inference and labelling each.\n- **Out of scope:** Pricing negotiation advice, legal comparison, and presenting a competitor's roadmap claim as shipped fact.",
    "research/user": "Synthesize qualitative user input into themes with evidence counts, keeping participant quotes attributable to a source and never inventing one.\n- **Out of scope:** Recruiting or interviewing participants, and generalizing from a single session to a population claim.",
    "research/explain-codebase": "Explain how a codebase actually works — entry points, data flow, module boundaries, and the surprising parts — grounded in files you have read, with paths cited.\n- **Out of scope:** Changing the code, and describing intended architecture as though it were the current state.",
    "research/spike": "Run a timeboxed feasibility spike: state the question, the box, what was tried, and a go/no-go with the evidence that decided it.\n- **Out of scope:** Turning the spike code into production code, and exceeding the timebox silently — report an unfinished spike as unfinished.",

    # ── Leaves: reports ──
    "reports/team-report": "Assemble the team report from configured sources, labelling every figure measured, estimated, or assumed.\n- **Out of scope:** Publishing it (`jstack:reports-share-html-publish`), and filling a section whose data source is unavailable.",
    "reports/engineer-report": "Assemble an individual engineer report for a named period, from configured sources only, with per-figure provenance.\n- **Out of scope:** Performance ratings or promotion recommendations, and comparing engineers against each other.",
    "reports/manager-report": "Assemble a manager-facing roll-up: delivery, risk, and people-signal sections at the altitude a manager acts on.\n- **Out of scope:** Individual performance verdicts, and IC-identifying detail where the report redacts names by config.",
    "reports/project-report": "Assemble a project status report: scope, schedule, risk, and the decision the reader needs to make.\n- **Out of scope:** Re-planning the project, and stating a confidence level the underlying data cannot support.",
    "reports/eval-report": "Generate a 9-grid performance-evaluation report (impact x trajectory) for a person, grounded in dated observable artifacts, with growth framing for the next cycle.\n- **Out of scope:** Rendering the software-eval pass/fail report from `evals/.reports/` output — that's a CI reporting concern, not a person's performance evaluation.",

    # ── Leaves: review ──
    "review/code-review": "Review a diff for correctness, security, and maintainability, separating blocking defects from taste, and naming a specific required edit for each blocker.\n- **Out of scope:** Merging or approving, and rewriting the change wholesale instead of reviewing it.",
    "review/project-review": "Review a project update for schedule, scope, risk, and stakeholder issues, separating factual errors from strategy disagreements.\n- **Out of scope:** Re-planning the project, and overruling the project owner's stated priorities.",
    "review/announcement-review": "Review a draft announcement against tone and approval policy: audience fit, claim accuracy, and whether anything needs sign-off before it goes out.\n- **Out of scope:** Posting it, and approving on behalf of a named approver.",
    "review/counsel-review": "Reconcile multiple persona lenses into one verdict, attributing each concern to the lens that raised it and stating what would change the call.\n- **Out of scope:** Manufacturing consensus by dropping a dissenting lens, and issuing a verdict without naming the lenses consulted.",

    # ── Leaves: incident ──
    "incident/retro": "Run a blameless incident retro: timeline, contributing factors, and action items with owners — describing system and process failure, never individual fault.\n- **Out of scope:** Assigning blame to a person, and closing action items on the participants' behalf.",
    "incident/find-sme": "Identify the likeliest subject-matter expert for a system from configured history (commits, tickets, docs), with the evidence for each candidate.\n- **Out of scope:** Paging or messaging the person, and treating commit volume alone as expertise.",
    "incident/oncall-summary": "Summarize the on-call period: what fired, what was actionable, what was noise, and which alerts need tuning.\n- **Out of scope:** Acknowledging or resolving alerts, and changing alert thresholds.",

    # ── Leaves: metrics ──
    "metrics/my-metrics": "Report the individual's own delivery metrics for a period from configured sources, as distributions rather than single averages.\n- **Out of scope:** Comparing the individual against teammates, and any performance judgement.",
    "metrics/team-metrics": "Report team delivery metrics (throughput, cycle time, WIP, flow efficiency) from configured sources, stating the population and window for every figure.\n- **Out of scope:** Ranking individuals within the team, and inferring causation from a metric shift.",

    # ── Leaves: knowledge ──
    "knowledge/self-knowledge": "Link the user's own activity and gbrain entries into a retrievable personal graph, each entry carrying a source and an as-of date.\n- **Out of scope:** Copying personal entries into a team store, and scraping repos or org data beyond the configured token's scope.",
    "knowledge/team-knowledge": "Build the shared team knowledge graph — issues, ADRs, runbooks — with canonical links, dedupe checks, and staleness flags.\n- **Out of scope:** Writing personal or performance commentary into the shared store, and superseding a canonical entry without saying which one it replaces.",
    "knowledge/ingest-all": "Run the configured bulk ingest across `ingest_all` sources, reporting per-source counts and every item skipped with its reason.\n- **Out of scope:** Ingesting a source absent from config, and silently dropping items that failed to parse.",

    # ── Leaves: routines ──
    "routines/standup": "Produce standup content — yesterday, today, blockers — from Jira and Slack, capped at three bullets per person, as a draft for review.\n- **Out of scope:** Posting to the channel, and inventing an update for someone with no activity — say there is none.",
    "routines/weekly-digest": "Assemble the weekly digest over the configured window for both team and stakeholder audiences.\n- **Out of scope:** Sending the digest, and padding a quiet week with restated work from a previous one.",
    "routines/sprint-close": "Run the sprint-close sequence: reconcile committed versus delivered, capture carry-over with reasons, and produce the close summary.\n- **Out of scope:** Moving unfinished issues between sprints without confirmation, and closing the sprint in Jira.",
    "routines/health-check": "Run the periodic health check across configured sources and report only what changed materially since the last run.\n- **Out of scope:** Fixing anything it finds, and paging on a finding — surface it for a human.",
    "routines/morning-kickoff": "Run the morning kickoff from `kickoff_workflows`: today's calendar, open threads, and the shortlist worth attention first.\n- **Out of scope:** Acting on any item, and reordering the user's actual priorities for them.",
    "routines/custom": "Execute a custom routine from its `config/schedules/<id>.json` definition, resolving every step to a real skill before starting.\n- **Out of scope:** Inventing a step the definition does not contain, and returning a plausible result when the definition is invalid — return the fix instead.",

    # ── Leaves: workflows ──
    "workflows/execute": "Run a saved `config/workflows/*.json` flow through the `jstack workflow` CLI: preview, confirm, then execute, capturing an artifact per step.\n- **Out of scope:** Editing the flow definition, and claiming a browser ran when the runner is the stub.",

    # ── Leaves: standalone ──
    "federated-search": "Dispatch one query across the configured backends in parallel (Jira, Notion, Slack, GitHub, knowledge_base, gbrain) and fuse the results with per-source attribution.\n- **Out of scope:** Knowledge-base-only lookups — use `jstack:knowledge-search`, which is scoped to the curated `knowledge_base` config. Also out of scope: storing anything it finds.",
    "granola-daily-summary": "Summarize Granola or meeting notes into a daily digest with owners and follow-ups, from the notes provided.\n- **Out of scope:** Joining or transcribing the call (`jstack:meetings-transcribe`), and inferring a decision the notes do not record.",
    "pe/report-context": "Assemble the PE reporting context for a period: teams, projects, and the window the figures cover, validated against config.\n- **Out of scope:** Writing performance narrative about a named individual, and reporting on a team absent from `pe.teams`.",
})


# `scaffold` was mis-tagged `category: workflows`, so it rendered browser-automation domain rules
# ("Browser driver not available", "Preview/diff before production mutate") for a skill-scaffolder.
# Recategorized to `skill-creator`, which has no category entry, so it needs a per-key one — the
# depth gate correctly failed on the missing domain-rules section until this was added.
CATEGORY_DEEP["scaffold"] = (
    "## Domain rules — skill and plugin scaffolding\n"
    "- Generate the directory shape only: `SKILL.md`, `references/`, `evals/`. Never write skill *content* "
    "the author has not decided on — a plausible-looking body is harder to fix than an empty one.\n"
    "- Frontmatter must be inline scalars. `read_front_matter()` in `scripts/apply_detailed_skills.py` is "
    "line-based and keeps only lines containing `:`; a YAML block list is silently dropped and the key "
    "round-trips empty. Quote any `description` containing a colon.\n"
    "- A new skill body is GENERATED unless its path is added to `SKIP` in "
    "`scripts/apply_detailed_skills.py`. Decide which before scaffolding, and say which you chose — a "
    "hand-edit to a non-SKIP body is lost on the next regeneration.\n"
    "- Every new skill needs eval cases or `bun run check` fails on coverage. Scaffold "
    "`evals/` alongside the skill, then run `bun run gen:skill-evals` rather than hand-writing them.\n"
    "- Set `disable-model-invocation: true` when the skill writes external state, and "
    "`context: fork` + `agent: Explore` only when it is genuinely read-only — `Explore` has no Write "
    "or Edit tool, so a write skill configured that way cannot do its job.\n"
    "- After adding a skill, run `bun run docs:generate` so `skill-catalog.json` includes it."
)


# Router missions for the container directories that had NO top-level SKILL.md.
#
# Measured against a live install (`claude plugin details jstack`): the platform surfaces only
# top-level `skills/<name>/SKILL.md` — 36 of the 137 files on disk. The other 101 are reachable ONLY
# through a parent router. `design/`, `pe/`, `plugin/`, and `shortcuts/` had children but no router, so
# six skills had no discovery path at all: design/figma-handoff, design/visual-single-page-html,
# pe/report-context, plugin/create-plugin-pr, shortcuts/ceo-brainstorm,
# shortcuts/executive-research-brief.
#
# `plugin` was later flattened (2026-08): its one child, `create-plugin-pr`, was merged directly
# into `skills/plugin/SKILL.md` and the child directory deleted, since a single-child router with
# no second child planned just adds an extra hop with nothing to route between. `skills/plugin/SKILL.md`
# is hand-authored and pinned in `SKIP` — see that file. `design` and `pe` keep their router shape:
# `design` has two real children and `pe` grew a second (`pe-recon`), so both routers earn their keep.
MISSIONS.update({
    "design": "Route a design request to the right sub-skill: `figma-handoff` for a design-to-implementation contract (tokens, variants, state coverage, accessibility), or `visual-single-page-html` for a self-contained artifact a reader opens directly.\n- **Out of scope:** Writing the component code, and editing the Figma file itself.",
    "pe": "Route a people/performance-engineering request to the right sub-skill. `report-context` assembles the validated reporting window, teams, and projects from `pe.*` config before any narrative is written.\n- **Out of scope:** Writing performance narrative or a rating about a named individual, and reporting on a team absent from `pe.teams`.",
    "shortcuts": "Route a named composite shortcut to its sub-skill. Each composite pins one persona plus one tone — `ceo-brainstorm` (CEO persona + executive tone), `executive-research-brief` (research then executive compression).\n- **Out of scope:** Generic brainstorming or research with no named composite — call the underlying skill directly rather than forcing a persona onto it.",
})


# Domain rules for the routers added to reach previously-unreachable children.
# 16 of 20 routers carried a domain-rules block at the time; these four had no CATEGORY_DEEP entry, so
# they rendered without one and `pe`/`plugin` failed the depth gate. `plugin` was later flattened
# (see the MISSIONS.update comment above) and no longer needs an entry here — its domain rules live
# directly in the hand-authored `skills/plugin/SKILL.md` instead.
CATEGORY_DEEP.update({
    "design": (
        "## Domain rules — design\n"
        "- Two very different outputs live here. `figma-handoff` produces an implementation CONTRACT "
        "(named components and variants, token references, state coverage, the accessibility criterion "
        "each state must meet). `visual-single-page-html` produces a self-contained ARTIFACT a reader "
        "opens directly. Pick by deliverable, not by topic.\n"
        "- Never claim pixel parity without a screenshot reference; say `[no screenshot available]` "
        "rather than asserting visual accuracy from a description.\n"
        "- Accessibility is a named criterion, not an adjective — cite the WCAG rule and the measured "
        "value (`#999 on #fff is 2.85:1`), never \"contrast looks low\".\n"
        "- A single-page artifact pins its CDN scripts with SRI and embeds no real customer or employee "
        "data. Use synthetic values in examples."
    ),
    "pe": (
        "## Domain rules — people and performance engineering\n"
        "- Assemble the reporting CONTEXT before any narrative: which teams, which projects, and the "
        "exact window, all validated against `pe.*` in config. A narrative written before the window is "
        "fixed cannot be checked later.\n"
        "- Report on a team only if it appears in `pe.teams`. An unlisted team means the scope is "
        "unconfirmed — say so instead of inferring it.\n"
        "- Separate observation from evaluation. Describe what happened with a date and a source; do not "
        "attach a rating, a level, or a promotion opinion about a named person.\n"
        "- Single incidents are not patterns. One data point gets labelled as one data point."
    ),
    "shortcuts": (
        "## Domain rules — named composites\n"
        "- A composite pins exactly one persona plus one tone and loads both verbatim with `!cat`. "
        "Paraphrasing either from memory defeats the point of having the file.\n"
        "- The composite must change the OUTPUT, not just the preamble. If the answer reads the same as "
        "the underlying skill without the persona, the composite added nothing.\n"
        "- Prefer the underlying skill when no named composite fits. Forcing a persona onto an unrelated "
        "request produces confident-sounding output in the wrong register.\n"
        "- Cross-plugin bridges (gstack, superpowers) only work when that pack is installed — say it is "
        "missing rather than inventing its behaviour."
    ),
})

# The last router without a domain-rules block (19 of 20 had one).
CATEGORY_DEEP["computer-use"] = (
    "## Domain rules — computer use\n"
    "- Three distinct surfaces, and picking the wrong one wastes the whole attempt: native desktop UI "
    "(`jstack:computer-use-cua`), web automation via a saved flow (`jstack:workflow-execute`), or an org "
    "YAML workflow definition. Name the surface and why before acting.\n"
    "- Driving a real machine is destructive by default. Preview the action, then require explicit "
    "confirmation; `restart` and `destroy` against a live sandbox are never implicit.\n"
    "- Never type a credential into a driven UI. Form fills read from env, and no secret appears in a "
    "flow definition or in chat.\n"
    "- Capture evidence per step (screenshot, trace, or log). An automation run with no artifact cannot "
    "be reviewed after the fact."
)
