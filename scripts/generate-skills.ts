#!/usr/bin/env bun
/**
 * SCAFFOLDER ONLY — creates initial SKILL.md files with minimal frontmatter.
 *
 * The authoritative body generator is: python3 scripts/apply_detailed_skills.py
 * Run this TS file only to scaffold NEW skills. It will SKIP existing files.
 *
 * To add detail to skill bodies, edit apply_detailed_skills_data.py and re-run
 * the Python generator.
 */
import { existsSync, mkdirSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");

type SkillDef = {
  path: string;
  name: string;
  description: string;
  when: string;
  category: string;
  chains?: string;
  integrations?: string;
  extra?: string;
};

const ROOT_REF = "${CLAUDE_PLUGIN_ROOT}/skills/_core/references";
const PREAMBLE = "${CLAUDE_PLUGIN_ROOT}/prompts/setup/preamble.md";

function md(s: SkillDef): string {
  const chains = s.chains ?? "";
  return `---
name: ${s.name}
description: ${s.description}
category: ${s.category}
---

<!-- Chain Contract -->
<!-- inputs: user_request, jstack_config -->
<!-- outputs: structured_result -->
${chains ? `<!-- chains-to: ${chains} -->` : ""}

Read the setup preamble first:
!cat ${PREAMBLE}

## Instructions

${s.when}

**Config**: Resolve all team-specific values from \`jstack.config.json\` (never hardcode). Questions: \`${ROOT_REF}/question-patterns.md\`; discrete choices (AskUserQuestion or equivalent): \`${ROOT_REF}/ask-user-question-patterns.md\`.

${s.extra ?? ""}

## Failure modes

- Missing config → direct user to \`jstack:setup\` or \`jstack setup\`
- Missing integration → cite \`${ROOT_REF}/integration-guide.md\` and \`jstack doctor\`

## User request

$ARGUMENTS
`;
}

const skills: SkillDef[] = [
  {
    path: "setup",
    name: "jstack-setup",
    category: "setup",
    description: "First-time jstack onboarding; run jstack setup CLI and configure team.",
    when: "Run when user needs install, config, or integration wiring.",
  },
  {
    path: "update-config",
    name: "jstack-update-config",
    category: "setup",
    description: "Live-edit jstack.config.json with validation and diff preview.",
    when: "User says update-config, change setting, or tweak jstack config via Claude.",
    extra: `Read \`${ROOT_REF}/../update-config/references/config-sections.md\` for section keys.`,
  },
  {
    path: "project",
    name: "jstack-project",
    category: "project",
    description: "Project status across Notion/JIRA/Sheets.",
    when: "Project dashboard, stakeholder view, milestones.",
    integrations: "notion,jira",
  },
  {
    path: "team",
    name: "jstack-team",
    category: "team",
    description: "Team roster, roles, Workday/XML hints, Slack channels.",
    when: "Team makeup, org questions.",
  },
  {
    path: "sprint",
    name: "jstack-sprint",
    category: "sprint",
    description: "Sprint health, burndown context, JIRA board view.",
    when: "Sprint status, velocity, scope.",
  },
  {
    path: "sprint/planning",
    name: "jstack-sprint-planning",
    category: "sprint",
    description: "Sprint planning; bridge to superpowers writing-plans when available.",
    when: "Planning sprint, capacity, goals.",
    chains: "jstack:prioritize",
    extra: `Consider \`Skill(skill: \"superpowers:writing-plans\")\` for plan drafting.`,
  },
  {
    path: "sprint/prep",
    name: "jstack-sprint-prep",
    category: "sprint",
    description: "Pre-refinement backlog curation vs sprint goals.",
    when: "Sprint prep, refine queue before refinement.",
    chains: "jstack:sprint-refinement",
  },
  {
    path: "sprint/refinement",
    name: "jstack-sprint-refinement",
    category: "sprint",
    description: "Refinement ceremony; five questions per ticket.",
    when: "Backlog refinement, sprint grooming.",
    chains: "jstack:sprint-planning",
  },
  {
    path: "engineering",
    name: "jstack-engineering",
    category: "engineering",
    description: "Engineering orchestrator: health vs silo-scan.",
    when: "Engineering metrics, overlap detection, CI/PR health.",
  },
  {
    path: "engineering/health",
    name: "jstack-engineering-health",
    category: "engineering",
    description: "CI, PR queue, flaky tests, revert risk from configured repos.",
    when: "Repo health, engineering dashboard prep.",
  },
  {
    path: "engineering/silo-scan",
    name: "jstack-engineering-silo-scan",
    category: "engineering",
    description: "Overlap detection across Jira/GitHub from a ticket or PR.",
    when: "Duplicate work, same files, silo risk.",
  },
  {
    path: "sdlc",
    name: "jstack-sdlc",
    category: "sdlc",
    description: "SDLC stage gates, release readiness, testing hooks.",
    when: "Release process, quality gates.",
    extra: `Optional: \`Skill(skill: \"superpowers:test-driven-development\")\` for test strategy.`,
  },
  {
    path: "announcements",
    name: "jstack-announcements",
    category: "announcements",
    description: "Draft and route announcements to Slack/email per policy.",
    when: "Team updates, releases, incidents comms.",
  },
  {
    path: "sop",
    name: "jstack-sop",
    category: "sop",
    description: "SOP orchestrator: expectations vs resources.",
    when: "Policies, runbooks, onboarding docs.",
  },
  {
    path: "sop/expectations",
    name: "jstack-sop-expectations",
    category: "sop",
    description: "Team expectations doc maintenance (Notion/Docs).",
    when: "Update expectations, code of conduct, working agreements.",
  },
  {
    path: "sop/resources",
    name: "jstack-sop-resources",
    category: "sop",
    description: "Team resources index in Notion.",
    when: "Centralize links, tools, dashboards.",
  },
  {
    path: "review",
    name: "jstack-review",
    category: "review",
    description: "Review orchestrator: project, announcement, counsel paths.",
    when: "Multi-perspective review workflows.",
    chains: "jstack:project-review,jstack:counsel-review",
  },
  {
    path: "review/project-review",
    name: "jstack-project-review",
    category: "review",
    description: "Project update review checklist.",
    when: "Review project status doc or demo.",
  },
  {
    path: "review/announcement-review",
    name: "jstack-announcement-review",
    category: "review",
    description: "Announcement tone, accuracy, channel fit.",
    when: "Review draft announcement.",
  },
  {
    path: "review/counsel-review",
    name: "jstack-counsel-review",
    category: "review",
    description: "CEO/Designer/Engineer/QA perspectives using persona prompts.",
    when: "Counsel-style multi-lens feedback.",
    extra: `Load personas from \`${PREAMBLE.replace("preamble.md", "../personas/")}\` (ceo, designer, engineer, qa).`,
  },
  {
    path: "review/code-review",
    name: "jstack-review-code-review",
    category: "review",
    description: "PR seek / appraise / polish workflows from config.",
    when: "Code review queue, interactive PR review, pre-push self-review.",
  },
  {
    path: "intake",
    name: "jstack-intake",
    category: "intake",
    description: "Feature/ticket intake from raw text to structured ticket.",
    when: "New request, idea, bug report intake.",
    chains: "jstack:prioritize",
  },
  {
    path: "prioritize",
    name: "jstack-prioritize",
    category: "prioritize",
    description: "Prioritize backlog items with rubric from config/policies.",
    when: "Ranking, WSJF, RICE, stack rank.",
  },
  {
    path: "recon",
    name: "jstack-recon",
    category: "recon",
    description: "Scan Slack/JIRA/email for action items and risks.",
    when: "What needs attention, recon, standup prep.",
    chains: "jstack:prioritize",
    extra: `Output must include line: action_items: for gate evals when summarizing lists.`,
  },
  {
    path: "knowledge",
    name: "jstack-knowledge",
    category: "knowledge",
    description: "Knowledge orchestrator: intake, process, shortcuts, team/self.",
    when: "KB operations, gbrain routing.",
  },
  {
    path: "knowledge/intake",
    name: "jstack-knowledge-intake",
    category: "knowledge",
    description: "Ingest notes into gbrain (team or personal per session).",
    when: "Save meeting notes, threads, docs to knowledge base.",
  },
  {
    path: "knowledge/process",
    name: "jstack-knowledge-process",
    category: "knowledge",
    description: "Organize, tag, dedupe gbrain entries.",
    when: "Clean up knowledge, taxonomy.",
  },
  {
    path: "knowledge/shortcuts",
    name: "jstack-knowledge-shortcuts",
    category: "knowledge",
    description: "Bridge to gstack/superpowers skills for planning and QA.",
    when: "Delegate to external plugin skills.",
    extra: `Read \`${PREAMBLE.replace("setup/preamble.md", "shortcuts/gstack-bridge.md")}\` and superpowers-bridge.md`,
  },
  {
    path: "knowledge/team-knowledge",
    name: "jstack-team-knowledge",
    category: "knowledge",
    description: "Team github + team gbrain linking patterns.",
    when: "Org-wide technical knowledge.",
  },
  {
    path: "knowledge/self-knowledge",
    name: "jstack-self-knowledge",
    category: "knowledge",
    description: "Personal github + personal gbrain.",
    when: "Individual learning log.",
  },
  {
    path: "incident",
    name: "jstack-incident",
    category: "incident",
    description: "Incident commander workflow: severity, comms, timeline.",
    when: "Incident, outage, sev response.",
    extra: `Optional \`Skill(skill: \"gstack:investigate\")\`, \`Skill(skill: \"superpowers:systematic-debugging\")\`.`,
  },
  {
    path: "incident/retro",
    name: "jstack-retro",
    category: "incident",
    description: "Blameless retro structure and follow-ups.",
    when: "Post-incident retro.",
    extra: `Optional \`Skill(skill: \"gstack:retro\")\`.`,
  },
  {
    path: "incident/oncall-summary",
    name: "jstack-incident-oncall-summary",
    category: "incident",
    description: "Oncall channel digest; alert grouping; severity ranking.",
    when: "Shift handoff, oncall summary.",
  },
  {
    path: "incident/find-sme",
    name: "jstack-incident-find-sme",
    category: "incident",
    description: "Rank SME candidates from Jira + Slack signals.",
    when: "Who owns this, incident SME lookup.",
  },
  {
    path: "advice",
    name: "jstack-advice",
    category: "advice",
    description: "CEO/Designer style advice using gbrain context.",
    when: "Leadership or design counsel question.",
  },
  {
    path: "session",
    name: "jstack-session",
    category: "session",
    description: "Session orchestrator: init vs end.",
    when: "Bookend working session.",
  },
  {
    path: "session/init",
    name: "jstack-init-session",
    category: "session",
    description: "Start session; set gbrain target personal vs team; load context.",
    when: "Begin focused session with jstack.",
    extra: `Read \`${ROOT_REF}/../questions/meeting-questions.md\` if storing meetings later.`,
  },
  {
    path: "session/end",
    name: "jstack-end-session",
    category: "session",
    description: "End session; persist notes; metrics summary.",
    when: "Wrap up session.",
  },
  {
    path: "self",
    name: "jstack-self",
    category: "self",
    description: "Personal productivity orchestrator.",
    when: "Diary, memory, focus, tasks.",
  },
  {
    path: "self/diary",
    name: "jstack-self-diary",
    category: "self",
    description: "Journal entry to personal gbrain.",
    when: "Daily journal, reflection snippet.",
  },
  {
    path: "self/remember",
    name: "jstack-self-remember",
    category: "self",
    description: "Store durable personal fact/decision.",
    when: "Remember this, save insight.",
  },
  {
    path: "self/explain",
    name: "jstack-self-explain",
    category: "self",
    description: "Explain recent work for commits/reviews.",
    when: "What did I change and why.",
  },
  {
    path: "self/focus",
    name: "jstack-self-focus",
    category: "self",
    description: "Synthesize what to focus on from tasks + calendar + gbrain.",
    when: "What should I focus on?",
  },
  {
    path: "self/lookback",
    name: "jstack-self-lookback",
    category: "self",
    description: "Review last N days (default from config) of personal gbrain.",
    when: "Look back 7 days, weekly review.",
  },
  {
    path: "self/tasks",
    name: "jstack-self-tasks",
    category: "self",
    description: "Personal task roll-up from JIRA + notes.",
    when: "My tasks today.",
  },
  {
    path: "self/eval",
    name: "jstack-self-eval",
    category: "self",
    description: "9-grid self evaluation + growth recommendations.",
    when: "Self assessment, performance reflection.",
    extra: `Read \`${ROOT_REF}/../self/references/9-grid-framework.md\`.`,
  },
  {
    path: "self/brag",
    name: "jstack-self-brag",
    category: "self",
    description: "Daily/weekly brag from Slack, GitHub, Jira with dimension mapping.",
    when: "Activity brag, perf evidence gathering.",
  },
  {
    path: "self/impact-prep",
    name: "jstack-self-impact-prep",
    category: "self",
    description: "Growth check-in or quarterly impact prep from artifacts.",
    when: "Impact narrative, review prep.",
  },
  {
    path: "metrics",
    name: "jstack-metrics",
    category: "metrics",
    description: "Metrics orchestrator.",
    when: "Engineering metrics overview.",
  },
  {
    path: "metrics/my-metrics",
    name: "jstack-my-metrics",
    category: "metrics",
    description: "Personal GitHub stats, PR throughput.",
    when: "My metrics, personal velocity.",
  },
  {
    path: "metrics/team-metrics",
    name: "jstack-team-metrics",
    category: "metrics",
    description: "Team DORA-style signals from GitHub/JIRA.",
    when: "Team delivery metrics.",
  },
  {
    path: "reports",
    name: "jstack-reports",
    category: "reports",
    description: "Reports orchestrator.",
    when: "Generate reports.",
  },
  {
    path: "reports/team-report",
    name: "jstack-team-report",
    category: "reports",
    description: "Weekly team report for managers.",
    when: "Team weekly summary.",
  },
  {
    path: "reports/engineer-report",
    name: "jstack-engineer-report",
    category: "reports",
    description: "Individual engineer weekly.",
    when: "IC weekly report.",
  },
  {
    path: "reports/manager-report",
    name: "jstack-manager-report",
    category: "reports",
    description: "Manager rollup across teams.",
    when: "Manager rollup.",
  },
  {
    path: "reports/project-report",
    name: "jstack-project-report",
    category: "reports",
    description: "Project status for stakeholders.",
    when: "Project health report.",
  },
  {
    path: "reports/self-report",
    name: "jstack-self-report",
    category: "reports",
    description: "Personal accomplishments report.",
    when: "Self summary for perf cycle.",
  },
  {
    path: "reports/eval-report",
    name: "jstack-eval-report",
    category: "reports",
    description: "9-grid evaluation report output.",
    when: "Formal self-eval doc.",
  },
  {
    path: "jira",
    name: "jstack-jira",
    category: "jira",
    description: "JIRA operations orchestrator.",
    when: "JIRA CRUD umbrella.",
  },
  ...["get", "create", "intake", "update", "transition", "notify", "append"].map((op) => ({
    path: `jira/${op}`,
    name: `jstack-jira-${op.replace(/-/g, "")}`,
    category: "jira",
    description: `JIRA ${op}: use templates and jira_rules from config.`,
    when: `User asks jira ${op} or issue ${op}.`,
    extra:
      op === "transition"
        ? "Enforce jira_rules.transitions and required fields before status changes."
        : "Read templates/jira/*.json for defaults.",
  })),
  {
    path: "notion",
    name: "jstack-notion",
    category: "notion",
    description: "Notion orchestrator.",
    when: "Notion CRUD umbrella.",
  },
  ...[
    "team-note",
    "knowledge-base",
    "article",
    "adr",
    "report",
    "project",
    "sprint",
    "planning",
    "update",
  ].map((op) => ({
    path: `notion/${op}`,
    name: `jstack-notion-${op.replace(/-/g, "")}`,
    category: "notion",
    description: `Notion ${op} using templates/notion/*.json.`,
    when: `Notion ${op.replace(/-/g, " ")}.`,
  })),
  {
    path: "research",
    name: "jstack-research",
    category: "research",
    description: "Research orchestrator.",
    when: "Research task routing.",
  },
  ...["technical", "competitive", "user", "spike", "explain-codebase"].map((op) => ({
    path: `research/${op}`,
    name: `jstack-research-${op.replace(/-/g, "")}`,
    category: "research",
    description: `Research subtype: ${op}.`,
    when: `${op} research or codebase tour.`,
  })),
  {
    path: "meetings",
    name: "jstack-meetings",
    category: "meetings",
    description: "Meetings orchestrator.",
    when: "Meeting lifecycle.",
  },
  {
    path: "meetings/prepare",
    name: "jstack-meetings-prepare",
    category: "meetings",
    description: "Prep brief: calendar + JIRA context.",
    when: "Prepare for meeting.",
  },
  {
    path: "meetings/transcribe",
    name: "jstack-meetings-transcribe",
    category: "meetings",
    description: "Transcribe AV via Whisper/Deepgram patterns.",
    when: "Transcribe recording.",
  },
  {
    path: "meetings/granola-highlights",
    name: "jstack-meetings-granola",
    category: "meetings",
    description: "Import Granola AI highlights.",
    when: "Granola export processing.",
  },
  {
    path: "meetings/store-note",
    name: "jstack-meetings-store-note",
    category: "meetings",
    description: "Route meeting notes to personal or team storage.",
    when: "Store meeting notes.",
  },
  {
    path: "meetings/store-note/personal",
    name: "jstack-meetings-store-personal",
    category: "meetings",
    description: "Save notes to personal gbrain.",
    when: "Private meeting notes.",
  },
  {
    path: "meetings/store-note/team",
    name: "jstack-meetings-store-team",
    category: "meetings",
    description: "Save notes to team gbrain / Notion.",
    when: "Shared meeting notes.",
  },
  {
    path: "meetings/notion-highlights",
    name: "jstack-meetings-notion-highlights",
    category: "meetings",
    description: "Push highlights to Notion DB.",
    when: "Notion meeting page.",
  },
  {
    path: "meetings/one-on-one-transcript",
    name: "jstack-meetings-one-on-one-transcript",
    category: "meetings",
    description:
      "1:1 prep and after notes from configured transcripts; Lattice MCP or Notion PE; AI attribution.",
    when: "1:1 prepare or after from transcripts; private PE vs team hub.",
    chains: "jstack-notion-one-on-one",
  },
  {
    path: "meetings/action-items",
    name: "jstack-meetings-action-items",
    category: "meetings",
    description: "Extract action items → JIRA tasks.",
    when: "Turn decisions into tickets.",
    chains: "jstack:jira/create",
  },
  {
    path: "meetings/post-slack",
    name: "jstack-meetings-post-slack",
    category: "meetings",
    description: "Post meeting summary to Slack.",
    when: "Slack recap after meeting.",
  },
  {
    path: "workflows",
    name: "jstack-workflows",
    category: "workflows",
    description: "Browser workflow orchestrator.",
    when: "Automation flows.",
  },
  ...["builder", "recorder", "runner", "viewer"].map((op) => ({
    path: `workflows/${op}`,
    name: `jstack-workflow-${op}`,
    category: "workflows",
    description: `Workflow ${op}: use jstack workflow CLI and Playwright/browser_use docs.`,
    when: `Workflow ${op}.`,
  })),
  {
    path: "computer-use",
    name: "jstack-computer-use",
    category: "computer-use",
    description:
      "Route native desktop automation (CUA) vs web (workflows, Playwright MCP) vs org YAML flows.",
    when: "Computer-use, CUA, trycua, desktop vs browser automation, ambiguous automate app.",
    extra: `CUA lifecycle: \`${ROOT_REF.replace("/_core/references", "/computer-use/cua/SKILL.md")}\`.`,
  },
  {
    path: "computer-use/cua",
    name: "jstack-computer-use-cua",
    category: "computer-use",
    description:
      "Cua Driver, CuaBot, sandboxes — setup, test, execute, status, restart, destroy.",
    when: "cua-driver, cuabot, trycua, macOS AX automation, sandbox SDK, TCC.",
    extra: `Upstream: \`${ROOT_REF.replace("/_core/references", "/computer-use/references/upstream-links.md")}\`.`,
  },
  {
    path: "routines",
    name: "jstack-routines",
    category: "routines",
    description: "Scheduled routines manager.",
    when: "Cron skill chains.",
  },
  ...["morning-kickoff", "standup", "weekly-digest", "sprint-close", "health-check", "custom"].map((op) => ({
    path: `routines/${op}`,
    name: `jstack-${op.replace(/-/g, "")}`,
    category: "routines",
    description: `Routine: ${op} — see config/routines and jstack schedule CLI.`,
    when: `Run ${op} routine.`,
  })),
];

for (const s of skills) {
  const dir = join(root, "skills", s.path);
  const file = join(dir, "SKILL.md");
  if (existsSync(file)) {
    continue;
  }
  mkdirSync(dir, { recursive: true });
  writeFileSync(file, md(s), "utf8");
}

console.log(`Wrote ${skills.length} skills under ${join(root, "skills")}`);
