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
    "notion/knowledge-base": "Add or update a knowledge-base entry in Notion with tags, deduplicating on title+topic.",
    "notion/team-note": "Create a lightweight team note in Notion. Suggest ADR for binding decisions instead.",
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
    "reports": "Route report requests to the right sub-skill (team, engineer, manager, project, self, eval).",
    "reports/team-report": "Generate a weekly team report: velocity, risks, dependencies, and 3 asks to leadership.",
    "reports/engineer-report": "Generate an individual engineer report: shipped, WIP, blockers, next. No invented metrics.",
    "reports/manager-report": "Generate a manager rollup across teams without stack-ranking individuals.",
    "reports/project-report": "Generate a stakeholder 1-pager: RAG status, milestones, risk register snapshot.",
    "reports/self-report": "Generate a self-authored accomplishments narrative for performance context. User-editable voice.",
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
    "knowledge": "Route knowledge requests to intake, process, search, self-knowledge, team-knowledge, or shortcuts.",
    "knowledge/intake": "Ingest raw text into a structured record (title, body, tags). Flag PII/secrets before storage.",
    "knowledge/search": "Answer questions using configured doc roots, URLs, and GitHub scope from jstack.config.json (knowledge_base) — not free-form web guesswork.",
    "knowledge/process": "Deduplicate, merge near-duplicates, and set canonical links across gbrain/Notion entries.",
    "knowledge/self-knowledge": "Link personal GitHub activity and gbrain entries. No scraping private repos without token scope.",
    "knowledge/team-knowledge": "Build the team knowledge graph: link issues, ADRs, runbooks. Suggest hubs and flag stale pages.",
    "knowledge/shortcuts": "Bridge to gstack/superpowers skills for planning and QA. Link to prompts/shortcuts/, do not duplicate.",
    # --- review ---
    "review": "Route review requests to project-review, announcement-review, or counsel-review.",
    "review/project-review": "Review a project update for schedule, scope, risk, and stakeholder issues. Factual errors vs strategy issues.",
    "review/announcement-review": "Review an announcement for tone, accuracy, and channel fit. Flag legal/PR risks if external.",
    "review/counsel-review": "Multi-persona review (CEO/design/eng/QA) with synthesis and tensions. Not vote-counting by title.",
    # --- routines ---
    "routines": "Route to the right routine sub-skill (standup, weekly-digest, sprint-close, health-check, custom).",
    "routines/standup": "Generate standup content: yesterday/today/blocked from Jira+Slack. 3 bullets max per person. Draft only.",
    "routines/weekly-digest": "Generate a weekly digest: exec summary + links. Separate customer-facing section if two audiences.",
    "routines/sprint-close": "Sprint close routine: velocity, spill, carry, retro hook. Do not fabricate demo links.",
    "routines/health-check": "Run jstack doctor + integration smoke test. Classify: P1 broken, P2 degraded. Output one Slack summary line.",
    "routines/custom": "Execute a custom routine from config/routines JSON. If schedule JSON is invalid, return a fix, not a fake result.",
    # --- workflows ---
    "workflows": "Route workflow requests to builder, runner, recorder, or viewer.",
    "workflows/builder": "Build a workflow definition (YAML/JSON): start URL, steps, waits, assertions. No credentials in the file.",
    "workflows/runner": "Execute a workflow with jstack workflow run. Capture log + screenshot paths. Abort on first assertion failure.",
    "workflows/recorder": "Record user browser actions into a workflow definition. Add stability notes (selectors) before promoting to CI.",
    "workflows/viewer": "Diff two workflow runs: timing, flakiness, visual diff summary. Do not assert pixel equality as pass/fail.",
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
    "setup": "First-time jstack onboarding: run jstack setup wizard, create config, validate with jstack doctor. No secrets in chat.",
    "update-config": "Edit jstack.config.json with validation against config/schema.json. Show diff and rollback one-liner.",
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
    "setup": "Also for first-time install, onboarding, jstack doctor failures, MCP setup, or fixing missing jstack.config.json.",
    "adr": "Also when the user mentions docs/decisions, RFC-lite, supersede ADR-NNN, or recording architecture or org decisions in git markdown.",
    "intake": "Also when shaping a feature idea, PRD snippet, messy notes, or Slack thread into ticket-ready fields (before Jira create).",
    "workflows": "Also for Playwright-style flows, browser automation YAML/JSON, recording steps, running jstack workflow, or comparing two runs.",
}

# ---------------------------------------------------------------------------
# MISSIONS — the "What this skill is for" body (unique per skill/category)
# ---------------------------------------------------------------------------
MISSIONS: dict[str, str] = {
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
    # --- meetings ---
    "meetings": "Route meeting requests to the most specific sub-skill: prepare, transcribe, action-items, post-slack, notion-highlights, or store-note.\n- **Out of scope:** Sending calendar invites or joining calls.",
    "meetings/prepare": "Build a 1-page prep brief: Jira in-progress/blocked for attendees + user-provided calendar context. Read-only output.\n- **Out of scope:** Posting, storing, or modifying external systems.",
    "meetings/action-items": "Extract action items from notes with owner + due. If owner is unclear, mark `TBD` with a suggested ping target.\n- **Out of scope:** Creating Jira tickets directly — hand off to `jstack:jira-intake`.",
    # --- self ---
    "self": "Route personal productivity requests to the right sub-skill. Session gbrain target (personal vs team) must be respected.\n- **Out of scope:** Therapy, HR advice, or storing other people's PII without redaction.",
    "self/diary": "Write a single journal entry to personal gbrain. Never auto-post to team channels; never mix team data in.\n- **Out of scope:** Multi-day lookbacks (use `self/lookback`) or team-visible storage.",
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
    # --- sprint ---
    "sprint": "Route sprint requests to the right sub-skill (planning, mid-sprint re-plan). Provide capacity and goal context.\n- **Out of scope:** Moving Jira issues between sprints without user confirmation.",
    # --- sop ---
    "sop": "Route SOP requests to the right sub-skill (expectations, resources). Maintain canonical links to Notion/Confluence.\n- **Out of scope:** Enforcing SOPs — surface tensions between policy and reality for the user to resolve.",
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
        "- Secrets: form fills must use env; never print passwords in workflow YAML or chat.\n"
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
    "session/end": "jstack:session-init",
    "knowledge/intake": "jstack:knowledge-process",
    "intake": "jstack:jira-intake",
    "routines/standup": "jstack:meetings-post-slack",
    "routines/sprint-close": "jstack:notion-sprint",
}

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
    "workflows": "| Browser driver not available | Document requirements; do not block on GUI if headless was requested. |\n| Assertion failure | Abort with screenshot ref and suggest selector fix. |",
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
            "- Output: return key, id, URL. For epics, note epic name in the summary line."
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
            "- Output: from-status → to-status with timestamp; link to view issue."
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
        "knowledge-base": "DB row with tags. Dedupe on title+topic with `jstack:knowledge-process` if unsure whether to add or update.",
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
        "self-report": "Self accomplishments for perf narrative. Not a legal perf review; user-editable voice.",
        "eval-report": "Sensitive: growth framing. Avoid comparing to other individuals by name. Mark manager-only if not peer-shareable.",
    }
    return b.get(seg, "")


def _self(seg: str) -> str:
    b = {
        "diary": "One session journal entry. gbrain personal target only unless user overrides.\n- No auto-post to team channels.",
        "lookback": "Last N days of personal gbrain + calendar. Surface patterns in one short section.\n- Gentle tone; not therapy.",
        "focus": "From tasks + gbrain: 2-3 focus blocks, one explicit non-goal, and a timebox suggestion.",
        "eval": "Self assessment only. Suggest one growth goal for next 2 weeks.\n- Do not use as formal HR input unless user says so.",
        "remember": "Durable fact storage in gbrain. Attach provenance: `jstack_session_id`, `gbrain_target`, `config_label`, `slack_handle` if resolved, `source_skill: jstack:remember`, `written_at`. See `gbrain-entry-provenance.md`.\n- Rotate or refuse if the user pastes a secret.",
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
        "shortcuts": "Bridge to gstack/superpowers. Output which external skill to run, not a copy of that skill's body. Link to `prompts/shortcuts/gstack-bridge.md`, `prompts/shortcuts/superpowers-bridge.md`, and `prompts/shortcuts/composites.md` (persona + tone + target skill, e.g. `jstack:ceo-brainstorm`). Prefer `skills/shortcuts/` wrapper skills when the user uses a named alias.",
    }
    return b.get(seg, "")


def _session(seg: str) -> str:
    b = {
        "init": "Set gbrain target. Set or read `session.current_session_id` (opaque). Load team context. Echo sprint and timezone from `jstack time` if available.\n- Do not end prior session silently — ask once if ambiguous.",
        "end": "Summary, carryover, links. When writing to GBrain, include envelope: session id, gbrain_target, config_label, slack_handle/ids if resolved, `source_skill: jstack:session-end`, `written_at`. See `gbrain-entry-provenance.md`.\n- Optional metrics from eval hooks. Clear ready for next init.",
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
        "builder": "Build flow YAML/JSON: start URL, steps, waits, assertions. No credentials in the file.",
        "runner": "Execute with `jstack workflow run`. Capture log + screenshot paths if enabled.\n- Abort on first assertion failure with screenshot ref.",
        "recorder": "Record user actions → flow. Add stability notes (selectors) before promoting to CI.",
        "viewer": "Diff two runs: timing, flakiness, visual diff summary when artifacts exist.\n- Do not assert pixel equality as pass/fail if threshold-based.",
    }
    return b.get(seg, "")


def _review(seg: str) -> str:
    b = {
        "project-review": "Schedule, scope, risk, stakeholders checklists. Separate factual errors from strategy issues.",
        "announcement-review": "Tone + accuracy + channel fit. Flag legal/PR risks if external.",
        "counsel-review": "Multi-persona (CEO/design/eng/QA) with synthesis and tensions. Not vote-counting by title.",
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
