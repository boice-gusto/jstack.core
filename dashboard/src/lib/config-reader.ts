import { readFileSync, existsSync } from "node:fs";
import { join } from "node:path";
import { ENCODING_UTF8, JSTACK_CONFIG_FILE } from "@jstack/constants/paths";

export function readJstackConfig(cwd: string): unknown | null {
  const p = join(cwd, "..", JSTACK_CONFIG_FILE);
  if (!existsSync(p)) return null;
  return JSON.parse(readFileSync(p, ENCODING_UTF8));
}
