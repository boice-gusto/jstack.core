import { Command } from "commander";
import {
  collect,
  detect,
  readTranscriptUserPrompts,
  render,
  type CollectOutput,
  type ScoredIssue,
} from "../lib/claude-md-improver.js";
import { findProjectRoot } from "../lib/config.js";
import { homedir } from "node:os";
import { readFileSync, statSync } from "node:fs";
import { join } from "node:path";

export type ClaudeMdScanOpts = {
  projectRoot?: string;
  homeDir?: string;
  output?: "json" | "prose";
  now?: Date;
  transcriptLookbackDays?: number;
};

export async function runClaudeMdScan(opts: ClaudeMdScanOpts) {
  const projectRoot = opts.projectRoot ?? findProjectRoot(process.cwd()) ?? process.cwd();
  const homeDir = opts.homeDir ?? homedir();
  const now = opts.now ?? new Date();
  const lookback = opts.transcriptLookbackDays ?? 30;

  const collected = collect({ projectRoot, homeDir, now });
  const prompts = collected.transcript_dir
    ? readTranscriptUserPrompts(collected.transcript_dir, now, lookback)
    : [];
  const result = detect(collected, prompts, []);
  return render(
    { collected, scored: result.scored, generated_at: now.toISOString() },
    opts.output ?? "prose",
  );
}

export type ClaudeMdRenderOpts = { inputPath: string; output: "prose" | "patch" };

export async function runClaudeMdRender(opts: ClaudeMdRenderOpts) {
  const payload = JSON.parse(readFileSync(opts.inputPath, "utf8"));
  if (opts.output === "patch") {
    const hunks: string[] = (payload.recommendations ?? [])
      .map((r: { diff_hunk: string }) => r.diff_hunk)
      .filter(Boolean);
    return { format: "patch" as const, text: hunks.join("\n") + "\n" };
  }
  // prose: simple bullet list (the SKILL.md formats the rich version)
  const lines: string[] = [];
  lines.push(`# CLAUDE.md Improvements (final)`);
  for (const r of payload.recommendations ?? []) {
    lines.push(`- ${r.issue_id} (${r.category}) — ${r.benefit}`);
  }
  return { format: "prose" as const, text: lines.join("\n") + "\n" };
}

export type ClaudeMdApplyOpts = {
  projectRoot: string;
  patchPath: string;
  scanMtimeMs: number;
  yes: boolean;
};

export async function runClaudeMdApply(opts: ClaudeMdApplyOpts) {
  const claudePath = join(opts.projectRoot, "CLAUDE.md");
  const currentMtime = statSync(claudePath).mtimeMs;
  // Allow up to 1s clock skew tolerance.
  if (currentMtime - opts.scanMtimeMs > 1000) {
    return { applied: false, reason: "CLAUDE.md changed since scan — re-run the improver." };
  }
  if (!opts.yes) {
    return { applied: false, reason: "--apply requires --yes (or interactive confirmation)." };
  }
  // Defer the actual `git apply` to the SKILL.md so the CLI does not assume a git repo state.
  // Return the command for the caller to run.
  return {
    applied: false,
    reason: "ready",
    command: `git -C ${opts.projectRoot} apply ${opts.patchPath} && git -C ${opts.projectRoot} add CLAUDE.md && git -C ${opts.projectRoot} commit -m "chore: apply CLAUDE.md improver patch"`,
  };
}

export function registerClaudeMdCommand(program: Command): void {
  const cmd = program.command("claude-md").description("CLAUDE.md improvement workflow (read-only by default)");
  cmd
    .command("scan")
    .description("Scan the project and emit issues (no LLM, no patch). Used by the SKILL.md.")
    .option("--output <fmt>", "json | prose", "prose")
    .action(async (o: { output?: string }) => {
      const out = await runClaudeMdScan({ output: (o.output as "json" | "prose") ?? "prose" });
      process.stdout.write(out.text + (out.format === "prose" ? "" : "\n"));
    });
  cmd
    .command("render")
    .description("Render final-edits JSON as prose or unified patch.")
    .option("--input <path>", "final-edits JSON", "")
    .option("--output <fmt>", "prose | patch", "patch")
    .action(async (o: { input?: string; output?: string }) => {
      if (!o.input) {
        process.stderr.write("--input required\n");
        process.exit(2);
      }
      const out = await runClaudeMdRender({ inputPath: o.input, output: (o.output as "prose" | "patch") ?? "patch" });
      process.stdout.write(out.text);
    });
  cmd
    .command("apply")
    .description("Validate scan freshness and emit the git-apply command.")
    .option("--patch <path>", "patch file path")
    .option("--scan-mtime <ms>", "epoch ms of CLAUDE.md at scan time")
    .option("--yes", "skip confirmation", false)
    .action(async (o: { patch?: string; scanMtime?: string; yes?: boolean }) => {
      const result = await runClaudeMdApply({
        projectRoot: findProjectRoot(process.cwd()) ?? process.cwd(),
        patchPath: o.patch ?? "",
        scanMtimeMs: Number(o.scanMtime ?? "0"),
        yes: !!o.yes,
      });
      if (result.applied) process.stdout.write("applied\n");
      else process.stdout.write(JSON.stringify(result) + "\n");
    });
}
