import chalk from "chalk";
import { findProjectRoot, readConfigOptional } from "../lib/config.js";

/** Thin CLI entrypoints; Drive/Notion MCP runs in the agent via skills. */
export function runTranscriptsStatus(): void {
  const root = findProjectRoot();
  const cfg = readConfigOptional(root) as {
    integrations?: { google_drive?: { transcripts_folder_id?: string }; transcripts?: unknown };
  } | null;
  const folder = cfg?.integrations?.google_drive?.transcripts_folder_id?.trim() ?? "";
  console.log(chalk.bold("Transcript pipeline (config snapshot)"));
  console.log(`  google_drive.transcripts_folder_id: ${folder || "(empty)"}`);
  console.log(`  integrations.transcripts: ${cfg?.integrations?.transcripts ? "set" : "(defaults only)"}`);
  console.log("");
  console.log("Use skill **jstack-transcripts-ingest** (`meetings/transcripts-ingest`) to classify and route new files.");
  console.log("Use **jstack-ingest-all** when `ingest_all[]` is configured.");
}

export function runTranscriptsIngest(): void {
  runTranscriptsStatus();
  console.log("");
  console.log(chalk.dim("This CLI does not call Google Drive MCP. Run the ingest skill in your agent host."));
}
