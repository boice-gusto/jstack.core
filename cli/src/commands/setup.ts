import * as p from "@clack/prompts";
import chalk from "chalk";
import { mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { ENCODING_UTF8 } from "@jstack/constants/paths";
import {
  configPath,
  findPluginRoot,
  findProjectRoot,
  loadDefaults,
  mergeDeep,
  readConfigOptional,
  writeConfig,
} from "../lib/config.js";
import { discoverFromMcpJson, mergeMcpRegistry } from "../lib/mcp-discovery.js";
import { asRecord, extractSetupSlices } from "../lib/setup-defaults-slices.js";
import { JstackConfigSchema } from "../types/config.js";

function parseRootsInput(raw: string, fallback: string[]): string[] {
  const parts = raw
    .split(/[,\n]+/)
    .map((s) => s.trim())
    .filter(Boolean);
  return parts.length ? parts : fallback;
}

function uniqRoots(paths: string[]): string[] {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const s of paths) {
    const t = String(s).trim();
    if (!t || seen.has(t)) continue;
    seen.add(t);
    out.push(t);
  }
  return out;
}

type TeamRosterPatch = {
  canonical_group: Record<string, unknown>;
  members: Record<string, unknown>[];
};

/**
 * Optional wizard: canonical team identity (Slack user group / Google Group / manual) and
 * `team.members` rows shaped as `{ id, metadata?, github?, email?, jira?, notion?, slack?, misc? }`.
 * See skills/team/references/team-canonical-identity.md.
 */
async function promptTeamRosterSection(
  defaultsTeam: Record<string, unknown> | undefined,
): Promise<TeamRosterPatch | null> {
  const go = await p.confirm({
    message:
      "Configure team roster, canonical group (Slack user group / Google Group), and optional Notion 1:1 page IDs?",
    initialValue: false,
  });
  if (p.isCancel(go) || !go) return null;

  const defCg = (defaultsTeam?.canonical_group as Record<string, unknown> | undefined) ?? {};

  const modeRaw = await p.select({
    message: "Canonical team identity mode (how tools resolve the team beyond this file)",
    options: [
      { value: "none", label: "none — no Slack/Google group" },
      { value: "manual_list", label: "manual_list — roster in config is source of truth" },
      { value: "slack_user_group", label: "slack_user_group — Slack user group" },
      { value: "google_group", label: "google_group — Google Group email" },
    ],
    initialValue: String(defCg.mode ?? "manual_list"),
  });
  if (p.isCancel(modeRaw)) throw new Error("cancelled");
  const mode = String(modeRaw);

  let slack_user_group_id = String(defCg.slack_user_group_id ?? "");
  let slack_handle = String(defCg.slack_handle ?? "");
  let google_group_email = String(defCg.google_group_email ?? "");

  if (mode === "slack_user_group") {
    const sid = await p.text({
      message:
        "Slack user group ID (often starts with S…; find via Slack UI or API — see team-canonical-identity.md)",
      initialValue: slack_user_group_id,
      placeholder: "S01234567",
    });
    if (p.isCancel(sid)) throw new Error("cancelled");
    slack_user_group_id = String(sid).trim();
    const sh = await p.text({
      message: "Slack handle for the group (optional, e.g. @eng-platform)",
      initialValue: slack_handle,
      placeholder: "@eng-platform",
    });
    if (p.isCancel(sh)) throw new Error("cancelled");
    slack_handle = String(sh).trim();
  }

  if (mode === "google_group") {
    const ge = await p.text({
      message: "Google Group email (e.g. eng-platform@company.com)",
      initialValue: google_group_email,
      placeholder: "team@company.com",
    });
    if (p.isCancel(ge)) throw new Error("cancelled");
    google_group_email = String(ge).trim();
  }

  const display_name = await p.text({
    message: "Team display label for reports (optional)",
    initialValue: String(defCg.display_name ?? ""),
    placeholder: "Platform Engineering",
  });
  if (p.isCancel(display_name)) throw new Error("cancelled");

  const canonical_group = mergeDeep(defCg, {
    mode,
    slack_user_group_id,
    slack_handle,
    google_group_email,
    display_name: String(display_name).trim(),
  });

  const members: Record<string, unknown>[] = [];
  let addMember = await p.confirm({
    message:
      "Add a team member now (id, metadata, GitHub, email, Jira, Slack, Notion 1:1s, optional misc)?",
    initialValue: true,
  });
  if (p.isCancel(addMember)) throw new Error("cancelled");

  while (addMember) {
    const id = await p.text({
      message: "Member id (slug, no spaces — e.g. alex-k)",
      placeholder: "alex-k",
    });
    if (p.isCancel(id)) throw new Error("cancelled");
    const idTrim = String(id).trim();
    if (!idTrim) {
      p.log.warn("Skipped empty member id.");
      break;
    }

    const displayName = await p.text({
      message: "Display name (optional, stored under metadata.name)",
      placeholder: "Alex Kim",
    });
    if (p.isCancel(displayName)) throw new Error("cancelled");

    const level = await p.text({
      message: "Level (optional, e.g. L5 — stored under metadata.level)",
      placeholder: "L5",
    });
    if (p.isCancel(level)) throw new Error("cancelled");

    const role = await p.text({
      message: "Role (optional — stored under metadata.role)",
      placeholder: "Staff Engineer",
    });
    if (p.isCancel(role)) throw new Error("cancelled");

    const title = await p.text({
      message: "Job title (optional — stored under metadata.title)",
      placeholder: "Senior Software Engineer",
    });
    if (p.isCancel(title)) throw new Error("cancelled");

    const githubLogin = await p.text({
      message: "GitHub username (optional — github.login)",
      placeholder: "alex-kim",
    });
    if (p.isCancel(githubLogin)) throw new Error("cancelled");

    const emailPrimary = await p.text({
      message: "Work email (optional — email.primary)",
      placeholder: "alex@company.com",
    });
    if (p.isCancel(emailPrimary)) throw new Error("cancelled");

    const jiraAccountId = await p.text({
      message: "Jira account id (optional — jira.account_id; from Jira profile/API)",
      placeholder: "",
    });
    if (p.isCancel(jiraAccountId)) throw new Error("cancelled");

    const slackHandle = await p.text({
      message: "Slack handle (optional — slack.handle, e.g. @alex)",
      placeholder: "@alex",
    });
    if (p.isCancel(slackHandle)) throw new Error("cancelled");

    const slackUserId = await p.text({
      message: "Slack user id (optional — slack.user_id, often U…)",
      placeholder: "",
    });
    if (p.isCancel(slackUserId)) throw new Error("cancelled");

    const miscNote = await p.text({
      message: "Misc one-line note (optional — misc.note; add more keys in config by hand)",
      placeholder: "",
    });
    if (p.isCancel(miscNote)) throw new Error("cancelled");

    p.log.info(
      chalk.dim(
        "Notion IDs: paste from page URLs (UUID with dashes). Leave empty to fill later — do not invent ids.",
      ),
    );
    const oneOnOneParent = await p.text({
      message: "Notion 1:1 section parent page ID (optional)",
      placeholder: "",
    });
    if (p.isCancel(oneOnOneParent)) throw new Error("cancelled");

    const templatePage = await p.text({
      message: "Notion template page ID for this person (optional)",
      placeholder: "",
    });
    if (p.isCancel(templatePage)) throw new Error("cancelled");

    const hubPage = await p.text({
      message: "Notion person hub page ID (optional)",
      placeholder: "",
    });
    if (p.isCancel(hubPage)) throw new Error("cancelled");

    const notion: Record<string, unknown> = {};
    const oop = String(oneOnOneParent).trim();
    const tp = String(templatePage).trim();
    const hp = String(hubPage).trim();
    if (oop) notion.one_on_one_parent_page_id = oop;
    if (tp) notion.template_page_id = tp;
    if (hp) notion.person_hub_page_id = hp;

    const dn = String(displayName).trim();
    const lv = String(level).trim();
    const ro = String(role).trim();
    const tt = String(title).trim();
    const metadata: Record<string, unknown> = {};
    if (dn) metadata.name = dn;
    if (lv) metadata.level = lv;
    if (ro) metadata.role = ro;
    if (tt) metadata.title = tt;

    const gl = String(githubLogin).trim();
    const github: Record<string, unknown> = {};
    if (gl) github.login = gl;

    const em = String(emailPrimary).trim();
    const email: Record<string, unknown> = {};
    if (em) email.primary = em;

    const jid = String(jiraAccountId).trim();
    const jira: Record<string, unknown> = {};
    if (jid) jira.account_id = jid;

    const sh = String(slackHandle).trim();
    const su = String(slackUserId).trim();
    const slack: Record<string, unknown> = {};
    if (sh) slack.handle = sh;
    if (su) slack.user_id = su;

    const mn = String(miscNote).trim();
    const misc: Record<string, unknown> = {};
    if (mn) misc.note = mn;

    const row: Record<string, unknown> = {
      id: idTrim,
      metadata,
      github,
      email,
      jira,
      notion,
      slack,
      misc,
    };

    members.push(row);

    const more = await p.confirm({ message: "Add another team member?", initialValue: false });
    if (p.isCancel(more)) throw new Error("cancelled");
    addMember = more;
  }

  if (mode === "manual_list" && members.length === 0) {
    p.log.warn(
      "manual_list mode with an empty roster: add members in jstack.config.json or re-run setup --reconfigure.",
    );
  }

  return { canonical_group, members };
}

export async function runSetup(opts: {
  reconfigure?: boolean;
  withGbrainKb?: boolean;
  pe?: boolean;
}): Promise<void> {
  try {
    return await runSetupInner(opts);
  } catch (err) {
    // B4 fix: cancellation propagates as an Error("cancelled") from the per-prompt
    // isCancel checks. Translate that into a clean exit instead of a stack trace.
    const msg = err instanceof Error ? err.message : String(err);
    if (msg === "cancelled") {
      p.cancel("Cancelled. No config changes.");
      process.exitCode = 130;
      return;
    }
    throw err;
  }
}

async function runSetupInner(opts: {
  reconfigure?: boolean;
  withGbrainKb?: boolean;
  pe?: boolean;
}): Promise<void> {
  p.intro(chalk.bold("jstack setup — Team Operations Toolkit"));

  const projectRoot = findProjectRoot();
  const pluginRoot = findPluginRoot();
  const cfgPath = configPath(projectRoot);

  const { existsSync } = await import("node:fs");
  if (existsSync(cfgPath) && !opts.reconfigure) {
    p.log.warn(`Config exists: ${cfgPath}. Use --reconfigure to overwrite sections interactively.`);
    const go = await p.confirm({ message: "Re-run setup anyway?", initialValue: false });
    if (p.isCancel(go) || !go) {
      p.outro("Skipped.");
      return;
    }
  }

  const defaults = loadDefaults(pluginRoot);
  // B3 fix: re-running setup must layer in the user's existing config, so unanswered
  // prompts don't snap back to defaults.json values and silently overwrite previous work.
  const existingCfg = (readConfigOptional(projectRoot) as unknown as Record<string, unknown> | null) ?? {};
  const layered = mergeDeep(defaults as Record<string, unknown>, existingCfg);
  const s = extractSetupSlices(layered);
  const defaultKb = s.defaultKb;
  const defaultGbrain = s.defaultGbrain;

  const teamName = await p.text({
    message: "Team name",
    placeholder:
      typeof s.defaultsTeam.name === "string" ? s.defaultsTeam.name : undefined,
  });
  if (p.isCancel(teamName)) throw new Error("cancelled");

  const tz = await p.text({
    message: "Timezone (IANA)",
    initialValue:
      typeof s.defaultsTeam.timezone === "string" ? s.defaultsTeam.timezone : "UTC",
  });
  if (p.isCancel(tz)) throw new Error("cancelled");

  const defaultsTeam = s.defaultsTeam;
  let teamForDraft = mergeDeep(defaultsTeam, {
    name: String(teamName),
    timezone: String(tz),
  });
  const rosterPatch = await promptTeamRosterSection(
    Object.keys(defaultsTeam).length ? defaultsTeam : undefined,
  );
  if (rosterPatch) {
    teamForDraft = mergeDeep(teamForDraft, rosterPatch);
  }

  const jiraKey = await p.text({
    message: "JIRA project key (optional)",
    placeholder: "ENG",
  });
  if (p.isCancel(jiraKey)) throw new Error("cancelled");

  const jiraUrl = await p.text({
    message: "JIRA base URL (optional)",
    placeholder: "https://yourorg.atlassian.net",
  });
  if (p.isCancel(jiraUrl)) throw new Error("cancelled");

  const telemetry = await p.confirm({
    message:
      "Enable anonymous plugin telemetry? (batched metadata only; machine id in ~/.jstack; eval JSONL uses JSTACK_TELEMETRY — see docs/TELEMETRY_NOTION.md)",
    initialValue: false,
  });
  if (p.isCancel(telemetry)) throw new Error("cancelled");

  const debug = await p.confirm({
    message: "Enable debug logging in skills?",
    initialValue: false,
  });
  if (p.isCancel(debug)) throw new Error("cancelled");

  let gbrainPatch: Record<string, unknown> = {};
  let sessionPatch: Record<string, unknown> = {};
  let knowledgeBasePatch: Record<string, unknown> = {};
  let knowledgeStoragePatch: Record<string, unknown> = {};

  let runGbrainKb = opts.withGbrainKb === true;
  if (!runGbrainKb) {
    const adv = await p.confirm({
      message:
        "Configure GBrain URLs and local knowledge_base roots? (team/personal memory + git-tracked docs paths)",
      initialValue: true,
    });
    if (p.isCancel(adv)) throw new Error("cancelled");
    runGbrainKb = adv;
  }

  if (runGbrainKb) {
    p.log.info(
      chalk.dim(
        "Examples: roots are paths relative to the workspace (e.g. docs, sessions, .cursor/plans). Create missing folders or fix paths later; jstack doctor will warn.",
      ),
    );

    const teamGbrainUrl = await p.text({
      message: "GBrain team base URL (optional; paste from GBrain team space)",
      initialValue: defaultGbrain.team?.url ?? "",
      placeholder: "https://…",
    });
    if (p.isCancel(teamGbrainUrl)) throw new Error("cancelled");

    const personalGbrainUrl = await p.text({
      message: "GBrain personal base URL (optional; often set only in a private overlay — see outro)",
      initialValue: defaultGbrain.personal?.url ?? "",
      placeholder: "https://…",
    });
    if (p.isCancel(personalGbrainUrl)) throw new Error("cancelled");

    const defKs = s.defKs;
    const defKsTeam = asRecord(s.defKs.team);
    const defKsPersonal = asRecord(s.defKs.personal);

    p.log.info(
      chalk.dim(
        "Git-backed KB: optional team + personal repos (clone locally). If you skip local paths, file drafts use disk under knowledge_storage.disk_fallback_root/{team|personal}/…",
      ),
    );

    const teamKbGit = await p.text({
      message: "Team knowledge Git repo URL (optional; shared GitHub org repo your team clones and pushes)",
      initialValue: String(defKsTeam.git_remote ?? ""),
      placeholder: "https://github.com/org/team-knowledge.git",
    });
    if (p.isCancel(teamKbGit)) throw new Error("cancelled");

    const teamKbPath = await p.text({
      message:
        "Team KB local checkout (optional; path relative to workspace, e.g. team-knowledge). Empty = team markdown may go only to disk fallback until you clone and set this.",
      initialValue: String(defKsTeam.local_checkout ?? ""),
      placeholder: "team-knowledge",
    });
    if (p.isCancel(teamKbPath)) throw new Error("cancelled");

    const personalKbGit = await p.text({
      message: "Personal knowledge Git repo URL (optional; private repo — often in personal overlay only)",
      initialValue: String(defKsPersonal.git_remote ?? ""),
      placeholder: "https://github.com/you/jstack-personal-kb.git",
    });
    if (p.isCancel(personalKbGit)) throw new Error("cancelled");

    const personalKbPath = await p.text({
      message: "Personal KB local checkout (optional; relative to workspace). Empty = personal markdown may use disk fallback only.",
      initialValue: String(defKsPersonal.local_checkout ?? ""),
      placeholder: "personal-knowledge",
    });
    if (p.isCancel(personalKbPath)) throw new Error("cancelled");

    const diskFallback = await p.text({
      message:
        "Disk fallback root for markdown when no local_checkout is set (team|personal subfolders, then category, then .md)",
      initialValue: String(defKs.disk_fallback_root ?? "/tmp/knowledgebase"),
    });
    if (p.isCancel(diskFallback)) throw new Error("cancelled");

    const sessionTargetRaw = s.defSession.default_gbrain_target;
    const sessionTargetInit: "team" | "personal" =
      sessionTargetRaw === "personal" ? "personal" : "team";
    const target = await p.select({
      message: "Default session GBrain target for new sessions",
      options: [
        { value: "team", label: "team — shared team space" },
        { value: "personal", label: "personal — your space" },
      ],
      initialValue: sessionTargetInit,
    });
    if (p.isCancel(target)) throw new Error("cancelled");

    const rootsHint =
      (defaultKb.roots ?? ["docs", "README.md"]).join(", ") + ", sessions, plans, tmp";
    const rootsRaw = await p.text({
      message: "Knowledge base roots (comma-separated, relative to workspace root)",
      initialValue: rootsHint,
    });
    if (p.isCancel(rootsRaw)) throw new Error("cancelled");

    const roots = uniqRoots([
      ...parseRootsInput(String(rootsRaw), defaultKb.roots ?? ["docs", "README.md"]),
      String(teamKbPath).trim(),
      String(personalKbPath).trim(),
    ]);

    const includeGbrainInSearch = await p.confirm({
      message: "Also query GBrain on knowledge-search when paths/URLs are used? (knowledge_base.gbrain.include)",
      initialValue: defaultKb.gbrain?.include === true,
    });
    if (p.isCancel(includeGbrainInSearch)) throw new Error("cancelled");

    gbrainPatch = {
      gbrain: mergeDeep(s.defGbrain, {
        team: { url: String(teamGbrainUrl).trim() },
        personal: { url: String(personalGbrainUrl).trim() },
      }),
    };

    sessionPatch = {
      session: mergeDeep(s.defSession, {
        default_gbrain_target: target,
      }),
    };

    knowledgeBasePatch = {
      knowledge_base: mergeDeep(s.defKb, {
        roots,
        gbrain: mergeDeep(s.defKbGbrain, { include: includeGbrainInSearch }),
      }),
    };

    knowledgeStoragePatch = {
      knowledge_storage: mergeDeep(defKs, {
        disk_fallback_root: String(diskFallback).trim() || "/tmp/knowledgebase",
        team: mergeDeep(defKsTeam, {
          git_remote: String(teamKbGit).trim(),
          local_checkout: String(teamKbPath).trim(),
        }),
        personal: mergeDeep(defKsPersonal, {
          git_remote: String(personalKbGit).trim(),
          local_checkout: String(personalKbPath).trim(),
        }),
      }),
    };
  }

  const discovered = discoverFromMcpJson(projectRoot);
  p.log.info(`Discovered ${Object.keys(discovered).length} MCP entries from .mcp.json`);

  let draft: Record<string, unknown> = mergeDeep(defaults, {
    team: teamForDraft,
    integrations: {
      jira: { project_key: String(jiraKey), base_url: String(jiraUrl) },
    },
    telemetry: { enabled: telemetry },
    debug: { enabled: debug },
    mcp_servers: mergeMcpRegistry(s.mcpExisting, discovered),
  });

  if (Object.keys(gbrainPatch).length) {
    draft = mergeDeep(draft, gbrainPatch);
  }
  if (Object.keys(sessionPatch).length) {
    draft = mergeDeep(draft, sessionPatch);
  }
  if (Object.keys(knowledgeBasePatch).length) {
    draft = mergeDeep(draft, knowledgeBasePatch);
  }
  if (Object.keys(knowledgeStoragePatch).length) {
    draft = mergeDeep(draft, knowledgeStoragePatch);
  }

  if (opts.pe) {
    p.log.info(chalk.bold("PE / team management"));
    const teamsRaw = await p.text({
      message: "PE team refs (comma-separated slugs; no default teams in core)",
      placeholder: "team-nova, team-pulse",
    });
    if (p.isCancel(teamsRaw)) throw new Error("cancelled");
    const keysRaw = await p.text({
      message: "Jira project keys for PE reporting (comma-separated, optional)",
      placeholder: "ENG,PLT",
    });
    if (p.isCancel(keysRaw)) throw new Error("cancelled");
    const windowDays = await p.text({
      message: "Default reporting window (days)",
      initialValue: "14",
    });
    if (p.isCancel(windowDays)) throw new Error("cancelled");
    const teams = String(teamsRaw)
      .split(/[,\n]+/)
      .map((s) => s.trim())
      .filter(Boolean);
    const jira_project_keys = String(keysRaw)
      .split(/[,\n]+/)
      .map((s) => s.trim())
      .filter(Boolean);
    const wd = Math.max(1, parseInt(String(windowDays), 10) || 14);
    draft = mergeDeep(draft, {
      pe: mergeDeep(s.defPe, {
        configured: true,
        teams,
        jira_project_keys,
        reporting_window_days: wd,
      }),
    });
  }

  let parsed;
  try {
    parsed = JstackConfigSchema.parse(draft);
  } catch (err) {
    // B4 fix: surface validation failures cleanly with no partial write.
    p.cancel(`Validation failed; nothing written. ${err instanceof Error ? err.message : String(err)}`);
    process.exitCode = 1;
    return;
  }
  writeConfig(projectRoot, parsed);

  p.outro(chalk.green(`Wrote ${cfgPath}`));
  console.log(chalk.dim("Next: run session init in the agent (e.g. /jstack:init-session), then jstack doctor"));
  console.log(
    chalk.dim(
      "Team roster + Slack/Google canonical group: skills/team/references/team-canonical-identity.md",
    ),
  );
  console.log(
    chalk.dim(
      "Personal-only GBrain URL and identity: copy config/personal.example.json → ~/.config/jstack/jstack.personal.json (do not commit private URLs to a team repo). See skills/_core/references/config-team-vs-personal.md",
    ),
  );
  console.log(chalk.dim("Next: keep CLAUDE.md sharp — /jstack:skill-creator/improve-claude-md (read-only by default)."));
}

/** Non-interactive config for CI / proof scripts (no prompts). */
export async function runSetupCi(opts: { diskFallbackRoot?: string }): Promise<void> {
  const projectRoot = findProjectRoot();
  const pluginRoot = findPluginRoot();
  const cfgPath = configPath(projectRoot);
  const defaults = loadDefaults(pluginRoot);
  const s = extractSetupSlices(defaults);
  const discovered = discoverFromMcpJson(projectRoot);
  const disk = (opts.diskFallbackRoot ?? "/tmp/knowledgebase").replace(/\/$/, "");

  let draft: Record<string, unknown> = mergeDeep(defaults, {
    team: { name: "ci-fixture", timezone: "UTC" },
    integrations: { jira: { project_key: "", base_url: "" } },
    telemetry: { enabled: false },
    debug: { enabled: false },
    mcp_servers: mergeMcpRegistry(s.mcpExisting, discovered),
    session: mergeDeep(s.defSession, { default_gbrain_target: "team", current_session_id: "" }),
    gbrain: mergeDeep(s.defGbrain, {
      team: { url: "" },
      personal: { url: "" },
    }),
    knowledge_base: mergeDeep(s.defKb, {
      roots: ["docs"],
      gbrain: { include: false },
    }),
    knowledge_storage: mergeDeep(s.defKs, {
      disk_fallback_root: disk,
      team: { git_remote: "", local_checkout: "" },
      personal: { git_remote: "", local_checkout: "" },
    }),
    pe: mergeDeep(s.defPe, {
      configured: true,
      teams: [],
      jira_project_keys: [],
    }),
  });

  mkdirSync(join(projectRoot, "docs"), { recursive: true });
  writeFileSync(join(projectRoot, ".mcp.json"), "{}\n", ENCODING_UTF8);
  const parsed = JstackConfigSchema.parse(draft);
  writeConfig(projectRoot, parsed);
  console.log(
    chalk.green(
      `[setup --ci] Wrote ${cfgPath} (team=ci-fixture, disk_fallback_root=${disk}, knowledge_base.roots=[docs])`,
    ),
  );
  console.log(chalk.dim("Next: keep CLAUDE.md sharp — /jstack:skill-creator/improve-claude-md (read-only by default)."));
}
