import { z } from "zod";

export const CliArgumentSchema = z.object({
  name: z.string(),
  type: z.enum(["string", "number", "boolean"]),
  required: z.boolean(),
  default: z.union([z.string(), z.number(), z.boolean()]).optional(),
  description: z.string(),
});

export const CliExampleSchema = z.object({
  command: z.string(),
  description: z.string(),
  output: z.string().optional(),
});

export const CliCommandSchema = z.object({
  name: z.string(),
  description: z.string(),
  tags: z.array(z.string()),
  arguments: z.array(CliArgumentSchema),
  examples: z.array(CliExampleSchema),
  returns: z.string(),
});

export type CliCommand = z.infer<typeof CliCommandSchema>;

export const CLI_COMMANDS: CliCommand[] = [
  {
    name: "jstack setup",
    description: "Interactive wizard: team config, MCP discovery, writes jstack.config.json",
    tags: ["setup", "onboarding", "mcp"],
    arguments: [
      {
        name: "--reconfigure",
        type: "boolean",
        required: false,
        default: false,
        description: "Re-run even if config exists",
      },
      {
        name: "--with-gbrain-kb",
        type: "boolean",
        required: false,
        default: false,
        description: "Always prompt for GBrain URLs and knowledge_base.roots",
      },
      {
        name: "--pe",
        type: "boolean",
        required: false,
        default: false,
        description: "Also configure PE / team management keys (pe.*)",
      },
    ],
    examples: [
      { command: "jstack setup", description: "First-time setup" },
      { command: "jstack setup --with-gbrain-kb", description: "Include GBrain + knowledge roots prompts" },
      { command: "jstack setup --pe", description: "Include PE / team report context prompts" },
    ],
    returns: "Config files on disk",
  },
  {
    name: "jstack mcp",
    description: "List, health-check, refresh MCP registry",
    tags: ["mcp", "integrations"],
    arguments: [
      {
        name: "action",
        type: "string",
        required: true,
        description: "list | health | refresh | add | remove",
      },
    ],
    examples: [
      { command: "jstack mcp list", description: "Show servers and tools" },
      { command: "jstack mcp refresh", description: "Re-scan .mcp.json / config" },
      { command: "jstack mcp add", description: "Interactive preset picker when server omitted (TTY)" },
      { command: "jstack mcp add notion", description: "Append Notion preset to .mcp.json and sync config" },
      { command: "jstack mcp add glean", description: "Append Glean MCP preset (GLEAN_INSTANCE + GLEAN_API_TOKEN)" },
      { command: "jstack mcp add gdrive", description: "Append Google Drive MCP preset" },
      { command: "jstack mcp remove", description: "Interactive picker when server omitted (TTY)" },
      { command: "jstack mcp remove notion", description: "Remove server from .mcp.json and config registry" },
    ],
    returns: "MCP registry summary",
  },
  {
    name: "jstack time",
    description: "Emit current time, timezone, optional sprint context (JSON/human)",
    tags: ["time", "timezone", "sprint"],
    arguments: [
      {
        name: "--format",
        type: "string",
        required: false,
        default: "human",
        description: "human | iso | unix | json",
      },
      {
        name: "--sprint",
        type: "boolean",
        required: false,
        default: false,
        description: "Include sprint placeholders from config",
      },
    ],
    examples: [{ command: "jstack time --format json", description: "LLM-friendly output" }],
    returns: "Time context object",
  },
  {
    name: "jstack docs",
    description:
      "Regenerate skill catalog / static docs: generate (skill-catalog.json, skills-data.js), build, serve, preview",
    tags: ["docs", "skills", "dev"],
    arguments: [
      {
        name: "subcommand",
        type: "string",
        required: true,
        description: "generate | build | serve | preview",
      },
    ],
    examples: [
      { command: "jstack docs generate", description: "Same as bun run docs:generate from jstack.core" },
      { command: "jstack docs serve", description: "Same as bun run docs:serve (local preview)" },
      { command: "jstack docs preview", description: "Build then serve" },
    ],
    returns: "Writes files under plugin root; exit 0 or 1",
  },
  {
    name: "jstack eval",
    description:
      "Skill evals: run (full local check), validate, coverage, structural, chain, gate, report, semantic",
    tags: ["eval", "test", "quality"],
    arguments: [
      {
        name: "subcommand",
        type: "string",
        required: true,
        description:
          "run | quick | validate | coverage | structural | chain | gate | report | semantic",
      },
    ],
    examples: [
      { command: "jstack eval run", description: "Structural + chain + YAML validate + coverage (no API)" },
      { command: "jstack eval validate", description: "Lint eval YAML only" },
      { command: "jstack eval semantic --skill setup", description: "LLM grading (requires API key)" },
    ],
    returns: "Console report; semantic writes evals/.reports/",
  },
  {
    name: "jstack doctor",
    description: "Validate jstack.config.json, plugin layout, optional MCP file; warn on GBrain/knowledge_base issues",
    tags: ["setup", "health"],
    arguments: [
      {
        name: "--fix",
        type: "boolean",
        required: false,
        default: false,
        description: "Reserved for auto-fix (not implemented)",
      },
      {
        name: "--strict",
        type: "boolean",
        required: false,
        default: false,
        description: "Treat GBrain URL and knowledge_base root warnings as failures",
      },
      {
        name: "--json",
        type: "boolean",
        required: false,
        default: false,
        description: "Machine-readable report (version, upgrade_available, distribution, warnings)",
      },
    ],
    examples: [
      { command: "jstack doctor", description: "Standard checks + warnings" },
      { command: "jstack doctor --strict", description: "Fail on missing roots or URL/target mismatch" },
      { command: "jstack doctor --json", description: "CI / agent-friendly JSON" },
    ],
    returns: "Exit 0 or 1",
  },
  {
    name: "jstack config",
    description: "Print jstack.config.json (resolved path)",
    tags: ["config"],
    arguments: [],
    examples: [{ command: "jstack config", description: "Show effective config" }],
    returns: "Config JSON",
  },
  {
    name: "jstack status",
    description: "Team + plugin status summary",
    tags: ["status"],
    arguments: [],
    examples: [{ command: "jstack status", description: "Quick health snapshot" }],
    returns: "Human-readable status",
  },
  {
    name: "jstack skills index",
    description: "List all SKILL.md under skills/ (optional second plugin via --overlay)",
    tags: ["skills", "agents"],
    arguments: [
      {
        name: "--json",
        type: "boolean",
        required: false,
        default: false,
        description: "JSON lines output",
      },
      {
        name: "--overlay",
        type: "string",
        required: false,
        description: "Second plugin root (e.g. jstack.gusto checkout)",
      },
    ],
    examples: [
      { command: "jstack skills index", description: "List skills" },
      { command: "jstack skills index --json", description: "Machine-readable list" },
      { command: "jstack skills browse", description: "Interactive select one skill (TTY)" },
      { command: "jstack skills pick", description: "Filter substring then pick (TTY)" },
    ],
    returns: "Skill id + path list",
  },
  {
    name: "jstack skills browse",
    description: "Interactive select from skills index (prints path + hint); --json matches skills index",
    tags: ["skills", "agents"],
    arguments: [
      {
        name: "--json",
        type: "boolean",
        required: false,
        default: false,
        description: "Same output as skills index",
      },
      {
        name: "--overlay",
        type: "string",
        required: false,
        description: "Second plugin root",
      },
    ],
    examples: [{ command: "jstack skills browse", description: "Pick one skill from list" }],
    returns: "Chosen skill path + hint",
  },
  {
    name: "jstack skills pick",
    description: "Filter skills by substring then pick one; --json matches skills index",
    tags: ["skills", "agents"],
    arguments: [
      {
        name: "--json",
        type: "boolean",
        required: false,
        default: false,
        description: "Same output as skills index",
      },
      {
        name: "--overlay",
        type: "string",
        required: false,
        description: "Second plugin root",
      },
    ],
    examples: [{ command: "jstack skills pick", description: "Search then select" }],
    returns: "Chosen skill path + hint",
  },
  {
    name: "jstack skills show",
    description: "Resolve skill id or path fragment to SKILL.md metadata",
    tags: ["skills", "agents"],
    arguments: [
      {
        name: "id",
        type: "string",
        required: true,
        description: "Frontmatter name or path fragment",
      },
      {
        name: "--json",
        type: "boolean",
        required: false,
        default: false,
        description: "JSON output",
      },
      {
        name: "--overlay",
        type: "string",
        required: false,
        description: "Second plugin root",
      },
    ],
    examples: [{ command: "jstack skills show jstack-doctor", description: "Resolve one skill" }],
    returns: "Path + description",
  },
  {
    name: "jstack report render",
    description: "Merge ReportPayload JSON into static HTML shell (Tailwind CDN + branding CSS)",
    tags: ["reports", "html"],
    arguments: [
      {
        name: "--data",
        type: "string",
        required: true,
        description: "Path to report JSON file",
      },
      {
        name: "--out",
        type: "string",
        required: true,
        description: "Output HTML path",
      },
      {
        name: "--shell",
        type: "string",
        required: false,
        description: "Override shell HTML path",
      },
    ],
    examples: [
      {
        command: "jstack report render --data ./out/payload.json --out ./out/report.html",
        description: "Build shareable HTML",
      },
    ],
    returns: "HTML file on disk",
  },
  {
    name: "jstack schedule",
    description: "List / enable / disable routines (cron-backed stubs)",
    tags: ["routines", "schedule"],
    arguments: [
      {
        name: "action",
        type: "string",
        required: true,
        description: "list | enable [id] | disable [id] (interactive picker when id omitted, TTY)",
      },
    ],
    examples: [
      { command: "jstack schedule list", description: "Show routines" },
      { command: "jstack schedule enable", description: "Interactive routine picker when id omitted (TTY)" },
      { command: "jstack schedule enable standup", description: "Turn on a routine" },
      { command: "jstack schedule disable", description: "Interactive routine picker when id omitted (TTY)" },
      { command: "jstack schedule disable standup", description: "Turn off a routine" },
    ],
    returns: "Console confirmation",
  },
  {
    name: "jstack workflow",
    description:
      "Browser workflows: CRUD on config/workflows/*.json; create prompts for URL when interactive; run previews unless --yes; delete confirms unless --force",
    tags: ["workflow", "browser"],
    arguments: [
      {
        name: "subcommand",
        type: "string",
        required: true,
        description:
          "list [--json] | show <id> [--json] | create <id> [--url] | run <id> [--yes] | delete <id> [--force] | export <id> --out | import --file | edit <id> [--url] [--name]",
      },
    ],
    examples: [
      { command: "jstack workflow list --json", description: "Machine-readable inventory" },
      { command: "jstack workflow create my-flow", description: "Prompt for start URL when TTY" },
      { command: "jstack workflow run my-flow", description: "Preview + confirm when TTY (omit --yes)" },
      { command: "jstack workflow export my-flow --out /tmp/wf.json", description: "Copy definition" },
      { command: "jstack workflow import --file /tmp/wf.json", description: "Install from file" },
    ],
    returns: "Workflow JSON on disk; stub runner log",
  },
  {
    name: "jstack transcripts",
    description: "Print transcript pipeline config snapshot; ingest is skill-driven (MCP)",
    tags: ["meetings", "transcripts"],
    arguments: [
      {
        name: "subcommand",
        type: "string",
        required: true,
        description: "status | ingest",
      },
    ],
    examples: [
      { command: "jstack transcripts status", description: "Show google_drive / transcripts config keys" },
    ],
    returns: "Console hints + skill ids",
  },
  {
    name: "jstack upgrade",
    description: "Reserved / placeholder upgrade hook",
    tags: ["upgrade"],
    arguments: [],
    examples: [{ command: "jstack upgrade", description: "Run upgrade helper if implemented" }],
    returns: "Console message",
  },
  {
    name: "jstack --help-json",
    description:
      "Print structured CLI registry (commands, flags, examples) for agents — argv must include --help-json before subcommands",
    tags: ["meta", "agents"],
    arguments: [],
    examples: [{ command: "jstack --help-json", description: "Machine-readable command registry" }],
    returns: "JSON { version, commands }",
  },
  {
    name: "jstack telemetry",
    description: "Telemetry buffer status / flush / reset / test (opt-in)",
    tags: ["telemetry", "privacy"],
    arguments: [
      {
        name: "action",
        type: "string",
        required: true,
        description: "status | flush | reset | test",
      },
    ],
    examples: [
      { command: "jstack telemetry status", description: "Show buffer + config hints" },
      {
        command: "jstack telemetry test",
        description: "Append anonymous self-test line to JSONL; see docs/TELEMETRY_NOTION.md",
      },
    ],
    returns: "Telemetry status or JSON",
  },
];

export function cliRegistryJson(): string {
  return JSON.stringify({ version: "0.1.0", commands: CLI_COMMANDS }, null, 2);
}
